import { Result } from "../proxy";
import { Context } from "../types/context";

/**
 * On issue closed, we want to delete the entry to stop watching this issue.
 */
export async function handleIssueClosed(context: Context): Promise<Result> {
  const {
    adapters: {
      supabase: { issues },
    },
  } = context;
  await issues.delete(context.payload.issue.html_url);
  return { status: "ok" };
}
