import { createPlugin } from "@ubiquity-os/plugin-sdk";
import { Manifest } from "@ubiquity-os/plugin-sdk/dist/manifest";
import { LOG_LEVEL } from "@ubiquity-os/ubiquity-os-logger";
import { ExecutionContext } from "hono";
import manifest from "../manifest.json";
import { run } from "./run";
import { Env, envSchema, PluginSettings, pluginSettingsSchema, SupportedEvents } from "./types/plugin-input";

export default {
  async fetch(request: Request, env: Record<string, string>, executionCtx?: ExecutionContext) {
    return createPlugin<PluginSettings, Env, null, SupportedEvents>(
      (context) => {
        return run(context);
      },
      manifest as Manifest,
      {
        envSchema: envSchema,
        settingsSchema: pluginSettingsSchema,
        logLevel: process.env.LOG_LEVEL || LOG_LEVEL.INFO,
        postCommentOnError: false,
        ...(env.KERNEL_PUBLIC_KEY && { kernelPublicKey: env.KERNEL_PUBLIC_KEY }),
        bypassSignatureVerification: process.env.NODE_ENV === "local",
      }
    ).fetch(request, env, executionCtx);
  },
  port: 4000,
};
