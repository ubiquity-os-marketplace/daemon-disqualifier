import { beforeEach, describe, jest } from "@jest/globals";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { FOLLOWUP_HEADER } from "../src/types/constants";
import { ListForOrg, ListIssueForRepo } from "../src/types/github-types";
import { ContextPlugin } from "../src/types/plugin-input";

describe("Reminder tests", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.resetAllMocks();
  });

  it("Should post reminders only on opened linked pull-requests", async () => {
    jest.unstable_mockModule("../src/helpers/task-metadata", () => {
      return {
        getTaskAssignmentDetails: jest.fn(() => ({ taskAssignees: [1] })),
        parsePriorityLabel: jest.fn(),
        parseTimeLabel: jest.fn(),
        getMostRecentUserAssignmentEvent: jest.fn(),
      };
    });
    jest.unstable_mockModule("../src/helpers/get-assignee-activity", () => {
      return {
        getAssigneesActivityForIssue: jest.fn(() => []),
      };
    });
    jest.unstable_mockModule("../src/helpers/collect-linked-pulls", () => {
      return {
        collectLinkedPullRequests: jest.fn(() => [
          {
            id: 2,
            state: "MERGED",
            url: "https://github.com/ubiquity-os/daemon-disqualifier/pull/2",
          },
          {
            id: 3,
            state: "CLOSE",
            url: "https://github.com/ubiquity-os/daemon-disqualifier/pull/3",
          },
          {
            id: 4,
            state: "OPEN",
            url: "https://github.com/ubiquity-os/daemon-disqualifier/pull/4",
          },
        ]),
      };
    });
    const f = jest.fn(() => []);
    jest.unstable_mockModule("../src/helpers/structured-metadata", () => {
      return {
        getCommentsFromMetadata: f,
        createStructuredMetadata: jest.fn(() => ""),
      };
    });
    const { updateTaskReminder } = await import("../src/helpers/task-update");
    await updateTaskReminder(
      {
        logger: new Logs("debug"),
        octokit: {
          rest: {
            issues: {
              listEvents: jest.fn(() => [
                {
                  event: "assigned",
                  actor: {
                    id: 1,
                  },
                },
              ]),
            },
          },
          paginate: jest.fn((func: Function, args: unknown) => func(args)),
        },
        config: {},
      } as unknown as ContextPlugin,
      {
        owner: {
          login: "ubiquity-os",
        },
        name: "daemon-disqualifier",
      } as unknown as ContextPlugin["payload"]["repository"],
      { number: 1, html_url: "https://github.com/ubiquity-os/daemon-disqualifier/issue/1" } as unknown as ListIssueForRepo
    );
    // We expect it to be called 2 times because one pull-request is merged and one is closed
    expect(f).toHaveBeenCalledTimes(2);
    expect(f).toHaveBeenCalledWith(expect.anything(), 1, "ubiquity-os", "daemon-disqualifier", FOLLOWUP_HEADER);
    expect(f).toHaveBeenCalledWith(expect.anything(), 4, "ubiquity-os", "daemon-disqualifier", FOLLOWUP_HEADER);
  });
});
