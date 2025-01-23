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
      const comment = value.pop();
      if (!comment) {
        logger.error(`No comment was found for repository ${key}`);
        continue;
      }
      const {
        data: { body = "" },
      } = await octokit.rest.issues.getComment({
        owner,
        repo,
        comment_id: comment.commentId,
        issue_number: comment.issueNumber,
      });
      const newBody = body + `\n<!-- daemon-disqualifier update ${Date().toLocaleString()} -->`;
      logger.debug(`Update comment ${comment.commentId}`, { newBody });
      await octokit.rest.issues.updateComment({
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
