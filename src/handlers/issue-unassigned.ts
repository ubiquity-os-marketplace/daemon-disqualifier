import { Result } from "../proxy";
import { Context } from "../types/context";
import { EnvConfigType } from "../types/env-type";

/**
 * On issue un-assigned, we want to delete the entry to stop watching this issue, if no assignee is left.
 */
export async function handleIssueUnassigned(context: Context, env: EnvConfigType): Promise<Result> {
  const {
    adapters: {
      supabase: { issues },
    },
    logger,
    payload,
  } = context;
  try {
    const assignees = payload.issue.assignees;
    if (assignees.length <= 0) {
      await issues.delete(context.payload.issue.html_url);
    } else {
      logger.info(`There are assignees remaining within issue ${payload.issue.html_url}, will not remove.`);
    }
  } catch (e) {
    logger.error(`[handleIssueUnassigned]: ${e}`);
    return { status: "failed" };
  }
  return { status: "ok" };
}
