import { Context } from "../types/context";
import { ListForOrg } from "../types/github-types";
import { parseRepoUrl } from "./github-url";

export async function getWatchedRepos(context: Context, watch: Context["config"]["watch"]) {
  const repoUrls = new Set<string>();
  let repos: ListForOrg["data"] = [];

  for (const orgOrRepo of watch.optIn) {
    const repositories: ListForOrg["data"] = await getReposForOrg(context, orgOrRepo);
    repositories.forEach((repo) => repoUrls.add(repo.html_url));
    repos = repos.concat(repositories);
  }

  for (const orgOrRepo of watch.optOut) {
    const len = orgOrRepo.split("/").length;

    if (len === 1) {
      //it's an org, delete all org repos in the list
      repoUrls.forEach((url) => {
        if (url.includes(orgOrRepo)) {
          const parsed = parseRepoUrl(url);
          if (!parsed) return;
          const { owner, repo } = parsed;
          if (watch.optIn.includes(`${owner}/${repo}`)) {
            return;
          }
          repoUrls.delete(url);
        }
      });
    } else {
      // it's a repo, delete the repo from the list
      repoUrls.forEach((url) => url.includes(orgOrRepo) && repoUrls.delete(url));
    }
  }

  return { repoUrls: Array.from(repoUrls), repos };
}

/**
 * Returns all org repositories urls or owner/repo url
 * @param orgOrRepo org or repository name
 * @returns array of repository urls
 */
export async function getReposForOrg(context: Context, orgOrRepo: string) {
  const { logger } = context;
  if (!orgOrRepo) {
    logger.info("No org or repo provided: ", { orgOrRepo });
    return [];
  }

  if (orgOrRepo.startsWith("/") || orgOrRepo.endsWith("/")) {
    logger.info("Invalid org or repo provided: ", { orgOrRepo });
    return [];
  }

  const { octokit } = context;

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
          logger.info(`Getting ${orgOrRepo} org repositories: ${repos.length}`);
        } catch (error: unknown) {
          logger.error(`Getting ${orgOrRepo} org repositories failed: ${error}`);
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
            logger.info(`Getting repo ${params[0]}/${params[1]}: ${res.data.html_url}`);
          } else logger.error(`Getting repo ${params[0]}/${params[1]} failed: ${res.status}`)
        } catch (error: unknown) {
          logger.error(`Getting repo ${params[0]}/${params[1]} failed: ${error}`);
          throw error;
        }
        break;
      default:
        logger.error(`Neither org or nor repo GitHub provided: ${orgOrRepo}.`);
    }
  } catch (err) {
    logger.error("Error getting repositories: ", { err });
  }

  return repos
}
