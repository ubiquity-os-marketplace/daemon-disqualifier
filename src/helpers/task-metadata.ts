import { RestEndpointMethodTypes } from "@octokit/rest";
import { DateTime } from "luxon";
import ms from "ms";
import { ListIssueForRepo } from "../types/github-types";
import { ContextPlugin } from "../types/plugin-input";

type IssueLabel = Partial<Omit<RestEndpointMethodTypes["issues"]["listLabelsForRepo"]["response"]["data"][0], "color">> & {
  color?: string | null;
};

/**
 * Retrieves assignment events from the timeline of an issue and calculates the disqualification threshold based on the time label.
 *
 * It does not care about previous updates, comments or other events that might have happened on the issue.
 *
 * It returns who is assigned and the initial calculated disqualification threshold (start + time label duration).
 */
export async function getTaskAssignmentDetails(
  context: ContextPlugin,
  repo: ContextPlugin["payload"]["repository"],
  issue: ListIssueForRepo
): Promise<{ startPlusLabelDuration: string; taskAssignees: number[] } | false> {
  const { logger, octokit, payload } = context;

  if (!repo.owner) {
    throw logger.error("No owner was found in the payload", { payload });
  }

  const assignmentEvents = await octokit.paginate(octokit.rest.issues.listEvents, {
    owner: repo.owner.login,
    repo: repo.name,
    issue_number: issue.number,
  });

  const assignedEvents = assignmentEvents
    .filter((o) => o.event === "assigned")
    .sort((a, b) => DateTime.fromISO(b.created_at).toMillis() - DateTime.fromISO(a.created_at).toMillis());

  const latestUserAssignment = assignedEvents.find((o) => o.actor?.type === "User");
  const latestBotAssignment = assignedEvents.find((o) => o.actor?.type === "Bot");

  let mostRecentAssignmentEvent = latestUserAssignment || latestBotAssignment;

  if (latestUserAssignment && latestBotAssignment && DateTime.fromISO(latestUserAssignment.created_at) > DateTime.fromISO(latestBotAssignment.created_at)) {
    mostRecentAssignmentEvent = latestUserAssignment;
  } else {
    mostRecentAssignmentEvent = latestBotAssignment;
  }

  const metadata = {
    startPlusLabelDuration: DateTime.fromISO(issue.created_at).toISO() || "",
    taskAssignees: issue.assignees ? issue.assignees.map((o) => o.id) : issue.assignee ? [issue.assignee.id] : [],
  };

  if (!metadata.taskAssignees?.length) {
    logger.error(`Missing Assignees from ${issue.html_url}`);
    return false;
  }

  const durationInMs = parseTimeLabel(issue.labels);

  if (durationInMs === 0) {
    // it could mean there was no time label set on the issue
    // but it could still be workable and priced
  } else if (durationInMs < 0 || !durationInMs) {
    logger.error(`Invalid disqualification threshold found on ${issue.html_url}`);
    return false;
  }

  // if there are no assignment events, we can assume the disqualification threshold is the issue creation date
  metadata.startPlusLabelDuration =
    DateTime.fromISO(mostRecentAssignmentEvent?.created_at || issue.created_at)
      .plus({ milliseconds: durationInMs })
      .toISO() || "";

  return metadata;
}

function parseTimeLabel(labels: (IssueLabel | string)[]): number {
  let taskTimeEstimate = 0;

  for (const label of labels) {
    let timeLabel = "";
    if (typeof label === "string") {
      timeLabel = label;
    } else {
      timeLabel = label.name || "";
    }

    if (timeLabel.startsWith("Time:")) {
      const matched = timeLabel.match(/Time: <(\d+) (\w+)/i);
      if (!matched) {
        return 0;
      }

      const [_, duration, unit] = matched;
      taskTimeEstimate = ms(`${duration} ${unit}`);
    }

    if (taskTimeEstimate) {
      break;
    }
  }

  return taskTimeEstimate;
}

export function parsePriorityLabel(labels: (IssueLabel | string)[]): number {
  for (const label of labels) {
    let priorityLabel = "";
    if (typeof label === "string") {
      priorityLabel = label;
    } else {
      priorityLabel = label.name || "";
    }

    if (priorityLabel.startsWith("Priority:")) {
      const matched = priorityLabel.match(/Priority: (\d+)/i);
      if (!matched) {
        return 1;
      }

      return Number(matched[1]);
    }
  }

  return 1;
}

export function parsePriceLabel(labels: (IssueLabel | string)[]): number | null {
  const priceLabel = labels?.map((label) => (typeof label === "string" ? label : label.name || "")).find((name) => name.toLowerCase().startsWith("price:"));

  if (!priceLabel) {
    return null;
  }

  const matched = priceLabel.match(/price:\s*(\d+)/i);
  return matched ? Number(matched[1]) : null;
}
