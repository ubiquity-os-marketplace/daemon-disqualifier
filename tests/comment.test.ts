import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { RestEndpointMethodTypes } from "@octokit/rest";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { ListIssueForRepo } from "../src/types/github-types";
import { ContextPlugin } from "../src/types/plugin-input";

jest.unstable_mockModule("../src/helpers/collect-linked-pulls", () => []);
jest.unstable_mockModule("../src/helpers/github-url", () => ({
  parseIssueUrl: jest.fn(() => ({
    repo: "repo",
    owner: "owner",
    issue_number: 1,
  })),
}));
jest.unstable_mockModule("../src/helpers/structured-metadata", () => ({
  createStructuredMetadata: jest.fn(() => ""),
  getCommentsFromMetadata: jest.fn(() => ({})),
}));

describe("remindAssigneesForIssue", () => {
  let context: ContextPlugin;
  let issue: ListIssueForRepo;

  beforeEach(() => {
    context = {
      logger: new Logs("debug"),
      octokit: {
        rest: {
          issues: {
            createComment: jest.fn(),
            removeAssignees: jest.fn(),
          },
        },
      },
      config: {
        warning: 1,
        disqualification: 1,
        pullRequestRequired: false,
      },
      payload: {},
      commentHandler: {
        postComment: jest.fn(),
      },
    } as unknown as ContextPlugin;

    issue = {
      html_url: "https://github.com/owner/repo/issues/1",
      assignees: [{ login: "ubiquity-os", id: 1 }],
    } as unknown as ListIssueForRepo;
  });

  it("should post a comment to the parent issue if posting to the pull request fails", async () => {
    context.config.pullRequestRequired = true;
    jest.unstable_mockModule("../src/helpers/collect-linked-pulls", () => {
      return {
        collectLinkedPullRequests: jest.fn(() => [
          {
            url: "https://github.com/owner/repo/pull/1",
            body: "",
            id: "1",
            login: "ubiquity-os",
            number: 1,
            state: "OPEN",
            title: "title",
          },
        ]),
      };
    });

    const mockedError = new Error("Failed to post comment");

    (context.octokit.rest.issues.createComment as jest.MockedFunction<typeof context.octokit.rest.issues.createComment>)
      .mockRejectedValueOnce(mockedError)
      .mockResolvedValueOnce({} as unknown as RestEndpointMethodTypes["issues"]["createComment"]["response"]);

    const { remindAssigneesForIssue } = await import("../src/helpers/remind-and-remove");
    await remindAssigneesForIssue(context, issue);

    expect(context.octokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "owner",
        repo: "repo",
        issue_number: 1,
      })
    );

    expect(context.octokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "owner",
        repo: "repo",
        issue_number: 1,
        body: expect.stringContaining("this task has been idle for a while"),
      })
    );
  });
});
