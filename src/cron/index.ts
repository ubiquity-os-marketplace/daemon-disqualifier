import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { customOctokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import db from "./database-handler";

async function main() {
  const logger = new Logs(process.env.LOG_LEVEL ?? "info");
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: Number(process.env.APP_ID),
      privateKey: process.env.APP_PRIVATE_KEY,
      installationId: process.env.APP_INSTALLATION_ID,
    },
  });

  const fileContent = db.data;
  for (const [key, value] of Object.entries(fileContent)) {
    try {
      logger.info(`Triggering update`, {
        key,
        value,
      });
      const [owner, repo] = key.split("/");
      const installation = await octokit.rest.apps.getRepoInstallation({
        owner,
        repo,
      });
      const comment = value.pop();
      if (!comment) {
        logger.error(`No comment was found for repository ${key}`);
        continue;
      }
      const repoOctokit = new customOctokit({
        authStrategy: createAppAuth,
        auth: {
          appId: Number(process.env.APP_ID),
          privateKey: process.env.APP_PRIVATE_KEY,
          installationId: installation.data.id,
        },
      });
      const {
        data: { body = "" },
      } = await repoOctokit.rest.issues.getComment({
        owner,
        repo,
        comment_id: comment.commentId,
        issue_number: comment.issueNumber,
      });
      const newBody = body + `\n<!-- daemon-disqualifier update ${Date().toLocaleString()} -->`;
      logger.info(`Updated comment ${comment.commentId}`, { newBody });
      await repoOctokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: comment.commentId,
        issue_number: comment.issueNumber,
        body: newBody,
      });
    } catch (e) {
      logger.error("Failed to update the comment", { key, value, e });
    }
  }
}

main().catch(console.error);
