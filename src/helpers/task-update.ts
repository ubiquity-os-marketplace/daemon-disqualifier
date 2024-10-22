import { RestEndpointMethodTypes } from "@octokit/rest";
import { DateTime } from "luxon";
import { FOLLOWUP_HEADER } from "../types/context";
import { ListForOrg, ListIssueForRepo } from "../types/github-types";
import { ContextPlugin, TimelineEvent } from "../types/plugin-input";
import { collectLinkedPullRequests } from "./collect-linked-pulls";
import { getAssigneesActivityForIssue } from "./get-assignee-activity";
import { parseIssueUrl } from "./github-url";
import { remindAssigneesForIssue, unassignUserFromIssue } from "./remind-and-remove";
import { getCommentsFromMetadata } from "./structured-metadata";
import { getTaskAssignmentDetails } from "./task-metadata";

const getMostRecentActivityDate = (assignedEventDate: DateTime, activityEventDate?: DateTime): DateTime => {
  return activityEventDate && activityEventDate > assignedEventDate ? activityEventDate : assignedEventDate;
};

export async function updateTaskReminder(context: ContextPlugin, repo: ListForOrg["data"][0], issue: ListIssueForRepo) {
  const {
    octokit,
    logger,
    config: { eventWhitelist, warning, disqualification },
  } = context;
  const handledMetadata = await getTaskAssignmentDetails(context, repo, issue);
  const now = DateTime.local();

  if (!handledMetadata) return;

  const assignmentEvents = await octokit.paginate(octokit.rest.issues.listEvents, {
    owner: repo.owner.login,
    repo: repo.name,
    issue_number: issue.number,
  });

  const assignedEvent = assignmentEvents
    .filter((o) => o.event === "assigned" && handledMetadata.taskAssignees.includes(o.actor.id))
    .sort((a, b) => DateTime.fromISO(b.created_at).toMillis() - DateTime.fromISO(a.created_at).toMillis())
    .shift();

  if (!assignedEvent) {
    logger.error(`Failed to update activity for ${issue.html_url}, there is no assigned event.`);
    return;
  }

  const activityEvent = (await getAssigneesActivityForIssue(context, issue, handledMetadata.taskAssignees))
    .filter((o) => eventWhitelist.includes(o.event as TimelineEvent))
    .shift();

  const assignedDate = DateTime.fromISO(assignedEvent.created_at);
  const activityDate = activityEvent?.created_at ? DateTime.fromISO(activityEvent.created_at) : undefined;
  let mostRecentActivityDate = getMostRecentActivityDate(assignedDate, activityDate);

  const linkedPrUrls: string[] = (await collectLinkedPullRequests(context, { issue_number: issue.number, repo: repo.name, owner: repo.owner.login })).map(
    (o) => o.url
  );
  linkedPrUrls.push(issue.html_url);
  const lastReminders: RestEndpointMethodTypes["issues"]["listComments"]["response"]["data"][] = await Promise.all(
    linkedPrUrls.map(async (url) => {
      const { issue_number, owner, repo } = parseIssueUrl(url);
      const comments = await getCommentsFromMetadata(context, issue_number, owner, repo, FOLLOWUP_HEADER);
      return comments.filter((o) => DateTime.fromISO(o.created_at) > mostRecentActivityDate);
    })
  );

  const lastReminderComment = lastReminders.flat().shift();

  logger.debug(`Handling metadata and deadline for ${issue.html_url}`, {
    now: now.toLocaleString(DateTime.DATETIME_MED),
    assignedDate: DateTime.fromISO(assignedEvent.created_at).toLocaleString(DateTime.DATETIME_MED),
    lastReminderComment: lastReminderComment ? DateTime.fromISO(lastReminderComment.created_at).toLocaleString(DateTime.DATETIME_MED) : "none",
    mostRecentActivityDate: mostRecentActivityDate.toLocaleString(DateTime.DATETIME_MED),
  });

  const disqualificationTimeDifference = disqualification - warning;

  if (lastReminderComment) {
    const lastReminderTime = DateTime.fromISO(lastReminderComment.created_at);
    mostRecentActivityDate = lastReminderTime > mostRecentActivityDate ? lastReminderTime : mostRecentActivityDate;
    if (mostRecentActivityDate.plus({ milliseconds: disqualificationTimeDifference }) <= now) {
      await unassignUserFromIssue(context, issue);
    } else {
      logger.info(`Reminder was sent for ${issue.html_url} already, not beyond disqualification deadline yet.`);
    }
  } else {
    if (mostRecentActivityDate.plus({ milliseconds: warning }) <= now) {
      await remindAssigneesForIssue(context, issue);
    } else {
      logger.info(`Nothing to do for ${issue.html_url}, still within due-time.`);
    }
  }
}
