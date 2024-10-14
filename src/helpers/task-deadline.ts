import { DateTime } from "luxon";
import { Context } from "../types/context";
import { ListIssueForRepo } from "../types/github-types";
import { getAssigneesActivityForIssue } from "./get-assignee-activity";
import { TimelineEvent } from "../types/plugin-inputs";

/**
 * Retrieves the deadline with the threshold for the issue.
 *
 * Uses `startPlusLabelDuration` to set a base deadline and then checks for any activity that has happened after that.
 *
 * If activity if detected after the deadline, it will adjust the `deadlineWithThreshold` to the most recent activity.
 *
 * Recent activity is determined by the `eventWhitelist`.
 */
export async function getDeadlineWithThreshold(
  context: Context,
  metadata: {
    startPlusLabelDuration: string | null;
    taskAssignees: number[] | undefined;
  },
  issue: ListIssueForRepo
) {
  const {
    logger,
    config: { disqualification, warning, eventWhitelist },
  } = context;

  const assigneeIds = issue.assignees?.map((o) => o.id) || [];

  if (assigneeIds.length && metadata.taskAssignees?.some((a) => !assigneeIds.includes(a))) {
    logger.info(`Assignees mismatch found for ${issue.html_url}`, {
      metadata,
      assigneeIds,
    });
  }

  const deadline = DateTime.fromISO(metadata.startPlusLabelDuration || issue.created_at);
  if (!deadline.isValid) {
    logger.error(`Invalid deadline date found on ${issue.html_url}`);
    return false;
  }

  // activity which has happened after either: A) issue start + time label duration or B) just issue creation date
  const activity = (await getAssigneesActivityForIssue(context, issue, assigneeIds)).filter((o) => {
    if (!o.created_at) {
      return false;
    }
    return DateTime.fromISO(o.created_at) >= deadline;
  });

  const filteredActivity = activity.filter((o) => {
    if (!o.event) {
      return false;
    }
    return eventWhitelist.includes(o.event as TimelineEvent);
  });

  // adding the buffer onto the already established issueStart + timeLabelDuration
  let deadlineWithThreshold = deadline.plus({ milliseconds: disqualification });
  let reminderWithThreshold = deadline.plus({ milliseconds: warning });

  // if there is any activity that has happened after the deadline, we need to adjust the deadlineWithThreshold
  if (filteredActivity?.length) {
    // use the most recent activity or the initial deadline
    const lastActivity = filteredActivity[0].created_at ? DateTime.fromISO(filteredActivity[0].created_at) : deadline;
    if (!lastActivity.isValid) {
      logger.error(`Invalid date found on last activity for ${issue.html_url}`);
      return false;
    }
    // take the last activity and add the buffer onto it
    deadlineWithThreshold = lastActivity.plus({ milliseconds: disqualification });
    reminderWithThreshold = lastActivity.plus({ milliseconds: warning });
  }

  return { deadlineWithThreshold, reminderWithThreshold };
}
