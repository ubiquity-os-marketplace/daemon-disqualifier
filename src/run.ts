import { Octokit } from "@octokit/rest";
import { Context } from "./types/context";
import { PluginInputs } from "./types/plugin-inputs";
import { Logs } from "@ubiquity-dao/ubiquibot-logger";
import { watchUserActivity } from "./handlers/watch-user-activity";

export async function run(inputs: PluginInputs) {
  const octokit = new Octokit({ auth: inputs.authToken });
  const context: Context = {
    eventName: inputs.eventName,
    payload: inputs.eventPayload,
    config: inputs.settings,
    octokit,
    logger: new Logs("verbose"),
  };
  await runPlugin(context);
  return JSON.stringify({ status: 200 });
}

export async function runPlugin(context: Context) {
  return await watchUserActivity(context);
}
