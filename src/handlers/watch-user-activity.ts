import { getWatchedRepos } from "../helpers/get-watched-repos";
import { updateTaskReminder } from "../helpers/task-update";
import { Context } from "../types/context";
import { ListForOrg, ListIssueForRepo } from "../types/github-types";

export async function watchUserActivity(context: Context) {
  const { logger } = context;

  const repos = await getWatchedRepos(context);

  if (!repos?.length) {
    logger.info("No watched repos have been found, no work to do.");
    return false;
  }

  for (const repo of repos) {
    logger.info(`> Watching user activity for repo: ${repo.name} (${repo.html_url})`);
    await updateReminders(context, repo);
  }

  return true;
}

async function updateReminders(context: Context, repo: ListForOrg["data"][0]) {
  const { logger, octokit, payload } = context;
  const owner = payload.repository.owner?.login;
  if (!owner) {
    throw new Error("No owner found in the payload");
  }
  const issues = (await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner,
    repo: repo.name,
    per_page: 100,
    state: "open",
  })) as ListIssueForRepo[];

  for (const issue of issues) {
    // I think we can safely ignore the following
    if (issue.draft || issue.pull_request || issue.locked || issue.state !== "open") {
      continue;
    }

    if (issue.assignees?.length || issue.assignee) {
      logger.debug(`Checking assigned issue: ${issue.html_url}`);
      await updateTaskReminder(context, repo, issue);
    }
  }
}
