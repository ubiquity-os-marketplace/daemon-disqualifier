import { DateTime } from "luxon";
import { Context } from "../types/context";
import { Database } from "../types/database";
import { parseGitHubUrl } from "./github-url";

export async function updateTasks(context: Context) {
  const {
    adapters: { supabase },
    logger,
  } = context;
  const watchedRepoList = await supabase.repositories.get();

  if (!watchedRepoList?.length) {
    logger.info("No watched repos have been found, no work to do.");
    return false;
  }
  for (const watchedIssue of watchedRepoList) {
    const now = DateTime.now().plus({ day: 10 });
    const deadline = DateTime.fromISO(watchedIssue.deadline);
    if (now >= deadline) {
      const activity = await getAssigneesActivityForIssue(context, watchedIssue);
      console.log(activity);
      if (!activity?.length) {
        console.log("bye");
        await removeIdleAssignees(context);
      }
    }
  }
  return true;
}

async function getAssigneesActivityForIssue({ octokit, payload }: Context, issue: Database["public"]["Tables"]["repositories"]["Row"]) {
  const { repo, owner, issue_number } = parseGitHubUrl(issue.url);
  console.log("users", JSON.stringify(payload.issue, null, 2));
  return octokit.paginate(
    octokit.rest.issues.listEvents,
    {
      owner,
      repo,
      issue_number,
      per_page: 100,
    },
    (res) => res.data.filter((o) => payload.issue.assignees?.find((assignee) => assignee?.login === o.actor.login))
  );
}

async function removeIdleAssignees(context: Context) {
  const { octokit, payload } = context;

  if (!payload.issue.assignees?.length) {
    return;
  }
  const logins = payload.issue.assignees.map((o) => o?.login).filter((o) => !!o) as string[];
  await octokit.rest.issues.removeAssignees({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    issue_number: payload.issue.number,
    assignees: logins,
  });
}
