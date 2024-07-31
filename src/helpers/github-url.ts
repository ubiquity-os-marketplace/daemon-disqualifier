export function parseIssueUrl(url: string): { owner: string; repo: string; issue_number: number } {
  const path = new URL(url).pathname.split("/");
  if (path.length !== 5) {
    throw new Error(`[parseGitHubUrl] Invalid url: [${url}]`);
  }
  return {
    owner: path[1],
    repo: path[2],
    issue_number: Number(path[4]),
  };
}

export function parseRepoUrl(repoUrl: string) {
  if (!repoUrl) {
    throw new Error(`[parseRepoUrl] Missing repo URL`);
  }
  const urlObject = new URL(repoUrl);
  const urlPath = urlObject.pathname.split("/");

  if (urlPath.length === 3) {
    const ownerName = urlPath[1];
    const repoName = urlPath[2];
    if (!ownerName || !repoName) {
      throw new Error(`Missing owner name or repo name in [${repoUrl}]`);
    }
    return {
      owner: ownerName,
      repo: repoName,
    };
  } else {
    throw new Error(`[parseRepoUrl] Invalid repo URL: [${repoUrl}]`);
  }
}