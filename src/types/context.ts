import { EmitterWebhookEvent as WebhookEvent, EmitterWebhookEventName as WebhookEventName } from "@octokit/webhooks";
import { Octokit } from "@octokit/rest";
import { SupportedEvents, UserActivityWatcherSettings } from "./plugin-inputs";
import { Logs } from "@ubiquity-dao/ubiquibot-logger";

export interface Context<T extends SupportedEvents = SupportedEvents> {
  eventName: T;
  payload: WebhookEvent<T>["payload"];
  octokit: InstanceType<typeof Octokit>;
  config: UserActivityWatcherSettings;
  logger: Logs;
}
