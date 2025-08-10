import { createAppAuth } from "@octokit/auth-app";
import { customOctokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import pkg from "../../package.json" with { type: "json" };
import { createKvDatabaseHandler, IssueEntry } from "../adapters/kv-database-handler";

const RATE_LIMIT_MAX_ITEMS_PER_WINDOW = 500;
const RATE_LIMIT_WINDOW_MS = 60_000;

let rateWindowStart = Date.now();
let rateProcessed = 0;
const logger = new Logs(process.env.LOG_LEVEL ?? "info");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - rateWindowStart;

  if (elapsed >= RATE_LIMIT_WINDOW_MS) {
    rateWindowStart = now;
    rateProcessed = 0;
    return;
  }

  if (rateProcessed >= RATE_LIMIT_MAX_ITEMS_PER_WINDOW) {
    const waitMs = RATE_LIMIT_WINDOW_MS - elapsed;
    logger.info("Rate limit reached, waiting for reset.", {
      processedInWindow: rateProcessed,
      windowMs: RATE_LIMIT_WINDOW_MS,
      waitMs,
    });
    await sleep(waitMs);
    rateWindowStart = Date.now();
    rateProcessed = 0;
  }
}

async function main() {
  const octokit = new customOctokit({
    authStrategy: createAppAuth,
    auth: {
      appId: Number(process.env.APP_ID),
      privateKey: process.env.APP_PRIVATE_KEY,
      installationId: process.env.APP_INSTALLATION_ID,
    },
  });

  const kvAdapter = await createKvDatabaseHandler();
  const repositories = await kvAdapter.getAllRepositories();

  logger.info(`Loaded KV data.`, {
    repositories: repositories.length,
  });

  for (const { owner, repo, issues } of repositories) {
    if (issues.length === 0) {
      continue;
    }

    try {
      logger.info(`Triggering update`, {
        organization: owner,
        repository: repo,
        issueIds: issues.map((i: IssueEntry) => i.issueNumber),
      });

      const installation = await octokit.rest.apps.getRepoInstallation({
        owner: owner,
        repo: repo,
      });

      const repoOctokit = new customOctokit({
        authStrategy: createAppAuth,
        auth: {
          appId: Number(process.env.APP_ID),
          privateKey: process.env.APP_PRIVATE_KEY,
          installationId: installation.data.id,
        },
      });

      const { issueNumber, commentId } = issues[0];
      if (!commentId) {
        logger.info("Removing entry without commentId", { owner, repo, issueNumber });
        await kvAdapter.removeIssueByNumber(owner, repo, issueNumber);
        continue;
      }
      const url = `https://github.com/${owner}/${repo}/issues/${issueNumber}#issuecomment-${commentId}`;
      try {
        await enforceRateLimit();
        const {
          data: { body = "" },
        } = await repoOctokit.rest.issues.getComment({
          owner: owner,
          repo: repo,
          issue_number: issueNumber,
          comment_id: commentId,
        });

        const newBody = body + `\n<!-- ${pkg.name} update ${new Date().toISOString()} -->`;
        logger.info(`Updated comment of ${url}`, { newBodyLength: newBody.length, totalIssues: issues.length, issueNumber, commentId });

        await repoOctokit.rest.issues.updateComment({
          owner: owner,
          repo: repo,
          comment_id: commentId,
          body: newBody,
        });
      } catch (err) {
        logger.error("Failed to update individual issue comment", {
          organization: owner,
          repository: repo,
          issueNumber,
          commentId,
          url,
          err,
        });
      } finally {
        rateProcessed++;
      }
    } catch (e) {
      logger.error("Failed to process repository", {
        owner,
        repo,
        issues,
        e,
      });
    }
  }
}

main().catch(console.error);
