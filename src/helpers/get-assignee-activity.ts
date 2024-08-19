import { DateTime } from "luxon";
import { collectLinkedPullRequests } from "../handlers/collect-linked-pulls";
import { Context } from "../types/context";
import { parseIssueUrl } from "./github-url";
import { GitHubListEvents, ListIssueForRepo } from "../types/github-types";

/**
 * Retrieves all the activity for users that are assigned to the issue. Also takes into account linked pull requests.
 */
export async function getAssigneesActivityForIssue(context: Context, issue: ListIssueForRepo, assigneeIds: number[]) {
    const gitHubUrl = parseIssueUrl(issue.html_url);
    const issueEvents: GitHubListEvents[] = await context.octokit.paginate(context.octokit.rest.issues.listEvents, {
        owner: gitHubUrl.owner,
        repo: gitHubUrl.repo,
        issue_number: gitHubUrl.issue_number,
        per_page: 100,
    });
    const linkedPullRequests = await collectLinkedPullRequests(context, gitHubUrl);
    for (const linkedPullRequest of linkedPullRequests) {
        const { owner, repo, issue_number } = parseIssueUrl(linkedPullRequest.url || "");
        const events = await context.octokit.paginate(context.octokit.rest.issues.listEvents, {
            owner,
            repo,
            issue_number,
            per_page: 100,
        });
        issueEvents.push(...events);
    }

    return issueEvents
        .reduce((acc, event) => {
            if (event.actor && event.actor.id) {
                if (assigneeIds.includes(event.actor.id)) acc.push(event);
            }
            return acc;
        }, [] as GitHubListEvents[])
        .sort((a, b) => DateTime.fromISO(b.created_at).toMillis() - DateTime.fromISO(a.created_at).toMillis());
}