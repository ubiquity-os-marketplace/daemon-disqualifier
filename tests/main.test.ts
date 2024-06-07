import { Value } from "@sinclair/typebox/value";
import program from "../src/parser/payload";
import { ValidationException } from "typebox-validators";
import { run } from "../src/run";
import envConfigSchema from "../src/types/env-type";
import { PluginInputs } from "../src/types/plugin-inputs";

jest.mock("../src/parser/payload", () => {
  // Require is needed because mock cannot access elements out of scope
  const cfg = require("./__mocks__/results/valid-configuration.json");
  return {
    stateId: 1,
    eventName: "issues.assigned",
    authToken: process.env.GITHUB_TOKEN,
    ref: "",
    eventPayload: {
      issue: { html_url: "https://github.com/Meniole/user-activity-watcher/issues/2", number: 2, assignees: [{ login: "gentlementlegen" }] },
      repository: {
        owner: {
          login: "Meniole",
        },
        name: "user-activity-watcher",
      },
    },
    settings: cfg,
  };
});

describe("Run tests", () => {
  it("Should fail on invalid environment", async () => {
    const oldEnv = { ...process.env };
    // @ts-ignore
    delete process.env.SUPABASE_URL;
    // @ts-ignore
    delete process.env.SUPABASE_KEY;
    await expect(
      run({} as unknown as PluginInputs, {
        SUPABASE_URL: "",
        SUPABASE_KEY: "",
      })
    ).rejects.toEqual(new ValidationException("The environment is" + " invalid."));
    process.env = oldEnv;
  });
  it("Should run", async () => {
    await run(program, Value.Decode(envConfigSchema, process.env));
    // await run({} as unknown as PluginInputs, {
    //   SUPABASE_URL: "",
    //   SUPABASE_KEY: "",
    // });
  });
});
