import { formatMillisecondsToHumanReadable } from "../handlers/time-format";
import { ContextPlugin } from "../types/plugin-input";
import { parsePriorityLabel } from "./task-metadata";

async function getIssueAssignmentDate(context: ContextPlugin): Promise<Date | null> {
  const { octokit } = context;

  if (!("issue" in context.payload)) {
    return new Date();
  }

  const assignees = context.payload.issue.assignees;

  if (!assignees.length) {
    return new Date();
  }

  const { data: events } = await octokit.rest.issues.listEvents({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    issue_number: context.payload.issue.number,
  });

  const assignmentEvent = events
    .reverse()
    .find((event) => event.event === "assigned" && "assignee" in event && assignees.some((assignee) => assignee?.login === event.assignee?.login));

  return assignmentEvent ? new Date(assignmentEvent.created_at) : null;
}

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export async function getTopUpsRemaining(context: ContextPlugin) {
  const defaultTopUps = { remainingTopUps: 0, topUpLimit: 0 };

  if (!("issue" in context.payload)) {
    return defaultTopUps;
  }
  if (!context.config.disqualification) {
    return { remainingTopUps: Infinity, topUpLimit: Infinity };
  }
  const priorityList = Object.keys(context.config.topUps.amounts);
  const priorityLabel = context.payload.issue.labels?.find((label) => priorityList.includes(label.name));
  if (!priorityLabel) {
    return defaultTopUps;
  }
  const topUpLimit = context.config.topUps.amounts[priorityLabel.name];
  const topUpTimeLapse = context.config.disqualification / parsePriorityLabel([priorityLabel]) / DAY_IN_MS;
  const assignmentDate = await getIssueAssignmentDate(context);

  if (!assignmentDate) {
    return defaultTopUps;
  }

  const currentDate = new Date();
  const diffTime = currentDate.getTime() - assignmentDate.getTime();
  const daysAssigned = parseFloat((diffTime / DAY_IN_MS).toFixed(2));
  const remainingTopUps = Math.ceil(topUpLimit - daysAssigned / topUpTimeLapse);

  context.logger.debug("Remaining top ups", {
    topUpLimit,
    topUpTimeLapse: formatMillisecondsToHumanReadable(topUpTimeLapse * DAY_IN_MS),
    assignmentDate,
    daysAssigned,
    remainingTopUps,
  });

  return { remainingTopUps, topUpLimit };
}
