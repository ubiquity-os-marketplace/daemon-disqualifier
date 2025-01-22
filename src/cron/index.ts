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
  const filePath = path.join(import.meta.dirname, "./db.json");
  const file = fs.readFileSync(filePath, { encoding: "utf8", flag: "a+" }) || "{}";

  console.log("->", file);
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
    } catch (e) {
      logger.error("Failed to update the comment", { e });
    }
  }
  // commit file
  // disable workflow?
  fs.writeFileSync(filePath, JSON.stringify(fileContent, null, 2));
  // await octokit.rest.actions.disableWorkflow({
  //   owner
  // })
  logger.info(`Saved updated database.`, {
    filePath,
  });
}

main().catch(console.error);
