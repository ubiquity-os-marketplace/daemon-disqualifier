import { createAppAuth } from "@octokit/auth-app";
import { customOctokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import pkg from "../../package.json" with { type: "json" };
import { createKvDatabaseHandler } from "../adapters/kv-database-handler";

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

  for (const { owner, repo, issueNumbers } of repositories) {
    if (issueNumbers.length === 0) {
      continue;
    }

    try {
      logger.info(`Triggering update`, {
        organization: owner,
        repository: repo,
        issueIds: issueNumbers,
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

      const issueNumber = issueNumbers[0];
      const url = `https://github.com/${owner}/${repo}/issues/${issueNumber}`;
      try {
        await enforceRateLimit();
        const {
          data: { body = "" },
        } = await repoOctokit.rest.issues.get({
          owner: owner,
          repo: repo,
          issue_number: issueNumber,
        });

        const newBody = body + `\n<!-- ${pkg.name} update ${new Date().toISOString()} -->`;
        logger.info(`Updated body of ${url}`, { newBody, totalIssues: issueNumbers.length, issueNumber });

        await repoOctokit.rest.issues.update({
          owner: owner,
          repo: repo,
          issue_number: issueNumber,
          body: newBody,
        });
      } catch (err) {
        logger.error("Failed to update individual issue", {
          organization: owner,
          repository: repo,
          issueNumber,
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
        issueNumbers,
        e,
      });
    }
  }
}

main().catch(console.error);
