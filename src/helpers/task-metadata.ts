import { DateTime } from "luxon";
import ms from "ms";
import { ListForOrg, ListIssueForRepo } from "../types/github-types";
import { ContextPlugin } from "../types/plugin-input";

/**
 * Retrieves assignment events from the timeline of an issue and calculates the deadline based on the time label.
 *
 * It does not care about previous updates, comments or other events that might have happened on the issue.
 *
 * It returns who is assigned and the initial calculated deadline (start + time label duration).
 */
export async function getTaskAssignmentDetails(
  context: ContextPlugin,
  repo: ListForOrg["data"][0],
  issue: ListIssueForRepo
): Promise<{ startPlusLabelDuration: string; taskAssignees: number[] } | false> {
  const { logger, octokit } = context;

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
    logger.error(`Invalid deadline found on ${issue.html_url}`);
    return false;
  }

  // if there are no assignment events, we can assume the deadline is the issue creation date
  metadata.startPlusLabelDuration =
    DateTime.fromISO(mostRecentAssignmentEvent?.created_at || issue.created_at)
      .plus({ milliseconds: durationInMs })
      .toISO() || "";

  return metadata;
}

function parseTimeLabel(
  labels: (
    | string
    | {
        id?: number;
        node_id?: string;
        url?: string;
        name?: string;
        description?: string | null;
        color?: string | null;
        default?: boolean;
      }
  )[]
): number {
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
