import { jest } from "@jest/globals";
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
  const mockContext = {
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

  test("posts comment for matching repository issue", async () => {
    const spy = jest.spyOn(console, "warn");
    await watchUserActivity(mockContext);

    expect(spy).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/(@ubiquity-os, a reminder will be sent in 1 hour\.|If no activity is detected, disqualification will occur after 2 hours\.)/)
    );
    spy.mockReset();
  });
});
