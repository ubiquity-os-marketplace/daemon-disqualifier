import { createPlugin } from "@ubiquity-os/plugin-sdk";
import { Manifest, resolveRuntimeManifest } from "@ubiquity-os/plugin-sdk/manifest";
import { LOG_LEVEL } from "@ubiquity-os/ubiquity-os-logger";
import { ExecutionContext } from "hono";
import { env } from "hono/adapter";
import manifest from "../manifest.json" with { type: "json" };
import { run } from "./run";
import { Env, envSchema, PluginSettings, pluginSettingsSchema, SupportedEvents } from "./types/plugin-input";

function buildRuntimeManifest(request: Request) {
  const runtimeManifest = resolveRuntimeManifest(manifest as Manifest);
  return {
    ...runtimeManifest,
    homepage_url: new URL(request.url).origin,
  };
}

export default {
  async fetch(request: Request, serverInfo: Record<string, unknown>, executionCtx?: ExecutionContext) {
    const runtimeManifest = buildRuntimeManifest(request);
    if (new URL(request.url).pathname === "/manifest.json") {
      return Response.json(runtimeManifest);
    }

    const environment = env<Env>(request as never) as Env & {
      KERNEL_PUBLIC_KEY?: string;
      LOG_LEVEL?: string;
      NODE_ENV?: string;
    };
    const app = createPlugin<PluginSettings, Env, null, SupportedEvents>(
      (context) => {
        return run(context);
      },
      runtimeManifest,
      {
        envSchema: envSchema,
        settingsSchema: pluginSettingsSchema,
        logLevel: environment.LOG_LEVEL || LOG_LEVEL.INFO,
        postCommentOnError: false,
        kernelPublicKey: environment.KERNEL_PUBLIC_KEY,
        bypassSignatureVerification: (environment as Env & { NODE_ENV?: string }).NODE_ENV === "local",
      }
    );

    return app.fetch(request, serverInfo, executionCtx);
  },
  port: 4000,
};
