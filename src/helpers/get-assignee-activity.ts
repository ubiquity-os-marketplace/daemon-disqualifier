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

  return filterEvents(issueEvents, assigneeIds);
}

function filterEvents(issueEvents: GitHubTimelineEvents[], assigneeIds: number[]) {
  const userIdMap = new Map<string, number>();

  let assigneeEvents = [];

  for (const event of issueEvents) {
    let actorId = null;
    let actorLogin = null;
    let createdAt = null;
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
      const commitCommiter = "committer" in event ? event.committer : null;

      if (commitAuthor || commitCommiter) {
        assigneeEvents.push({
          event: eventName,
          created_at: createdAt,
        });

        continue;
      }
    }

    if (actorId && assigneeIds.includes(actorId)) {
      assigneeEvents.push({
        event: eventName,
        created_at: createdAt,
      });
    }
  }

  return assigneeEvents.sort((a, b) => {
    if (!a.created_at || !b.created_at) {
      return 0;
    }
    return DateTime.fromISO(b.created_at).toMillis() - DateTime.fromISO(a.created_at).toMillis();
  });
}
