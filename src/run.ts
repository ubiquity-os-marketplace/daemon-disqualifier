import { Octokit } from "@octokit/rest";
import { updateTasks } from "./helpers/update-tasks";
import { proxyCallbacks } from "./proxy";
import { Context } from "./types/context";
import { PluginInputs } from "./types/plugin-inputs";

export async function run(inputs: PluginInputs) {
  const octokit = new Octokit({ auth: inputs.authToken });
  const context: Context = {
    eventName: inputs.eventName,
    payload: inputs.eventPayload,
    config: inputs.settings,
    octokit,
    logger: {
      debug(message: unknown, ...optionalParams: unknown[]) {
        console.debug(message, ...optionalParams);
      },
      info(message: unknown, ...optionalParams: unknown[]) {
        console.log(message, ...optionalParams);
      },
      warn(message: unknown, ...optionalParams: unknown[]) {
        console.warn(message, ...optionalParams);
      },
      error(message: unknown, ...optionalParams: unknown[]) {
        console.error(message, ...optionalParams);
      },
      fatal(message: unknown, ...optionalParams: unknown[]) {
        console.error(message, ...optionalParams);
      },
    },
  };

  await updateTasks(context);
  return JSON.stringify(await proxyCallbacks[inputs.eventName](context));
}
