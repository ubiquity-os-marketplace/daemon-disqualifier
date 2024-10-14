import * as github from "@actions/github";
import { config } from "dotenv";
import { validateAndDecodeSchemas } from "../helpers/validator";
import { PluginInputs } from "../types/plugin-input";

config();

const webhookPayload = github.context.payload.inputs;
const { decodedSettings } = validateAndDecodeSchemas(JSON.parse(webhookPayload.settings), process.env);

const program: PluginInputs = {
  stateId: webhookPayload.stateId,
  eventName: webhookPayload.eventName,
  authToken: webhookPayload.authToken,
  ref: webhookPayload.ref,
  eventPayload: JSON.parse(webhookPayload.eventPayload),
  settings: decodedSettings,
};

export default program;
