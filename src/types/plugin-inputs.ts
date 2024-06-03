import { EmitterWebhookEvent as WebhookEvent, EmitterWebhookEventName as WebhookEventName } from "@octokit/webhooks";
import { StaticDecode, Type as T } from "@sinclair/typebox";

export type SupportedEvents = "issues" | "pull_request" | "issues.opened";

export interface PluginInputs<T extends WebhookEventName = SupportedEvents> {
  stateId: string;
  eventName: T;
  eventPayload: WebhookEvent<T>["payload"];
  settings: UserActivityWatcherSettings;
  authToken: string;
  ref: string;
}

export const userActivityWatcherSettingsSchema = T.Object({
  sendReminders: T.Boolean({
    default: true,
  }),
  unassignUser: T.Boolean({
    default: true,
  }),
});

export type UserActivityWatcherSettings = StaticDecode<typeof userActivityWatcherSettingsSchema>;
