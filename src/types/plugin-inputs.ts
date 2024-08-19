import { EmitterWebhookEvent as WebhookEvent, EmitterWebhookEventName as WebhookEventName } from "@octokit/webhooks";
import { StaticDecode, StringOptions, Type as T, TypeBoxError } from "@sinclair/typebox";
import ms from "ms";

export type SupportedEvents = "issues.closed" | "issues.assigned" | "issues.unassigned";

export interface PluginInputs<T extends WebhookEventName = SupportedEvents> {
  stateId: string;
  eventName: T;
  eventPayload: WebhookEvent<T>["payload"];
  settings: UserActivityWatcherSettings;
  authToken: string;
  ref: string;
}

function thresholdType(options?: StringOptions) {
  return T.Transform(
    T.String({
      // Matches a pattern like [decimal] [unit], e.g. 3.25 hours
      pattern: /^\s*\d+(\.\d+)?\s+\S+\s*$/.source,
      errorMessage: "must be a duration, in the format of [decimal] [unit]",
      ...options,
    })
  )
    .Decode((value) => {
      const milliseconds = ms(value);
      if (milliseconds === undefined) {
        throw new TypeBoxError(`Invalid threshold value: [${value}]`);
      }
      return milliseconds;
    })
    .Encode((value) => {
      const textThreshold = ms(value, { long: true });
      if (textThreshold === undefined) {
        throw new TypeBoxError(`Invalid threshold value: [${value}]`);
      }
      return textThreshold;
    });
}

export const userActivityWatcherSettingsSchema = T.Object({
  /**
   * Delay to send reminders. 0 means disabled. Any other value is counted in days, e.g. 1,5 days
   */
  sendRemindersThreshold: thresholdType({ default: "3.5 days" }),
  /**
   * Delay to unassign users. 0 means disabled. Any other value is counted in days, e.g. 7 days
   */
  unassignUserThreshold: thresholdType({
    default: "7 days",
  }),
});

export type UserActivityWatcherSettings = StaticDecode<typeof userActivityWatcherSettingsSchema>;
