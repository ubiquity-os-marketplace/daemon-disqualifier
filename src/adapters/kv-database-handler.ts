import { parseIssueUrl } from "../helpers/github-url";

export const KV_PREFIX = "cron";

export interface IssueEntry {
  issueNumber: number;
  commentId: number;
}

export class KvDatabaseHandler {
  private _kv: Deno.Kv;

  constructor(kv: Deno.Kv) {
    this._kv = kv;
  }

  private async _getIssueEntries(owner: string, repo: string): Promise<IssueEntry[]> {
    const key = [KV_PREFIX, owner, repo];
    const result = await this._kv.get<IssueEntry[] | number[]>(key);
    if (!result.value) return [];
    const value = result.value;
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object" && value[0] !== null && "issueNumber" in value[0]) {
      return value as IssueEntry[];
    }
    return [];
  }

  async getIssueNumbers(owner: string, repo: string): Promise<number[]> {
    return (await this._getIssueEntries(owner, repo)).map((e) => e.issueNumber);
  }

  async addIssue(url: string, commentId: number): Promise<void> {
    const { owner, repo, issue_number } = parseIssueUrl(url);
    const key = [KV_PREFIX, owner, repo];
    const entries = await this._getIssueEntries(owner, repo);
    if (!entries.some((e) => e.issueNumber === issue_number)) {
      entries.push({ issueNumber: issue_number, commentId });
      await this._kv.set(key, entries);
    }
  }

  async removeIssue(url: string): Promise<void> {
    const { owner, repo, issue_number } = parseIssueUrl(url);
    return this.removeIssueByNumber(owner, repo, issue_number);
  }

  async removeIssueByNumber(owner: string, repo: string, issueNumber: number): Promise<void> {
    const key = [KV_PREFIX, owner, repo];
    const entries = await this._getIssueEntries(owner, repo);
    const filtered = entries.filter((e) => e.issueNumber !== issueNumber);
    if (filtered.length === 0) {
      await this._kv.delete(key);
    } else {
      await this._kv.set(key, filtered);
    }
  }

  async updateIssue(currentUrl: string, newUrl: string, newCommentId: number): Promise<void> {
    await this.removeIssue(currentUrl);
    await this.addIssue(newUrl, newCommentId);
  }

  async getAllRepositories(): Promise<Array<{ owner: string; repo: string; issues: IssueEntry[] }>> {
    const repositories: Array<{ owner: string; repo: string; issues: IssueEntry[] }> = [];
    const iter = this._kv.list({ prefix: [KV_PREFIX] });

    for await (const entry of iter) {
      if (entry.key.length >= 3) {
        const owner = entry.key[1] as string;
        const repo = entry.key[2] as string;
        let issues: IssueEntry[] = [];
        if (Array.isArray(entry.value) && entry.value.length > 0) {
          if (typeof entry.value[0] === "object" && entry.value[0] !== null && "issueNumber" in entry.value[0]) {
            issues = entry.value as IssueEntry[];
          } else {
            issues = (entry.value as number[]).map((issueNumber) => ({ issueNumber, commentId: 0 }));
          }
        }
        repositories.push({ owner, repo, issues });
      }
    }

    return repositories;
  }

  async hasData(): Promise<boolean> {
    const repositories = await this.getAllRepositories();
    return repositories.length > 0 && repositories.some((repo) => repo.issues.length > 0);
  }
}

export async function createKvDatabaseHandler(): Promise<KvDatabaseHandler> {
  const kv = await Deno.openKv(process.env.DENO_KV_URL);
  return new KvDatabaseHandler(kv);
}
