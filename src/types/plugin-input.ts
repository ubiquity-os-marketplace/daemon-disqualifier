import { StaticDecode, StringOptions, Type as T, TypeBoxError } from "@sinclair/typebox";
import { Context } from "@ubiquity-os/plugin-sdk";
import ms from "ms";

export type SupportedEvents = "pull_request_review_comment.created" | "issue_comment.created" | "push" | "issues.assigned";

export type ContextPlugin<TEvents extends SupportedEvents = SupportedEvents> = Context<PluginSettings, Env, null, TEvents>;

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

type WhitelistEvent = (typeof eventWhitelist)[number];

export type TimelineEvent = "review_requested" | "ready_for_review" | "commented" | "committed";

function mapWebhookToEvent(webhook: WhitelistEvent) {
  const roleMap: Map<WhitelistEvent, TimelineEvent> = new Map([
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
    followUpInterval: thresholdType({
      default: "3.5 days",
      description: "Delay to send reminders. 0 means disabled. Any other value is counted in days, e.g. 1,5 days",
    }),
    /*
     * Whether to rush the follow-ups by the priority level
     */
    prioritySpeed: T.Boolean({ default: true, description: "Whether to rush the follow ups by the priority level" }),
    /**
     * Delay to unassign users. 0 means disabled. Any other value is counted in days, e.g. 7 days
     */
    negligenceThreshold: thresholdType({
      default: "7 days",
      description: "Delay to unassign users. 0 means disabled and any other value is counted in days, e.g. 7 days",
      examples: ["7 days", "1 day"],
    }),
    /**
     * Whether a pull request is required for the given issue on disqualify.
     */
    pullRequestRequired: T.Boolean({
      default: true,
      description: "Whether a pull request is required for the given issue on disqualify",
      examples: ["true", "false"],
    }),
    availableDeadlineExtensions: T.Object(
      {
        enabled: T.Boolean({ default: true }),
        amounts: T.Record(T.String(), T.Integer({ minimum: 1 }), { default: {} }),
      },
      {
        default: {},
        description: "The amount of deadline extensions available for a given priority label (how many reminders can be sent before disqualifying the user).",
        examples: [
          {
            amounts: { "Priority: 1 (Normal)": 5, "Priority: 2 (Medium)": 4 },
          },
        ],
      }
    ),
    /**
     * List of events to consider as valid activity on a task
     */
    eventWhitelist: T.Transform(
      T.Array(T.String(), {
        default: eventWhitelist,
        description: "List of webhook event names to consider as valid activity on a task",
        examples: ["pull_request.review_requested", "issue_comment.created", "push"],
      })
    )
      .Decode((value) => {
        const validEvents = Object.values(eventWhitelist);
        const eventsStripped: TimelineEvent[] = [];
        for (const event of value) {
          if (!validEvents.includes(event as WhitelistEvent)) {
            throw new TypeBoxError(`Invalid event [${event}] (unknown event)`);
          }

          const mappedEvent = mapWebhookToEvent(event as WhitelistEvent);

          if (!mappedEvent) {
            throw new TypeBoxError(`Invalid event [${event}] (unmapped event)`);
          }

          if (!eventsStripped.includes(mappedEvent)) {
            eventsStripped.push(mappedEvent);
          }
        }

        return eventsStripped as TimelineEvent[];
      })
      .Encode((value) =>
        value.map((event) => {
          const roleMap: Map<TimelineEvent, WhitelistEvent> = new Map([
            ["review_requested", "pull_request.review_requested"],
            ["ready_for_review", "pull_request.ready_for_review"],
            ["commented", "pull_request_review_comment.created"],
            ["commented", "issue_comment.created"],
            ["committed", "push"],
          ]);

          return roleMap.get(event as TimelineEvent) as WhitelistEvent;
        })
      ),
  },
  { default: {} }
);

export type PluginSettings = StaticDecode<typeof pluginSettingsSchema>;

export const envSchema = T.Object({});

export type Env = StaticDecode<typeof envSchema>;
