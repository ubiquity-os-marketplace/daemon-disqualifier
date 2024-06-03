import { ValidationException } from "typebox-validators";
import program from "./parser/payload";
import { proxyCallbacks } from "./proxy";
import { EnvConfigType, envConfigValidator } from "./types/env-type";

export async function run(env: EnvConfigType) {
  // console.log(JSON.stringify(program, null, 2));
  if (!envConfigValidator.test(process.env)) {
    for (const error of envConfigValidator.errors(process.env)) {
      console.error(error);
    }
    return Promise.reject(new ValidationException("The environment is invalid."));
  }
  return proxyCallbacks[program.eventName](env);
}
