import { DateTime } from "luxon";
import { ListForOrg, ListIssueForRepo } from "../types/github-types";
import { ContextPlugin } from "../types/plugin-input";
import { getDeadlineWithThreshold } from "./task-deadline";
import { getTaskAssignmentDetails } from "./task-metadata";

export async function updateTaskReminder(context: ContextPlugin, repo: ListForOrg["data"][0], issue: ListIssueForRepo) {
  const { logger } = context;

  let deadlineWithThreshold, reminderWithThreshold;
  const now = DateTime.now();

  const handledMetadata = await getTaskAssignmentDetails(context, repo, issue);

  if (handledMetadata) {
    const handledDeadline = await getDeadlineWithThreshold(context, handledMetadata, issue);
    if (handledDeadline) {
      deadlineWithThreshold = handledDeadline.deadlineWithThreshold;
      reminderWithThreshold = handledDeadline.reminderWithThreshold;

      logger.info(`Handling metadata and deadline for ${issue.html_url}`, {
        initialDeadline: DateTime.fromISO(handledMetadata.startPlusLabelDuration).toLocaleString(DateTime.DATETIME_MED),
        now: now.toLocaleString(DateTime.DATETIME_MED),
        reminderWithThreshold: reminderWithThreshold.toLocaleString(DateTime.DATETIME_MED),
        deadlineWithThreshold: deadlineWithThreshold.toLocaleString(DateTime.DATETIME_MED),
      });
    }
  }

  if (!deadlineWithThreshold || !reminderWithThreshold) {
    logger.error(`Failed to handle metadata or deadline for ${issue.html_url}`);
    return false;
  }

  if (now >= deadlineWithThreshold) {
    // if the issue is past due, we should unassign the user
    // await unassignUserFromIssue(context, issue);
  } else if (now >= reminderWithThreshold) {
    // if the issue is within the reminder threshold, we should remind the assignees
    // await remindAssigneesForIssue(context, issue);
  } else {
    logger.info(`Nothing to do for ${issue.html_url}, still within due-time.`);
  }
}
