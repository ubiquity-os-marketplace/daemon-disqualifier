import { Context } from "../types/context";
import { ListForOrg, ListIssueForRepo } from "../types/github-types";
import { parseGitHubUrl } from "./github-url";

export async function getGithubIssue(context: Context, issue: ListIssueForRepo) {
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

export async function getProjectUrls(context: Context, watch: Context["config"]["watch"]) {
  const projectUrls = new Set<string>();
  let repos: ListForOrg["data"] = [];

  for (const orgOrRepo of watch.optIn) {
    const repositories: ListForOrg["data"] = await getRepoUrls(context, orgOrRepo);
    repositories.forEach((repo) => projectUrls.add(repo.html_url));
    repos = repos.concat(repositories);
  }

  for (const orgOrRepo of watch.optOut) {
    const len = orgOrRepo.split("/").length;

    if (len === 1) {
      //it's an org, delete all org repos in the list
      projectUrls.forEach((url) => {
        if (url.includes(orgOrRepo)) {
          const [owner, repo] = getRepoCredentials(url);
          if (watch.optIn.includes(`${owner}/${repo}`)) {
            return;
          }
          projectUrls.delete(url);
        }
      });
    } else {
      // it's a repo, delete the repo from the list
      projectUrls.forEach((url) => url.includes(orgOrRepo) && projectUrls.delete(url));
    }
  }

  return { projectUrls: Array.from(projectUrls), repos };
}

/**
 * Returns owner and repository names from a project URL
 * @param projectUrl project URL
 * @returns array of owner and repository names
 */
export function getRepoCredentials(projectUrl: string) {
  const urlObject = new URL(projectUrl);
  const urlPath = urlObject.pathname.split("/");
  const ownerName = urlPath[1];
  const repoName = urlPath[2];
  if (!ownerName || !repoName) {
    throw new Error(`Missing owner name or repo name in [${projectUrl}]`);
  }
  return [ownerName, repoName];
}

/**
 * Returns all org repositories urls or owner/repo url
 * @param orgOrRepo org or repository name
 * @returns array of repository urls
 */
export async function getRepoUrls(content: Context, orgOrRepo: string) {
  if (!orgOrRepo) {
    console.warn("No org or repo provided: ", orgOrRepo);
    return [];
  }

  if (orgOrRepo.startsWith("/") || orgOrRepo.endsWith("/")) {
    console.warn("Invalid org or repo provided: ", orgOrRepo);
    return [];
  }

  const { octokit } = content;

  const params = orgOrRepo.split("/");
  let repos: ListForOrg["data"] = [];
  try {
    switch (params.length) {
      case 1: // org
        try {
          const res = await octokit.paginate(octokit.rest.repos.listForOrg, {
            org: orgOrRepo,
          });
          repos = res.map((repo) => repo);
          console.info(`Getting ${orgOrRepo} org repositories: ${repos.length}`);
        } catch (error: unknown) {
          console.warn(`Getting ${orgOrRepo} org repositories failed: ${error}`);
          throw error;
        }
        break;
      case 2: // owner/repo
        try {
          const res = await octokit.rest.repos.get({
            owner: params[0],
            repo: params[1],
          });

          if (res.status === 200) {
            repos.push(res.data as ListForOrg["data"][0]);
            console.info(`Getting repo ${params[0]}/${params[1]}: ${res.data.html_url}`);
          } else console.warn(`Getting repo ${params[0]}/${params[1]} failed: ${res.status}`)
        } catch (error: unknown) {
          console.warn(`Getting repo ${params[0]}/${params[1]} failed: ${error}`);
          throw error;
        }
        break;
      default:
        console.warn(`Neither org or nor repo GitHub provided: ${orgOrRepo}.`);
    }
  } catch (err) {
    console.error(err);
  }

  return repos
}
