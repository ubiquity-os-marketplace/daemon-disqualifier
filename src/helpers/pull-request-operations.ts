export const MUTATION_PULL_REQUEST_TO_DRAFT = /* GraphQL */ `
  mutation ConvertPullRequestToDraft($input: ConvertPullRequestToDraftInput!) {
    convertPullRequestToDraft(input: $input) {
      pullRequest {
        id
        isDraft
      }
    }
  }
`;

export const QUERY_PULL_REQUEST = /* GraphQL */ `
  query PullRequest($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        id
        reviewDecision
      }
    }
  }
`;
