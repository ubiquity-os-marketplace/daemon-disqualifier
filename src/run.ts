import { Octokit } from "@octokit/rest";
import { Value } from "@sinclair/typebox/value";
import { createClient } from "@supabase/supabase-js";
import { ValidationException } from "typebox-validators";
import { createAdapters } from "./adapters";
import program from "./parser/payload";
import { proxyCallbacks } from "./proxy";
import { Context } from "./types/context";
import { Database } from "./types/database";
import envConfigSchema, { envConfigValidator } from "./types/env-type";

export async function run() {
  console.log(JSON.stringify(program, null, 2));
  if (!envConfigValidator.test(process.env)) {
    for (const error of envConfigValidator.errors(process.env)) {
      console.error(error);
    }
    return Promise.reject(new ValidationException("The environment is invalid."));
  }
  const env = Value.Decode(envConfigSchema, process.env);
  const inputs = program;
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

  return JSON.stringify(await proxyCallbacks[program.eventName](context, env));
}
