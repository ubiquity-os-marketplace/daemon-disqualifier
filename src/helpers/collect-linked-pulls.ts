import { PullRequest, validate } from "@octokit/graphql-schema";
import { ContextPlugin } from "../types/plugin-input";

type ClosedByPullRequestsReferences = {
  node: Pick<PullRequest, "url" | "title" | "number" | "state" | "body" | "id" | "reviewDecision"> & { author: { login: string; id: number } };
};

type IssueWithClosedByPrs = {
  repository: {
    issue: {
      closedByPullRequestsReferences: {
        edges: ClosedByPullRequestsReferences[];
      };
    };
  };
};

const query = /* GraphQL */ `
  query collectLinkedPullRequests($owner: String!, $repo: String!, $issue_number: Int!, $includeClosedPrs: Boolean = false) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issue_number) {
        closedByPullRequestsReferences(first: 100, includeClosedPrs: $includeClosedPrs) {
          edges {
            node {
              id
              url
              title
              body
              state
              number
              author {
                login
                ... on User {
                  id: databaseId
                }
              }
              reviewDecision
            }
          }
        }
      }
    }
  }
`;

const queryErrors = validate(query);

/**
 * > 1 because the schema package is slightly out of date and does not include the
 * `closedByPullRequestsReferences` object in the schema as it is a recent addition to the GitHub API.
 */
if (queryErrors.length > 1) {
  throw new Error(`Invalid query: ${queryErrors.join(", ")}`);
}

export async function collectLinkedPullRequests(
  context: ContextPlugin,
  issue: {
    owner: string;
    repo: string;
    issue_number: number;
  },
  includeClosedPrs = false
) {
  const { owner, repo, issue_number } = issue;
  const result = await context.octokit.graphql<IssueWithClosedByPrs>(query, {
    owner,
    repo,
    issue_number,
    includeClosedPrs,
  });

  return result.repository.issue.closedByPullRequestsReferences.edges.map((edge) => edge.node);
}
