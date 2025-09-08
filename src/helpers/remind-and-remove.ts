import { Context } from "@ubiquity-os/plugin-sdk";
import { FOLLOWUP_HEADER } from "../types/constants";
import { ListIssueForRepo } from "../types/github-types";
import { ContextPlugin } from "../types/plugin-input";
import { collectLinkedPullRequests } from "./collect-linked-pulls";
import { getRemainingAvailableExtensions } from "./deadline-extensions";
import { parseIssueUrl } from "./github-url";
import { areLinkedPullRequestsApproved } from "./pull-request";
import { MUTATION_PULL_REQUEST_TO_DRAFT } from "./pull-request-operations";
import { createStructuredMetadata } from "./structured-metadata";
import { getMostRecentUserAssignmentEvent } from "./task-metadata";

interface IssuePrTarget {
  issueNumber: number;
  remainingExtensions: number;
  pr?: {
    prOwner: string;
    prRepo: string;
    prNumber: number;
  };
}

type Extensions = Awaited<ReturnType<typeof getRemainingAvailableExtensions>>;

export async function unassignUserFromIssue(context: ContextPlugin, issue: ListIssueForRepo) {
  const { logger, config } = context;

  if (config.negligenceThreshold <= 0) {
    logger.info("The unassign threshold is <= 0, won't unassign users.");
  } else {
    await removeAllAssignees(context, issue);
  }
}

export async function remindAssigneesForIssue(context: ContextPlugin, issue: ListIssueForRepo) {
  const { logger, config } = context;
  const issueItem = parseIssueUrl(issue.html_url);

  const hasLinkedPr = !!(await collectLinkedPullRequests(context, issueItem)).filter((o) => o.state === "OPEN").length;
  const { remainingExtensions } = await getRemainingAvailableExtensions(context, issue);
  if (config.followUpInterval <= 0) {
    logger.info("The reminder threshold is <= 0, won't send any reminder.");
  } else if ((config.pullRequestRequired && !hasLinkedPr) || remainingExtensions <= 0) {
    logger.debug("No linked pull-request or no more remaining extensions, will attempt to un-assign the user.", {
      issue: issue.html_url,
      pullRequestRequired: config.pullRequestRequired,
      hasLinkedPr,
      remainingExtensions,
    });
    await unassignUserFromIssue(context, issue);
    await closeLinkedPullRequests(context, issue);
  } else {
    logger.info(`Passed the reminder threshold on ${issue.html_url} sending a reminder.`);
    await remindAssignees(context, issue);
  }
}

async function shouldDisplayRemainingExtensionsReminder(context: ContextPlugin, issueAndPrTargets: IssuePrTarget) {
  const { octokit, logger } = context;
  const issueNumber = issueAndPrTargets.pr?.prNumber ?? issueAndPrTargets.issueNumber;
  const owner = issueAndPrTargets.pr?.prOwner ?? context.payload.repository.owner?.login;
  const repo = issueAndPrTargets.pr?.prRepo ?? context.payload.repository.name;

  if (!owner) {
    logger.error("No owner was found in the payload, won't display remaining extensions value", { issueAndPrTargets });
    return false;
  }

  let userAssignmentEvent = await getMostRecentUserAssignmentEvent(context, { owner: { login: owner }, name: repo }, issueNumber);

  // If no user assignment event was found on the pull-request, it might be found in the linked issue timeline
  if (!userAssignmentEvent && issueAndPrTargets.issueNumber !== issueNumber) {
    logger.debug(`No user assignment event was found, retrying with issue number ${issueAndPrTargets.issueNumber}`, {
      issueUrl: `https://github.com/${owner}/${repo}/issues/${issueAndPrTargets.issueNumber}`,
      issueAndPrTargets,
    });
    userAssignmentEvent = await getMostRecentUserAssignmentEvent(context, { owner: { login: owner }, name: repo }, issueAndPrTargets.issueNumber);
  }

  if (!userAssignmentEvent) {
    logger.warn("No user assignment event was found, won't display remaining extensions value");
    return false;
  }

  const regex = new RegExp(/"remainingExtensions": (\d+)/, "i");

  const lastRemainingExtensionsValue = (
    await octokit.paginate(octokit.rest.issues.listEventsForTimeline, {
      owner: owner,
      repo: repo,
      issue_number: issueNumber,
    })
  ).reduce((lastRemainingExtensionsValue, event) => {
    if (
      "created_at" in event &&
      "actor" in event &&
      "body" in event &&
      event.event === "commented" &&
      new Date(event.created_at).getTime() >= new Date(userAssignmentEvent.created_at).getTime() &&
      event.actor?.type === "Bot" &&
      event.body?.includes("remainingExtensions")
    ) {
      const res = regex.exec(event.body);
      const value = Number(res?.[1]);
      if (!lastRemainingExtensionsValue || value < lastRemainingExtensionsValue) {
        return value;
      } else {
        return lastRemainingExtensionsValue;
      }
    }
    return lastRemainingExtensionsValue;
  }, 0);
  logger.debug("Last remaining extensions value", { lastRemainingExtensionsValue, remainingExtensions: issueAndPrTargets.remainingExtensions });
  return lastRemainingExtensionsValue !== issueAndPrTargets.remainingExtensions;
}

async function buildReminderMessage(context: ContextPlugin, args: { issue: ListIssueForRepo; extensions: Extensions } & IssuePrTarget) {
  const logins = args.issue.assignees
    ?.map((o) => o?.login)
    .filter((o) => !!o)
    .join(", @");
  const shouldDisplayExtensions =
    !(await areLinkedPullRequestsApproved(context, args.issue)) &&
    !!context.config.negligenceThreshold &&
    context.config.availableDeadlineExtensions.enabled &&
    (await shouldDisplayRemainingExtensionsReminder(context, args));
  const currentExtensionsMilestone = args.extensions.extensionsLimit - args.remainingExtensions + 1;
  const reminderContent = !shouldDisplayExtensions
    ? "this task has been idle for a while"
    : `you have used <code>**${currentExtensionsMilestone}**</code> of <code>**${args.extensions.extensionsLimit}**</code> available deadline extensions`;
  const message = [`@${logins}, ${reminderContent}.`, "Please provide an update on your progress."];

  if (shouldDisplayExtensions && args.extensions.assignmentDate) {
    message.push(
      `The new deadline is on <code>**${new Date(
        args.extensions.assignmentDate.getTime() + (currentExtensionsMilestone + 1) * args.extensions.extensionTimeLapse
      ).toLocaleString("en-US", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
        hour12: true,
      })} UTC**</code>.`
    );
  }
  return message.join(" ");
}

async function constructBodyWithMetadata(
  context: ContextPlugin,
  {
    reminderContent,
    extensions,
    issue,
  }: {
    reminderContent: string;
    issue: ListIssueForRepo;
    extensions: Extensions;
  }
) {
  const { logger } = context;

  const logMessage = logger.info(reminderContent, {
    taskAssignees: issue.assignees?.map((o) => o?.id),
    url: issue.html_url,
    ...extensions,
  });
  const metadata = createStructuredMetadata(FOLLOWUP_HEADER, logMessage);

  return [logMessage.logMessage.raw, metadata].join("\n");
}

export async function remindAssignees(context: ContextPlugin, issue: ListIssueForRepo) {
  const { octokit, logger, config } = context;
  const { repo, owner, issue_number } = parseIssueUrl(issue.html_url);

  if (!issue?.assignees?.length) {
    logger.error(`Missing Assignees from ${issue.html_url}`);
    return false;
  }

  const extensions = await getRemainingAvailableExtensions(context, issue);
  const { remainingExtensions } = extensions;

  if (!config.pullRequestRequired) {
    const reminderContent = await buildReminderMessage(context, { issue, extensions, remainingExtensions, issueNumber: issue_number });
    const body = await constructBodyWithMetadata(context, {
      issue,
      reminderContent,
      extensions,
    });
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body: body,
    });
  } else {
    const openedLinkedPullRequests = (await collectLinkedPullRequests(context, { repo, owner, issue_number }))
      // We filter out closed and merged PRs to avoid commenting on these
      .filter((o) => o.state === "OPEN");
    let shouldPostToMainIssue = openedLinkedPullRequests.length === 0;
    for (const pullRequest of openedLinkedPullRequests) {
      const { owner: prOwner, repo: prRepo, issue_number: prNumber } = parseIssueUrl(pullRequest.url);
      try {
        const reminderContent = await buildReminderMessage(context, {
          issue,
          extensions,
          issueNumber: issue_number,
          pr: { prOwner, prRepo, prNumber },
          remainingExtensions,
        });
        const body = await constructBodyWithMetadata(context, {
          issue,
          reminderContent,
          extensions,
        });
        await octokit.rest.issues.createComment({
          owner: prOwner,
          repo: prRepo,
          issue_number: prNumber,
          body: body,
        });
        if (pullRequest.reviewDecision === "CHANGES_REQUESTED") {
          await octokit.graphql(MUTATION_PULL_REQUEST_TO_DRAFT, {
            input: {
              pullRequestId: pullRequest.id,
            },
          });
        }
      } catch (e) {
        logger.error(`Could not post to ${pullRequest.url} will post to the issue instead.`, { e });
        shouldPostToMainIssue = true;
      }
    }
    // This is a fallback if we failed to post the reminder to a pull-request, which can happen when posting cross
    // organizations, so we post to the parent issue instead, to make sure the user got a reminder.
    if (shouldPostToMainIssue) {
      const reminderContent = await buildReminderMessage(context, { issue, extensions, remainingExtensions, issueNumber: issue_number });
      const body = await constructBodyWithMetadata(context, {
        issue,
        reminderContent,
        extensions,
      });
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number,
        body: body,
      });
    }
  }
  return true;
}

export async function removeEntryFromDatabase(context: ContextPlugin, issue: ListIssueForRepo) {
  await context.adapters.kv.removeIssue(issue.html_url);
}

async function removeAllAssignees(context: ContextPlugin, issue: ListIssueForRepo) {
  const { octokit, logger, commentHandler } = context;
  const { repo, owner, issue_number } = parseIssueUrl(issue.html_url);

  if (!issue?.assignees?.length) {
    logger.error(`Missing Assignees from ${issue.html_url}`);
    return false;
  }
  const logins = issue.assignees.map((o) => o?.login).filter((o) => !!o) as string[];
  const { remainingExtensions } = await getRemainingAvailableExtensions(context, issue);
  const logMessage = logger.info(
    `${logins.map((o) => `@${o}`).join(", ")} you have ${remainingExtensions <= 0 ? "used all available deadline extensions" : "shown no activity"} and have been disqualified from this task.`,
    {
      issue: issue.html_url,
    }
  );
  await commentHandler.postComment(
    {
      ...context,
      // Make sure to post to the proper issue for disqualification, as the context might be from some other issue / pull-request
      payload: {
        ...context.payload,
        issue,
        repository: {
          owner: {
            login: owner,
          },
          name: repo,
        },
      },
    } as unknown as Context,
    logMessage,
    { raw: true, updateComment: false }
  );
  try {
    await octokit.rest.issues.removeAssignees({
      owner,
      repo,
      issue_number,
      assignees: logins,
    });
    logger.info(`Successfully removed assignees: ${logins.join(", ")} from ${issue.html_url}`);
  } catch (error) {
    logger.error(`Failed to remove assignees: ${logins.join(", ")} from ${issue.html_url}`, { 
      error: error instanceof Error ? error : new Error(String(error)),
      assignees: logins,
      issue: issue.html_url 
    });
    
    // For bot accounts, the removeAssignees API call might fail
    // In this case, we still want to remove from database and log the disqualification
    // The comment has already been posted, so the user knows they've been disqualified
    logger.warn(`Proceeding with database cleanup despite assignee removal failure for ${issue.html_url}`);
  }
  await removeEntryFromDatabase(context, issue);
  return true;
}

export async function closeLinkedPullRequests(context: ContextPlugin, issue: ListIssueForRepo) {
  const { octokit, logger } = context;
  const { repo, owner, issue_number } = parseIssueUrl(issue.html_url);
  const pullRequestsFromAssignees = (await collectLinkedPullRequests(context, { repo, owner, issue_number })).filter((o) =>
    issue.assignees?.some((assignee) => assignee.id === o.author.id)
  );

  for (const pullRequest of pullRequestsFromAssignees) {
    const { owner: prOwner, repo: prRepo, issue_number: prNumber } = parseIssueUrl(pullRequest.url);
    try {
      await octokit.rest.pulls.update({
        owner: prOwner,
        repo: prRepo,
        pull_number: prNumber,
        state: "closed",
      });
    } catch (e) {
      logger.error(`Could not close pull-request ${pullRequest.url}.`, { e });
    }
  }
}
