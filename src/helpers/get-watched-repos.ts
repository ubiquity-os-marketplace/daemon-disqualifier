import { Context } from "@ubiquity-os/ubiquity-os-kernel";
import { ListForOrg } from "../types/github-types";
import { ContextPlugin } from "../types/plugin-input";

export async function getWatchedRepos(context: ContextPlugin) {
  const {
    config: {
      watch: { optOut },
    },
  } = context;
  const repoNames = new Set<string>();
  const owner = context.payload.repository.owner?.login;
  if (!owner) {
    throw new Error("No owner found in the payload");
  }
  const orgRepos = await getReposForOrg(context, owner);
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
