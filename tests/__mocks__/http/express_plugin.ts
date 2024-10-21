import { serve } from "@hono/node-server";
import { createPlugin } from "@ubiquity-os/ubiquity-os-kernel";
import { LOG_LEVEL } from "@ubiquity-os/ubiquity-os-logger";
import manifest from "../../../manifest.json";
import { run } from "../../../src/run";
import { Env, envSchema, PluginSettings, pluginSettingsSchema, SupportedEvents } from "../../../src/types/plugin-input";

createPlugin<PluginSettings, Env, SupportedEvents>(
  async (context) => {
    const result = await run(context);
    console.log(JSON.stringify(result));
    return result;
  },
  //@ts-expect-error err
  manifest,
  {
    envSchema: envSchema,
    settingsSchema: pluginSettingsSchema,
    logLevel: LOG_LEVEL.DEBUG,
  }
).then((server) => {
  console.log("Server starting...");
  return serve(server);
});
