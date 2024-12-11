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
