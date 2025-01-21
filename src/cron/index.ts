import { Octokit } from "@octokit/rest";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import * as fs from "node:fs";
import path from "node:path";

interface DbComment {
  [repo: string]: {
    commentId: string;
    issueNumber: number;
  };
}

async function main() {
  const logger = new Logs(process.env.LOG_LEVEL ?? "info");
  const octokit = new Octokit();

  const fileContent = JSON.parse(fs.readFileSync(path.join(__dirname, "./db.json"), { encoding: "utf8" })) as DbComment;
  for (const [key, value] of Object.entries(fileContent.comments)) {
    logger.info(`Triggering update through comments ${key} (${value})`);
    await octokit.rest.issues.updateComment({
      owner: key,
      repo: key,
      comment_id: 1,
      issue_number: value,
      body: "",
    });
  }
}

main().catch(console.error);
