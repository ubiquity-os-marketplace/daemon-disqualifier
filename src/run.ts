import { Value } from "@sinclair/typebox/value";
import { ValidationException } from "typebox-validators";
import program from "./parser/payload";
import { proxyCallbacks } from "./proxy";
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

  return JSON.stringify(proxyCallbacks[program.eventName](program, env));
}
