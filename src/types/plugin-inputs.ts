import { EmitterWebhookEvent as WebhookEvent, EmitterWebhookEventName as WebhookEventName } from "@octokit/webhooks";
import { StaticDecode, StringOptions, Type as T, TypeBoxError } from "@sinclair/typebox";
import ms from "ms";
import { StandardValidator } from "typebox-validators";

export type SupportedEvents = "pull_request_review_comment.created" | "issue_comment.created" | "push";

export interface PluginInputs<T extends WebhookEventName = SupportedEvents> {
  stateId: string;
  eventName: T;
  eventPayload: WebhookEvent<T>["payload"];
  settings: UserActivityWatcherSettings;
  authToken: string;
  ref: string;
}

function thresholdType(options?: StringOptions) {
  return T.Transform(T.String(options))
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
  warning: thresholdType({ default: "3.5 days" }),
  /**
   * By default all repositories are watched. Use this option to opt-out from watching specific repositories
   * within your organization. The value is an array of repository names.
   */
  watch: T.Object({
    optOut: T.Array(T.String()),
  }),
  /**
   * Delay to unassign users. 0 means disabled. Any other value is counted in days, e.g. 7 days
   */
  disqualification: thresholdType({
    default: "7 days",
  }),
});

export const pluginSettingsValidator = new StandardValidator(userActivityWatcherSettingsSchema);

export type UserActivityWatcherSettings = StaticDecode<typeof userActivityWatcherSettingsSchema>;

export const envSchema = T.Object({});

export const envValidator = new StandardValidator(envSchema);

export type Env = StaticDecode<typeof envSchema>;
