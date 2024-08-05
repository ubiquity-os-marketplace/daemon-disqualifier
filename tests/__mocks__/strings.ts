export const STRINGS = {
    UBIQUITY: "ubiquity",
    UBIQUIBOT: "ubiquibot",
    USER: "user2",
    TEST_REPO: "ubiquity/test-repo",
    TEST_REPO_NAME: "test-repo",
    PRIVATE_REPO: "ubiquity/private-repo",
    PRIVATE_REPO_NAME: "private-repo",
    FILLER_REPO: "ubiquity/filler-repo",
    FILLER_REPO_NAME: "filler-repo",
    USER_ACTIVITY_WATCHER: "ubiquity/user-activity-watcher",
    USER_ACTIVITY_WATCHER_NAME: "user-activity-watcher",
    TEST_REPO_URL: "https://api.github.com/repos/ubiquity/test-repo/issues/1",
    TEST_REPO_HTML_URL: "https://github.com/ubiquity/test-repo/issues/1",
}


export function updatingRemindersFor(repo: string) {
    return `Updating reminders for ${repo}`;
}

export function noAssignmentCommentFor(repo: string) {
    return `No assignment or followup comments found for ${repo}`;
}

export function getIssueUrl(issueId: number) {
    return STRINGS.TEST_REPO_URL.replace("issues/1", `issues/${issueId}`);
}

export function getIssueHtmlUrl(issueId: number) {
    return STRINGS.TEST_REPO_HTML_URL.replace("issues/1", `issues/${issueId}`);
}

export function getRepoUrl(repo: string) {
    return `https://api.github.com/repos/${repo}`;
}

export function getRepoHtmlUrl(repo: string) {
    return `https://github.com/${repo}`;
}
