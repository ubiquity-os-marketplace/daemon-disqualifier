import { Repository } from "@octokit/graphql-schema";
import { ListIssueForRepo } from "../types/github-types";
import { ContextPlugin } from "../types/plugin-input";
import { collectLinkedPullRequests } from "./collect-linked-pulls";
import { parseIssueUrl } from "./github-url";
import { QUERY_PULL_REQUEST } from "./pull-request-operations";

export function isPullRequestFromAssignee(
  pullRequest: { author?: { id?: number; login?: string } | null },
  issue: ListIssueForRepo
): boolean {
  if (!issue.assignees?.length || !pullRequest.author) {
    return false;
  }
  return issue.assignees.some((assignee) => {
    if (assignee.id && pullRequest.author?.id && assignee.id === pullRequest.author.id) {
      return true;
    }
    if (
      assignee.login &&
      pullRequest.author?.login &&
      assignee.login.toLowerCase() === pullRequest.author.login.toLowerCase()
    ) {
      return true;
    }
    return false;
  });
}

export async function areLinkedPullRequestsApproved(context: ContextPlugin, issue: ListIssueForRepo) {
  const { octokit, logger } = context;
  const { repo, owner, issue_number } = parseIssueUrl(issue.html_url);

  const pullRequestsFromAssignees = (
    await collectLinkedPullRequests(context, {
      repo,
      owner,
      issue_number,
    })
  ).filter((o) => isPullRequestFromAssignee(o, issue));

  for (const pullRequest of pullRequestsFromAssignees) {
    const { owner: prOwner, repo: prRepo, issue_number: prNumber } = parseIssueUrl(pullRequest.url);
    try {
      const data = await octokit.graphql<{ repository: Repository }>(QUERY_PULL_REQUEST, {
        owner: prOwner,
        name: prRepo,
        number: prNumber,
      });
      logger.info(`Pull request ${pullRequest.url} review decision: ${data.repository.pullRequest?.reviewDecision}`);
      if (data.repository.pullRequest?.reviewDecision === "APPROVED") {
        return true;
      }
    } catch (e) {
      logger.error(`Could not get pull-request approval state ${pullRequest.url}.`, { e });
    }
  }
  return false;
}
