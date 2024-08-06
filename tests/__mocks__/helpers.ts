import { db } from "./db";
import issueTemplate from "./issue-template";
import repoTemplate from "./repo-template";
import { STRINGS, getIssueUrl, getIssueHtmlUrl } from "./strings";

export const ONE_DAY = 1000 * 60 * 60 * 24;

export function createRepo(name?: string, id?: number, owner?: string) {
    db.repo.create({ ...repoTemplate, id: id || 1, name: name || repoTemplate.name, owner: { login: owner || STRINGS.UBIQUITY } });
}

export function createComment(
    id: number,
    issueId: number,
    user: string,
    type: "User" | "Bot" = "User",
    body?: string,
    created_at?: string,
) {
    db.issueComments.create({
        id,
        user: { login: user, type },
        issueId,
        body: body || "test",
        created_at: created_at || new Date(Date.now() - ONE_DAY).toISOString(),
    });
}

export function createIssue(
    id: number,
    assignees: { login: string, id: number }[],
    owner?: string,
    created_at?: string,
    repo?: string,
) {
    db.issue.create({
        ...issueTemplate,
        id,
        assignees: assignees.length ? assignees : [{ login: STRINGS.UBIQUITY, id: 1 }],
        created_at: created_at || new Date(Date.now() - ONE_DAY).toISOString(),
        url: getIssueUrl(id),
        html_url: getIssueHtmlUrl(id),
        owner: { login: owner || STRINGS.UBIQUITY },
        number: id,
        repo: repo || "test-repo",
    });
}
