import { parseIssueUrl } from "../helpers/github-url";
import { Context } from "../types/context";
import { IssuesSearch } from "../types/github-types";

export type IssueParams = ReturnType<typeof parseIssueUrl>;

// cannot use more than 5 AND / OR / NOT operators in a query
function additionalBooleanFilters(issueNumber: number) {
  return `in:body "closes #${issueNumber}" OR "fixes #${issueNumber}" OR "resolves #${issueNumber}"`;
}

export async function collectLinkedPullRequests(context: Context, issue: IssueParams) {
  return (await context.octokit.paginate(context.octokit.rest.search.issuesAndPullRequests, {
    q: `repo:${issue.owner}/${issue.repo} is:pr is:open ${additionalBooleanFilters(issue.issue_number)}`,
    per_page: 100,
  })) as IssuesSearch[];
}
