import { Octokit } from "@octokit/rest";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import db from "./database-handler";

async function main() {
  const logger = new Logs(process.env.LOG_LEVEL ?? "info");
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });
  const fileContent = db.data;
  for (const [key, value] of Object.entries(fileContent)) {
    try {
      logger.info(`Triggering update`, {
        key,
        value,
      });
      const [owner, repo] = key.split("/");
      const {
        data: { body = "" },
      } = await octokit.rest.issues.getComment({
        owner,
        repo,
        comment_id: value.commentId,
        issue_number: value.issueNumber,
      });
      const newBody = body + `\n<!-- daemon-disqualifier update ${Date().toLocaleString()} -->`;
      logger.debug(`Update comment ${value.commentId}`, { newBody });
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: value.commentId,
        issue_number: value.issueNumber,
        body: newBody,
      });
      delete db.data[key];
    } catch (e) {
      logger.error("Failed to update the comment", { key, value, e });
    }
  }
  await db.write();
  logger.info(`Saved updated database.`);
  if (Object.keys(fileContent).length === 0) {
    logger.info("No more repositories to watch, disabling the CRON workflow.");
  }
}

main().catch(console.error);
