import { parseIssueUrl } from "../helpers/github-url";

export const KV_PREFIX = "cron";

export interface IssueEntry {
  issueNumber: number;
}

export class KvDatabaseHandler {
  private _kv: Deno.Kv;

  constructor(kv: Deno.Kv) {
    this._kv = kv;
  }

  private _normalizeIssueEntries(value: unknown): IssueEntry[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const issueNumbers = new Set<number>();
    for (const entry of value) {
      if (typeof entry === "number") {
        issueNumbers.add(entry);
        continue;
      }

      if (typeof entry === "object" && entry !== null && "issueNumber" in entry) {
        const issueNumber = entry.issueNumber;
        if (typeof issueNumber === "number") {
          issueNumbers.add(issueNumber);
        }
      }
    }

    return Array.from(issueNumbers).map((issueNumber) => ({ issueNumber }));
  }

  private async _getIssueEntries(owner: string, repo: string): Promise<IssueEntry[]> {
    const key = [KV_PREFIX, owner, repo];
    const result = await this._kv.get<IssueEntry[]>(key);
    if (!result.value) return [];
    return this._normalizeIssueEntries(result.value);
  }

  async getIssueNumbers(owner: string, repo: string): Promise<number[]> {
    return (await this._getIssueEntries(owner, repo)).map((e) => e.issueNumber);
  }

  async addIssue(url: string): Promise<void> {
    const { owner, repo, issue_number } = parseIssueUrl(url);
    const key = [KV_PREFIX, owner, repo];
    const entries = await this._getIssueEntries(owner, repo);
    if (!entries.some((e) => e.issueNumber === issue_number)) {
      entries.push({ issueNumber: issue_number });
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

  async updateIssue(currentUrl: string, newUrl: string): Promise<void> {
    await this.removeIssue(currentUrl);
    await this.addIssue(newUrl);
  }

  async getAllRepositories(): Promise<Array<{ owner: string; repo: string; issues: IssueEntry[] }>> {
    const repositories: Array<{ owner: string; repo: string; issues: IssueEntry[] }> = [];
    const iter = this._kv.list({ prefix: [KV_PREFIX] });

    for await (const entry of iter) {
      if (entry.key.length >= 3) {
        const owner = entry.key[1] as string;
        const repo = entry.key[2] as string;
        const issues = this._normalizeIssueEntries(entry.value);
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
