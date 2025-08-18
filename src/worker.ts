import { createPlugin } from "@ubiquity-os/plugin-sdk";
import { Manifest } from "@ubiquity-os/plugin-sdk/manifest";
import { LOG_LEVEL } from "@ubiquity-os/ubiquity-os-logger";
import manifest from "../manifest.json" with { type: "json" };
import { run } from "./run";
import { Env, envSchema, PluginSettings, pluginSettingsSchema, SupportedEvents } from "./types/plugin-input";

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
    kernelPublicKey: process.env.KERNEL_PUBLIC_KEY,
    bypassSignatureVerification: process.env.NODE_ENV === "local",
  }
);

export default {
  fetch: app.fetch,
  port: 4000,
};
