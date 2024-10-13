import { EmitterWebhookEvent as WebhookEvent, EmitterWebhookEventName as WebhookEventName } from "@octokit/webhooks";
import { StaticDecode, StringOptions, Type as T, TypeBoxError } from "@sinclair/typebox";
import ms from "ms";
import { StandardValidator } from "typebox-validators";

export type SupportedEvents = "pull_request_review_comment.created" | "issue_comment.created" | "push";

export interface PluginInputs<T extends WebhookEventName = SupportedEvents> {
  stateId: string;
  eventName: T;
  eventPayload: WebhookEvent<T>["payload"];
  settings: PluginSettings;
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

const eventWhitelist = [
  "pull_request.review_requested",
  "pull_request.ready_for_review",
  "pull_request_review_comment.created",
  "issue_comment.created",
  "push",
] as const;

type WhitelistEvents = (typeof eventWhitelist)[number];

export type TimelineEvents = "review_requested" | "ready_for_review" | "commented" | "committed";

function mapWebhookToEvent(webhook: WhitelistEvents) {
  const roleMap: Map<WhitelistEvents, TimelineEvents> = new Map([
    ["pull_request.review_requested", "review_requested"],
    ["pull_request.ready_for_review", "ready_for_review"],
    ["pull_request_review_comment.created", "commented"],
    ["issue_comment.created", "commented"],
    ["push", "committed"],
  ]);

  return roleMap.get(webhook);
}

const EventWhitelistType = T.Union(eventWhitelist.map((event) => T.Literal(event)));

export const pluginSettingsSchema = T.Object(
  {
    /**
     * Delay to send reminders. 0 means disabled. Any other value is counted in days, e.g. 1,5 days
     */
    warning: thresholdType({ default: "3.5 days" }),
    /**
     * By default, all repositories are watched. Use this option to opt-out from watching specific repositories
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
    /**
     * List of events to consider as valid activity on a task
     */
    eventWhitelist: T.Array(EventWhitelistType, {
      default: eventWhitelist,
      transform: (value: WhitelistEvents[]) => {
        return Array.from(new Set(value.map(mapWebhookToEvent)));
      },
    }),
  },
  { default: {} }
);

export const pluginSettingsValidator = new StandardValidator(pluginSettingsSchema);

export type PluginSettings = StaticDecode<typeof pluginSettingsSchema>;

export const envSchema = T.Object({});

export const envValidator = new StandardValidator(envSchema);

export type Env = StaticDecode<typeof envSchema>;
