import { drop } from "@mswjs/data";
import { TransformDecodeError, Value } from "@sinclair/typebox/value";
import { runPlugin } from "../src/run";
import { userActivityWatcherSettingsSchema } from "../src/types/plugin-inputs";
import { db } from "./__mocks__/db";
import { server } from "./__mocks__/node";
import cfg from "./__mocks__/results/valid-configuration.json";
import { expect, describe, beforeAll, beforeEach, afterAll, afterEach } from "@jest/globals";
import dotenv from "dotenv";
import { Logs } from "@ubiquity-dao/ubiquibot-logger";
import { Context } from "../src/types/context";
import mockUsers from "./__mocks__/mock-users";
import { botAssignmentComment, getIssueHtmlUrl, getIssueUrl, noAssignmentCommentFor, STRINGS, updatingRemindersFor } from "./__mocks__/strings";
import { createComment, createIssue, createRepo, ONE_DAY } from "./__mocks__/helpers";
import { collectLinkedPullRequests } from "../src/handlers/collect-linked-pulls";

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
    const context = createContext(1, 1);
    const infoSpy = jest.spyOn(context.logger, "info");
    await runPlugin(context);

    expect(infoSpy).toHaveBeenNthCalledWith(1, noAssignmentCommentFor(getIssueUrl(1)));
    expect(infoSpy).toHaveBeenNthCalledWith(2, noAssignmentCommentFor(getIssueUrl(2)));
    expect(infoSpy).toHaveBeenNthCalledWith(3, noAssignmentCommentFor(getIssueUrl(3)));
    expect(infoSpy).toHaveBeenNthCalledWith(4, noAssignmentCommentFor(getIssueUrl(4)));
    expect(infoSpy).toHaveBeenCalledTimes(4);
  });

  it("Should include the previously excluded repo", async () => {
    const context = createContext(1, 1);
    const infoSpy = jest.spyOn(context.logger, "info");
    context.config.watch.optOut = [];
    await runPlugin(context);

    expect(infoSpy).toHaveBeenNthCalledWith(1, noAssignmentCommentFor(getIssueUrl(1)));
    expect(infoSpy).toHaveBeenNthCalledWith(2, noAssignmentCommentFor(getIssueUrl(2)));
    expect(infoSpy).toHaveBeenNthCalledWith(3, noAssignmentCommentFor(getIssueUrl(3)));
    expect(infoSpy).toHaveBeenNthCalledWith(4, noAssignmentCommentFor(getIssueUrl(4)));
    expect(infoSpy).toHaveBeenCalledTimes(4);
  });

  it("Should eject the user after the disqualification period", async () => {
    const context = createContext(4, 2);
    const infoSpy = jest.spyOn(context.logger, "info");

    createComment(3, 3, STRINGS.BOT, "Bot", botAssignmentComment(2, daysPriorToNow(9)), daysPriorToNow(9));

    const issue = db.issue.findFirst({ where: { id: { equals: 4 } } });
    expect(issue?.assignees).toEqual([{ login: STRINGS.USER, id: 2 }]);

    await runPlugin(context);

    expect(infoSpy).toHaveBeenNthCalledWith(1, `Assignees mismatch found for ${getIssueUrl(1)}`, { caller: STRINGS.LOGS_ANON_CALLER, issue: [1], metadata: [2] });
    expect(infoSpy).toHaveBeenNthCalledWith(2, `Passed the deadline on ${getIssueUrl(2)} and no activity is detected, removing assignees.`);
    expect(infoSpy).toHaveBeenNthCalledWith(3, `Passed the deadline on ${getIssueUrl(3)} and no activity is detected, removing assignees.`);
    expect(infoSpy).toHaveBeenNthCalledWith(4, `Passed the deadline on ${getIssueUrl(4)} and no activity is detected, removing assignees.`);
    expect(infoSpy).toHaveBeenCalledTimes(4);

    const updatedIssue = db.issue.findFirst({ where: { id: { equals: 4 } } });
    expect(updatedIssue?.assignees).toEqual([]);
  });

  it("Should warn the user after the warning period", async () => {
    const context = createContext(4, 2);
    const infoSpy = jest.spyOn(context.logger, "info");

    createComment(3, 3, STRINGS.BOT, "Bot", botAssignmentComment(2, daysPriorToNow(5)), daysPriorToNow(5));

    const issue = db.issue.findFirst({ where: { id: { equals: 4 } } });
    expect(issue?.assignees).toEqual([{ login: STRINGS.USER, id: 2 }]);

    await runPlugin(context);

    expect(infoSpy).toHaveBeenNthCalledWith(1, `Assignees mismatch found for ${getIssueUrl(1)}`, { caller: STRINGS.LOGS_ANON_CALLER, issue: [1], metadata: [2] });
    expect(infoSpy).toHaveBeenCalledTimes(1);

    const updatedIssue = db.issue.findFirst({ where: { id: { equals: 4 } } });
    expect(updatedIssue?.assignees).toEqual([{ login: STRINGS.USER, id: 2 }]);

    const comments = db.issueComments.getAll();
    expect(comments[comments.length - 1].body).toEqual(JSON.stringify({ body: `@${STRINGS.USER}, this task has been idle for a while. Please provide an update.` }));
  });

  it("Should have nothing do within the warning period", async () => {
    const context = createContext(4, 2);
    const infoSpy = jest.spyOn(context.logger, "info");

    createComment(3, 3, STRINGS.BOT, "Bot", botAssignmentComment(2, daysPriorToNow(2)), daysPriorToNow(2));

    const issue = db.issue.findFirst({ where: { id: { equals: 4 } } });
    expect(issue?.assignees).toEqual([{ login: STRINGS.USER, id: 2 }]);

    await runPlugin(context);

    expect(infoSpy).toHaveBeenNthCalledWith(1, `Assignees mismatch found for ${getIssueUrl(1)}`, { caller: STRINGS.LOGS_ANON_CALLER, issue: [1], metadata: [2] });
    expect(infoSpy).toHaveBeenNthCalledWith(2, `Nothing to do for ${getIssueHtmlUrl(2)}, still within due-time.`);
    expect(infoSpy).toHaveBeenNthCalledWith(4, `Nothing to do for ${getIssueHtmlUrl(3)}, still within due-time.`);
    expect(infoSpy).toHaveBeenNthCalledWith(6, `Nothing to do for ${getIssueHtmlUrl(4)}, still within due-time.`);
    expect(infoSpy).toHaveBeenCalledTimes(7);

    const updatedIssue = db.issue.findFirst({ where: { id: { equals: 4 } } });
    expect(updatedIssue?.assignees).toEqual([{ login: STRINGS.USER, id: 2 }]);
  });

  it("Should handle collecting linked PR with # format", async () => {
    const context = createContext(1, 1);
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } });
    const result = await collectLinkedPullRequests(context, { issue_number: issue?.number as number, repo: issue?.repo as string, owner: issue?.owner.login as string });
    expect(result).toHaveLength(1);
    expect(result[0].number).toEqual(1);
    expect(result[0].body).toMatch(/Resolves #1/gi);
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

  createIssue(1, [], STRINGS.UBIQUITY, daysPriorToNow(1), "resolves #1");
  // nothing to do
  createIssue(2, [{ login: STRINGS.USER, id: 2 }], STRINGS.UBIQUITY, daysPriorToNow(1), "resolves #1");
  // warning
  createIssue(3, [{ login: STRINGS.USER, id: 2 }], STRINGS.UBIQUITY, daysPriorToNow(4), "fixes #2");
  // disqualification
  createIssue(4, [{ login: STRINGS.USER, id: 2 }], STRINGS.UBIQUITY, daysPriorToNow(12), "closes #3");

  createComment(1, 1, STRINGS.UBIQUITY);
  createComment(2, 2, STRINGS.UBIQUITY);
}

function daysPriorToNow(days: number) {
  return new Date(Date.now() - ONE_DAY * days).toISOString();
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
