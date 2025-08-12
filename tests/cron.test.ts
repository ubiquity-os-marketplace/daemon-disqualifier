import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { ContextPlugin } from "../src/types/plugin-input";

describe("CRON tests", () => {
  beforeEach(async () => {
    mock.restore();
    mock.clearAllMocks();
  });

  it("Should modify the comments in the list inside of the db", async () => {
    const issue1 = { issueNumber: 1, commentId: 1 };
    const issue2 = { issueNumber: 2, commentId: 2 };
    const owner = "ubiquity-os-marketplace";
    const repo1 = "daemon-disqualifier";

    const getComment = mock(() => ({ data: { body: "" } }));
    const updateComment = mock(() => ({ data: { body: "" } }));

    spyOn(await import("@ubiquity-os/plugin-sdk/octokit"), "customOctokit").mockReturnValue({
      rest: {
        apps: { getRepoInstallation: mock(() => ({ data: { id: 1 } })) },
        issues: {
          getComment,
          updateComment,
          get: mock(() => ({ data: { assignees: [{ id: "1" }], state: "open" } })),
        },
      },
    } as never);

    spyOn(await import("../src/adapters/kv-database-handler"), "createKvDatabaseHandler").mockReturnValue(
      Promise.resolve({
        getAllRepositories: mock(() =>
          Promise.resolve([
            {
              owner,
              repo: repo1,
              issues: [
                { commentId: issue2.commentId, issueNumber: issue2.issueNumber },
                { commentId: issue1.commentId, issueNumber: issue1.issueNumber },
              ],
            },
          ])
        ),
      })
    );

    const { runCronJob } = await import("../src/cron/runner");
    await runCronJob();
    expect(getComment).toHaveBeenCalledWith({ issue_number: issue2.issueNumber, comment_id: issue2.commentId, owner, repo: repo1 });
    expect(updateComment).toHaveBeenCalledWith({
      comment_id: issue2.commentId,
      owner,
      repo: repo1,
      body: expect.stringContaining("update"),
    });
  });

  it("Should enable and disable the CRON workflow depending on the DB state", async () => {
    const { updateCronState } = await import("../src/cron/workflow");
    const hasData = mock(() => false);
    spyOn(await import("@ubiquity-os/plugin-sdk/octokit"), "customOctokit").mockReturnValue({} as never);
    const enableWorkflow = mock(() => {});
    const disableWorkflow = mock(() => {});
    const context = {
      logger: new Logs("debug"),
      octokit: { rest: { actions: { enableWorkflow, disableWorkflow } } },
      adapters: { kv: { hasData } },
    } as unknown as ContextPlugin;

    process.env.GITHUB_REPOSITORY = "ubiquity-os-marketplace/daemon-disqualifier";
    await updateCronState(context);
    expect(disableWorkflow).toHaveBeenCalledTimes(1);

    hasData.mockReturnValueOnce(true);
    await updateCronState(context);
    expect(enableWorkflow).toHaveBeenCalledTimes(1);
  });
});
