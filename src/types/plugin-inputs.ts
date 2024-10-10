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
];

type WhitelistEvents =
  | "push"
  | "pull_request.review_requested"
  | "pull_request.ready_for_review"
  | "pull_request_review_comment.created"
  | "issue_comment.created";

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

export const pluginSettingsSchema = T.Object(
  {
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
    /**
     * List of events to consider as valid activity on a task
     */
    eventWhitelist: T.Transform(T.Array(T.String(), { default: eventWhitelist }))
      .Decode((value) => {
        const validEvents = Object.values(eventWhitelist);
        let eventsStripped: TimelineEvents[] = [];
        for (const event of value) {
          if (!validEvents.includes(event)) {
            throw new TypeBoxError(`Invalid event [${event}]`);
          }

          const mappedEvent = mapWebhookToEvent(event as WhitelistEvents);

          if (!mappedEvent) {
            throw new TypeBoxError(`Invalid event [${event}]`);
          }

          if (!eventsStripped.includes(mappedEvent)) {
            eventsStripped.push(mappedEvent);
          }
        }

        return eventsStripped as TimelineEvents[];
      })
      .Encode((value) =>
        value.map((event) => {
          const roleMap: Map<TimelineEvents, WhitelistEvents> = new Map([
            ["review_requested", "pull_request.review_requested"],
            ["ready_for_review", "pull_request.ready_for_review"],
            ["commented", "pull_request_review_comment.created"],
            ["commented", "issue_comment.created"],
            ["committed", "push"],
          ]);

          return roleMap.get(event as TimelineEvents) as WhitelistEvents;
        })
      ),
  },
  { default: {} }
);

export const pluginSettingsValidator = new StandardValidator(pluginSettingsSchema);

export type PluginSettings = StaticDecode<typeof pluginSettingsSchema>;

export const envSchema = T.Object({});

export const envValidator = new StandardValidator(envSchema);

export type Env = StaticDecode<typeof envSchema>;
