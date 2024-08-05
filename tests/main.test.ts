import { drop } from "@mswjs/data";
import { TransformDecodeError, Value } from "@sinclair/typebox/value";
import program from "../src/parser/payload";
import { run, runPlugin } from "../src/run";
import { userActivityWatcherSettingsSchema } from "../src/types/plugin-inputs";
import { db } from "./__mocks__/db";
import { server } from "./__mocks__/node";
import cfg from "./__mocks__/results/valid-configuration.json";
import { expect, describe, beforeAll, beforeEach, afterAll, afterEach } from "@jest/globals";
import dotenv from "dotenv";
import { Logs } from "@ubiquity-dao/ubiquibot-logger";
import { Context } from "../src/types/context";
import mockUsers from "./__mocks__/mock-users";
import { getIssueUrl, noAssignmentCommentFor, STRINGS, updatingRemindersFor } from "./__mocks__/strings";
import { createComment, createIssue, createRepo, ONE_DAY } from "./__mocks__/helpers";

dotenv.config();
const octokit = jest.requireActual("@octokit/rest");

beforeAll(() => {
  server.listen();
});
afterEach(() => {
  drop(db);
  server.resetHandlers();
});
afterAll(() => server.close());

describe("User start/stop", () => {
  beforeEach(async () => {
    await setupTests();
  });

  it("Should parse thresholds", async () => {
    const settings = Value.Decode(userActivityWatcherSettingsSchema, Value.Default(userActivityWatcherSettingsSchema, cfg));
    expect(settings).toEqual({ warning: 302400000, disqualification: 604800000, watch: { optOut: [STRINGS.PRIVATE_REPO_NAME] } });
    expect(() =>
      Value.Decode(
        userActivityWatcherSettingsSchema,
        Value.Default(userActivityWatcherSettingsSchema, {
          warning: "12 foobars",
          disqualification: "2 days",
          watch: { optOut: [STRINGS.PRIVATE_REPO_NAME] },
        })
      )
    ).toThrow(TransformDecodeError);
  });
  it("Should run", async () => {
    const context = createContext(1, 1);
    const result = await runPlugin(context);
    expect(result).toBe(true);
  });

  it("Should process update for all repos except optOut", async () => {
    const context = createContext(2, 1);
    const infoSpy = jest.spyOn(context.logger, "info");
    await runPlugin(context);

    expect(infoSpy).toHaveBeenNthCalledWith(1, updatingRemindersFor(STRINGS.TEST_REPO));
    expect(infoSpy).toHaveBeenNthCalledWith(2, noAssignmentCommentFor(getIssueUrl(1)));
    expect(infoSpy).toHaveBeenNthCalledWith(3, noAssignmentCommentFor(getIssueUrl(2)));
    expect(infoSpy).toHaveBeenNthCalledWith(4, noAssignmentCommentFor(getIssueUrl(3)));
    expect(infoSpy).toHaveBeenNthCalledWith(5, noAssignmentCommentFor(getIssueUrl(4)));
    expect(infoSpy).toHaveBeenNthCalledWith(6, updatingRemindersFor(STRINGS.USER_ACTIVITY_WATCHER));
    expect(infoSpy).toHaveBeenNthCalledWith(7, updatingRemindersFor(STRINGS.FILLER_REPO));
    expect(infoSpy).toHaveBeenCalledTimes(7);
  });

  it("Should include the previously excluded repo", async () => {
    const context = createContext(2, 1);
    const infoSpy = jest.spyOn(context.logger, "info");
    context.config.watch.optOut = [];
    await runPlugin(context);

    expect(infoSpy).toHaveBeenNthCalledWith(1, updatingRemindersFor(STRINGS.TEST_REPO));
    expect(infoSpy).toHaveBeenNthCalledWith(2, noAssignmentCommentFor(getIssueUrl(1)));
    expect(infoSpy).toHaveBeenNthCalledWith(3, noAssignmentCommentFor(getIssueUrl(2)));
    expect(infoSpy).toHaveBeenNthCalledWith(4, noAssignmentCommentFor(getIssueUrl(3)));
    expect(infoSpy).toHaveBeenNthCalledWith(5, noAssignmentCommentFor(getIssueUrl(4)));
    expect(infoSpy).toHaveBeenNthCalledWith(6, updatingRemindersFor(STRINGS.PRIVATE_REPO));
    expect(infoSpy).toHaveBeenNthCalledWith(7, updatingRemindersFor(STRINGS.USER_ACTIVITY_WATCHER));
    expect(infoSpy).toHaveBeenNthCalledWith(8, updatingRemindersFor(STRINGS.FILLER_REPO));
    expect(infoSpy).toHaveBeenCalledTimes(8);
  });


});

async function setupTests() {
  for (const item of mockUsers) {
    db.users.create(item);
  }

  createRepo()
  createRepo(STRINGS.PRIVATE_REPO_NAME, 2);
  createRepo(STRINGS.USER_ACTIVITY_WATCHER_NAME, 3);
  createRepo(STRINGS.FILLER_REPO_NAME, 4);
  createRepo(STRINGS.UBIQUIBOT, 5, STRINGS.UBIQUIBOT);

  createIssue(1, []);
  // nothing to do
  createIssue(2, [STRINGS.USER]);
  // warning
  createIssue(3, [STRINGS.USER]);
  // disqualification
  createIssue(4, [STRINGS.USER]);

  createComment(1, 1);
  createComment(2, 2);
  createComment(3, 3);
}

function createContext(issueId: number, senderId: number): Context {
  return {
    payload: {
      issue: db.issue.findFirst({ where: { id: { equals: issueId } } }) as unknown as Context["payload"]["issue"],
      sender: db.users.findFirst({ where: { id: { equals: senderId } } }) as unknown as Context["payload"]["sender"],
      repository: db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Context["payload"]["repository"],
      action: "assigned",
      installation: { id: 1 } as unknown as Context["payload"]["installation"],
      organization: { login: STRINGS.UBIQUITY } as unknown as Context["payload"]["organization"],
    },
    logger: new Logs("debug"),
    config: {
      disqualification: ONE_DAY * 7,
      warning: ONE_DAY * 3.5,
      watch: { optOut: [STRINGS.PRIVATE_REPO_NAME] },
    },
    octokit: new octokit.Octokit(),
    eventName: "issues.assigned",
  };
}
