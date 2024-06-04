import { Context } from "../types/context";
import { Database } from "../types/database";

export async function updateTasks(context: Context) {
  const {
    adapters: { supabase },
    logger,
  } = context;
  const watchedRepoList = await supabase.repositories.get();

  console.log("hello");
  if (!watchedRepoList?.length) {
    logger.info("No watched repos have been found, no work to do.");
    return false;
  }
  for (const watchedRepo of watchedRepoList) {
    const activity = await getAssigneeActivityForIssue(context, watchedRepo);
  }
  return true;
}

async function getAssigneeActivityForIssue({ octokit, payload }: Context, issue: Database["public"]["Tables"]["repositories"]["Row"]) {
  const events = await octokit.paginate(
    octokit.rest.issues.listEvents,
    {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      per_page: 100,
    },
    (res) => {
      return res.data.filter((o) => o.actor.login === payload.issue.assignee?.login);
    }
  );
  return events;
}
