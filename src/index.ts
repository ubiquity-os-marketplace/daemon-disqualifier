import * as core from "@actions/core";
import { Value } from "@sinclair/typebox/value";
import { ValidationException } from "typebox-validators";
import program from "./parser/payload";
import { run } from "./run";
import envConfigSchema, { envConfigValidator } from "./types/env-type";

export async function getEnv() {
  if (!envConfigValidator.test(process.env)) {
    for (const error of envConfigValidator.errors(process.env)) {
      console.error(error);
    }
    return Promise.reject(new ValidationException("The environment is invalid."));
  }
  return Promise.resolve(Value.Decode(envConfigSchema, process.env));
}

getEnv()
  .then((env) => run(program, env))
  .then((result) => {
    core?.setOutput("result", result);
  })
  .catch((e) => {
    console.error("Failed to run user-activity-watcher:", e);
    core?.setFailed(e.toString());
  });
