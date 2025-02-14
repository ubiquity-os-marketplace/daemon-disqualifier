import { formatMillisecondsToHumanReadable } from "../handlers/time-format";
import { ListIssueForRepo } from "../types/github-types";
import { ContextPlugin } from "../types/plugin-input";
import { parsePriorityLabel, parseTimeLabel } from "./task-metadata";
import { getAssignedEvent } from "./task-update";

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
  let topUpTimeLapse = Math.max(1, context.config.disqualification / parsePriorityLabel([priorityLabel]));

  // If the total time for top-ups is inferior to the actual time label of the task,
  // we use the time label as a reference
  const labels = context.payload.issue.labels;

  if (labels?.length) {
    const timeLabelValue = parseTimeLabel(labels);
    const totalTimeLapse = topUpTimeLapse * topUpLimit;
    if (totalTimeLapse < timeLabelValue) {
      topUpTimeLapse = timeLabelValue / topUpLimit;
    }
  }

  const assignmentEvent = await getAssignedEvent(context, context.payload.repository, context.payload.issue as ListIssueForRepo);
  const assignmentDate = assignmentEvent?.created_at ? new Date(assignmentEvent.created_at) : null;

  if (!assignmentDate) {
    return defaultTopUps;
  }

  const currentDate = new Date();
  const diffTime = currentDate.getTime() - assignmentDate.getTime();
  const daysAssigned = parseFloat((diffTime / DAY_IN_MS).toFixed(2));
  const remainingTopUps = Math.ceil(topUpLimit - topUpLimit * (diffTime / (topUpLimit * topUpTimeLapse)));

  context.logger.debug("Remaining top ups", {
    topUpLimit,
    topUpTimeLapse: formatMillisecondsToHumanReadable(topUpTimeLapse),
    diffTime: formatMillisecondsToHumanReadable(diffTime),
    assignmentDate,
    daysAssigned,
    remainingTopUps,
  });

  return { remainingTopUps, topUpLimit };
}
