import * as github from "@actions/github";
import { Octokit } from "@octokit/rest";
import { TransformDecodeCheckError, TransformDecodeError, Value, ValueError } from "@sinclair/typebox/value";
import { Env, envSchema, envValidator, pluginSettingsValidator, PluginSettings, pluginSettingsSchema } from "../types/plugin-inputs";

export function validateAndDecodeSchemas(rawEnv: object, rawSettings: object) {
  const errors: ValueError[] = [];

  const env = Value.Default(envSchema, rawEnv) as Env;
  if (!envValidator.test(env)) {
    for (const error of envValidator.errors(env)) {
      errors.push(error);
    }
  }

  const settings = Value.Default(pluginSettingsSchema, rawSettings) as PluginSettings;
  if (!pluginSettingsValidator.test(settings)) {
    for (const error of pluginSettingsValidator.errors(settings)) {
      errors.push(error);
    }
  }

  if (errors.length) {
    throw { errors };
  }

  try {
    const decodedSettings = Value.Decode(pluginSettingsSchema, settings);
    const decodedEnv = Value.Decode(envSchema, rawEnv || {});
    return { decodedEnv, decodedSettings };
  } catch (e) {
    if (e instanceof TransformDecodeCheckError || e instanceof TransformDecodeError) {
      throw { errors: [e.error] };
    }
    throw e;
  }
}

export async function returnDataToKernel(repoToken: string, stateId: string, output: object, eventType = "return_data_to_ubiquibot_kernel") {
  const octokit = new Octokit({ auth: repoToken });
  return octokit.repos.createDispatchEvent({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    event_type: eventType,
    client_payload: {
      state_id: stateId,
      output: JSON.stringify(output),
    },
  });
}
