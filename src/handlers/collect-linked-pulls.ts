import { parseIssueUrl } from "../helpers/github-url";
import { Context } from "../types/context";
import { GitHubLinkEvent, GitHubTimelineEvent, isGitHubLinkEvent } from "../types/github-types";

export type IssueParams = ReturnType<typeof parseIssueUrl>;

export async function collectLinkedPullRequests(context: Context, issue: IssueParams) {
  const onlyPullRequests = await collectLinkedPulls(context, issue);
  return onlyPullRequests.filter((event) => {
    if (!event.source.issue.body) {
      return false;
    }
    // Matches all keywords according to the docs:
    // https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue#linking-a-pull-request-to-an-issue-using-a-keyword
    // Works on multiple linked issues, and matches #<number> or URL patterns
    const linkedIssueRegex =
      /\b(?:Close(?:s|d)?|Fix(?:es|ed)?|Resolve(?:s|d)?):?\s+(?:#(\d+)|https?:\/\/(?:www\.)?github\.com\/(?:[^/\s]+\/[^/\s]+\/(?:issues|pull)\/(\d+)))\b/gi;
    const linkedPrUrls = event.source.issue.body.match(linkedIssueRegex);
    if (!linkedPrUrls) {
      return false;
    }
    let isClosingPr = false;
    for (let i = 0; i < linkedPrUrls.length && !isClosingPr; ++i) {
      const idx = linkedPrUrls[i].indexOf("#");
      if (idx !== -1) {
        isClosingPr = Number(linkedPrUrls[i].slice(idx + 1)) === issue.issue_number;
      } else {
        const url = linkedPrUrls[i].match(/https.+/)?.[0];
        if (url) {
          const linkedRepo = parseIssueUrl(url);
          isClosingPr = linkedRepo.issue_number === issue.issue_number && linkedRepo.repo === issue.repo && linkedRepo.owner === issue.owner;
        }
      }
    }
    return isGitHubLinkEvent(event) && event.source.issue.pull_request?.merged_at === null && isClosingPr;
  });
}

export async function collectLinkedPulls(context: Context, issue: IssueParams) {
  const issueLinkEvents = await getLinkedEvents(context, issue);
  const onlyConnected = eliminateDisconnects(issueLinkEvents);
  return onlyConnected.filter((event) => isGitHubLinkEvent(event) && event.source.issue.pull_request);
}

function eliminateDisconnects(issueLinkEvents: GitHubLinkEvent[]) {
  // Track connections and disconnections
  const connections = new Map<number, GitHubLinkEvent>(); // Use issue/pr number as key for easy access
  const disconnections = new Map<number, GitHubLinkEvent>(); // Track disconnections

  issueLinkEvents.forEach((issueEvent: GitHubLinkEvent) => {
    const issueNumber = issueEvent.source.issue.number as number;

    if (issueEvent.event === "connected" || issueEvent.event === "cross-referenced") {
      // Only add to connections if there is no corresponding disconnected event
      if (!disconnections.has(issueNumber)) {
        connections.set(issueNumber, issueEvent);
      }
    } else if (issueEvent.event === "disconnected") {
      disconnections.set(issueNumber, issueEvent);
      // If a disconnected event is found, remove the corresponding connected event
      if (connections.has(issueNumber)) {
        connections.delete(issueNumber);
      }
    }
  });

  return Array.from(connections.values());
}

async function getLinkedEvents(context: Context, params: IssueParams): Promise<GitHubLinkEvent[]> {
  const issueEvents = await getAllTimelineEvents(context, params);
  return issueEvents.filter(isGitHubLinkEvent);
}

export async function getAllTimelineEvents({ octokit }: Context, issueParams: IssueParams): Promise<GitHubTimelineEvent[]> {
  const options = octokit.issues.listEventsForTimeline.endpoint.merge(issueParams);
  return await octokit.paginate(options);
}
