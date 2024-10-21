import { DateTime } from "luxon";
import { FOLLOWUP_HEADER } from "../types/context";
import { ListForOrg, ListIssueForRepo } from "../types/github-types";
import { ContextPlugin, TimelineEvent } from "../types/plugin-input";
import { getAssigneesActivityForIssue } from "./get-assignee-activity";
import { remindAssigneesForIssue, unassignUserFromIssue } from "./remind-and-remove";
import { getCommentsFromMetadata } from "./structured-metadata";
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

export async function updateReminder(context: ContextPlugin, repo: ListForOrg["data"][0], issue: ListIssueForRepo) {
  const {
    octokit,
    logger,
    config: { eventWhitelist, warning, disqualification },
  } = context;
  const handledMetadata = await getTaskAssignmentDetails(context, repo, issue);
  const now = DateTime.local();

  if (handledMetadata) {
    const assignmentEvents = await octokit.paginate(
      octokit.rest.issues.listEvents,
      {
        owner: repo.owner.login,
        repo: repo.name,
        issue_number: issue.number,
      },
      (response) =>
        response.data
          .filter((o) => o.event === "assigned" && handledMetadata.taskAssignees.includes(o.actor.id))
          .sort((a, b) => DateTime.fromISO(b.created_at).toMillis() - DateTime.fromISO(a.created_at).toMillis())
    );

    const assignedEvent = assignmentEvents.pop();
    const activityEvent = (await getAssigneesActivityForIssue(context, issue, handledMetadata.taskAssignees))
      .filter((o) => eventWhitelist.includes(o.event as TimelineEvent))
      .pop();

    if (!assignedEvent) {
      throw new Error(`Failed to update activity for ${issue.html_url}, there is no assigned event.`);
    }

    let mostRecentActivityDate: DateTime;

    if (assignedEvent?.created_at && activityEvent?.created_at) {
      const assignedDate = DateTime.fromISO(assignedEvent.created_at);
      const activityDate = DateTime.fromISO(activityEvent.created_at);
      mostRecentActivityDate = assignedDate > activityDate ? assignedDate : activityDate;
    } else {
      mostRecentActivityDate = DateTime.fromISO(assignedEvent.created_at);
    }

    const lastReminderComment = (await getCommentsFromMetadata(context, issue.number, repo.owner.login, repo.name, FOLLOWUP_HEADER)).pop();
    const disqualificationDifference = disqualification - warning;

    logger.info(`Handling metadata and deadline for ${issue.html_url}`, {
      now: now.toLocaleString(DateTime.DATETIME_MED),
      lastReminderComment: lastReminderComment ? DateTime.fromISO(lastReminderComment.created_at).toLocaleString(DateTime.DATETIME_MED) : "none",
      mostRecentActivityDate: mostRecentActivityDate.toLocaleString(DateTime.DATETIME_MED),
    });

    if (lastReminderComment) {
      const lastReminderTime = DateTime.fromISO(lastReminderComment.created_at);
      if (lastReminderTime.plus(disqualificationDifference) >= now) {
        await unassignUserFromIssue(context, issue);
      } else {
        logger.info(`Reminder was sent for ${issue.html_url} already, not beyond disqualification deadline yet.`);
      }
    } else {
      if (mostRecentActivityDate.plus({ milliseconds: warning }) >= now) {
        await remindAssigneesForIssue(context, issue);
      } else {
        logger.info(`No reminder to send for ${issue.html_url}, still within due time.`);
      }
    }
  }
}
