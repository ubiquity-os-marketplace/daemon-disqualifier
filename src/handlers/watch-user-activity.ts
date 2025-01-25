import { RestEndpointMethodTypes } from "@octokit/rest";
import { postComment } from "@ubiquity-os/plugin-sdk";
import db from "../cron/database-handler";
import { updateCronState } from "../cron/workflow";
import { getWatchedRepos } from "../helpers/get-watched-repos";
import { removeEntryFromDatabase } from "../helpers/remind-and-remove";
import { parsePriceLabel, parsePriorityLabel } from "../helpers/task-metadata";
import { updateTaskReminder } from "../helpers/task-update";
import { ContextPlugin } from "../types/plugin-input";
import { formatMillisecondsToHumanReadable } from "./time-format";

type IssueType = RestEndpointMethodTypes["issues"]["listForRepo"]["response"]["data"]["0"];

export async function watchUserActivity(context: ContextPlugin) {
  const { logger } = context;

  const repos = await getWatchedRepos(context);

  if (!repos?.length) {
    return { message: logger.info("No watched repos have been found, no work to do.").logMessage.raw };
  }

  if (
    context.eventName === "issues.assigned" &&
    repos.some((repo) => repo.id === context.payload.repository.id) &&
    "issue" in context.payload &&
    !shouldIgnoreIssue(context.payload.issue as IssueType)
  ) {
    const message = ["[!IMPORTANT]"];
    const priorityValue = Math.max(1, context.payload.issue.labels ? parsePriorityLabel(context.payload.issue.labels) : 1);
    if (context.config.pullRequestRequired) {
      message.push(`- Be sure to link a pull-request before the first reminder to avoid disqualification.`);
    }
    message.push(`- Reminders will be sent every \`${formatMillisecondsToHumanReadable(context.config.warning / priorityValue)}\` if there is no activity.`);
    message.push(
      `- Assignees will be disqualified after \`${formatMillisecondsToHumanReadable(context.config.disqualification / priorityValue)}\` of inactivity.`
    );
    const log = logger.error(message.map((o) => `> ${o}`).join("\n"));
    log.logMessage.diff = log.logMessage.raw;
    const commentData = await postComment(context, log);
    if (commentData) {
      await db.update((data) => {
        const dbKey = `${context.payload.repository.owner?.login}/${context.payload.repository.name}`;
        if (!data[dbKey]) {
          data[dbKey] = [];
        }
        if (!data[dbKey].some((o) => o.issueNumber === commentData.issueNumber)) {
          data[dbKey].push({
            commentId: commentData.id,
            issueNumber: commentData.issueNumber,
          });
        }
        return data;
      });
    }
  }

  const repo = context.payload.repository;
  logger.debug(`> Watching user activity for repo: ${repo.name} (${repo.html_url})`);
  await updateReminders(context, repo);
  await updateCronState(context);

  return { message: "OK" };
}

/*
 * We ignore the issue if:
 * - draft
 * - pull request
 * - locked
 * - not in "open" state
 * - not priced (no price label found)
 */
function shouldIgnoreIssue(issue: IssueType) {
  return issue.draft || !!issue.pull_request || issue.locked || issue.state !== "open" || parsePriceLabel(issue.labels) === null;
}

async function updateReminders(context: ContextPlugin, repo: ContextPlugin["payload"]["repository"]) {
  const { logger, octokit, payload } = context;
  const owner = payload.repository.owner?.login;
  if (!owner) {
    throw new Error("No owner found in the payload");
  }
  const issues = await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner,
    repo: repo.name,
    per_page: 100,
    state: "open",
  });

  await Promise.all(
    issues.map(async (issue) => {
      if (shouldIgnoreIssue(issue)) {
        logger.info(`Skipping issue ${issue.html_url} due to the issue not meeting the right criteria.`, {
          draft: issue.draft,
          pullRequest: !!issue.pull_request,
          locked: issue.locked,
          state: issue.state,
          priceLabel: parsePriceLabel(issue.labels),
        });
        return;
      }

      if (issue.assignees?.length || issue.assignee) {
        logger.debug(`Checking assigned issue: ${issue.html_url}`);
        await updateTaskReminder(context, repo, issue);
      } else {
        logger.info(`Skipping issue ${issue.html_url} because no user is assigned.`);
        await removeEntryFromDatabase(issue);
      }
    })
  );
}
