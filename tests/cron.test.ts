import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
// import db from "../src/cron/database-handler";
import { ContextPlugin } from "../src/types/plugin-input";

jest.unstable_mockModule("@octokit/rest", () => {});

describe("CRON tests", () => {
  beforeEach(async () => {
    // db.data = {};
    // await db.write();
  });

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
    // db.data = {
    //   [`${owner}/${repo1}`]: [issue1, issue2],
    //   [`${owner}/${repo2}`]: [issue1, issue2],
    // };

    const getComment = jest.fn(() => ({ data: { body: "" } }));
    const updateComment = jest.fn(() => ({ data: { body: "" } }));
    jest.unstable_mockModule("@octokit/rest", () => ({
      Octokit: jest.fn(() => ({
        rest: {
          apps: {
            getRepoInstallation: jest.fn(() => ({
              data: {
                id: 1,
              },
            })),
          },
          issues: {
            getComment,
            updateComment,
          },
        },
      })),
    }));

    jest.unstable_mockModule("@ubiquity-os/plugin-sdk/octokit", () => ({
      customOctokit: jest.fn(() => ({
        rest: {
          apps: {
            getRepoInstallation: jest.fn(() => ({
              data: {
                id: 1,
              },
            })),
          },
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

  it("Should enable and disable the CRON workflow depending on the DB state", async () => {
    const { updateCronState } = await import("../src/cron/workflow");
    const enableWorkflow = jest.fn();
    const disableWorkflow = jest.fn();
    const context = {
      logger: new Logs("debug"),
      octokit: {
        rest: {
          actions: {
            enableWorkflow,
            disableWorkflow,
          },
        },
      },
    } as unknown as ContextPlugin;

    process.env.GITHUB_REPOSITORY = "ubiquity-os-marketplace/daemon-disqualifier";
    await updateCronState(context);
    expect(disableWorkflow).toHaveBeenCalledTimes(1);

    // db.data = { "ubiquity-os-marketplace/daemon-disqualifier": [{ commentId: 1, issueNumber: 1 }] };
    await updateCronState(context);
    expect(enableWorkflow).toHaveBeenCalledTimes(1);

    enableWorkflow.mockReset();
    disableWorkflow.mockReset();
  });
});
