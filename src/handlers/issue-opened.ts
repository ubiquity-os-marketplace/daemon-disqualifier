import { Result } from "../proxy";
import { EnvConfigType } from "../types/env-type";
import { PluginInputs } from "../types/plugin-inputs";

export function handleIssueOpened(inputs: PluginInputs, env: EnvConfigType): Result {
  console.log(inputs, env);
  return { status: "ok" };
}
