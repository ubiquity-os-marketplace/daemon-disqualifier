import { RestEndpointMethodTypes } from "@octokit/rest";
import { postComment } from "@ubiquity-os/plugin-sdk";
import prettyMilliseconds from "pretty-ms";
import { getWatchedRepos } from "../helpers/get-watched-repos";
import { updateTaskReminder } from "../helpers/task-update";
import { ListForOrg } from "../types/github-types";
import { ContextPlugin } from "../types/plugin-input";

type IssueType = RestEndpointMethodTypes["issues"]["listForRepo"]["response"]["data"]["0"];

export async function watchUserActivity(context: ContextPlugin) {
  const { logger } = context;

  const repos = await getWatchedRepos(context);

  if (!repos?.length) {
    return { message: logger.info("No watched repos have been found, no work to do.").logMessage.raw };
  }

  if (
    context.eventName === "issues.assigned" &&
    repos.some((repo) => repo.id === context.payload.repository.id) &&
    "issue" in context.payload &&
    !shouldIgnoreIssue(context.payload.issue as IssueType)
  ) {
    const message = ["[!IMPORTANT]", "**Follow-up schedule**"];
    message.push(`- A reminder will be sent every ${prettyMilliseconds(context.config.warning, { verbose: true })} if there is no activity.`);
    message.push(`- Tasks are subject to disqualification after ${prettyMilliseconds(context.config.disqualification, { verbose: true })} of inactivity.`);
    if (context.config.pullRequestRequired) {
      message.push(`- Be sure to link a pull-request before the first reminder or you will be disqualified.`);
    }
    const log = logger.error(message.map((o) => `> ${o}`).join("\n"));
    log.logMessage.diff = log.logMessage.raw;
    await postComment(context, log);
  }

  await Promise.all(
    repos.map(async (repo) => {
      logger.debug(`> Watching user activity for repo: ${repo.name} (${repo.html_url})`);
      await updateReminders(context, repo);
    })
  );

  return { message: "OK" };
}

function shouldIgnoreIssue(issue: IssueType) {
  return issue.draft || issue.pull_request || issue.locked || issue.state !== "open";
}

async function updateReminders(context: ContextPlugin, repo: ListForOrg["data"][0]) {
  const { logger, octokit, payload } = context;
  const owner = payload.repository.owner?.login;
  if (!owner) {
    throw new Error("No owner found in the payload");
  }
  const issues = await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner,
    repo: repo.name,
    per_page: 100,
    state: "open",
  });

  await Promise.all(
    issues.map(async (issue) => {
      // I think we can safely ignore the following
      if (shouldIgnoreIssue(issue)) {
        logger.debug(`Skipping issue ${issue.html_url} due to the issue not meeting the right criteria.`, {
          draft: issue.draft,
          pullRequest: !!issue.pull_request,
          locked: issue.locked,
          state: issue.state,
        });
        return;
      }

      if (issue.assignees?.length || issue.assignee) {
        logger.debug(`Checking assigned issue: ${issue.html_url}`);
        await updateTaskReminder(context, repo, issue);
      } else {
        logger.info(`Skipping issue ${issue.html_url} because no user is assigned.`);
      }
    })
  );
}
