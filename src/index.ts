import { createActionsPlugin } from "@ubiquity-os/ubiquity-os-kernel";
import { run } from "./run";
import { Env, envSchema, PluginSettings, pluginSettingsSchema, SupportedEvents } from "./types/plugin-input";

createActionsPlugin<PluginSettings, Env, SupportedEvents>(
  (context) => {
    return run(context);
  },
  {
    envSchema: envSchema,
    settingsSchema: pluginSettingsSchema,
    logLevel: process.env.LOG_LEVEL || "info",
  }
).catch(console.error);
