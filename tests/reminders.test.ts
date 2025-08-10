import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { FOLLOWUP_HEADER } from "../src/types/constants";
import { ListIssueForRepo } from "../src/types/github-types";
import { ContextPlugin } from "../src/types/plugin-input";

describe("Reminder tests", () => {
  beforeEach(() => {
    mock.restore();
    mock.clearAllMocks();
  });

  it("Should post reminders only on opened linked pull-requests", async () => {
    mock.module("../src/helpers/task-metadata", () => ({
      getTaskAssignmentDetails: mock(() => ({ taskAssignees: [1] })),
      parsePriorityLabel: mock(() => {}),
      parseTimeLabel: mock(() => {}),
      getMostRecentUserAssignmentEvent: mock(() => ({ id: 1 })),
    }));
    mock.module("../src/helpers/get-assignee-activity", () => ({
      getAssigneesActivityForIssue: mock(() => []),
    }));
    mock.module("../src/helpers/collect-linked-pulls", () => ({
      collectLinkedPullRequests: mock(() => [
        { id: 2, state: "MERGED", url: "https://github.com/ubiquity-os/daemon-disqualifier/pull/2" },
        { id: 3, state: "CLOSE", url: "https://github.com/ubiquity-os/daemon-disqualifier/pull/3" },
        { id: 4, state: "OPEN", url: "https://github.com/ubiquity-os/daemon-disqualifier/pull/4" },
      ]),
    }));
    const f = mock(() => []);
    mock.module("../src/helpers/structured-metadata", () => ({
      getCommentsFromMetadata: f,
      createStructuredMetadata: mock(() => ""),
      commentUpdateMetadataPattern: /stub/,
    }));
    const { updateTaskReminder } = await import("../src/helpers/task-update");
    await updateTaskReminder(
      {
        logger: new Logs("debug"),
        octokit: {
          rest: {
            issues: {
              listEvents: mock(() => [{ event: "assigned", actor: { id: 1 } }]),
            },
          },
          paginate: mock((func: Function, args: unknown) => func(args)),
        },
        config: {},
      } as unknown as ContextPlugin,
      { owner: { login: "ubiquity-os" }, name: "daemon-disqualifier" } as unknown as ContextPlugin["payload"]["repository"],
      { number: 1, html_url: "https://github.com/ubiquity-os/daemon-disqualifier/issue/1" } as unknown as ListIssueForRepo
    );
    // We expect it to be called 2 times because one pull-request is merged and one is closed
    expect(f).toHaveBeenCalledTimes(2);
    expect(f).toHaveBeenCalledWith(expect.anything(), 1, "ubiquity-os", "daemon-disqualifier", FOLLOWUP_HEADER);
    expect(f).toHaveBeenCalledWith(expect.anything(), 4, "ubiquity-os", "daemon-disqualifier", FOLLOWUP_HEADER);
  });
});
