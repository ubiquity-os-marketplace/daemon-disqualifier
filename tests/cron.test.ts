import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { ContextPlugin } from "../src/types/plugin-input";

describe("CRON tests", () => {
  beforeEach(async () => {
    mock.restore();
    mock.clearAllMocks();
  });

  it("Should run reminder sweep directly and clean stale issues", async () => {
    const issue1 = { issueNumber: 1 };
    const issue2 = { issueNumber: 2 };
    const owner = "ubiquity-os-marketplace";
    const repo1 = "daemon-disqualifier";
    const sequence: string[] = [];
    const runRemindersForRepository = mock(() => {
      sequence.push("reminders");
      return Promise.resolve({ message: "OK" });
    });
    const populateDeadlineExtensionsThresholds = mock(() => {
      sequence.push("populate");
      return Promise.resolve();
    });
    const removeIssueByNumber = mock(() => Promise.resolve());
    const getIssue = mock(({ issue_number }: { issue_number: number }) => {
      if (issue_number === issue2.issueNumber) {
        return { data: { number: issue2.issueNumber, assignees: [], state: "closed" } };
      }
      return {
        data: {
          number: issue1.issueNumber,
          html_url: `https://github.com/${owner}/${repo1}/issues/${issue1.issueNumber}`,
          labels: [],
          assignees: [{ id: 1, login: "ubiquity" }],
          state: "open",
        },
      };
    });

    process.env.APP_ID = "1";
    process.env.APP_PRIVATE_KEY = "private-key";

    spyOn(await import("@ubiquity-os/plugin-sdk/octokit"), "customOctokit").mockReturnValue({
      rest: {
        apps: { getRepoInstallation: mock(() => ({ data: { id: 1 } })) },
        issues: {
          get: getIssue,
        },
      },
    } as never);

    spyOn((await import("@ubiquity-os/plugin-sdk/configuration")).ConfigurationHandler.prototype, "getSelfConfiguration").mockImplementation(() =>
      Promise.resolve({} as never)
    );

    spyOn(await import("../src/run"), "populateDeadlineExtensionsThresholds").mockImplementation(populateDeadlineExtensionsThresholds as never);
    spyOn(await import("../src/handlers/watch-user-activity"), "runRemindersForRepository").mockImplementation(runRemindersForRepository as never);

    spyOn(await import("../src/adapters/kv-database-handler"), "createKvDatabaseHandler").mockReturnValue(
      Promise.resolve({
        removeIssueByNumber,
        getAllRepositories: mock(() =>
          Promise.resolve([
            {
              owner,
              repo: repo1,
              issues: [{ issueNumber: issue2.issueNumber }, { issueNumber: issue1.issueNumber }],
            },
          ])
        ),
      } as never)
    );

    const { runCronJob } = await import("../src/cron/runner");
    await runCronJob();

    expect(removeIssueByNumber).toHaveBeenCalledWith(owner, repo1, issue2.issueNumber);
    expect(populateDeadlineExtensionsThresholds).toHaveBeenCalledTimes(1);
    expect(runRemindersForRepository).toHaveBeenCalledTimes(1);
    expect(runRemindersForRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "issues.reopened",
        payload: expect.objectContaining({
          issue: expect.objectContaining({ number: issue1.issueNumber }),
          repository: expect.objectContaining({ name: repo1 }),
        }),
      }),
      expect.objectContaining({ name: repo1 })
    );
    expect(sequence).toEqual(["populate", "reminders"]);
    expect(getIssue).toHaveBeenCalledWith({
      issue_number: issue2.issueNumber,
      owner,
      repo: repo1,
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

    delete process.env.APP_ID;
    delete process.env.APP_PRIVATE_KEY;
    process.env.GITHUB_REPOSITORY = "ubiquity-os-marketplace/daemon-disqualifier";
    await updateCronState(context);
    expect(disableWorkflow).toHaveBeenCalledTimes(1);

    hasData.mockReturnValueOnce(true);
    await updateCronState(context);
    expect(enableWorkflow).toHaveBeenCalledTimes(1);
  });
});
