import { RestEndpointMethodTypes } from "@octokit/rest";

export type ListIssueForRepo = RestEndpointMethodTypes["issues"]["listForRepo"]["response"]["data"][0];
export type GitHubTimelineEvents = RestEndpointMethodTypes["issues"]["listEventsForTimeline"]["response"]["data"][0];
