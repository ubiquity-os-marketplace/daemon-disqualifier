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
import { STRINGS } from "./__mocks__/strings";

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
    expect(settings).toEqual({ warning: 302400000, disqualification: 604800000, watch: { optIn: [STRINGS.UBIQUITY], optOut: [STRINGS.PRIVATE_REPO] } });
    expect(() =>
      Value.Decode(
        userActivityWatcherSettingsSchema,
        Value.Default(userActivityWatcherSettingsSchema, {
          warning: "12 foobars",
          disqualification: "2 days",
          watch: { optIn: [STRINGS.UBIQUITY], optOut: [STRINGS.PRIVATE_REPO] },
        })
      )
    ).toThrow(TransformDecodeError);
  });
  it("Should run", async () => {
    const context = createContext(1, 1);
    const result = await runPlugin(context);
    expect(result).toBe(true);
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
  db.repo.create({ ...repoTemplate, id: 5, owner: { login: STRINGS.UBIQUIBOT }, html_url: repoTemplate.html_url.replace("ubiquity", STRINGS.UBIQUIBOT) });

  // nothing to do
  db.issue.create({ ...issueTemplate, id: 1, assignees: [STRINGS.UBIQUITY], created_at: new Date(Date.now() - ONE_DAY).toISOString() });
  // nothing to do
  db.issue.create({ ...issueTemplate, id: 2, assignees: [STRINGS.USER], created_at: new Date(Date.now() - ONE_DAY * 2).toISOString() });
  // warning
  db.issue.create({ ...issueTemplate, id: 4, assignees: [STRINGS.USER], created_at: new Date(Date.now() - ONE_DAY * 4).toISOString() });
  // disqualification
  db.issue.create({ ...issueTemplate, id: 5, assignees: [STRINGS.USER], created_at: new Date(Date.now() - ONE_DAY * 8).toISOString() });

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
      watch: { optIn: [STRINGS.UBIQUITY], optOut: [STRINGS.PRIVATE_REPO] },
    },
    octokit: new octokit.Octokit(),
    eventName: "issues.assigned",
  };
}