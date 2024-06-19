import { EmitterWebhookEvent as WebhookEvent, EmitterWebhookEventName as WebhookEventName } from "@octokit/webhooks";
import { StaticDecode, Type as T } from "@sinclair/typebox";

export type SupportedEvents = "issues.closed" | "issues.assigned" | "issues.unassigned";

export interface PluginInputs<T extends WebhookEventName = SupportedEvents> {
  stateId: string;
  eventName: T;
  eventPayload: WebhookEvent<T>["payload"];
  settings: UserActivityWatcherSettings;
  authToken: string;
  ref: string;
}

export const userActivityWatcherSettingsSchema = T.Object({
  /**
   * Delay to send reminders. 0 means disabled. Any other value is counted in days, e.g. 1,5 days
   */
  sendRemindersThreshold: T.Number({
    default: 3.5,
  }),
  /**
   * Delay to unassign users. 0 means disabled. Any other value is counted in days, e.g. 7 days
   */
  unassignUserThreshold: T.Number({
    default: 7,
  }),
});

export type UserActivityWatcherSettings = StaticDecode<typeof userActivityWatcherSettingsSchema>;
