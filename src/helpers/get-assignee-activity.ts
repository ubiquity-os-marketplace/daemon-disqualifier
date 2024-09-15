import { DateTime } from "luxon";
import { collectLinkedPullRequests } from "../handlers/collect-linked-pulls";
import { Context } from "../types/context";
import { parseIssueUrl } from "./github-url";
import { GitHubTimelineEvents, ListIssueForRepo } from "../types/github-types";

/**
 * Retrieves all the activity for users that are assigned to the issue. Also takes into account linked pull requests.
 */
export async function getAssigneesActivityForIssue(context: Context, issue: ListIssueForRepo, assigneeIds: number[]) {
  const gitHubUrl = parseIssueUrl(issue.html_url);
  const issueEvents: GitHubTimelineEvents[] = await context.octokit.paginate(context.octokit.rest.issues.listEventsForTimeline, {
    owner: gitHubUrl.owner,
    repo: gitHubUrl.repo,
    issue_number: gitHubUrl.issue_number,
    per_page: 100,
  });
  const linkedPullRequests = await collectLinkedPullRequests(context, gitHubUrl);
  for (const linkedPullRequest of linkedPullRequests) {
    const { owner, repo, issue_number } = parseIssueUrl(linkedPullRequest.url || "");
    const events: GitHubTimelineEvents[] = await context.octokit.paginate(context.octokit.rest.issues.listEventsForTimeline, {
      owner,
      repo,
      issue_number,
      per_page: 100,
    });
    issueEvents.push(...events);
  }

  return filterEvents(issueEvents, assigneeIds, context);
}

function filterEvents(issueEvents: GitHubTimelineEvents[], assigneeIds: number[], context: Context) {
  const userIdMap = new Map<string, number>();

  let assigneeEvents = [];

  for (const event of issueEvents) {
    let actorId = null;
    let actorLogin = null;
    let createdAt = "UNKNOWN";
    let eventName = event.event;

    if ("actor" in event && event.actor) {
      actorLogin = event.actor.login.toLowerCase();
      if (!userIdMap.has(actorLogin)) {
        userIdMap.set(actorLogin, event.actor.id);
      }
      actorId = userIdMap.get(actorLogin);
      createdAt = event.created_at;
    } else if (event.event === "committed") {
      const commitAuthor = "author" in event ? event.author : null;
      const commitCommitter = "committer" in event ? event.committer : null;

      if (commitAuthor && commitCommitter && commitAuthor.name === commitCommitter.name) {
        actorLogin = commitAuthor.name.toLowerCase();
        if (!userIdMap.has(actorLogin)) {
          const { id, name } = parseGitHubEmail(commitAuthor.email);
          actorLogin = name.toLowerCase();
          userIdMap.set(actorLogin, id);
        }
        actorId = userIdMap.get(actorLogin);
        createdAt = commitCommitter.date;
        eventName = "committed";
      }
    }

    if (actorId && assigneeIds.includes(actorId)) {
      assigneeEvents.push({
        event: eventName,
        created_at: createdAt,
        actor: actorLogin,
      });
    }
  }

  return assigneeEvents.sort((a, b) => {
    return DateTime.fromISO(b.created_at).toMillis() - DateTime.fromISO(a.created_at).toMillis();
  });
}

// 0000000+userLogin@users.noreply.github.com
function parseGitHubEmail(email: string) {
  const idName = email.split("@")[0];

  const [id, name] = idName.split("+");

  return {
    id: parseInt(id),
    name,
  };
}