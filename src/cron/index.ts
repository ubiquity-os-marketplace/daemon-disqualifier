import { Octokit } from "@octokit/rest";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import * as fs from "node:fs";
import path from "node:path";

interface DbComment {
  [repo: string]: {
    commentId: number;
    issueNumber: number;
  };
}

async function main() {
  const logger = new Logs(process.env.LOG_LEVEL ?? "info");
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });
  const filePath = path.join(process.env.GITHUB_WORKSPACE || import.meta.dirname, "./db.json");
  const file = fs.readFileSync(filePath, { encoding: "utf8", flag: "a+" }) || "{}";

  const fileContent = JSON.parse(file) as DbComment;
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
      delete fileContent[key];
    } catch (e) {
      logger.error("Failed to update the comment", { key, value, e });
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(fileContent, null, 2));
  logger.info(`Saved updated database.`, {
    filePath,
  });
  if (Object.keys(fileContent).length === 0) {
    logger.info("No more repositories to watch, disabling the CRON workflow.");
  }
}

main().catch(console.error);
