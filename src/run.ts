import { watchUserActivity } from "./handlers/watch-user-activity";
import { ContextPlugin } from "./types/plugin-input";

export async function run(context: ContextPlugin) {
  context.logger.debug("Will run with the following configuration:", { configuration: context.config });
  console.log(JSON.stringify(context, null, 2));
  return watchUserActivity(context);
}
