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
      adapters: { kv: { removeIssue: mock(() => Promise.resolve()) } },
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

  it("should handle removeAssignees failure for bot accounts gracefully", async () => {
    const { unassignUserFromIssue } = await import("../src/helpers/remind-and-remove");
    
    // Mock removeAssignees to fail (as it does for bot accounts)
    const mockError = new Error("User cannot be unassigned");
    (context.octokit.rest.issues.removeAssignees as any).mockRejectedValue(mockError);
    
    // Test with a bot account (like Copilot)
    const botIssue = { 
      html_url: "https://github.com/owner/repo/issues/1", 
      assignees: [{ login: "Copilot", id: 198982749, type: "Bot" }] 
    } as unknown as ListIssueForRepo;

    // Should not throw and should still clean up database even if removeAssignees fails
    await expect(unassignUserFromIssue(context, botIssue)).resolves.not.toThrow();
    
    expect(context.adapters.kv.removeIssue).toHaveBeenCalledWith("https://github.com/owner/repo/issues/1");
    expect(context.octokit.rest.issues.removeAssignees).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo", 
      issue_number: 1,
      assignees: ["Copilot"]
    });
  });
});
