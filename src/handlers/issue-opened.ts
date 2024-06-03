import { Result } from "../proxy";
import { Context } from "../types/context";
import { EnvConfigType } from "../types/env-type";
import { DateTime, Duration } from "luxon";

/**
 * On issue opened, we want to keep track of the deadline, and set an alarm for the reminder.
 */
export async function handleIssueOpened(context: Context<"issues.opened">, env: EnvConfigType): Promise<Result> {
  const {
    adapters: {
      supabase: { repository },
    },
  } = context;
  const timeEstimate = await getTimeEstimate(context);
  await repository.upsert(context.payload.issue.html_url, DateTime.now().plus(timeEstimate).toJSDate());
  return { status: "ok" };
}

async function getTimeEstimate(context: Context<"issues.opened">) {
  const timeLabelRegex = /Time: <(\d+)/i;
  const labels = await context.octokit.issues.listLabelsOnIssue({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    issue_number: context.payload.issue.number,
  });
  const durationLabel = labels.data.find((o) => o.name.match(timeLabelRegex));
  if (!durationLabel) {
    return Duration.invalid("No time label was found.");
  }
  return parseDurationString(durationLabel.name);
}

function parseDurationString(durationString: string) {
  const match = durationString.match(/<(\d+)\s*(\w+)/);
  if (!match) {
    throw new Error("Invalid duration string format.");
  }

  const [, value, unit] = match;
  let duration;
  switch (unit.toLowerCase()) {
    case "hour":
    case "hours":
      duration = { hours: parseInt(value) };
      break;
    case "day":
    case "days":
      duration = { days: parseInt(value) };
      break;
    case "week":
    case "weeks":
      duration = { weeks: parseInt(value) };
      break;
    default:
      throw new Error("Unsupported duration unit.");
  }

  return Duration.fromObject(duration);
}
