import { createAppAuth } from "@octokit/auth-app";
import { CommentHandler } from "@ubiquity-os/plugin-sdk";
import { customOctokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { createPostgresIssueStore, IssueStore } from "../adapters/postgres-issue-store";
import { resolveCronRepoConfig } from "./configuration";
import { runRemindersForRepository } from "../handlers/watch-user-activity";
import { populateDeadlineExtensionsThresholds } from "../run";
import { ContextPlugin, PluginSettings } from "../types/plugin-input";

const RATE_LIMIT_MAX_ITEMS_PER_WINDOW = 500;
const RATE_LIMIT_WINDOW_MS = 60_000;

let rateWindowStart = Date.now();
let rateProcessed = 0;
const logger = new Logs(process.env.LOG_LEVEL ?? "info");

interface AppAuth {
  appId: number;
  privateKey: string;
}

type RepoIssue = Awaited<ReturnType<ContextPlugin["octokit"]["rest"]["issues"]["get"]>>["data"];

function normalizeMultilineSecret(value: string): string {
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

function getAppAuth(): AppAuth {
  const appId = Number(process.env.APP_ID);
  const privateKey = normalizeMultilineSecret(process.env.APP_PRIVATE_KEY ?? "");

  if (!appId || Number.isNaN(appId)) {
    throw new Error("APP_ID is missing or invalid.");
  }

  if (!privateKey.trim()) {
    throw new Error("APP_PRIVATE_KEY is missing.");
  }

  return { appId, privateKey };
}

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
    logger.warn("Rate limit reached, waiting for reset.", {
      processedInWindow: rateProcessed,
      windowMs: RATE_LIMIT_WINDOW_MS,
      waitMs,
    });
    await sleep(waitMs);
    rateWindowStart = Date.now();
    rateProcessed = 0;
  }
}

async function getInstallationOctokit(appOctokit: ContextPlugin["octokit"], owner: string, repo: string, appAuth: AppAuth) {
  const installation = await appOctokit.rest.apps.getRepoInstallation({
    owner,
    repo,
  });

  return new customOctokit({
    authStrategy: createAppAuth,
    auth: {
      appId: appAuth.appId,
      privateKey: appAuth.privateKey,
      installationId: installation.data.id,
    },
  });
}

async function resolveRepoConfig(octokit: ContextPlugin["octokit"], owner: string, repo: string): Promise<PluginSettings | null> {
  return resolveCronRepoConfig(octokit, logger, owner, repo);
}

function buildCronContext(args: {
  owner: string;
  repo: string;
  issue: RepoIssue;
  config: PluginSettings;
  octokit: ContextPlugin["octokit"];
  issueStore: IssueStore;
}): ContextPlugin {
  return {
    authToken: "",
    command: null,
    commentHandler: new CommentHandler(),
    config: args.config,
    env: {},
    eventName: "issue_comment.edited",
    logger,
    octokit: args.octokit,
    payload: {
      action: "edited",
      installation: { id: 0 },
      issue: args.issue,
      organization: { login: args.owner },
      repository: {
        html_url: `https://github.com/${args.owner}/${args.repo}`,
        name: args.repo,
        owner: {
          login: args.owner,
        },
      },
      sender: {
        id: 0,
        login: "daemon-disqualifier-cron",
        type: "Bot",
      },
    },
    adapters: {
      issueStore: args.issueStore,
      async close() {},
    },
  } as unknown as ContextPlugin;
}

export async function runCronJob() {
  let appAuth: AppAuth;
  try {
    appAuth = getAppAuth();
  } catch (err) {
    logger.error("Cannot run CRON job due to missing GitHub App credentials.", { err });
    throw err;
  }

  const appOctokit = new customOctokit({
    authStrategy: createAppAuth,
    auth: {
      appId: appAuth.appId,
      privateKey: appAuth.privateKey,
    },
  });

  const issueStore = await createPostgresIssueStore();

  try {
    const repositories = await issueStore.getAllRepositories();

    logger.ok(`Loaded tracked issue data.`, {
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

        const repoOctokit = await getInstallationOctokit(appOctokit, owner, repo, appAuth);
        let issueToTrigger: RepoIssue | null = null;

        for (const issueNumber of issueNumbers) {
          const url = `https://github.com/${owner}/${repo}/issues/${issueNumber}`;
          try {
            await enforceRateLimit();
            const issueResponse = await repoOctokit.rest.issues.get({ owner, repo, issue_number: issueNumber });
            const hasAssignees = !!(issueResponse.data.assignee || issueResponse.data.assignees?.length);
            if (issueResponse.data.state !== "open" || !hasAssignees) {
              logger.debug("Removing entry due to issue closed or no assignees", {
                owner,
                repo,
                issueNumber,
                state: issueResponse.data.state,
                assignees: issueResponse.data.assignees?.map((a) => a?.login),
              });
              await issueStore.removeIssueByNumber(owner, repo, issueNumber);
              continue;
            }

            issueToTrigger = issueResponse.data;
            logger.ok(`Selected issue for CRON reminder sweep (stopping after first valid issue).`, {
              totalIssues: issueNumbers.length,
              issueNumber,
              url,
            });
            break;
          } catch (err) {
            logger.error("Failed to process issue", {
              organization: owner,
              repository: repo,
              issueNumber,
              url,
              err,
            });
          } finally {
            rateProcessed++;
          }
        }

        if (!issueToTrigger) {
          logger.debug("No valid issue found to trigger CRON reminder sweep.", {
            owner,
            repo,
          });
          continue;
        }

        const config = await resolveRepoConfig(repoOctokit, owner, repo);
        if (!config) {
          logger.warn("No plugin configuration found for repository; skipping CRON reminder sweep.", { owner, repo });
          continue;
        }

        const context = buildCronContext({
          owner,
          repo,
          issue: issueToTrigger,
          config,
          octokit: repoOctokit,
          issueStore,
        });

        await populateDeadlineExtensionsThresholds(context);
        await runRemindersForRepository(context, context.payload.repository);
        logger.ok("Processed repository updates directly through CRON reminder sweep.", {
          owner,
          repo,
          issueNumber: issueToTrigger.number,
        });
      } catch (e) {
        logger.error("Failed to process repository", {
          owner,
          repo,
          issueNumbers,
          e,
        });
      }
    }
  } finally {
    await issueStore.close();
  }
}
