import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { collectLinkedPullRequests } from "../src/helpers/collect-linked-pulls";
import { parseIssueUrl } from "../src/helpers/github-url";
import { remindAssigneesForIssue } from "../src/helpers/remind-and-remove";
import { createStructuredMetadata } from "../src/helpers/structured-metadata";
import { ListIssueForRepo } from "../src/types/github-types";
import { ContextPlugin } from "../src/types/plugin-input";

jest.mock("../src/helpers/collect-linked-pulls");
jest.mock("../src/helpers/github-url");
jest.mock("../src/helpers/structured-metadata");

describe("remindAssigneesForIssue", () => {
  let context: ContextPlugin;
  let issue: ListIssueForRepo;

  beforeEach(() => {
    context = {
      logger: new Logs("debug"),
      octokit: {
        rest: {
          issues: {
            createComment: jest.fn(),
            removeAssignees: jest.fn(),
          },
        },
      },
      config: {
        warning: 1,
        disqualification: 1,
        pullRequestRequired: false,
      },
    } as unknown as ContextPlugin;

    issue = {
      html_url: "https://github.com/owner/repo/issues/1",
      assignees: [{ login: "ubiquity-os", id: 1 }],
    } as unknown as ListIssueForRepo;

    (parseIssueUrl as jest.Mock).mockReturnValue({
      repo: "repo",
      owner: "owner",
      issue_number: 1,
    });

    (collectLinkedPullRequests as jest.Mock).mockResolvedValue([]);
    (createStructuredMetadata as jest.Mock).mockReturnValue({});
  });

  it("should post a comment to the parent issue if posting to the pull request fails", async () => {
    context.config.pullRequestRequired = true;
    (collectLinkedPullRequests as jest.Mock).mockResolvedValue([{ url: "https://github.com/owner/repo/pull/1" }]);

    const mockedError = new Error("Failed to post comment");

    (context.octokit.rest.issues.createComment as unknown as jest.Mock).mockRejectedValueOnce(mockedError).mockResolvedValueOnce({});

    await remindAssigneesForIssue(context, issue);

    expect(context.octokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "owner",
        repo: "repo",
        issue_number: 1,
      })
    );

    expect(context.octokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "owner",
        repo: "repo",
        issue_number: 1,
        body: expect.stringContaining("this task has been idle for a while"),
      })
    );
  });
});
