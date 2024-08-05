import { Context } from "../types/context";
import { ListForOrg } from "../types/github-types";

export async function getWatchedRepos(context: Context) {
  const {
    config: {
      watch: { optOut },
    },
  } = context;
  const repoNames = new Set<string>();
  const orgRepos = await getReposForOrg(context, context.payload.repository.owner.login);
  orgRepos.forEach((repo) => repoNames.add(repo.name.toLowerCase()));

  for (const repo of optOut) {
    repoNames.forEach((name) => (name.includes(repo) ? repoNames.delete(name) : null));
  }

  return Array.from(repoNames)
    .map((name) => orgRepos.find((repo) => repo.name.toLowerCase() === name))
    .filter((repo) => repo !== undefined) as ListForOrg["data"];
}

export async function getReposForOrg(context: Context, orgOrRepo: string) {
  const { octokit } = context;
  try {
    return (await octokit.paginate(octokit.rest.repos.listForOrg, {
      org: orgOrRepo,
      per_page: 100,
    })) as ListForOrg["data"];
  } catch (er) {
    throw new Error(`Error getting repositories for org ${orgOrRepo}: ` + JSON.stringify(er));
  }
}
