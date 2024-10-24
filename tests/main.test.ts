import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { Octokit } from "@octokit/rest";
import { TypeBoxError } from "@sinclair/typebox";
import { TransformDecodeError, Value } from "@sinclair/typebox/value";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import dotenv from "dotenv";
import ms from "ms";
import { collectLinkedPullRequests } from "../src/helpers/collect-linked-pulls";
import { run } from "../src/run";
import { Context } from "../src/types/context";
import { ContextPlugin, pluginSettingsSchema } from "../src/types/plugin-input";
import { db } from "./__mocks__/db";
import { createComment, createEvent, createIssue, createRepo, ONE_DAY } from "./__mocks__/helpers";
import mockUsers from "./__mocks__/mock-users";
import { server } from "./__mocks__/node";
import cfg from "./__mocks__/results/valid-configuration.json";
import { botAssignmentComment, botReminderComment, getIssueHtmlUrl, STRINGS } from "./__mocks__/strings";

dotenv.config();

beforeAll(() => {
  server.listen();
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => server.close());

describe("User start/stop", () => {
  beforeEach(async () => {
    drop(db);
    await setupTests();
  });
  it("should throw an error if the whitelist events are incorrect", () => {
    expect(() =>
      Value.Decode(
        pluginSettingsSchema,
        Value.Default(pluginSettingsSchema, {
          warning: "12 days",
          disqualification: "2 days",
          watch: { optOut: [STRINGS.PRIVATE_REPO_NAME] },
          eventWhitelist: ["review_requested", "ready_for_review", "commented", "committed"],
        })
      )
    ).toThrow(TypeBoxError);
  });
  it("Should parse thresholds", async () => {
    const pluginSettings = Value.Decode(pluginSettingsSchema, Value.Default(pluginSettingsSchema, { ...cfg }));
    expect(pluginSettings).toEqual({
      pullRequestRequired: true,
      warning: 302400000,
      disqualification: 604800000,
      watch: { optOut: [STRINGS.PRIVATE_REPO_NAME] },
      eventWhitelist: ["review_requested", "ready_for_review", "commented", "committed"],
    });
    expect(() =>
      Value.Decode(
        pluginSettingsSchema,
        Value.Default(pluginSettingsSchema, {
          warning: "12 foobars",
          disqualification: "2 days",
          watch: { optOut: [STRINGS.PRIVATE_REPO_NAME] },
        })
      )
    ).toThrow(TransformDecodeError);
  });
  it("Should correctly transform the eventWhitelist", () => {
    const settings = Value.Default(pluginSettingsSchema, {
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
    const decodedSettings = Value.Decode(pluginSettingsSchema, settings);
    expect(decodedSettings.eventWhitelist).toEqual(["review_requested", "ready_for_review", "commented", "committed"]);
  });
  it("Should define eventWhitelist defaults if omitted", () => {
    const settings = Value.Default(pluginSettingsSchema, {
      warning: "12 days",
      disqualification: "2 days",
      watch: { optOut: [STRINGS.PRIVATE_REPO_NAME] },
    });
    const decodedSettings = Value.Decode(pluginSettingsSchema, settings);
    expect(decodedSettings.eventWhitelist).toEqual(["review_requested", "ready_for_review", "commented", "committed"]);
  });
  it("Should define all defaults if omitted", () => {
    const settings = Value.Default(pluginSettingsSchema, {
      watch: { optOut: [STRINGS.PRIVATE_REPO_NAME] }, // has no default
    });

    const decodedSettings = Value.Decode(pluginSettingsSchema, settings);

    console.log("decodedSettings", decodedSettings);

    expect(decodedSettings).toEqual({
      pullRequestRequired: true,
      warning: ms("3.5 days"),
      disqualification: ms("7 days"),
      watch: { optOut: [STRINGS.PRIVATE_REPO_NAME] },
      eventWhitelist: ["review_requested", "ready_for_review", "commented", "committed"],
    });
  });
  it("Should run", async () => {
    const context = createContext(1, 1);
    const result = await run(context);
    expect(result).toEqual({ message: "OK" });
  });

  it("Should process updates for all repos except optOut", async () => {
    const context = createContext(1, 1);
    const infoSpy = jest.spyOn(context.logger, "info");
    const errorSpy = jest.spyOn(context.logger, "error");

    await expect(run(context)).resolves.toEqual({ message: "OK" });

    expect(errorSpy).toHaveBeenCalledWith(`Failed to update activity for ${getIssueHtmlUrl(1)}, there is no assigned event.`);
    expect(infoSpy).toHaveBeenCalledWith(`Nothing to do for ${getIssueHtmlUrl(2)}, still within due-time.`);
    expect(infoSpy).toHaveBeenCalledWith(`Passed the reminder threshold on ${getIssueHtmlUrl(3)}, sending a reminder.`);
    expect(infoSpy).toHaveBeenCalledWith(`@user2, this task has been idle for a while. Please provide an update.\n\n`, {
      taskAssignees: [2],
      caller: STRINGS.LOGS_ANON_CALLER,
    });
    expect(infoSpy).toHaveBeenCalledWith("Passed the deadline and no activity is detected, removing assignees: @user2.");
    expect(infoSpy).not.toHaveBeenCalledWith(expect.stringContaining(STRINGS.PRIVATE_REPO_NAME));
  });

  it("Should include the previously excluded repo", async () => {
    const context = createContext(1, 1, []);
    const infoSpy = jest.spyOn(context.logger, "info");

    await expect(run(context)).resolves.toEqual({ message: "OK" });

    expect(infoSpy).toHaveBeenCalledWith(`Nothing to do for ${getIssueHtmlUrl(2)}, still within due-time.`);
    expect(infoSpy).toHaveBeenCalledWith(`Passed the reminder threshold on ${getIssueHtmlUrl(3)}, sending a reminder.`);
    expect(infoSpy).toHaveBeenCalledWith(`@user2, this task has been idle for a while. Please provide an update.\n\n`, {
      taskAssignees: [2],
      caller: STRINGS.LOGS_ANON_CALLER,
    });
    expect(infoSpy).toHaveBeenCalledWith("Passed the deadline and no activity is detected, removing assignees: @user2.");
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining(STRINGS.PRIVATE_REPO_NAME));
  });

  it("Should eject the user after the disqualification period", async () => {
    const context = createContext(4, 2);
    const infoSpy = jest.spyOn(context.logger, "info");

    const issue = db.issue.findFirst({ where: { id: { equals: 4 } } });
    expect(issue?.assignees).toEqual([{ login: STRINGS.USER, id: 2 }]);

    await run(context);

    expect(infoSpy).toHaveBeenCalledWith(`Nothing to do for ${getIssueHtmlUrl(2)}, still within due-time.`);
    expect(infoSpy).toHaveBeenCalledWith(`Passed the reminder threshold on ${getIssueHtmlUrl(3)}, sending a reminder.`);
    expect(infoSpy).toHaveBeenCalledWith(`@user2, this task has been idle for a while. Please provide an update.\n\n`, {
      taskAssignees: [2],
      caller: STRINGS.LOGS_ANON_CALLER,
    });
    expect(infoSpy).toHaveBeenCalledWith("Passed the deadline and no activity is detected, removing assignees: @user2.");
    const updatedIssue = db.issue.findFirst({ where: { id: { equals: 4 } } });
    expect(updatedIssue?.assignees).toEqual([]);
  });

  it("Should warn the user after the warning period", async () => {
    const context = createContext(3, 2);

    const issue = db.issue.findFirst({ where: { id: { equals: 3 } } });
    expect(issue?.assignees).toEqual([{ login: STRINGS.USER, id: 2 }]);

    await run(context);

    const updatedIssue = db.issue.findFirst({ where: { id: { equals: 3 } } });
    expect(updatedIssue?.assignees).toEqual([{ login: STRINGS.USER, id: 2 }]);

    const comments = db.issueComments.getAll();
    const latestComment = comments[comments.length - 1];
    const partialComment = "@user2, this task has been idle for a while. Please provide an update.\\n\\n\\n<!-- Ubiquity - Followup -";
    expect(latestComment.body).toContain(partialComment);
  });

  it("Should have nothing to do within the warning period", async () => {
    const context = createContext(1, 2);
    const infoSpy = jest.spyOn(context.logger, "info");

    const issue = db.issue.findFirst({ where: { id: { equals: 1 } } });
    expect(issue?.assignees).toEqual([{ login: STRINGS.UBIQUITY, id: 1 }]);

    await run(context);

    expect(infoSpy).toHaveBeenCalledWith(`Nothing to do for ${getIssueHtmlUrl(2)}, still within due-time.`);

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

  // no assignees
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
  createComment(3, 4, STRINGS.BOT, "Bot", botReminderComment(), daysPriorToNow(6));

  createEvent(1, 2, 2, daysPriorToNow(1));
  createEvent(2, 2, 3, daysPriorToNow(4));
  createEvent(3, 2, 4, daysPriorToNow(12));
  createEvent(4, 2, 5, daysPriorToNow(12));
}

function daysPriorToNow(days: number) {
  return new Date(Date.now() - ONE_DAY * days).toISOString();
}

function createContext(issueId: number, senderId: number, optOut = [STRINGS.PRIVATE_REPO_NAME]): ContextPlugin {
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
      pullRequestRequired: false,
    },
    // @ts-expect-error ESM causes types to not match
    octokit: new Octokit(),
    eventName: "issue_comment.created",
    env: {},
  };
}
