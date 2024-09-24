import { drop } from "@mswjs/data";
import { TransformDecodeError, Value } from "@sinclair/typebox/value";
import { runPlugin } from "../src/run";
import { UserActivityWatcherSettings, userActivityWatcherSettingsSchema } from "../src/types/plugin-inputs";
import { db } from "./__mocks__/db";
import { server } from "./__mocks__/node";
import cfg from "./__mocks__/results/valid-configuration.json";
import { expect, describe, beforeAll, beforeEach, afterAll, afterEach } from "@jest/globals";
import dotenv from "dotenv";
import { Logs } from "@ubiquity-dao/ubiquibot-logger";
import { Context } from "../src/types/context";
import mockUsers from "./__mocks__/mock-users";
import { botAssignmentComment, getIssueHtmlUrl, STRINGS } from "./__mocks__/strings";
import { createComment, createEvent, createIssue, createRepo, ONE_DAY } from "./__mocks__/helpers";
import { collectLinkedPullRequests } from "../src/handlers/collect-linked-pulls";
import ms from "ms";
import { TypeBoxError } from "@sinclair/typebox";

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
  it("should throw an error if the whitelist events are incorrect", () => {
    expect(() =>
      Value.Decode(
        userActivityWatcherSettingsSchema,
        Value.Default(userActivityWatcherSettingsSchema, {
          warning: "12 days",
          disqualification: "2 days",
          watch: { optOut: [STRINGS.PRIVATE_REPO_NAME] },
          eventWhitelist: ["review_requested", "ready_for_review", "commented", "committed"],
        })
      )
    ).toThrow(TypeBoxError);
  });
  it("Should parse thresholds", async () => {
    const settings = Value.Decode(userActivityWatcherSettingsSchema, Value.Default(userActivityWatcherSettingsSchema, cfg));
    expect(settings).toEqual({
      warning: 302400000,
      disqualification: 604800000,
      watch: { optOut: [STRINGS.PRIVATE_REPO_NAME] },
      eventWhitelist: ["review_requested", "ready_for_review", "commented", "committed"],
    });
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
  it("Should correctly transform the eventWhitelist", () => {
    const settings = Value.Default(userActivityWatcherSettingsSchema, {
      warning: "12 days",
      disqualification: "2 days",
      watch: { optOut: [STRINGS.PRIVATE_REPO_NAME] },
      eventWhitelist: [
        "pull_request.review_requested",
        "pull_request.ready_for_review",
        "pull_request_review_comment.created",
        "issue_comment.created",
        "push",
      ],
    });
    const decodedSettings = Value.Decode(userActivityWatcherSettingsSchema, settings);
    expect(decodedSettings.eventWhitelist).toEqual(["review_requested", "ready_for_review", "commented", "committed"]);
  });
  it("Should define eventWhitelist defaults if omitted", () => {
    const settings = Value.Default(userActivityWatcherSettingsSchema, {
      warning: "12 days",
      disqualification: "2 days",
      watch: { optOut: [STRINGS.PRIVATE_REPO_NAME] },
    });
    const decodedSettings = Value.Decode(userActivityWatcherSettingsSchema, settings);
    expect(decodedSettings.eventWhitelist).toEqual(["review_requested", "ready_for_review", "commented", "committed"]);
  });
  it("Should define all defaults if omitted", () => {
    const settings = Value.Default(userActivityWatcherSettingsSchema, {
      watch: { optOut: [STRINGS.PRIVATE_REPO_NAME] }, // has no default
    }) as UserActivityWatcherSettings;

    const decodedSettings = Value.Decode(userActivityWatcherSettingsSchema, settings);

    console.log("decodedSettings", decodedSettings);

    expect(decodedSettings).toEqual({
      warning: ms("3.5 days"),
      disqualification: ms("7 days"),
      watch: { optOut: [STRINGS.PRIVATE_REPO_NAME] },
      eventWhitelist: ["review_requested", "ready_for_review", "commented", "committed"],
    });
  });
  it("Should run", async () => {
    const context = createContext(1, 1);
    const result = await runPlugin(context);
    expect(result).toBe(true);
  });

  it("Should process updates for all repos except optOut", async () => {
    const context = createContext(1, 1);
    const infoSpy = jest.spyOn(context.logger, "info");
    createComment(5, 1, STRINGS.BOT, "Bot", botAssignmentComment(2, daysPriorToNow(1)), daysPriorToNow(1));
    createEvent(2, daysPriorToNow(1));

    await expect(runPlugin(context)).resolves.toBe(true);

    expect(infoSpy).toHaveBeenNthCalledWith(2, `Nothing to do for ${getIssueHtmlUrl(1)}, still within due-time.`);
    expect(infoSpy).toHaveBeenNthCalledWith(4, `Nothing to do for ${getIssueHtmlUrl(2)}, still within due-time.`);
    expect(infoSpy).toHaveBeenNthCalledWith(6, `Passed the reminder threshold on ${getIssueHtmlUrl(3)}, sending a reminder.`);
    expect(infoSpy).toHaveBeenNthCalledWith(7, `@user2, this task has been idle for a while. Please provide an update.\n\n`, {
      taskAssignees: [2],
      caller: STRINGS.LOGS_ANON_CALLER,
    });
    expect(infoSpy).toHaveBeenNthCalledWith(9, `Passed the deadline on ${getIssueHtmlUrl(4)} and no activity is detected, removing assignees.`);
    expect(infoSpy).not.toHaveBeenCalledWith(expect.stringContaining(STRINGS.PRIVATE_REPO_NAME));
  });

  it("Should include the previously excluded repo", async () => {
    const context = createContext(1, 1, []);
    const infoSpy = jest.spyOn(context.logger, "info");
    createComment(5, 1, STRINGS.BOT, "Bot", botAssignmentComment(2, daysPriorToNow(1)), daysPriorToNow(1));
    createEvent(2, daysPriorToNow(1));

    await expect(runPlugin(context)).resolves.toBe(true);

    expect(infoSpy).toHaveBeenNthCalledWith(2, `Nothing to do for ${getIssueHtmlUrl(1)}, still within due-time.`);
    expect(infoSpy).toHaveBeenNthCalledWith(4, `Nothing to do for ${getIssueHtmlUrl(2)}, still within due-time.`);
    expect(infoSpy).toHaveBeenNthCalledWith(6, `Passed the reminder threshold on ${getIssueHtmlUrl(3)}, sending a reminder.`);
    expect(infoSpy).toHaveBeenNthCalledWith(7, `@user2, this task has been idle for a while. Please provide an update.\n\n`, {
      taskAssignees: [2],
      caller: STRINGS.LOGS_ANON_CALLER,
    });
    expect(infoSpy).toHaveBeenNthCalledWith(9, `Passed the deadline on ${getIssueHtmlUrl(4)} and no activity is detected, removing assignees.`);
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining(STRINGS.PRIVATE_REPO_NAME));
  });

  it("Should eject the user after the disqualification period", async () => {
    const context = createContext(4, 2);
    const infoSpy = jest.spyOn(context.logger, "info");

    const timestamp = daysPriorToNow(9);
    createComment(3, 4, STRINGS.BOT, "Bot", botAssignmentComment(2, timestamp), timestamp);
    createEvent(2, timestamp);

    const issue = db.issue.findFirst({ where: { id: { equals: 4 } } });
    expect(issue?.assignees).toEqual([{ login: STRINGS.USER, id: 2 }]);

    await runPlugin(context);

    expect(infoSpy).toHaveBeenNthCalledWith(2, `Nothing to do for ${getIssueHtmlUrl(1)}, still within due-time.`);
    expect(infoSpy).toHaveBeenNthCalledWith(4, `Nothing to do for ${getIssueHtmlUrl(2)}, still within due-time.`);
    expect(infoSpy).toHaveBeenNthCalledWith(6, `Passed the reminder threshold on ${getIssueHtmlUrl(3)}, sending a reminder.`);
    expect(infoSpy).toHaveBeenNthCalledWith(7, `@user2, this task has been idle for a while. Please provide an update.\n\n`, {
      taskAssignees: [2],
      caller: STRINGS.LOGS_ANON_CALLER,
    });
    expect(infoSpy).toHaveBeenNthCalledWith(9, `Passed the deadline on ${getIssueHtmlUrl(4)} and no activity is detected, removing assignees.`);
    const updatedIssue = db.issue.findFirst({ where: { id: { equals: 4 } } });
    expect(updatedIssue?.assignees).toEqual([]);
  });

  it("Should warn the user after the warning period", async () => {
    const context = createContext(3, 2);
    const timestamp = daysPriorToNow(5);

    createComment(3, 2, STRINGS.BOT, "Bot", botAssignmentComment(2, timestamp), timestamp);

    const issue = db.issue.findFirst({ where: { id: { equals: 3 } } });
    expect(issue?.assignees).toEqual([{ login: STRINGS.USER, id: 2 }]);

    await runPlugin(context);

    const updatedIssue = db.issue.findFirst({ where: { id: { equals: 3 } } });
    expect(updatedIssue?.assignees).toEqual([{ login: STRINGS.USER, id: 2 }]);

    const comments = db.issueComments.getAll();
    const latestComment = comments[comments.length - 1];
    const partialComment = "@user2, this task has been idle for a while. Please provide an update.\\n\\n\\n<!-- Ubiquity - Followup -";
    expect(latestComment.body).toContain(partialComment);
  });

  it("Should have nothing do within the warning period", async () => {
    const context = createContext(1, 2);
    const infoSpy = jest.spyOn(context.logger, "info");

    const timestamp = daysPriorToNow(2);
    createComment(3, 1, STRINGS.BOT, "Bot", botAssignmentComment(2, timestamp), timestamp);

    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } });
    expect(issue?.assignees).toEqual([{ login: STRINGS.UBIQUITY, id: 1 }]);

    await runPlugin(context);

    expect(infoSpy).toHaveBeenCalledWith(`Nothing to do for ${getIssueHtmlUrl(1)}, still within due-time.`);

    const updatedIssue = db.issue.findFirst({ where: { id: { equals: 1 } } });
    expect(updatedIssue?.assignees).toEqual([{ login: STRINGS.UBIQUITY, id: 1 }]);
  });

  it("Should handle collecting linked PRs", async () => {
    const context = createContext(1, 1);
    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } });
    const result = await collectLinkedPullRequests(context, {
      issue_number: issue?.number as number,
      repo: issue?.repo as string,
      owner: issue?.owner.login as string,
    });
    expect(result).toHaveLength(2);
    expect(result).toEqual([
      {
        url: "https://github.com/ubiquity/test-repo/pull/1",
        title: "test",
        body: "test",
        state: "OPEN",
        number: 1,
        author: { login: "ubiquity", id: 1 },
      },
      {
        url: "https://github.com/ubiquity/test-repo/pull/1",
        title: "test",
        body: "test",
        state: "CLOSED",
        number: 2,
        author: { login: "user2", id: 2 },
      },
    ]);
  });
});

async function setupTests() {
  for (const item of mockUsers) {
    db.users.create(item);
  }

  createRepo();
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
  createIssue(5, [{ login: STRINGS.USER, id: 2 }], STRINGS.UBIQUITY, daysPriorToNow(12), "closes #1", STRINGS.PRIVATE_REPO_NAME);

  createComment(1, 1, STRINGS.UBIQUITY);
  createComment(2, 2, STRINGS.UBIQUITY);

  createEvent(1);
}

function daysPriorToNow(days: number) {
  return new Date(Date.now() - ONE_DAY * days).toISOString();
}

function createContext(issueId: number, senderId: number, optOut = [STRINGS.PRIVATE_REPO_NAME]): Context<"issue_comment.created"> {
  return {
    payload: {
      issue: db.issue.findFirst({ where: { id: { equals: issueId } } }) as unknown as Context<"issue_comment.created">["payload"]["issue"],
      sender: db.users.findFirst({ where: { id: { equals: senderId } } }) as unknown as Context<"issue_comment.created">["payload"]["sender"],
      repository: db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Context<"issue_comment.created">["payload"]["repository"],
      action: "created",
      installation: { id: 1 } as unknown as Context["payload"]["installation"],
      organization: { login: STRINGS.UBIQUITY } as unknown as Context["payload"]["organization"],
      comment: db.issueComments.findFirst({ where: { issueId: { equals: issueId } } }) as unknown as Context<"issue_comment.created">["payload"]["comment"],
    },
    logger: new Logs("debug"),
    config: {
      disqualification: ONE_DAY * 7,
      warning: ONE_DAY * 3.5,
      watch: { optOut },
      eventWhitelist: ["review_requested", "ready_for_review", "commented", "committed"],
    },
    octokit: new octokit.Octokit(),
    eventName: "issue_comment.created",
  };
}
