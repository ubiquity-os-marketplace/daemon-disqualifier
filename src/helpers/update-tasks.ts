import { DateTime } from "luxon";
import { Context } from "../types/context";
import { Database } from "../types/database";
import { parseGitHubUrl } from "./github-url";

async function updateReminders(context: Context, issue: Database["public"]["Tables"]["repositories"]["Row"]) {
  const {
    adapters: { supabase },
    logger,
    config,
  } = context;
  const now = DateTime.now();
  const activity = await getAssigneesActivityForIssue(context, issue);
  const deadline = DateTime.fromISO(issue.deadline);
  const deadlineWithThreshold = deadline.plus({ day: config.unassignUserThreshold });
  const reminderWithThreshold = deadline.plus({ day: config.sendRemindersThreshold });

  if (activity?.length) {
    const lastCheck = DateTime.fromISO(issue.last_check);
    const timeDiff = now.diff(lastCheck);
    const newDeadline = deadline.plus(timeDiff);
    logger.info(
      `Activity found on ${issue.url}, will move the deadline forward from ${deadline.toLocaleString(DateTime.DATETIME_MED)} to ${newDeadline.toLocaleString(DateTime.DATETIME_MED)}`
    );
    await supabase.repositories.upsert({ url: issue.url, deadline: newDeadline.toJSDate(), lastCheck: now.toJSDate() });
  } else {
    if (now >= deadlineWithThreshold) {
      logger.info(`Passed the deadline on ${issue.url} and no activity is detected, removing assignees.`);
      await removeIdleAssignees(context, issue);
      await supabase.repositories.delete(issue.url);
    } else if (now >= reminderWithThreshold) {
      const lastReminder = issue.last_reminder;
      logger.info(`We are passed the deadline on ${issue.url}, should we send a reminder? ${!!lastReminder}`);
      if (!lastReminder) {
        await remindAssignees(context, issue);
        await supabase.repositories.upsert({
          url: issue.url,
          deadline: deadline.toJSDate(),
          lastReminder: now.toJSDate(),
          lastCheck: now.toJSDate(),
        });
      }
    }
  }
}

export async function updateTask(context: Context, issue: Database["public"]["Tables"]["repositories"]["Row"]) {
  const {
    adapters: { supabase },
    logger,
  } = context;
  const watchedRepo = await supabase.repositories.getSingle(issue.url);
  if (!watchedRepo) {
    logger.info(`${issue.url} could not be retrieved, skipping.`);
    return false;
  }
  await updateReminders(context, issue);
  return true;
}

export async function updateTasks(context: Context) {
  const {
    adapters: { supabase },
    logger,
  } = context;
  const watchedRepoList = await supabase.repositories.get();

  if (!watchedRepoList?.length) {
    logger.info("No watched repos have been found, no work to do.");
    return false;
  }
  for (const watchedIssue of watchedRepoList) {
    await updateReminders(context, watchedIssue);
  }
  return true;
}

async function getAssigneesActivityForIssue({ octokit, payload }: Context, issue: Database["public"]["Tables"]["repositories"]["Row"]) {
  const { repo, owner, issue_number } = parseGitHubUrl(issue.url);
  return octokit.paginate(
    octokit.rest.issues.listEvents,
    {
      owner,
      repo,
      issue_number,
      per_page: 100,
    },
    (res) => res.data.filter((o) => payload.issue?.assignees?.find((assignee) => assignee?.login === o.actor.login))
  );
}

async function remindAssignees(context: Context, issue: Database["public"]["Tables"]["repositories"]["Row"]) {
  const { octokit, payload } = context;
  const githubIssue = await getGithubIssue(context, issue);

  if (!githubIssue?.assignees?.length) {
    return;
  }
  const logins = payload.issue.assignees
    .map((o) => o?.login)
    .filter((o) => !!o)
    .join(", @");
  await octokit.rest.issues.createComment({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    issue_number: payload.issue.number,
    body: `@${logins}, this task has been idle for a while. Please provide an update.`,
  });
}

async function removeIdleAssignees(context: Context, issue: Database["public"]["Tables"]["repositories"]["Row"]) {
  const { octokit, payload } = context;
  const githubIssue = await getGithubIssue(context, issue);

  if (!githubIssue?.assignees?.length) {
    return;
  }
  const logins = payload.issue.assignees.map((o) => o?.login).filter((o) => !!o) as string[];
  await octokit.rest.issues.removeAssignees({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    issue_number: payload.issue.number,
    assignees: logins,
  });
}

async function getGithubIssue(context: Context, issue: Database["public"]["Tables"]["repositories"]["Row"]) {
  const { repo, owner, issue_number } = parseGitHubUrl(issue.url);

  try {
    const { data } = await context.octokit.issues.get({
      owner,
      repo,
      issue_number,
    });
    return data;
  } catch (e) {
    context.logger.error(`Could not get GitHub issue ${issue.url}`);
    return null;
  }
}
