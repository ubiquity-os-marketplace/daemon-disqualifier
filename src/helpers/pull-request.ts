import { Repository } from "@octokit/graphql-schema";
import { ListIssueForRepo } from "../types/github-types";
import { ContextPlugin } from "../types/plugin-input";
import { collectLinkedPullRequests } from "./collect-linked-pulls";
import { parseIssueUrl } from "./github-url";
import { QUERY_PULL_REQUEST } from "./pull-request-operations";

export async function areLinkedPullRequestsApproved(context: ContextPlugin, issue: ListIssueForRepo) {
  const { octokit, logger } = context;
  const { repo, owner, issue_number } = parseIssueUrl(issue.html_url);

  const pullRequestsFromAssignees = (
    await collectLinkedPullRequests(context, {
      repo,
      owner,
      issue_number,
    })
  ).filter((o) => issue.assignees?.some((assignee) => assignee.id === o.author.id));

  for (const pullRequest of pullRequestsFromAssignees) {
    const { owner: prOwner, repo: prRepo, issue_number: prNumber } = parseIssueUrl(pullRequest.url);
    try {
      const data = await octokit.graphql<{ repository: Repository }>(QUERY_PULL_REQUEST, {
        owner: prOwner,
        name: prRepo,
        number: prNumber,
      });
      logger.debug(`Pull request ${pullRequest.url} review decision: ${data.repository.pullRequest?.reviewDecision}`);
      if (data.repository.pullRequest?.reviewDecision !== "APPROVED") {
        return false;
      }
    } catch (e) {
      logger.error(`Could not get pull-request approval state ${pullRequest.url}.`, { e });
    }
  }
  return true;
}
