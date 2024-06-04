import { Octokit } from "@octokit/rest";
import { createClient } from "@supabase/supabase-js";
import { createAdapters } from "./adapters";
import { updateTasks } from "./helpers/update-tasks";
import { proxyCallbacks } from "./proxy";
import { Context } from "./types/context";
import { Database } from "./types/database";
import { EnvConfigType } from "./types/env-type";
import { PluginInputs } from "./types/plugin-inputs";

export async function run(inputs: PluginInputs, env: EnvConfigType) {
  const octokit = new Octokit({ auth: inputs.authToken });
  const supabaseClient = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_KEY);
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
    adapters: {} as ReturnType<typeof createAdapters>,
  };
  context.adapters = createAdapters(supabaseClient, context);
  await updateTasks(context);
  return JSON.stringify(await proxyCallbacks[inputs.eventName](context, env));
}
