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

export async function getTopUpsRemaining(context: ContextPlugin): Promise<number> {
  if (!("issue" in context.payload)) {
    return 0;
  }
  if (!context.config.disqualification) {
    return Infinity;
  }
  const prioList = Object.keys(context.config.topUps.amounts);
  const priorityLabel = context.payload.issue.labels?.find((label) => prioList.includes(label.name));
  if (!priorityLabel) {
    return 0;
  }
  const topUpLimit = context.config.topUps.amounts[priorityLabel.name];
  const topUpTimelapse = context.config.disqualification / parsePriorityLabel([priorityLabel]);
  const assignmentDate = await getIssueAssignmentDate(context);

  if (!assignmentDate) {
    return 0;
  }

  const currentDate = new Date();
  const diffTime = currentDate.getTime() - assignmentDate.getTime();
  const daysAssigned = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  context.logger.debug("top ups", { topUps: topUpLimit, topUpTimelapse, assignmentDate, daysAssigned });
  return topUpLimit;
}
