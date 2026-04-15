import { beforeEach, describe, expect, it } from "bun:test";
import { createPostgresIssueStore } from "../src/adapters/postgres-issue-store";
import { resetMockPostgres } from "./helpers/mock-postgres";

const trackedIssueUrl = "https://github.com/ubiquity-os-marketplace/daemon-disqualifier/issues/42";
const trackedIssueOwner = "ubiquity-os-marketplace";
const trackedIssueRepo = "daemon-disqualifier";

describe("Postgres issue store", () => {
  beforeEach(() => {
    resetMockPostgres();
  });

  it("adds issues without duplicating rows", async () => {
    const issueStore = await createPostgresIssueStore();

    try {
      await issueStore.addIssue(trackedIssueUrl);
      await issueStore.addIssue(trackedIssueUrl);

      await expect(issueStore.getIssueNumbers(trackedIssueOwner, trackedIssueRepo)).resolves.toEqual([42]);
    } finally {
      await issueStore.close();
    }
  });

  it("updates tracked issues to the new target", async () => {
    const issueStore = await createPostgresIssueStore();

    try {
      await issueStore.addIssue("https://github.com/ubiquity-os-marketplace/daemon-disqualifier/issues/41");
      await issueStore.updateIssue(
        "https://github.com/ubiquity-os-marketplace/daemon-disqualifier/issues/41",
        "https://github.com/ubiquity-os-marketplace/daemon-disqualifier/issues/43"
      );

      await expect(issueStore.getIssueNumbers(trackedIssueOwner, trackedIssueRepo)).resolves.toEqual([43]);
    } finally {
      await issueStore.close();
    }
  });

  it("removes only the targeted issue number", async () => {
    const issueStore = await createPostgresIssueStore();

    try {
      await issueStore.addIssue("https://github.com/ubiquity-os-marketplace/daemon-disqualifier/issues/41");
      await issueStore.addIssue("https://github.com/ubiquity-os-marketplace/daemon-disqualifier/issues/42");

      await issueStore.removeIssueByNumber(trackedIssueOwner, trackedIssueRepo, 41);

      await expect(issueStore.getIssueNumbers(trackedIssueOwner, trackedIssueRepo)).resolves.toEqual([42]);
    } finally {
      await issueStore.close();
    }
  });

  it("groups repositories with stable issue ordering", async () => {
    const issueStore = await createPostgresIssueStore();

    try {
      await issueStore.addIssue("https://github.com/ubiquity-os-marketplace/daemon-disqualifier/issues/7");
      await issueStore.addIssue("https://github.com/ubiquity-os-marketplace/daemon-disqualifier/issues/3");
      await issueStore.addIssue("https://github.com/ubiquity-os/another-repo/issues/11");

      await expect(issueStore.getAllRepositories()).resolves.toEqual([
        {
          owner: "ubiquity-os",
          repo: "another-repo",
          issueNumbers: [11],
        },
        {
          owner: "ubiquity-os-marketplace",
          repo: "daemon-disqualifier",
          issueNumbers: [3, 7],
        },
      ]);
    } finally {
      await issueStore.close();
    }
  });

  it("reports whether tracked issue data exists", async () => {
    const issueStore = await createPostgresIssueStore();

    try {
      await expect(issueStore.hasData()).resolves.toBe(false);

      await issueStore.addIssue(trackedIssueUrl);

      await expect(issueStore.hasData()).resolves.toBe(true);
    } finally {
      await issueStore.close();
    }
  });
});
