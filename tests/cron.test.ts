import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { ContextPlugin } from "../src/types/plugin-input";

mock.module("@octokit/rest", () => {});

describe("CRON tests", () => {
  beforeEach(async () => {
    // db.data = {};
    // await db.write();
    mock.restore();
  });

  it("Should modify the comments in the list inside of the db", async () => {
    const issue1 = { issueNumber: 1, commentId: 1 };
    const issue2 = { issueNumber: 2, commentId: 2 };
    const owner = "ubiquity-os-marketplace";
    const repo1 = "daemon-disqualifier";
    const repo2 = "daemon-disqualifier-2";
    // db.data = {
    //   [`${owner}/${repo1}`]: [issue1, issue2],
    //   [`${owner}/${repo2}`]: [issue1, issue2],
    // };

    const getComment = mock(() => ({ data: { body: "" } }));
    const updateComment = mock(() => ({ data: { body: "" } }));
    mock.module("@octokit/rest", () => ({
      Octokit: mock(() => ({
        rest: {
          apps: { getRepoInstallation: mock(() => ({ data: { id: 1 } })) },
          issues: { getComment, updateComment },
        },
      })),
    }));

    mock.module("@ubiquity-os/plugin-sdk/octokit", () => ({
      customOctokit: mock(() => ({
        rest: {
          apps: { getRepoInstallation: mock(() => ({ data: { id: 1 } })) },
          issues: { getComment, updateComment },
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
  });

  it("Should enable and disable the CRON workflow depending on the DB state", async () => {
    const { updateCronState } = await import("../src/cron/workflow");
    const enableWorkflow = mock(() => {});
    const disableWorkflow = mock(() => {});
    const context = {
      logger: new Logs("debug"),
      octokit: { rest: { actions: { enableWorkflow, disableWorkflow } } },
    } as unknown as ContextPlugin;

    process.env.GITHUB_REPOSITORY = "ubiquity-os-marketplace/daemon-disqualifier";
    await updateCronState(context);
    expect(disableWorkflow).toHaveBeenCalledTimes(1);

    // db.data = { "ubiquity-os-marketplace/daemon-disqualifier": [{ commentId: 1, issueNumber: 1 }] };
    await updateCronState(context);
    expect(enableWorkflow).toHaveBeenCalledTimes(1);
  });
});
