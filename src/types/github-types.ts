import { RestEndpointMethodTypes } from "@octokit/rest";

export type GitHubIssue = RestEndpointMethodTypes["issues"]["get"]["response"]["data"];
export type GitHubPullRequest = RestEndpointMethodTypes["pulls"]["get"]["response"]["data"];
export type GitHubTimelineEvent = RestEndpointMethodTypes["issues"]["listEventsForTimeline"]["response"]["data"][0];
export type GitHubRepository = RestEndpointMethodTypes["repos"]["get"]["response"]["data"];
export type ListForOrg = RestEndpointMethodTypes["repos"]["listForOrg"]["response"]
export type ListIssueForRepo = RestEndpointMethodTypes["issues"]["listForRepo"]["response"]["data"][0];
export type ListCommentsForIssue = RestEndpointMethodTypes["issues"]["listComments"]["response"]["data"][0];
export type GitHubListEvents = RestEndpointMethodTypes["issues"]["listEvents"]["response"]["data"][0];

type LinkPullRequestDetail = {
  url: string;
  html_url: string;
  diff_url: string;
  patch_url: string;
  merged_at: string;
};

type SourceIssueWithPullRequest = GitHubIssue | ((GitHubPullRequest & { pull_request: LinkPullRequestDetail }) & { repository: GitHubRepository });

export type GitHubLinkEvent = RestEndpointMethodTypes["issues"]["listEventsForTimeline"]["response"]["data"][0] & {
  event: "connected" | "disconnected" | "cross-referenced";
  source: { issue: SourceIssueWithPullRequest };
};
export function isGitHubLinkEvent(event: GitHubTimelineEvent): event is GitHubLinkEvent {
  return "source" in event;
}
