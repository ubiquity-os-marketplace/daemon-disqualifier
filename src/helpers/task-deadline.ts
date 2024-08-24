import { DateTime } from "luxon";
import { Context } from "../types/context";
import { ListIssueForRepo } from "../types/github-types";
import { getAssigneesActivityForIssue } from "./get-assignee-activity";

export async function handleDeadline(
    context: Context,
    metadata: {
        taskDeadline: string;
        taskAssignees: number[] | undefined;
    },
    issue: ListIssueForRepo,
    lastCheck: DateTime,
) {
    const { logger, config } = context;

    const assigneeIds = issue.assignees?.map((o) => o.id) || [];

    if (assigneeIds.length && metadata.taskAssignees?.some((a) => !assigneeIds.includes(a))) {
        logger.info(`Assignees mismatch found for ${issue.html_url}`, {
            metadata,
            assigneeIds,
        });
    }

    const deadline = DateTime.fromISO(metadata.taskDeadline);
    const now = DateTime.now();

    if (!deadline.isValid && !lastCheck.isValid) {
        logger.error(`Invalid date found on ${issue.html_url}`);
        return false;
    }

    const activity = (await getAssigneesActivityForIssue(context, issue, assigneeIds)).filter((o) => {
        return DateTime.fromISO(o.created_at) > lastCheck;
    })

    let deadlineWithThreshold = deadline.plus({ milliseconds: config.disqualification });
    let reminderWithThreshold = deadline.plus({ milliseconds: config.warning });

    if (activity?.length) {
        const lastActivity = DateTime.fromISO(activity[0].created_at);
        deadlineWithThreshold = lastActivity.plus({ milliseconds: config.disqualification });
        reminderWithThreshold = lastActivity.plus({ milliseconds: config.warning });
    }

    return { deadlineWithThreshold, reminderWithThreshold, now };
}