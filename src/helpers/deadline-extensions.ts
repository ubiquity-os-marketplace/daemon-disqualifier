import { formatMillisecondsToHumanReadable } from "../handlers/time-format";
import { ListIssueForRepo } from "../types/github-types";
import { ContextPlugin } from "../types/plugin-input";
import { parseIssueUrl } from "./github-url";
import { getMostRecentUserAssignmentEvent, parsePriorityLabel, parseTimeLabel } from "./task-metadata";

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export async function getRemainingAvailableExtensions(
  context: ContextPlugin,
  issue: ListIssueForRepo
): Promise<{ remainingExtensions: number; extensionsLimit: number; extensionTimeLapse: number; assignmentDate?: Date }> {
  const defaultExtensions = { remainingExtensions: 0, extensionsLimit: 0, extensionTimeLapse: 0 };
  const { config, logger } = context;
  const { owner, repo } = parseIssueUrl(issue.html_url);

  if (!config.negligenceThreshold || !config.availableDeadlineExtensions.enabled) {
    return { remainingExtensions: Infinity, extensionsLimit: Infinity, extensionTimeLapse: Infinity };
  }

  const priorityList = Object.keys(config.availableDeadlineExtensions.amounts);
  const priorityLabel = issue.labels?.find((label) => typeof label !== "string" && label.name && priorityList.includes(label.name));

  if (!priorityLabel || typeof priorityLabel === "string" || !priorityLabel.name) {
    return defaultExtensions;
  }
  const extensionsLimit = config.availableDeadlineExtensions.amounts[priorityLabel.name];
  let extensionTimeLapse = Math.max(1, config.negligenceThreshold / parsePriorityLabel([priorityLabel]));

  // If the total time for top-ups is inferior to the actual time label of the task,
  // we use the time label as a reference
  const labels = issue.labels;

  if (labels?.length) {
    const timeLabelValue = parseTimeLabel(labels);
    const totalTimeLapse = extensionTimeLapse * extensionsLimit;
    if (totalTimeLapse < timeLabelValue) {
      extensionTimeLapse = timeLabelValue / extensionsLimit;
    }
  }

  const assignmentEvent = await getMostRecentUserAssignmentEvent(context, { owner: { login: owner }, name: repo }, issue);
  const assignmentDate = assignmentEvent?.created_at ? new Date(assignmentEvent.created_at) : null;

  if (!assignmentDate) {
    return defaultExtensions;
  }

  const currentDate = new Date();
  const diffTime = currentDate.getTime() - assignmentDate.getTime();
  const daysAssigned = parseFloat((diffTime / DAY_IN_MS).toFixed(2));
  const remainingExtensions = Math.ceil(extensionsLimit - extensionsLimit * (diffTime / (extensionsLimit * extensionTimeLapse)));

  logger.debug("Remaining extensions", {
    extensionsLimit,
    extensionTimeLapse: formatMillisecondsToHumanReadable(extensionTimeLapse),
    diffTime: formatMillisecondsToHumanReadable(diffTime),
    assignmentDate,
    daysAssigned,
    remainingExtensions,
  });

  return { remainingExtensions, extensionsLimit, extensionTimeLapse, assignmentDate };
}
