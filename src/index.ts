import * as core from "@actions/core";
import { getEnv } from "./helpers/get-env";
import program from "./parser/payload";
import { run } from "./run";

getEnv()
  .then((env) => run(program, env))
  .then((result) => {
    core?.setOutput("result", result);
  })
  .catch((e) => {
    console.error("Failed to run user-activity-watcher:", e);
    core?.setFailed(e.toString());
  });
