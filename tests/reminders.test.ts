import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { updateTaskReminder } from "../src/helpers/task-update";
import { FOLLOWUP_HEADER } from "../src/types/constants";
import { ListIssueForRepo } from "../src/types/github-types";
import { ContextPlugin } from "../src/types/plugin-input";

describe("Reminder tests", () => {
  beforeEach(() => {
    mock.restore();
    mock.clearAllMocks();
  });

  it("Should post reminders only on opened linked pull-requests", async () => {
    spyOn(await import("../src/helpers/task-metadata"), "getTaskAssignmentDetails").mockReturnValue(Promise.resolve({ taskAssignees: [1] }));
    spyOn(await import("../src/helpers/task-metadata"), "parsePriorityLabel").mockReturnValue(1);
    spyOn(await import("../src/helpers/task-metadata"), "parseTimeLabel").mockReturnValue(1);
    spyOn(await import("../src/helpers/task-metadata"), "getMostRecentUserAssignmentEvent").mockReturnValue(Promise.resolve({ id: 1 } as never));
    spyOn(await import("../src/helpers/get-assignee-activity"), "getAssigneesActivityForIssue").mockReturnValue(Promise.resolve([]));
    spyOn(await import("../src/helpers/collect-linked-pulls"), "collectLinkedPullRequests").mockReturnValue(
      Promise.resolve([
        { id: 2, state: "MERGED", url: "https://github.com/ubiquity-os/daemon-disqualifier/pull/2" },
        { id: 3, state: "CLOSE", url: "https://github.com/ubiquity-os/daemon-disqualifier/pull/3" },
        { id: 4, state: "OPEN", url: "https://github.com/ubiquity-os/daemon-disqualifier/pull/4" },
      ] as never)
    );
    const f = mock(() => Promise.resolve([]));
    spyOn(await import("../src/helpers/structured-metadata"), "getCommentsFromMetadata").mockImplementation(f);
    spyOn(await import("../src/helpers/structured-metadata"), "createStructuredMetadata").mockReturnValue("");
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

  it("Should post reminder only to assigned user's pull-request when another PR from an unassigned user exists", async () => {
    const { remindAssignees } = await import("../src/helpers/remind-and-remove");
    const createCommentMock = mock(() => Promise.resolve({}));

    const context = {
      logger: new Logs("debug"),
      octokit: {
        rest: {
          issues: {
            createComment: createCommentMock,
          },
        },
      },
      config: {
        pullRequestRequired: true,
        availableDeadlineExtensions: { enabled: false, amounts: {} },
      },
    } as unknown as ContextPlugin;

    const issue = {
      html_url: "https://github.com/ubiquity-os/daemon-disqualifier/issues/100",
      number: 100,
      assignees: [{ login: "userA", id: 101 }],
    } as unknown as ListIssueForRepo;

    spyOn(await import("../src/helpers/deadline-extensions"), "getRemainingAvailableExtensions").mockReturnValue(
      Promise.resolve({ remainingExtensions: 3, extensionsLimit: 5, extensionTimeLapse: 1000, assignmentDate: new Date() }) as never
    );

    spyOn(await import("../src/helpers/collect-linked-pulls"), "collectLinkedPullRequests").mockReturnValue(
      Promise.resolve([
        {
          id: "pr_userB",
          number: 201,
          state: "OPEN",
          url: "https://github.com/ubiquity-os/daemon-disqualifier/pull/201",
          author: { login: "userB", id: 202 },
        },
        {
          id: "pr_userA",
          number: 202,
          state: "OPEN",
          url: "https://github.com/ubiquity-os/daemon-disqualifier/pull/202",
          author: { login: "userA", id: 101 },
        },
      ] as never)
    );

    await remindAssignees(context, issue);

    // Should only comment on User A's PR (issue_number: 202), NOT on User B's PR (201) or main issue (100)
    expect(createCommentMock).toHaveBeenCalledTimes(1);
    expect(createCommentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "ubiquity-os",
        repo: "daemon-disqualifier",
        issue_number: 202,
      })
    );
  });

  it("Should fallback to posting to the main issue when only an unassigned user's PR is linked", async () => {
    const { remindAssignees } = await import("../src/helpers/remind-and-remove");
    const createCommentMock = mock(() => Promise.resolve({}));

    const context = {
      logger: new Logs("debug"),
      octokit: {
        rest: {
          issues: {
            createComment: createCommentMock,
          },
        },
      },
      config: {
        pullRequestRequired: true,
        availableDeadlineExtensions: { enabled: false, amounts: {} },
      },
    } as unknown as ContextPlugin;

    const issue = {
      html_url: "https://github.com/ubiquity-os/daemon-disqualifier/issues/100",
      number: 100,
      assignees: [{ login: "userA", id: 101 }],
    } as unknown as ListIssueForRepo;

    spyOn(await import("../src/helpers/deadline-extensions"), "getRemainingAvailableExtensions").mockReturnValue(
      Promise.resolve({ remainingExtensions: 3, extensionsLimit: 5, extensionTimeLapse: 1000, assignmentDate: new Date() }) as never
    );

    spyOn(await import("../src/helpers/collect-linked-pulls"), "collectLinkedPullRequests").mockReturnValue(
      Promise.resolve([
        {
          id: "pr_userB",
          number: 201,
          state: "OPEN",
          url: "https://github.com/ubiquity-os/daemon-disqualifier/pull/201",
          author: { login: "userB", id: 202 },
        },
      ] as never)
    );

    await remindAssignees(context, issue);

    // Should NOT comment on User B's PR (201). Should fallback to the main issue (100)!
    expect(createCommentMock).toHaveBeenCalledTimes(1);
    expect(createCommentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "ubiquity-os",
        repo: "daemon-disqualifier",
        issue_number: 100,
      })
    );
  });
});
