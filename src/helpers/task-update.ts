import { DateTime } from "luxon";
import { Context } from "../types/context";
import { ListForOrg, ListIssueForRepo } from "../types/github-types";
import { remindAssigneesForIssue, unassignUserFromIssue } from "./remind-and-remove";
import { getDeadlineWithThreshold } from "./task-deadline";
import { getTaskMetadata } from "./task-metadata";

export async function updateTaskReminder(context: Context, repo: ListForOrg["data"][0], issue: ListIssueForRepo) {
  const { logger } = context;

  let metadata, lastCheck, deadlineWithThreshold, reminderWithThreshold, now;

  const handledMetadata = await getTaskMetadata(context, repo, issue);

  if (handledMetadata) {
    metadata = handledMetadata.metadata;
    lastCheck = handledMetadata.lastCheck;

    const handledDeadline = await getDeadlineWithThreshold(context, metadata, issue, lastCheck);
    if (handledDeadline) {
      deadlineWithThreshold = handledDeadline.deadlineWithThreshold;
      reminderWithThreshold = handledDeadline.reminderWithThreshold;
      now = handledDeadline.now;
    }
  }

  if (!metadata || !lastCheck || !deadlineWithThreshold || !reminderWithThreshold || !now) {
    logger.error(`Failed to handle metadata or deadline for ${issue.html_url}`);
    return false;
  }

  if (now >= deadlineWithThreshold) {
    await unassignUserFromIssue(context, issue);
  } else if (now >= reminderWithThreshold) {
    await remindAssigneesForIssue(context, issue);
  } else {
    logger.info(`Nothing to do for ${issue.html_url}, still within due-time.`);
    logger.info(`Last check was on ${lastCheck.toISO()}`, {
      now: now.toLocaleString(DateTime.DATETIME_MED),
      reminder: reminderWithThreshold.toLocaleString(DateTime.DATETIME_MED),
      deadline: deadlineWithThreshold.toLocaleString(DateTime.DATETIME_MED),
    });
  }
}
