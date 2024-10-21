import { FOLLOWUP_HEADER } from "../types/context";
import { ListIssueForRepo } from "../types/github-types";
import { ContextPlugin } from "../types/plugin-input";
import { parseIssueUrl } from "./github-url";
import { createStructuredMetadata } from "./structured-metadata";

export async function unassignUserFromIssue(context: ContextPlugin, issue: ListIssueForRepo) {
  const { logger, config } = context;

  if (config.disqualification <= 0) {
    logger.info("The unassign threshold is <= 0, won't unassign users.");
  } else {
    logger.info(`Passed the deadline on ${issue.html_url} and no activity is detected, removing assignees.`);
    await removeAllAssignees(context, issue);
  }
}

export async function remindAssigneesForIssue(context: ContextPlugin, issue: ListIssueForRepo) {
  const { logger, config } = context;
  if (config.warning <= 0) {
    logger.info("The reminder threshold is <= 0, won't send any reminder.");
  } else {
    logger.info(`Passed the reminder threshold on ${issue.html_url}, sending a reminder.`);
    await remindAssignees(context, issue);
  }
}

async function remindAssignees(context: ContextPlugin, issue: ListIssueForRepo) {
  const { octokit, logger } = context;
  const { repo, owner, issue_number } = parseIssueUrl(issue.html_url);

  if (!issue?.assignees?.length) {
    logger.error(`Missing Assignees from ${issue.html_url}`);
    return false;
  }
  const logins = issue.assignees
    .map((o) => o?.login)
    .filter((o) => !!o)
    .join(", @");

  const logMessage = logger.info(`@${logins}, this task has been idle for a while. Please provide an update.\n\n`, {
    taskAssignees: issue.assignees.map((o) => o?.id),
  });

  const metadata = createStructuredMetadata(FOLLOWUP_HEADER, logMessage);

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number,
    body: [logMessage.logMessage.raw, metadata].join("\n"),
  });
  return true;
}

async function removeAllAssignees(context: ContextPlugin, issue: ListIssueForRepo) {
  const { octokit, logger } = context;
  const { repo, owner, issue_number } = parseIssueUrl(issue.html_url);

  if (!issue?.assignees?.length) {
    logger.error(`Missing Assignees from ${issue.html_url}`);
    return false;
  }
  const logins = issue.assignees.map((o) => o?.login).filter((o) => !!o) as string[];
  await octokit.rest.issues.removeAssignees({
    owner,
    repo,
    issue_number,
    assignees: logins,
  });
  return true;
}
