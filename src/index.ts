import * as core from "@actions/core";
import program from "./parser/payload";
import { run } from "./run";

run(program)
  .then((result) => {
    core?.setOutput("result", result);
  })
  .catch((e) => {
    console.error("Failed to run user-activity-watcher:", e);
    core?.setFailed(e.toString());
  });
