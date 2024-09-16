import { DateTime } from "luxon";
import { Context } from "../types/context";
import { ListIssueForRepo } from "../types/github-types";
import { getAssigneesActivityForIssue } from "./get-assignee-activity";

export async function getDeadlineWithThreshold(
  context: Context,
  metadata: {
    taskDeadline: string;
    taskAssignees: number[] | undefined;
  },
  issue: ListIssueForRepo,
  lastCheck: DateTime
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

  const deadline = DateTime.fromISO(metadata.taskDeadline);
  const now = DateTime.now();

  if (!deadline.isValid && !lastCheck.isValid) {
    logger.error(`Invalid date found on ${issue.html_url}`);
    return false;
  }

  const activity = (await getAssigneesActivityForIssue(context, issue, assigneeIds)).filter((o) => {
    if (!o.created_at) {
      return false;
    }
    return DateTime.fromISO(o.created_at) > lastCheck;
  });

  const filteredActivity = activity.filter((o) => {
    if (!o.event) {
      return false;
    }
    return eventWhitelist.includes(o.event);
  });

  let deadlineWithThreshold = deadline.plus({ milliseconds: disqualification });
  let reminderWithThreshold = deadline.plus({ milliseconds: warning });

  if (filteredActivity?.length) {
    const lastActivity = filteredActivity[0].created_at ? DateTime.fromISO(filteredActivity[0].created_at) : deadline;
    deadlineWithThreshold = lastActivity.plus({ milliseconds: disqualification });
    reminderWithThreshold = lastActivity.plus({ milliseconds: warning });
  }

  return { deadlineWithThreshold, reminderWithThreshold, now };
}
