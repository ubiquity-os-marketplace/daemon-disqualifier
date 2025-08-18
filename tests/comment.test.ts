import { RestEndpointMethodTypes } from "@octokit/rest";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { ListIssueForRepo } from "../src/types/github-types";
import { ContextPlugin } from "../src/types/plugin-input";

describe("remindAssigneesForIssue", () => {
  let context: ContextPlugin;
  let issue: ListIssueForRepo;

  beforeEach(async () => {
    mock.restore();
    mock.clearAllMocks();

    context = {
      logger: new Logs("debug"),
      octokit: {
        rest: {
          issues: {
            createComment: mock(() => {}),
            removeAssignees: mock(() => {}),
          },
        },
      },
      config: { warning: 1, disqualification: 0, pullRequestRequired: false },
      payload: { issue: {} },
      commentHandler: { postComment: mock(() => {}) },
    } as unknown as ContextPlugin;

    issue = { html_url: "https://github.com/owner/repo/issues/1", assignees: [{ login: "ubiquity-os", id: 1 }] } as unknown as ListIssueForRepo;
  });

  it("should post a comment to the parent issue if posting to the pull request fails", async () => {
    context.config.pullRequestRequired = true;
    spyOn(await import("../src/helpers/collect-linked-pulls"), "collectLinkedPullRequests").mockReturnValue(
      Promise.resolve([
        {
          url: "https://github.com/owner/repo/pull/1",
          body: "",
          id: "1",
          login: "ubiquity-os",
          number: 1,
          state: "OPEN",
          title: "title",
          author: { id: 1, login: "ubiquity-os" },
        },
      ])
    );

    const mockedError = new Error("Failed to post comment");
    (context.octokit.rest.issues.createComment as any)
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
