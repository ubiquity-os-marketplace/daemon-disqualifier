import { createPostgresIssueStore, IssueStore } from "./postgres-issue-store";

export interface Adapters {
  issueStore: IssueStore;
  close(): Promise<void>;
}

export async function createAdapters(): Promise<Adapters> {
  const issueStore = await createPostgresIssueStore();

  return {
    issueStore,
    async close() {
      await issueStore.close();
    },
  };
}
