import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { ListIssueForRepo } from "../src/types/github-types";
import { ContextPlugin } from "../src/types/plugin-input";

describe("Bot account disqualification", () => {
  let context: ContextPlugin;

  beforeEach(() => {
    mock.restore();
    mock.clearAllMocks();

    context = {
      logger: new Logs("debug"),
      octokit: {
        rest: {
          issues: {
            removeAssignees: mock(() => Promise.resolve()),
          },
        },
      },
      config: { negligenceThreshold: 1000 }, // Enable unassignment
      commentHandler: { postComment: mock(() => Promise.resolve()) },
      adapters: { kv: { removeIssue: mock(() => Promise.resolve()) } },
    } as unknown as ContextPlugin;
  });

  it("should successfully handle regular user disqualification", async () => {
    const { unassignUserFromIssue } = await import("../src/helpers/remind-and-remove");
    
    const regularUserIssue = {
      html_url: "https://github.com/owner/repo/issues/1",
      assignees: [{ login: "regular-user", id: 12345, type: "User" }]
    } as unknown as ListIssueForRepo;

    await expect(unassignUserFromIssue(context, regularUserIssue)).resolves.not.toThrow();
    
    expect(context.octokit.rest.issues.removeAssignees).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      issue_number: 1,
      assignees: ["regular-user"]
    });
    expect(context.adapters.kv.removeIssue).toHaveBeenCalledWith("https://github.com/owner/repo/issues/1");
  });

  it("should gracefully handle bot account disqualification when removeAssignees fails", async () => {
    const { unassignUserFromIssue } = await import("../src/helpers/remind-and-remove");
    
    // Simulate API failure for bot accounts
    (context.octokit.rest.issues.removeAssignees as any).mockRejectedValue(
      new Error("Cannot remove bot assignee")
    );
    
    const botIssue = {
      html_url: "https://github.com/owner/repo/issues/1",
      assignees: [{ login: "Copilot", id: 198982749, type: "Bot" }]
    } as unknown as ListIssueForRepo;

    // Should not throw an error even if removeAssignees fails
    await expect(unassignUserFromIssue(context, botIssue)).resolves.not.toThrow();
    
    // Should still attempt to remove assignees
    expect(context.octokit.rest.issues.removeAssignees).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      issue_number: 1,
      assignees: ["Copilot"]
    });
    
    // Should still clean up the database entry even if GitHub API fails
    expect(context.adapters.kv.removeIssue).toHaveBeenCalledWith("https://github.com/owner/repo/issues/1");
  });
});