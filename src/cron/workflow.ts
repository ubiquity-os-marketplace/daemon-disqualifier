import { ContextPlugin } from "../types/plugin-input";
import db from "./database-handler";

export async function updateCronState(context: ContextPlugin) {
  await db.update((data) => {
    for (const key of Object.keys(data)) {
      if (!data[key].length) {
        delete data[key];
      }
    }
    return data;
  });

  if (!process.env.GITHUB_REPOSITORY) {
    context.logger.error("Can't update the Action Workflow state as GITHUB_REPOSITORY is missing from the env.");
    return;
  }

  const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");

  if (Object.keys(db.data).length) {
    context.logger.verbose("Enabling cron.yml workflow.");
    await context.octokit.rest.actions.enableWorkflow({
      owner,
      repo,
      workflow_id: "cron.yml",
    });
  } else {
    context.logger.verbose("Disabling cron.yml workflow.");
    await context.octokit.rest.actions.disableWorkflow({
      owner,
      repo,
      workflow_id: "cron.yml",
    });
  }
}
