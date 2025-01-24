import { describe, it, jest } from "@jest/globals";
import db from "../src/cron/database-handler";

describe("CRON tests", () => {
  it("Should modify the comments in the list inside of the db", async () => {
    const issue1 = {
      issueNumber: 1,
      commentId: 1,
    };
    const issue2 = {
      issueNumber: 2,
      commentId: 2,
    };
    const owner = "ubiquity-os-marketplace";
    const repo1 = "daemon-disqualifier";
    const repo2 = "daemon-disqualifier-2";
    db.data = {
      [`${owner}/${repo1}`]: [issue1, issue2],
      [`${owner}/${repo2}`]: [issue1, issue2],
    };

    const getComment = jest.fn(() => ({ data: { body: "" } }));
    const updateComment = jest.fn(() => ({ data: { body: "" } }));
    jest.unstable_mockModule("@octokit/rest", () => ({
      Octokit: jest.fn(() => ({
        rest: {
          issues: {
            getComment,
            updateComment,
          },
        },
      })),
    }));

    await import("../src/cron/index");
    expect(getComment).toHaveBeenCalledWith({ issue_number: issue2.issueNumber, comment_id: issue2.commentId, owner, repo: repo1 });
    expect(updateComment).toHaveBeenCalledWith({
      issue_number: issue2.issueNumber,
      comment_id: issue2.commentId,
      owner,
      repo: repo1,
      body: expect.stringContaining("update"),
    });
    getComment.mockReset();
    updateComment.mockReset();
  });
});
