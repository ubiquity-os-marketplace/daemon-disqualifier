import { DateTime } from "luxon";
import { getTimeEstimate } from "../helpers/time";
import { Result } from "../proxy";
import { Context } from "../types/context";

/**
 * On issue assigned, we want to update the entry with the new created time and deadline.
 */
export async function handleIssueAssigned(context: Context): Promise<Result> {
  const {
    adapters: {
      supabase: { issues },
    },
  } = context;
  const timeEstimate = await getTimeEstimate(context);
  if (timeEstimate.isValid) {
    await issues.upsert({
      url: context.payload.issue.html_url,
      deadline: DateTime.now().plus(timeEstimate).toJSDate(),
      createdAt: new Date(),
      lastCheck: new Date(),
    });
  } else {
    context.logger.warn(`Time for the task is invalid. ${timeEstimate.invalidReason}`);
  }
  return { status: "ok" };
}
