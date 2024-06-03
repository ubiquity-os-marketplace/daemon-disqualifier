import { ValidationException } from "typebox-validators";
import { run } from "../src/run";

jest.mock("../src/parser/payload", () => {
  // Require is needed because mock cannot access elements out of scope
  const cfg = require("./__mocks__/results/valid-configuration.json");
  return {
    stateId: 1,
    eventName: "issues.opened",
    authToken: process.env.GITHUB_TOKEN,
    ref: "",
    eventPayload: {
      issue: { html_url: "https://github.com/ubiquibot/comment-incentives/issues/22" },
    },
    settings: JSON.stringify(cfg),
  };
});

describe("Run tests", () => {
  it("Should fail on invalid environment", async () => {
    const oldEnv = { ...process.env };
    // @ts-ignore
    delete process.env.SUPABASE_URL;
    // @ts-ignore
    delete process.env.SUPABASE_KEY;
    await expect(run()).rejects.toEqual(new ValidationException("The environment is invalid."));
    process.env = oldEnv;
  });
  it("Should run", async () => {
    await run();
  });
});
