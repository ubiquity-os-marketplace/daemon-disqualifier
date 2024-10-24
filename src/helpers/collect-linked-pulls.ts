import { PullRequest, User, validate } from "@octokit/graphql-schema";
import { ContextPlugin } from "../types/plugin-input";

type closedByPullRequestsReferences = {
  node: Pick<PullRequest, "url" | "title" | "number" | "state" | "body"> & Pick<User, "login" | "id">;
};

type IssueWithClosedByPRs = {
  repository: {
    issue: {
      closedByPullRequestsReferences: {
        edges: closedByPullRequestsReferences[];
      };
    };
  };
};

const query = /* GraphQL */ `
  query collectLinkedPullRequests($owner: String!, $repo: String!, $issue_number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issue_number) {
        closedByPullRequestsReferences(first: 100, includeClosedPrs: false) {
          edges {
            node {
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
  }
) {
  const { owner, repo, issue_number } = issue;
  const result = await context.octokit.graphql<IssueWithClosedByPRs>(query, {
    owner,
    repo,
    issue_number,
  });

  return result.repository.issue.closedByPullRequestsReferences.edges.map((edge) => edge.node);
}
