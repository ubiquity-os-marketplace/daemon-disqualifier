import db from "../cron/database-handler";
import { FOLLOWUP_HEADER } from "../types/constants";
import { ListIssueForRepo } from "../types/github-types";
import { ContextPlugin } from "../types/plugin-input";
import { collectLinkedPullRequests } from "./collect-linked-pulls";
import { parseIssueUrl } from "./github-url";
import { MUTATION_PULL_REQUEST_TO_DRAFT } from "./pull-request-operations";
import { createStructuredMetadata } from "./structured-metadata";
import { getMostRecentUserAssignmentEvent } from "./task-metadata";
import { getTopUpsRemaining } from "./top-ups";

export async function unassignUserFromIssue(context: ContextPlugin, issue: ListIssueForRepo) {
  const { logger, config } = context;

  if (config.disqualification <= 0) {
    logger.info("The unassign threshold is <= 0, won't unassign users.");
  } else {
    await removeAllAssignees(context, issue);
  }
}

export async function remindAssigneesForIssue(context: ContextPlugin, issue: ListIssueForRepo) {
  const { logger, config } = context;
  const issueItem = parseIssueUrl(issue.html_url);

  const hasLinkedPr = !!(await collectLinkedPullRequests(context, issueItem)).filter((o) => o.state === "OPEN").length;
  const { remainingTopUps } = await getTopUpsRemaining(context);
  if (config.warning <= 0) {
    logger.info("The reminder threshold is <= 0, won't send any reminder.");
  } else if ((config.pullRequestRequired && !hasLinkedPr) || remainingTopUps <= 0) {
    await unassignUserFromIssue(context, issue);
    await closeLinkedPullRequests(context, issue);
  } else {
    logger.info(`Passed the reminder threshold on ${issue.html_url} sending a reminder.`);
    await remindAssignees(context, issue);
  }
}

interface Args {
  issueNumber: number;
  remainingTopUps: number;
  pr?: {
    prOwner: string;
    prRepo: string;
    prNumber: number;
  };
}

async function shouldDisplayTopUpsReminder(context: ContextPlugin, args: Args) {
  const { octokit, logger } = context;
  const userAssignmentEvent = await getMostRecentUserAssignmentEvent(context, context.payload.repository, args.issueNumber);

  if (!userAssignmentEvent) {
    logger.warn("No user assignment event was found, won't display top-up value");
    return false;
  }

  const issueNumber = args.pr?.prNumber ?? args.issueNumber;
  const owner = args.pr?.prOwner ?? context.payload.repository.owner?.login;
  const repo = args.pr?.prRepo ?? context.payload.repository.name;

  if (!owner) {
    logger.error("No owner was found in the payload, won't display top-up value");
    return false;
  }

  const regex = new RegExp(/"remainingTopUps": (\d+)/, "i");

  const lastTopUpValue = (
    await octokit.paginate(octokit.rest.issues.listEventsForTimeline, {
      owner: owner,
      repo: repo,
      issue_number: issueNumber,
    })
  ).reduce((acc, o) => {
    if (
      "created_at" in o &&
      "actor" in o &&
      "body" in o &&
      o.event === "commented" &&
      new Date(o.created_at).getTime() >= new Date(userAssignmentEvent.created_at).getTime() &&
      o.actor?.type === "Bot" &&
      o.body?.includes("remainingTopUps")
    ) {
      const res = regex.exec(o.body);
      const value = Number(res?.[1]);
      if (!acc || value < acc) {
        return value;
      } else {
        return acc;
      }
    }
    return acc;
  }, 0);
  logger.debug("Last reminder top up value", { events: lastTopUpValue });
  return lastTopUpValue !== args.remainingTopUps;
}

export async function remindAssignees(context: ContextPlugin, issue: ListIssueForRepo) {
  const { octokit, logger, config } = context;
  const { repo, owner, issue_number } = parseIssueUrl(issue.html_url);

  if (!issue?.assignees?.length) {
    logger.error(`Missing Assignees from ${issue.html_url}`);
    return false;
  }

  const logins = issue.assignees
    .map((o) => o?.login)
    .filter((o) => !!o)
    .join(", @");
  const { remainingTopUps, topUpLimit } = await getTopUpsRemaining(context);

  if (!config.pullRequestRequired) {
    const reminderContent =
      !context.config.disqualification ||
      !context.config.topUps.enabled ||
      !(await shouldDisplayTopUpsReminder(context, { issueNumber: issue_number, remainingTopUps }))
        ? "this task has been idle for a while"
        : `you have used <code>${topUpLimit - remainingTopUps + 1}</code> of <code>${topUpLimit}</code> available deadline extensions`;

    const logMessage = logger.info(`@${logins}, ${reminderContent}. Please provide an update on your progress.`, {
      taskAssignees: issue.assignees.map((o) => o?.id),
      url: issue.html_url,
      topUpLimit,
      remainingTopUps,
    });
    const metadata = createStructuredMetadata(FOLLOWUP_HEADER, logMessage);

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body: [logMessage.logMessage.raw, metadata].join("\n"),
    });
  } else {
    const openedLinkedPullRequests = (await collectLinkedPullRequests(context, { repo, owner, issue_number }))
      // We filter out closed and merged PRs to avoid commenting on these
      .filter((o) => o.state === "OPEN");
    let shouldPostToMainIssue = openedLinkedPullRequests.length === 0;
    for (const pullRequest of openedLinkedPullRequests) {
      const { owner: prOwner, repo: prRepo, issue_number: prNumber } = parseIssueUrl(pullRequest.url);
      try {
        const reminderContent =
          !context.config.disqualification ||
          !context.config.topUps.enabled ||
          !(await shouldDisplayTopUpsReminder(context, { issueNumber: issue_number, pr: { prOwner, prRepo, prNumber }, remainingTopUps }))
            ? "this task has been idle for a while"
            : `you have used <code>${topUpLimit - remainingTopUps + 1}</code> of <code>${topUpLimit}</code> available deadline extensions`;

        const logMessage = logger.info(`@${logins}, ${reminderContent}. Please provide an update on your progress.`, {
          taskAssignees: issue.assignees.map((o) => o?.id),
          url: issue.html_url,
          topUpLimit,
          remainingTopUps,
        });
        const metadata = createStructuredMetadata(FOLLOWUP_HEADER, logMessage);

        await octokit.rest.issues.createComment({
          owner: prOwner,
          repo: prRepo,
          issue_number: prNumber,
          body: [logMessage.logMessage.raw, metadata].join("\n"),
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
      const reminderContent =
        !context.config.disqualification ||
        !context.config.topUps.enabled ||
        !(await shouldDisplayTopUpsReminder(context, { issueNumber: issue_number, remainingTopUps }))
          ? "this task has been idle for a while"
          : `you have used <code>${topUpLimit - remainingTopUps + 1}</code> of <code>${topUpLimit}</code> available deadline extensions`;
      const logMessage = logger.info(`@${logins}, ${reminderContent}. Please provide an update on your progress.`, {
        taskAssignees: issue.assignees.map((o) => o?.id),
        url: issue.html_url,
        topUpLimit,
        remainingTopUps,
      });
      const metadata = createStructuredMetadata(FOLLOWUP_HEADER, logMessage);
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number,
        body: [logMessage.logMessage.raw, metadata].join("\n"),
      });
    }
  }
  return true;
}

export async function removeEntryFromDatabase(issue: ListIssueForRepo) {
  const { owner, repo, issue_number } = parseIssueUrl(issue.html_url);
  await db.update((data) => {
    const key = `${owner}/${repo}`;
    if (data[key]) {
      data[key] = data[key].filter((o) => o.issueNumber !== issue_number);
    }
    return data;
  });
}

async function removeAllAssignees(context: ContextPlugin, issue: ListIssueForRepo) {
  const { octokit, logger, commentHandler } = context;
  const { repo, owner, issue_number } = parseIssueUrl(issue.html_url);

  if (!issue?.assignees?.length) {
    logger.error(`Missing Assignees from ${issue.html_url}`);
    return false;
  }
  const logins = issue.assignees.map((o) => o?.login).filter((o) => !!o) as string[];
  const { remainingTopUps } = await getTopUpsRemaining(context);
  const logMessage = logger.info(
    `Passed the disqualification threshold and ${remainingTopUps <= 0 ? "no more top-ups are remaining" : "no activity is detected"}, removing assignees: ${logins.map((o) => `@${o}`).join(", ")}.`,
    {
      issue: issue.html_url,
    }
  );
  await commentHandler.postComment(context, logMessage, { raw: true });
  await octokit.rest.issues.removeAssignees({
    owner,
    repo,
    issue_number,
    assignees: logins,
  });
  await removeEntryFromDatabase(issue);
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
