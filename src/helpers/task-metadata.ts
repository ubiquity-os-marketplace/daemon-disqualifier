import { DateTime } from "luxon";
import { Context } from "../types/context";
import { ListCommentsForIssue, ListForOrg, ListIssueForRepo } from "../types/github-types";
import ms from "ms";

export async function getTaskMetadata(
    context: Context,
    repo: ListForOrg["data"][0],
    issue: ListIssueForRepo
) {
    const { logger, octokit } = context;

    const comments = (await octokit.paginate(octokit.rest.issues.listComments, {
        owner: repo.owner.login,
        repo: repo.name,
        issue_number: issue.number,
        per_page: 100,
    })) as ListCommentsForIssue[];

    const botComments = comments.filter((o) => o.user?.type === "Bot");
    const taskDeadlineJsonRegex = /"taskDeadline": "([^"]*)"/g;
    const taskAssigneesJsonRegex = /"taskAssignees": \[([^\]]*)\]/g;
    const assignmentRegex = /Ubiquity - Assignment - start -/gi;
    const botAssignmentComments = botComments.filter(
        (o) => assignmentRegex.test(o?.body || "")
    ).sort((a, b) =>
        DateTime.fromISO(a.created_at).toMillis() - DateTime.fromISO(b.created_at).toMillis()
    )

    const botFollowup = /this task has been idle for a while. Please provide an update./gi;
    const botFollowupComments = botComments.filter((o) => botFollowup.test(o?.body || ""));

    if (!botAssignmentComments.length && !botFollowupComments.length) {
        logger.info(`No assignment or followup comments found for ${issue.html_url}`);
        return false;
    }

    const lastCheckComment = botFollowupComments[0]?.created_at ? botFollowupComments[0] : botAssignmentComments[0];
    const lastCheck = DateTime.fromISO(lastCheckComment.created_at);

    const taskDeadlineMatch = taskDeadlineJsonRegex.exec(botAssignmentComments[0]?.body || "");
    const taskAssigneesMatch = taskAssigneesJsonRegex.exec(botAssignmentComments[0]?.body || "");

    const metadata = {
        taskDeadline: taskDeadlineMatch?.[1] || "",
        taskAssignees: taskAssigneesMatch?.[1]
            .split(",")
            .map((o) => o.trim())
            .map(Number),
    };

    // supporting legacy format
    if (!metadata.taskAssignees?.length) {
        metadata.taskAssignees = issue.assignees ? issue.assignees.map((o) => o.id) : issue.assignee ? [issue.assignee.id] : [];
    }

    if (!metadata.taskAssignees?.length) {
        logger.error(`Missing Assignees from ${issue.html_url}`);
        return false;
    }

    if (!metadata.taskDeadline) {
        const taskDeadlineJsonRegex = /"duration": ([^,]*),/g;
        const taskDeadlineMatch = taskDeadlineJsonRegex.exec(botAssignmentComments[0]?.body || "");
        if (!taskDeadlineMatch) {
            logger.error(`Missing deadline from ${issue.html_url}`);
            return false;
        }
        const duration = taskDeadlineMatch[1] || "";
        const durationInMs = ms(duration);
        if (durationInMs === 0) {
            // it could mean there was no time label set on the issue
            // but it could still be workable and priced
        } else if (durationInMs < 0 || !durationInMs) {
            logger.error(`Invalid deadline found on ${issue.html_url}`);
            return false;
        }
        metadata.taskDeadline = DateTime.fromMillis(lastCheck.toMillis() + durationInMs).toISO() || "";
    }

    return { metadata, lastCheck };
}