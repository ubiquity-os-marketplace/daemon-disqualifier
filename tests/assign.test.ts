import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { ContextPlugin } from "../src/types/plugin-input";

jest.unstable_mockModule("../src/helpers/get-watched-repos", () => ({
  getWatchedRepos: jest.fn(() => [{ id: 123 }]),
}));

jest.unstable_mockModule("@ubiquity-os/plugin-sdk", () => ({
  postComment: jest.fn(),
}));

const { watchUserActivity } = await import("../src/handlers/watch-user-activity");

describe("watchUserActivity", () => {
  const mockContextTemplate = {
    logger: new Logs("debug"),
    eventName: "issues.assigned",
    payload: {
      repository: { id: 123, owner: { id: 123, login: "ubiquity-os" } },
      issue: {
        assignees: [{ login: "ubiquity-os" }],
        title: "Test Issue",
        state: "open",
      },
    },
    config: {
      warning: 3600000, // 1 hour
      disqualification: 7200000, // 2 hours
      pullRequestRequired: true,
      watch: {
        optOut: [],
      },
    },
    octokit: {
      paginate: jest.fn(() => []),
      rest: {
        issues: {
          listForRepo: jest.fn(() => []),
        },
      },
    },
  } as unknown as ContextPlugin;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should post comment for matching repository issue", async () => {
    const spy = jest.spyOn(console, "warn");
    const mockContext = {
      ...mockContextTemplate,
    };
    mockContext.payload = {
      ...mockContextTemplate.payload,
      issue: {
        assignees: [{ login: "ubiquity-os" }],
        title: "Test Issue",
        state: "open",
        labels: ["Price: 1 USD"],
      },
    } as unknown as ContextPlugin["payload"];

    await watchUserActivity(mockContext);
    expect(spy).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/(Reminders will be sent every `1 hour` if there is no activity\.|Assignees will be disqualified after `2 hours` of inactivity\.)/)
    );
    spy.mockReset();
  });

  it("should ignore an un-priced task", async () => {
    const spy = jest.spyOn(console, "info");

    await watchUserActivity(mockContextTemplate);
    expect(spy).not.toHaveBeenCalled();
    spy.mockReset();
  });
});
