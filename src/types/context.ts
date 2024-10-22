import { Octokit } from "@octokit/rest";
import { EmitterWebhookEvent as WebhookEvent } from "@octokit/webhooks";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { PluginSettings, SupportedEvents } from "./plugin-input";

export interface Context<T extends SupportedEvents = SupportedEvents> {
  eventName: T;
  payload: WebhookEvent<T>["payload"];
  octokit: InstanceType<typeof Octokit>;
  config: PluginSettings;
  logger: Logs;
}

export const FOLLOWUP_HEADER = "Followup";
export const UNASSIGN_HEADER = "Unassign";
