import * as github from "@actions/github";
import { Value } from "@sinclair/typebox/value";
import { config } from "dotenv";
import { PluginInputs, userActivityWatcherSettingsSchema } from "../types/plugin-inputs";

config();

const webhookPayload = github.context.payload.inputs;
const settings = Value.Decode(userActivityWatcherSettingsSchema, Value.Default(userActivityWatcherSettingsSchema, JSON.parse(webhookPayload.settings)));

const program: PluginInputs = {
  stateId: webhookPayload.stateId,
  eventName: webhookPayload.eventName,
  authToken: webhookPayload.authToken,
  ref: webhookPayload.ref,
  eventPayload: JSON.parse(webhookPayload.eventPayload),
  settings,
};

export default program;
