import { Context } from "../types/context";
import { parseGitHubUrl } from "./github-url";

export async function getGithubIssue(context: Context, issue: Context["payload"]["issue"]) {
  const { repo, owner, issue_number } = parseGitHubUrl(issue.url);

  try {
    const { data } = await context.octokit.issues.get({
      owner,
      repo,
      issue_number,
    });
    return data;
  } catch (e) {
    context.logger.error(`Could not get GitHub issue ${issue.url}`);
    return null;
  }
}
