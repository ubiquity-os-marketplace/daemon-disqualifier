import { drop } from "@mswjs/data";
import { TransformDecodeError, Value } from "@sinclair/typebox/value";
import { parseDurationString } from "../src/helpers/time";
import program from "../src/parser/payload";
import { run } from "../src/run";
import { userActivityWatcherSettingsSchema } from "../src/types/plugin-inputs";
import { db as mockDb } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";
import cfg from "./__mocks__/results/valid-configuration.json";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

jest.mock("../src/parser/payload", () => {
  // Require is needed because mock cannot access elements out of scope
  const cfg = require("./__mocks__/results/valid-configuration.json");
  return {
    stateId: 1,
    eventName: "issues.assigned",
    authToken: process.env.GITHUB_TOKEN,
    ref: "",
    eventPayload: {
      issue: { html_url: "https://github.com/ubiquibot/user-activity-watcher/issues/1", number: 1, assignees: [{ login: "ubiquibot" }] },
      repository: {
        owner: {
          login: "ubiquibot",
        },
        name: "user-activity-watcher",
      },
    },
    settings: cfg,
  };
});

describe("Run tests", () => {
  beforeAll(() => {
    drop(mockDb);
    for (const item of dbSeed.issues) {
      mockDb.issues.create(item);
    }
  });

  it("Should parse thresholds", async () => {
    const settings = Value.Decode(userActivityWatcherSettingsSchema, Value.Default(userActivityWatcherSettingsSchema, cfg));
    expect(settings).toEqual({ warning: 302400000, disqualification: 604800000, watch: { optIn: ["ubiquity"], optOut: ["ubiquity/private-repo"] } });
    expect(() =>
      Value.Decode(
        userActivityWatcherSettingsSchema,
        Value.Default(userActivityWatcherSettingsSchema, {
          warning: "12 foobars",
          disqualification: "2 days",
          watch: { optIn: ["ubiquity"], optOut: ["ubiquity/private-repo"] },
        })
      )
    ).toThrow(TransformDecodeError);
  });
  it("Should run", async () => {
    const result = await run(program);
    expect(JSON.parse(result)).toEqual({ status: "ok" });
  });
  it("Should parse time", () => {
    expect(parseDurationString("Time: <1 Day").get("days")).toEqual(1);
    expect(parseDurationString("Time: <1 Days").get("days")).toEqual(1);
    expect(parseDurationString("Time: <1 Week").get("weeks")).toEqual(1);
    expect(parseDurationString("Time: <1 Weeks").get("weeks")).toEqual(1);
    expect(parseDurationString("Time: <4 Hour").get("hours")).toEqual(4);
    expect(parseDurationString("Time: <4 Hours").get("hours")).toEqual(4);
    expect(parseDurationString("Time: <8 Week").get("months")).toEqual(2);
    expect(parseDurationString("Time: <8 Weeks").get("months")).toEqual(2);
    expect(parseDurationString("Time: <3 Month").get("months")).toEqual(3);
    expect(parseDurationString("Time: <3 Months").get("months")).toEqual(3);
  });
});
