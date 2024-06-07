import { DateTime } from "luxon";
import { Context } from "../types/context";
import { Database } from "../types/database";
import { parseGitHubUrl } from "./github-url";

export async function updateTasks(context: Context) {
  const {
    adapters: { supabase },
    logger,
    config,
  } = context;
  const watchedRepoList = await supabase.repositories.get();

  if (!watchedRepoList?.length) {
    logger.info("No watched repos have been found, no work to do.");
    return false;
  }
  for (const watchedIssue of watchedRepoList) {
    const now = DateTime.now().plus({ day: 11 });
    const activity = await getAssigneesActivityForIssue(context, watchedIssue);
    const deadline = DateTime.fromISO(watchedIssue.deadline);
    const deadlineWithThreshold = deadline.plus({ day: config.unassignUserThreshold });
    const reminderWithThreshold = deadline.plus({ day: config.sendRemindersThreshold });

    if (activity?.length) {
      const lastCheck = DateTime.fromISO(watchedIssue.last_check);
      const timeDiff = now.diff(lastCheck);
      const newDeadline = deadline.plus(timeDiff);
      logger.info(
        `Activity found on ${watchedIssue.url}, will move the deadline forward from ${deadline.toLocaleString(DateTime.DATETIME_MED)} to ${newDeadline.toLocaleString(DateTime.DATETIME_MED)}`
      );
      await supabase.repositories.upsert({ url: watchedIssue.url, deadline: newDeadline.toJSDate(), lastCheck: now.toJSDate() });
    } else {
      if (now >= deadlineWithThreshold) {
        logger.info(`Passed the deadline on ${watchedIssue.url} and no activity is detected, removing assignees.`);
        await removeIdleAssignees(context);
        await supabase.repositories.delete(watchedIssue.url);
      } else if (now >= reminderWithThreshold) {
        const lastReminder = watchedIssue.last_reminder;
        logger.info(`We are passed the deadline on ${watchedIssue.url}, should we send a reminder? ${!!lastReminder}`);
        if (!lastReminder) {
          await remindAssignees(context);
          await supabase.repositories.upsert({
            url: watchedIssue.url,
            deadline: deadline.toJSDate(),
            lastReminder: now.toJSDate(),
            lastCheck: now.toJSDate(),
          });
        }
      }
    }
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

async function remindAssignees(context: Context) {
  const { octokit, payload } = context;

  if (!payload.issue?.assignees?.length) {
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

async function removeIdleAssignees(context: Context) {
  const { octokit, payload } = context;

  if (!payload.issue?.assignees?.length) {
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
