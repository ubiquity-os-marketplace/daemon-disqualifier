import { formatMillisecondsToHumanReadable } from "../handlers/time-format";
import { ListIssueForRepo } from "../types/github-types";
import { ContextPlugin } from "../types/plugin-input";
import { getMostRecentUserAssignmentEvent, parsePriorityLabel, parseTimeLabel } from "./task-metadata";

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export async function getRemainingAvailableExtensions(context: ContextPlugin) {
  const defaultExtensions = { remainingExtensions: 0, extensionsLimit: 0 };

  if (!("issue" in context.payload)) {
    return defaultExtensions;
  }
  if (!context.config.negligenceThreshold || !context.config.availableDeadlineExtensions.enabled) {
    return { remainingExtensions: Infinity, extensionsLimit: Infinity };
  }

  const priorityList = Object.keys(context.config.availableDeadlineExtensions.amounts);
  const priorityLabel = context.payload.issue.labels?.find((label) => priorityList.includes(label.name));

  if (!priorityLabel) {
    return defaultExtensions;
  }
  const extensionsLimit = context.config.availableDeadlineExtensions.amounts[priorityLabel.name];
  let extensionTimeLapse = Math.max(1, context.config.negligenceThreshold / parsePriorityLabel([priorityLabel]));

  // If the total time for top-ups is inferior to the actual time label of the task,
  // we use the time label as a reference
  const labels = context.payload.issue.labels;

  if (labels?.length) {
    const timeLabelValue = parseTimeLabel(labels);
    const totalTimeLapse = extensionTimeLapse * extensionsLimit;
    if (totalTimeLapse < timeLabelValue) {
      extensionTimeLapse = timeLabelValue / extensionsLimit;
    }
  }

  const assignmentEvent = await getMostRecentUserAssignmentEvent(context, context.payload.repository, context.payload.issue as ListIssueForRepo);
  const assignmentDate = assignmentEvent?.created_at ? new Date(assignmentEvent.created_at) : null;

  if (!assignmentDate) {
    return defaultExtensions;
  }

  const currentDate = new Date();
  const diffTime = currentDate.getTime() - assignmentDate.getTime();
  const daysAssigned = parseFloat((diffTime / DAY_IN_MS).toFixed(2));
  const remainingExtensions = Math.ceil(extensionsLimit - extensionsLimit * (diffTime / (extensionsLimit * extensionTimeLapse)));

  context.logger.debug("Remaining extensions", {
    extensionsLimit,
    extensionTimeLapse: formatMillisecondsToHumanReadable(extensionTimeLapse),
    diffTime: formatMillisecondsToHumanReadable(diffTime),
    assignmentDate,
    daysAssigned,
    remainingExtensions,
  });

  return { remainingExtensions, extensionsLimit };
}
