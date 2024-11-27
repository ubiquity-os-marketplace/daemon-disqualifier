import { LOG_LEVEL } from "@ubiquity-os/ubiquity-os-logger";
import { createActionsPlugin } from "@ubiquity-os/plugin-sdk";
import { run } from "./run";
import { Env, envSchema, PluginSettings, pluginSettingsSchema, SupportedEvents } from "./types/plugin-input";

createActionsPlugin<PluginSettings, Env, null, SupportedEvents>(
  (context) => {
    return run(context);
  },
  {
    envSchema: envSchema,
    settingsSchema: pluginSettingsSchema,
    logLevel: process.env.LOG_LEVEL || LOG_LEVEL.INFO,
    postCommentOnError: false,
    ...(process.env.KERNEL_PUBLIC_KEY && { kernelPublicKey: process.env.KERNEL_PUBLIC_KEY }),
  }
).catch(console.error);
