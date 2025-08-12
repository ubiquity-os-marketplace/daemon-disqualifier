import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { updateTaskReminder } from "../src/helpers/task-update";
import { FOLLOWUP_HEADER } from "../src/types/constants";
import { ListIssueForRepo } from "../src/types/github-types";
import { ContextPlugin } from "../src/types/plugin-input";

describe("Reminder tests", () => {
  beforeEach(() => {
    mock.clearAllMocks();
    mock.restore();
  });

  it("Should post reminders only on opened linked pull-requests", async () => {
    spyOn(await import("../src/helpers/task-metadata"), "getTaskAssignmentDetails").mockReturnValue(Promise.resolve({ taskAssignees: [1] }));
    spyOn(await import("../src/helpers/task-metadata"), "parsePriorityLabel").mockReturnValue(1);
    spyOn(await import("../src/helpers/task-metadata"), "parseTimeLabel").mockReturnValue(1);
    spyOn(await import("../src/helpers/task-metadata"), "getMostRecentUserAssignmentEvent").mockReturnValue(Promise.resolve({ id: 1 }));
    spyOn(await import("../src/helpers/get-assignee-activity"), "getAssigneesActivityForIssue").mockReturnValue(Promise.resolve([]));
    spyOn(await import("../src/helpers/collect-linked-pulls"), "collectLinkedPullRequests").mockReturnValue(
      Promise.resolve([
        { id: 2, state: "MERGED", url: "https://github.com/ubiquity-os/daemon-disqualifier/pull/2" },
        { id: 3, state: "CLOSE", url: "https://github.com/ubiquity-os/daemon-disqualifier/pull/3" },
        { id: 4, state: "OPEN", url: "https://github.com/ubiquity-os/daemon-disqualifier/pull/4" },
      ])
    );
    const f = mock(() => []);
    spyOn(await import("../src/helpers/structured-metadata"), "getCommentsFromMetadata").mockReturnValue(f);
    spyOn(await import("../src/helpers/structured-metadata"), "createStructuredMetadata").mockReturnValue("");
    spyOn(await import("../src/helpers/structured-metadata"), "commentUpdateMetadataPattern").mockReturnValue(/stub/);
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
