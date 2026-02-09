import { beforeEach, describe, expect, it } from "bun:test";
import { createKvDatabaseHandler, KV_PREFIX } from "../src/adapters/kv-database-handler";

type KvMock = Awaited<ReturnType<typeof Deno.openKv>> & {
  _data: Map<string, unknown>;
};

describe("KvDatabaseHandler", () => {
  let kv: KvMock;

  beforeEach(async () => {
    kv = (await Deno.openKv()) as KvMock;
    kv._data.clear();
  });

  it("should read legacy entries with commentId and normalize to issue-only objects", async () => {
    await kv.set(
      [KV_PREFIX, "owner", "repo"],
      [
        { issueNumber: 1, commentId: 111 },
        { issueNumber: 2, commentId: 222 },
      ]
    );

    const handler = await createKvDatabaseHandler();
    const repositories = await handler.getAllRepositories();

    expect(repositories).toEqual([
      {
        owner: "owner",
        repo: "repo",
        issues: [{ issueNumber: 1 }, { issueNumber: 2 }],
      },
    ]);
  });

  it("should persist only issueNumber objects for add/update/remove operations", async () => {
    await kv.set([KV_PREFIX, "owner", "repo"], [{ issueNumber: 1, commentId: 111 }]);
    const handler = await createKvDatabaseHandler();

    await handler.addIssue("https://github.com/owner/repo/issues/2");

    let stored = await kv.get([KV_PREFIX, "owner", "repo"]);
    expect(stored.value).toEqual([{ issueNumber: 1 }, { issueNumber: 2 }]);

    await handler.updateIssue("https://github.com/owner/repo/issues/1", "https://github.com/owner/repo/issues/3");
    stored = await kv.get([KV_PREFIX, "owner", "repo"]);
    expect(stored.value).toEqual([{ issueNumber: 2 }, { issueNumber: 3 }]);

    await handler.removeIssue("https://github.com/owner/repo/issues/2");
    stored = await kv.get([KV_PREFIX, "owner", "repo"]);
    expect(stored.value).toEqual([{ issueNumber: 3 }]);
  });
});
