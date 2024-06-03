import { ValidationException } from "typebox-validators";
import program from "./parser/payload";
import { EnvConfigType, envConfigValidator } from "./types/env-type";

export async function run(env: EnvConfigType) {
  console.log(JSON.stringify(program, null, 2));
  if (!envConfigValidator.test(process.env)) {
    for (const error of envConfigValidator.errors(process.env)) {
      console.error(error);
    }
    return Promise.reject(new ValidationException("The environment is invalid."));
  }
  if (program.eventName === "issues") {
    console.log("running", env);
    return JSON.stringify({ status: "ok" });
  } else {
    console.warn(`${program.eventName} is not supported, skipping.`);
    return JSON.stringify({ status: "skipped", reason: "unsupported_event" });
  }
}
