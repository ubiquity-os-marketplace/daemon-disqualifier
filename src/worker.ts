import { Manifest } from "@ubiquity-os/plugin-sdk/dist/manifest";
import { LOG_LEVEL } from "@ubiquity-os/ubiquity-os-logger";
import { createPlugin } from "@ubiquity-os/plugin-sdk";
import { run } from "./run";
import { Env, envSchema, PluginSettings, pluginSettingsSchema, SupportedEvents } from "./types/plugin-input";
import manifest from "../manifest.json";

const app = createPlugin<PluginSettings, Env, null, SupportedEvents>(
  (context) => {
    return run(context);
  },
  manifest as Manifest,
  {
    envSchema: envSchema,
    settingsSchema: pluginSettingsSchema,
    logLevel: process.env.LOG_LEVEL || LOG_LEVEL.INFO,
    postCommentOnError: false,
    ...(process.env.KERNEL_PUBLIC_KEY && { kernelPublicKey: process.env.KERNEL_PUBLIC_KEY }),
  }
);

export default {
  fetch: app.fetch,
  port: 4000,
};
