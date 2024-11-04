import { FOLLOWUP_HEADER, UNASSIGN_HEADER } from "../types/context";
import { ListIssueForRepo } from "../types/github-types";
import { ContextPlugin } from "../types/plugin-input";
import { collectLinkedPullRequests } from "./collect-linked-pulls";
import { parseIssueUrl } from "./github-url";
import { createStructuredMetadata } from "./structured-metadata";

export async function unassignUserFromIssue(context: ContextPlugin, issue: ListIssueForRepo) {
  const { logger, config } = context;

  if (config.disqualification <= 0) {
    logger.info("The unassign threshold is <= 0, won't unassign users.");
  } else {
    await removeAllAssignees(context, issue);
  }
}

export async function remindAssigneesForIssue(context: ContextPlugin, issue: ListIssueForRepo) {
  const { logger, config } = context;
  const issueItem = parseIssueUrl(issue.html_url);

  const hasLinkedPr = !!(await collectLinkedPullRequests(context, issueItem)).length;
  if (config.warning <= 0) {
    logger.info("The reminder threshold is <= 0, won't send any reminder.");
  } else if (config.pullRequestRequired && !hasLinkedPr) {
    await unassignUserFromIssue(context, issue);
  } else {
    logger.info(`Passed the reminder threshold on ${issue.html_url} sending a reminder.`);
    await remindAssignees(context, issue);
  }
}

async function remindAssignees(context: ContextPlugin, issue: ListIssueForRepo) {
  const { octokit, logger, config } = context;
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

  if (!config.pullRequestRequired) {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body: [logMessage.logMessage.raw, metadata].join("\n"),
    });
  } else {
    const pullRequests = await collectLinkedPullRequests(context, { repo, owner, issue_number });
    let shouldPostToMainIssue = false;
    for (const pullRequest of pullRequests) {
      const { owner: prOwner, repo: prRepo, issue_number: prNumber } = parseIssueUrl(pullRequest.url);
      try {
        await octokit.rest.issues.createComment({
          owner: prOwner,
          repo: prRepo,
          issue_number: prNumber,
          body: [logMessage.logMessage.raw, metadata].join("\n"),
        });
      } catch (e) {
        logger.error(`Could not post to ${pullRequest.url} will post to the issue instead.`, { e });
        shouldPostToMainIssue = true;
      }
    }
    // This is a fallback if we failed to post the reminder to a pull-request, which can happen when posting cross
    // organizations, so we post to the parent issue instead, to make sure the user got a reminder.
    if (shouldPostToMainIssue) {
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number,
        body: [logMessage.logMessage.raw, metadata].join("\n"),
      });
    }
  }
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
  const logMessage = logger.info(`Passed the deadline and no activity is detected, removing assignees: ${logins.map((o) => `@${o}`).join(", ")}.`, {
    issue: issue.html_url,
  });
  const metadata = createStructuredMetadata(UNASSIGN_HEADER, logMessage);

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number,
    body: [logMessage.logMessage.raw, metadata].join("\n"),
  });
  await octokit.rest.issues.removeAssignees({
    owner,
    repo,
    issue_number,
    assignees: logins,
  });
  return true;
}
