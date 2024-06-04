import { DateTime } from "luxon";
import { getTimeEstimate } from "../helpers/time";
import { Result } from "../proxy";
import { Context } from "../types/context";
import { EnvConfigType } from "../types/env-type";

/**
 * On issue opened, we want to keep track of the deadline, and set an alarm for the reminder.
 */
export async function handleIssueOpened(context: Context, env: EnvConfigType): Promise<Result> {
  const {
    adapters: {
      supabase: { repositories },
    },
  } = context;
  const timeEstimate = await getTimeEstimate(context);
  if (timeEstimate.isValid) {
    await repositories.upsert(context.payload.issue.html_url, DateTime.now().plus(timeEstimate).toJSDate());
  } else {
    context.logger.warn(`Time for the task is invalid. ${timeEstimate.invalidReason}`);
  }
  return { status: "ok" };
}
