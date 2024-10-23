import { FOLLOWUP_HEADER } from "../../src/types/context";

export const STRINGS = {
  UBIQUITY: "ubiquity",
  UBIQUIBOT: "ubiquibot",
  BOT: "ubiquibot[bot]",
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
  LOGS_ANON_CALLER: "_Logs.<anonymous>",
  USING_ASSIGNMENT_EVENT: "No last check found, using assignment event",
};

export function botAssignmentComment(assigneeId: number, deadlineStr: string) {
  return `<samp>
<table>

<tr><td>Deadline</td><td>${deadlineStr}</td></tr>
<tr>
<td>Registered Wallet</td>
<td>Register your wallet address using the following slash command: '/wallet 0x0000...0000'</td>
</tr>
</table>
</samp>
  
<h6>Tips:</h6>
    <ul>
    <li>Use <code>/wallet 0x0000...0000</code> if you want to update your registered payment wallet address.</li>
    <li>Be sure to open a draft pull request as soon as possible to communicate updates on your progress.</li>
    <li>Be sure to provide timely updates to us when requested, or you will be automatically unassigned from the task.</li>
    <ul>
<!-- Ubiquity - Assignment - start - 4b6c279
{
  "taskDeadline": "${deadlineStr}",
  "taskAssignees": [
    ${assigneeId}
  ],
  "priceLabel": {
    "id": 7146357929,
    "node_id": "LA_kwDOKbHpBs8AAAABqfTEqQ",
    "url": "https://api.github.com/repos/ubq-testing/ubiquibot-config/labels/Price:%2075%20USD",
    "name": "Price: 75 USD",
    "color": "1f883d",
    "default": false,
    "description": null
  },
  "revision": "4b6c279",
  "caller": "start"
}
-->`;
}
export function botReminderComment() {
  return `@user2, this task has been idle for a while. Please provide an update.
<!-- Ubiquity - ${FOLLOWUP_HEADER} - function - 4b6c279
{
}
-->`;
}

export function lastCheckWasOn(deadlineStr: string) {
  return `Last check was on ${deadlineStr}`;
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
