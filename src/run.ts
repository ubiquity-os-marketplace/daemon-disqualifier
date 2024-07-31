import { Octokit } from "@octokit/rest";
import { updateTasks } from "./helpers/update-tasks";
import { Context } from "./types/context";
import { PluginInputs } from "./types/plugin-inputs";
import { Logs } from "@ubiquity-dao/ubiquibot-logger";

export async function run(inputs: PluginInputs) {
  const octokit = new Octokit({ auth: inputs.authToken });
  const context: Context = {
    eventName: inputs.eventName,
    payload: inputs.eventPayload,
    config: inputs.settings,
    octokit,
    logger: new Logs("info"),
  };
  await runPlugin(context);
  return JSON.stringify({ status: 200 });
}

export async function runPlugin(context: Context) {
  return await updateTasks(context);
}
