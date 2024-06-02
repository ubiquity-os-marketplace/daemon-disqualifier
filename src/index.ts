import * as core from "@actions/core";
import program from "./parser/payload";

async function main() {
  console.log(program);
  if (program.eventName === "issues") {
    console.log("running");
    return JSON.stringify({ status: "ok" });
  } else {
    console.warn(`${program.eventName} is not supported, skipping.`);
    return JSON.stringify({ status: "skipped", reason: "unsupported_event" });
  }
}

main()
  .then((result) => {
    core?.setOutput("result", result);
  })
  .catch((e) => {
    console.error("Failed to run user-activity-watcher:", e);
    core?.setFailed(e.toString());
  });
