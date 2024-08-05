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
import issueTemplate from "./__mocks__/issue-template";
import repoTemplate from "./__mocks__/repo-template";
import { getIssueHtmlUrl, getIssueUrl, getRepoHtmlUrl, getRepoUrl, noAssignmentCommentFor, STRINGS, updatingRemindersFor } from "./__mocks__/strings";

dotenv.config();
const ONE_DAY = 1000 * 60 * 60 * 24;
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
    expect(settings).toEqual({ warning: 302400000, disqualification: 604800000, watch: { optOut: [STRINGS.PRIVATE_REPO] } });
    expect(() =>
      Value.Decode(
        userActivityWatcherSettingsSchema,
        Value.Default(userActivityWatcherSettingsSchema, {
          warning: "12 foobars",
          disqualification: "2 days",
          watch: { optOut: [STRINGS.PRIVATE_REPO] },
        })
      )
    ).toThrow(TransformDecodeError);
  });
  it("Should run", async () => {
    const context = createContext(1, 1);
    const result = await runPlugin(context);
    expect(result).toBe(true);
  });

  it.only("Should process update for all repos except optOut", async () => {
    const context = createContext(2, 1);
    const infoSpy = jest.spyOn(context.logger, "info");
    await runPlugin(context);

    expect(infoSpy).toHaveBeenNthCalledWith(1, "Getting ubiquity org repositories: 4");
    expect(infoSpy).toHaveBeenNthCalledWith(2, updatingRemindersFor(STRINGS.TEST_REPO));
    expect(infoSpy).toHaveBeenNthCalledWith(3, noAssignmentCommentFor(getIssueUrl(1)));
    expect(infoSpy).toHaveBeenNthCalledWith(4, noAssignmentCommentFor(getIssueUrl(2)));
    expect(infoSpy).toHaveBeenNthCalledWith(5, noAssignmentCommentFor(getIssueUrl(3)));
    expect(infoSpy).toHaveBeenNthCalledWith(6, noAssignmentCommentFor(getIssueUrl(4)));
    expect(infoSpy).toHaveBeenNthCalledWith(7, updatingRemindersFor(STRINGS.PRIVATE_REPO));
  });
});

async function setupTests() {
  for (const item of mockUsers) {
    db.users.create(item);
  }

  db.repo.create(repoTemplate);
  db.repo.create({ ...repoTemplate, id: 2, name: "private-repo" });
  db.repo.create({ ...repoTemplate, id: 3, name: "user-activity-watcher" });
  db.repo.create({ ...repoTemplate, id: 4, name: "filler-repo" });
  db.repo.create({
    ...repoTemplate,
    id: 5,
    name: "ubiquibot",
    owner: { login: STRINGS.UBIQUIBOT },
    url: getRepoUrl(STRINGS.UBIQUIBOT),
    html_url: getRepoHtmlUrl(STRINGS.UBIQUIBOT),
  });

  // nothing to do
  db.issue.create({
    ...issueTemplate,
    id: 1,
    assignees: [STRINGS.UBIQUITY],
    created_at: new Date(Date.now() - ONE_DAY).toISOString(),
    url: getIssueUrl(1),
    html_url: getIssueHtmlUrl(1),
  });
  // nothing to do
  db.issue.create({
    ...issueTemplate,
    id: 2,
    assignees: [STRINGS.USER],
    created_at: new Date(Date.now() - ONE_DAY * 2).toISOString(),
    url: getIssueUrl(2),
    html_url: getIssueHtmlUrl(2),
  });
  // warning
  db.issue.create({
    ...issueTemplate,
    id: 3,
    assignees: [STRINGS.USER],
    created_at: new Date(Date.now() - ONE_DAY * 4).toISOString(),
    url: getIssueUrl(3),
    html_url: getIssueHtmlUrl(3),
  });
  // disqualification
  db.issue.create({
    ...issueTemplate,
    id: 4,
    assignees: [STRINGS.USER],
    created_at: new Date(Date.now() - ONE_DAY * 8).toISOString(),
    url: getIssueUrl(4),
    html_url: getIssueHtmlUrl(2),
  });

  db.issueComments.create({ id: 1, issueId: 1, body: "test", created_at: new Date(Date.now() - ONE_DAY).toISOString() });
  db.issueComments.create({ id: 2, issueId: 2, body: "test", created_at: new Date(Date.now() - ONE_DAY * 2).toISOString() });
  db.issueComments.create({ id: 3, issueId: 4, body: "test", created_at: new Date(Date.now() - ONE_DAY * 4).toISOString() });
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
      watch: { optOut: [STRINGS.PRIVATE_REPO] },
    },
    octokit: new octokit.Octokit(),
    eventName: "issues.assigned",
  };
}
