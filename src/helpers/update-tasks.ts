import { DateTime } from "luxon";
import { collectLinkedPullRequests } from "../handlers/collect-linked-pulls";
import { Context } from "../types/context";
import { getWatchedRepos } from "./get-watched-repos";
import { parseIssueUrl } from "./github-url";
import { GitHubListEvents, ListCommentsForIssue, ListForOrg, ListIssueForRepo } from "../types/github-types";

export async function updateTasks(context: Context) {
  const {
    logger,
  } = context;

  const repos = await getWatchedRepos(context);

  if (!repos?.length) {
    logger.info("No watched repos have been found, no work to do.");
    return false;
  }

  for (const repo of repos) {
    logger.info(`Updating reminders for ${repo.owner.login}/${repo.name}`);
    await updateReminders(context, repo);
  }

  return true;
}

async function updateReminders(context: Context, repo: ListForOrg["data"][0]) {
  const {
    octokit
  } = context;
  const issues = await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner: context.payload.repository.owner.login,
    repo: repo.name,
    per_page: 100,
    state: "open",
  }) as ListIssueForRepo[];

  for (const issue of issues) {
    if (issue.assignees?.length || issue.assignee) {
      await updateReminderForIssue(context, repo, issue);
    }
  }
}

async function updateReminderForIssue(context: Context, repo: ListForOrg["data"][0], issue: ListIssueForRepo) {
  const {
    logger,
    config,
    octokit
  } = context;
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner: repo.owner.login,
    repo: repo.name,
    issue_number: issue.number,
    per_page: 100,
  }) as ListCommentsForIssue[];

  const botComments = comments.filter((o) => o.user?.type === "Bot");
  const taskDeadlineJsonRegex = /"taskDeadline": "([^"]*)"/g;
  const taskAssigneesJsonRegex = /"taskAssignees": \[([^\]]*)\]/g;
  const assignmentRegex = /Ubiquity - Assignment - start -/gi;
  const botAssignmentComments = sortAndReturn(botComments.filter((o) => assignmentRegex.test(o?.body || "")), "desc");
  const botFollowup = /this task has been idle for a while. Please provide an update./gi;
  const botFollowupComments = botComments.filter((o) => botFollowup.test(o?.body || ""));

  if (!botAssignmentComments.length && !botFollowupComments.length) {
    logger.info(`No assignment or followup comments found for ${issue.url}`);
    return false;
  }

  const lastCheckComment = botFollowupComments[0]?.created_at ? botFollowupComments[0] : botAssignmentComments[0];
  const lastCheck = DateTime.fromISO(lastCheckComment.created_at);

  const taskDeadlineMatch = taskDeadlineJsonRegex.exec(botAssignmentComments[0]?.body || "");
  const taskAssigneesMatch = taskAssigneesJsonRegex.exec(botAssignmentComments[0]?.body || "");

  if (!taskDeadlineMatch || !taskAssigneesMatch) {
    logger.error(`Missing metadata from ${issue.url}`);
    return false;
  }

  const metadata = {
    taskDeadline: taskDeadlineMatch[1],
    taskAssignees: taskAssigneesMatch[1].split(",").map((o) => o.trim()).map(Number),
  };

  if (!metadata.taskAssignees.length) {
    logger.error(`No assignees found for ${issue.url}`);
    return false;
  } else if (metadata.taskAssignees.length && issue.assignees?.length && metadata.taskAssignees.some((a) => !issue.assignees?.map((o) => o.id).includes(a))) {
    logger.error(`Assignees mismatch found for ${issue.url}`);
    return false;
  }

  if (!metadata.taskDeadline) {
    logger.info(`No deadline found for ${issue.url}`);
    return false;
  }
  const deadline = DateTime.fromFormat(metadata?.taskDeadline, "EEE, LLL d, h:mm a 'UTC'")
  const now = DateTime.now();

  if (!deadline.isValid && !lastCheck.isValid) {
    logger.error(`Invalid date found on ${issue.url}`);
    return false;
  }

  const activity = (await getAssigneesActivityForIssue(context, issue)).filter((o) => DateTime.fromISO(o.created_at) > lastCheck)

  let deadlineWithThreshold = deadline.plus({ milliseconds: config.disqualification });
  let reminderWithThreshold = deadline.plus({ milliseconds: config.warning });

  if (activity?.length) {
    const lastActivity = DateTime.fromISO(activity[0].created_at);
    deadlineWithThreshold = lastActivity.plus({ milliseconds: config.disqualification });
    reminderWithThreshold = lastActivity.plus({ milliseconds: config.warning });
  }

  if (now >= deadlineWithThreshold) {
    await unassignUserFromIssue(context, issue);
  } else if (now >= reminderWithThreshold) {
    await remindAssigneesForIssue(context, issue);
  } else {
    logger.info(
      `Nothing to do for ${issue.html_url}, still within due-time (now: ${now.toLocaleString(DateTime.DATETIME_MED)}, reminder ${reminderWithThreshold.toLocaleString(DateTime.DATETIME_MED)}, deadline: ${deadlineWithThreshold.toLocaleString(DateTime.DATETIME_MED)})`
    );
  }
}

function sortAndReturn(array: ListCommentsForIssue[], direction: "asc" | "desc") {
  return array.sort((a, b) => {
    if (direction === "asc") {
      return DateTime.fromISO(a.created_at).toMillis() - DateTime.fromISO(b.created_at).toMillis();
    } else {
      return DateTime.fromISO(b.created_at).toMillis() - DateTime.fromISO(a.created_at).toMillis();
    }
  });
}

async function unassignUserFromIssue(context: Context, issue: ListIssueForRepo) {
  const {
    logger,
    config,
  } = context;

  if (config.disqualification <= 0) {
    logger.info("The unassign threshold is <= 0, won't unassign users.");
  } else {
    logger.info(`Passed the deadline on ${issue.url} and no activity is detected, removing assignees.`);
    await removeAllAssignees(context, issue)
  }
}

async function remindAssigneesForIssue(context: Context, issue: ListIssueForRepo) {
  const {
    logger,
    config,
  } = context;
  if (config.warning <= 0) {
    logger.info("The reminder threshold is <= 0, won't send any reminder.");
  } else {
    await remindAssignees(context, issue)
  }
}

/**
 * Retrieves all the activity for users that are assigned to the issue. Also takes into account linked pull requests.
 */
async function getAssigneesActivityForIssue(context: Context, issue: ListIssueForRepo) {
  const gitHubUrl = parseIssueUrl(issue.html_url);
  const issueEvents: GitHubListEvents[] = await context.octokit.paginate(context.octokit.rest.issues.listEvents, {
    owner: gitHubUrl.owner,
    repo: gitHubUrl.repo,
    issue_number: gitHubUrl.issue_number,
    per_page: 100,
  });
  const linkedPullRequests = await collectLinkedPullRequests(context, gitHubUrl);
  for (const linkedPullRequest of linkedPullRequests) {
    const { owner, repo, issue_number } = parseIssueUrl(linkedPullRequest.source.issue.html_url);
    const events = await context.octokit.paginate(context.octokit.rest.issues.listEvents, {
      owner,
      repo,
      issue_number,
      per_page: 100,
    });
    issueEvents.push(...events);
  }
  const assignees = issue.assignees ? issue.assignees.map((assignee) => assignee.login) : issue.assignee ? [issue.assignee.login] : [];

  return issueEvents.reduce((acc, event) => {
    if (event.actor && event.actor.login && event.actor.login) {

      if (assignees.includes(event.actor.login))
        acc.push(event);
    }
    return acc;
  }, [] as GitHubListEvents[])
    .sort((a, b) => DateTime.fromISO(b.created_at).toMillis() - DateTime.fromISO(a.created_at).toMillis());
}

async function remindAssignees(context: Context, issue: ListIssueForRepo) {
  const { octokit, logger } = context;
  const { repo, owner, issue_number } = parseIssueUrl(issue.html_url);

  if (!issue?.assignees?.length) {
    logger.error(`Missing Assignees from ${issue.url}`);
    return false;
  }
  const logins = issue.assignees
    .map((o) => o?.login)
    .filter((o) => !!o)
    .join(", @");

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number,
    body: `@${logins}, this task has been idle for a while. Please provide an update.`,
  });
  return true;
}

async function removeAllAssignees(context: Context, issue: ListIssueForRepo) {
  const { octokit, logger } = context;
  const { repo, owner, issue_number } = parseIssueUrl(issue.html_url);

  if (!issue?.assignees?.length) {
    logger.error(`Missing Assignees from ${issue.url}`);
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
