import { Result } from "../proxy";
import { Context } from "../types/context";
import { EnvConfigType } from "../types/env-type";

/**
 * On issue closed, we want to delete the entry to stop watching this issue.
 */
export async function handleIssueClosed(context: Context, env: EnvConfigType): Promise<Result> {
  const {
    adapters: {
      supabase: { repository },
    },
  } = context;
  await repository.delete(context.payload.issue.html_url);
  return { status: "ok" };
}
