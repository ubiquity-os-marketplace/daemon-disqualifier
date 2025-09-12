import { RestEndpointMethodTypes } from "@octokit/rest";
import { updateCronState } from "../cron/workflow";
import { removeEntryFromDatabase } from "../helpers/remind-and-remove";
import { commentUpdateMetadataPattern } from "../helpers/structured-metadata";
import { getPriorityValue, parsePriceLabel } from "../helpers/task-metadata";
import { updateTaskReminder } from "../helpers/task-update";
import { ContextPlugin } from "../types/plugin-input";
import { formatMillisecondsToHumanReadable } from "./time-format";

type IssueType = RestEndpointMethodTypes["issues"]["listForRepo"]["response"]["data"]["0"];

function isIssueComment(context: ContextPlugin): context is ContextPlugin<"issue_comment.edited"> {
  return "comment" in context.payload;
}

export async function watchUserActivity(context: ContextPlugin) {
  const { logger } = context;

  if (
    ["issues.assigned", "issues.reopened"].includes(context.eventName) &&
    "issue" in context.payload &&
    !shouldIgnoreIssue(context.payload.issue as IssueType)
  ) {
    const message = ["[!IMPORTANT]"];
    const priorityValue = getPriorityValue(context);
    if (context.config.pullRequestRequired) {
      message.push(`- Be sure to link a pull-request before the first reminder to avoid disqualification.`);
    }
    message.push(
      `- Reminders will be sent every \`${formatMillisecondsToHumanReadable(context.config.followUpInterval / priorityValue)}\` if there is no activity.`
    );
    message.push(
      `- Assignees will be disqualified after \`${formatMillisecondsToHumanReadable(context.config.negligenceThreshold / priorityValue)}\` of inactivity.`
    );
    const log = logger.error(message.map((o) => `> ${o}`).join("\n"));
    log.logMessage.diff = log.logMessage.raw;
    const commentData = await context.commentHandler.postComment(context, log);
    if (commentData) {
      await context.adapters.kv.addIssue(context.payload.issue.html_url, commentData.id);
    }
    // We return early not to run the reminders section, which is handled by the CRON (avoids multiple reminders)
    return { message: "OK" };
  }

  if (isIssueComment(context)) {
    if (commentUpdateMetadataPattern.test(context.payload.comment.body)) {
      const repo = context.payload.repository;
      logger.debug(`> Watching user activity for repo: ${repo.name} (${repo.html_url})`);
      await updateReminders(context, repo);
      await updateCronState(context);
      return { message: "OK" };
    } else {
      return { message: logger.warn("The comment is not related to any daemon-disqualifier comment edit.").logMessage.raw };
    }
  }
  return { message: logger.warn(`Unsupported event ${context.eventName}`).logMessage.raw };
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

  // We use a for of loop instead of a promise to actually give some delay between updates. It helps not reach API
  // limits and concurrency when committing the updated DB
  for (const issue of issues) {
    if (shouldIgnoreIssue(issue)) {
      logger.info(`Skipping issue ${issue.html_url} due to the issue not meeting the right criteria.`, {
        draft: issue.draft,
        pullRequest: !!issue.pull_request,
        locked: issue.locked,
        state: issue.state,
        priceLabel: parsePriceLabel(issue.labels),
      });
      continue;
    }

    if (issue.assignees?.length || issue.assignee) {
      logger.debug(`Checking assigned issue: ${issue.html_url}`);
      await updateTaskReminder(context, repo, issue);
    } else {
      logger.info(`Skipping issue ${issue.html_url} because no user is assigned.`);
      await removeEntryFromDatabase(context, issue);
    }
  }
}
