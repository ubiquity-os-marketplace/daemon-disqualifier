import { Value } from "@sinclair/typebox/value";
import { ValidationException } from "typebox-validators";
import { run } from "./run";
import { EnvConfigType, envConfigValidator } from "./types/env-type";
import { userActivityWatcherSettingsSchema } from "./types/plugin-inputs";

export default {
  async fetch(request: Request, env: EnvConfigType): Promise<Response> {
    try {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: `Only POST requests are supported.` }), {
          status: 405,
          headers: { "content-type": "application/json", Allow: "POST" },
        });
      }
      const contentType = request.headers.get("content-type");
      if (contentType !== "application/json") {
        return new Response(JSON.stringify({ error: `Error: ${contentType} is not a valid content type` }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      if (!envConfigValidator.test(env)) {
        for (const error of envConfigValidator.errors(env)) {
          console.error(error);
        }
        return Promise.reject(new ValidationException("The environment is invalid."));
      }
      const webhookPayload = await request.json();
      const settings = Value.Decode(userActivityWatcherSettingsSchema, Value.Default(userActivityWatcherSettingsSchema, webhookPayload.settings));
      webhookPayload.settings = settings;
      await run(webhookPayload, env);
      return new Response(JSON.stringify("OK"), { status: 200, headers: { "content-type": "application/json" } });
    } catch (error) {
      return handleUncaughtError(error);
    }
  },
};

function handleUncaughtError(error: unknown) {
  console.error(error);
  const status = 500;
  return new Response(JSON.stringify({ error }), { status: status, headers: { "content-type": "application/json" } });
}
