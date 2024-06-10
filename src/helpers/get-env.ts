import { Value } from "@sinclair/typebox/value";
import { ValidationException } from "typebox-validators";
import envConfigSchema, { envConfigValidator } from "../types/env-type";

export async function getEnv() {
  if (!envConfigValidator.test(process.env)) {
    for (const error of envConfigValidator.errors(process.env)) {
      console.error(error);
    }
    return Promise.reject(new ValidationException("The environment is invalid."));
  }
  return Promise.resolve(Value.Decode(envConfigSchema, process.env));
}
