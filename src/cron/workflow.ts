import { createAppAuth } from "@octokit/auth-app";
import { customOctokit } from "@ubiquity-os/plugin-sdk/octokit";
import { ContextPlugin } from "../types/plugin-input";

export async function updateCronState(context: ContextPlugin) {
  context.logger.info("Updating the cron.yml workflow state.");

  if (!process.env.GITHUB_REPOSITORY) {
    context.logger.warn("Can't update the Action Workflow state as GITHUB_REPOSITORY is missing from the env.");
    return;
  }

  const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");

  try {
    const appOctokit = new customOctokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.APP_ID,
        privateKey: process.env.APP_PRIVATE_KEY,
      },
    });
    let authOctokit;
    if (!process.env.APP_ID || !process.env.APP_PRIVATE_KEY) {
      context.logger.warn("APP_ID or APP_PRIVATE_KEY are missing from the env, will use the default Octokit instance.");
      authOctokit = context.octokit;
    } else {
      const installation = await appOctokit.rest.apps.getRepoInstallation({
        owner,
        repo,
      });
      authOctokit = new customOctokit({
        authStrategy: createAppAuth,
        auth: {
          appId: process.env.APP_ID,
          privateKey: process.env.APP_PRIVATE_KEY,
          installationId: installation.data.id,
        },
      });
    }
    const hasData = await context.adapters.kv.hasData();
    if (hasData) {
      context.logger.verbose("Enabling cron.yml workflow.", { owner, repo });
      await authOctokit.rest.actions.enableWorkflow({
        owner,
        repo,
        workflow_id: "cron.yml",
      });
    } else {
      context.logger.verbose("Disabling cron.yml workflow.");
      await authOctokit.rest.actions.disableWorkflow({
        owner,
        repo,
        workflow_id: "cron.yml",
      });
    }
  } catch (e) {
    context.logger.error("Could not enable / disable the CRON workflow.", {
      e,
    });
  }
}
