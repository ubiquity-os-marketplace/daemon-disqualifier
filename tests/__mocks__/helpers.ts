import { db } from "./db";
import issueTemplate from "./issue-template";
import repoTemplate from "./repo-template";
import { STRINGS, getIssueUrl, getIssueHtmlUrl } from "./strings";

export const ONE_DAY = 1000 * 60 * 60 * 24;

export function createRepo(name?: string, id?: number, owner?: string) {
  db.repo.create({
    ...repoTemplate,
    id: id || 1,
    name: name || repoTemplate.name,
    owner: { login: owner || STRINGS.UBIQUITY },
    url: `https://api.github.com/repos/${owner || STRINGS.UBIQUITY}/${name || repoTemplate.name}`,
    html_url: `https://github.com/${owner || STRINGS.UBIQUITY}/${name || repoTemplate.name}`,
  });
}

export function createComment(id: number, issueId: number, user: string, type: "User" | "Bot" = "User", body?: string, created_at?: string) {
  db.issueComments.create({
    id,
    user: { login: user, type },
    issueId,
    body: body || "test",
    created_at: created_at || new Date(Date.now() - ONE_DAY).toISOString(),
    performed_via_github_app: type === "Bot",
  });
}

export function createIssue(id: number, assignees: { login: string; id: number }[], owner?: string, created_at?: string, body?: string, repo?: string) {
  db.issue.create({
    ...issueTemplate,
    id,
    assignees: assignees.length ? assignees : [{ login: STRINGS.UBIQUITY, id: 1 }],
    created_at: created_at || new Date(Date.now() - ONE_DAY).toISOString(),
    url: `https://github.com/${owner || STRINGS.UBIQUITY}/${repo || "test-repo"}/issues/${id}`,
    html_url: `https://github.com/${owner || STRINGS.UBIQUITY}/${repo || "test-repo"}/issues/${id}`,
    owner: { login: owner || STRINGS.UBIQUITY },
    number: id,
    repo: repo || "test-repo",
    body: body || "test",
  });
}

export function createEvent(id: number, actorId = 1, issueId = 1, created_at = new Date(Date.now() - ONE_DAY).toISOString()) {
  db.event.create({
    id,
    actor: {
      id: actorId,
      type: "User",
      login: "ubiquity",
    },
    owner: "ubiquity",
    repo: "test-repo",
    issue_number: issueId,
    event: "assigned",
    commit_id: null,
    commit_url: "https://github.com/ubiquity/test-repo/commit/1",
    created_at,
    assignee: {
      login: "ubiquity",
    },
    source: {
      issue: {
        number: 1,
        html_url: getIssueHtmlUrl(1),
        body: "test",
        pull_request: {
          merged_at: new Date(Date.now() - ONE_DAY).toISOString(),
        },
        repository: {
          full_name: "ubiquity/test-repo",
        },
        state: "open",
        user: {
          login: "ubiquity",
        },
      },
    },
  });
}
