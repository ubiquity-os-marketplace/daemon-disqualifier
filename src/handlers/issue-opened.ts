import { Result } from "../proxy";
import { Context } from "../types/context";
import { EnvConfigType } from "../types/env-type";

export async function handleIssueOpened(context: Context, env: EnvConfigType): Promise<Result> {
  const {
    adapters: {
      supabase: { repository },
    },
  } = context;
  console.log(JSON.stringify(context.payload, null, 2));
  await repository.upsert("url", new Date());
  return { status: "ok" };
}
