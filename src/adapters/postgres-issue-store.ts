import { parseIssueUrl } from "../helpers/github-url";
import { createPostgresPool, PostgresClient, PostgresPool } from "./postgres-driver";

export interface TrackedRepository {
  owner: string;
  repo: string;
  issueNumbers: number[];
}

export interface IssueStore {
  getIssueNumbers(owner: string, repo: string): Promise<number[]>;
  addIssue(url: string): Promise<void>;
  removeIssue(url: string): Promise<void>;
  removeIssueByNumber(owner: string, repo: string, issueNumber: number): Promise<void>;
  updateIssue(currentUrl: string, newUrl: string): Promise<void>;
  getAllRepositories(): Promise<TrackedRepository[]>;
  hasData(): Promise<boolean>;
  close(): Promise<void>;
}

export class PostgresIssueStore implements IssueStore {
  private _pool: PostgresPool;

  constructor(pool: PostgresPool) {
    this._pool = pool;
  }

  async initialize(): Promise<void> {
    await this._withClient(async (client) => {
      // cspell:disable
      await client.queryObject`
        CREATE TABLE IF NOT EXISTS tracked_issues (
          owner TEXT NOT NULL,
          repo TEXT NOT NULL,
          issue_number INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (owner, repo, issue_number)
        )
      `;
      // cspell:enable

      await client.queryObject`
        CREATE INDEX IF NOT EXISTS tracked_issues_owner_repo_idx
        ON tracked_issues (owner, repo)
      `;
    });
  }

  async getIssueNumbers(owner: string, repo: string): Promise<number[]> {
    const result = await this._withClient(
      (client) =>
        client.queryObject<{ issue_number: number }>`
        SELECT issue_number
        FROM tracked_issues
        WHERE owner = ${owner} AND repo = ${repo}
        ORDER BY issue_number
      `
    );

    return result.rows.map((row) => row.issue_number);
  }

  async addIssue(url: string): Promise<void> {
    const { owner, repo, issue_number: issueNumber } = parseIssueUrl(url);

    await this._withClient(
      (client) =>
        client.queryObject`
        INSERT INTO tracked_issues (owner, repo, issue_number)
        VALUES (${owner}, ${repo}, ${issueNumber})
        ON CONFLICT (owner, repo, issue_number) DO NOTHING
      `
    );
  }

  async removeIssue(url: string): Promise<void> {
    const { owner, repo, issue_number: issueNumber } = parseIssueUrl(url);
    await this.removeIssueByNumber(owner, repo, issueNumber);
  }

  async removeIssueByNumber(owner: string, repo: string, issueNumber: number): Promise<void> {
    await this._withClient(
      (client) =>
        client.queryObject`
        DELETE FROM tracked_issues
        WHERE owner = ${owner} AND repo = ${repo} AND issue_number = ${issueNumber}
      `
    );
  }

  async updateIssue(currentUrl: string, newUrl: string): Promise<void> {
    if (currentUrl === newUrl) {
      return;
    }

    const currentIssue = parseIssueUrl(currentUrl);
    const nextIssue = parseIssueUrl(newUrl);

    await this._withClient(async (client) => {
      await client.queryObject`BEGIN`;

      try {
        await client.queryObject`
          DELETE FROM tracked_issues
          WHERE owner = ${currentIssue.owner} AND repo = ${currentIssue.repo} AND issue_number = ${currentIssue.issue_number}
        `;

        await client.queryObject`
          INSERT INTO tracked_issues (owner, repo, issue_number)
          VALUES (${nextIssue.owner}, ${nextIssue.repo}, ${nextIssue.issue_number})
          ON CONFLICT (owner, repo, issue_number) DO NOTHING
        `;

        await client.queryObject`COMMIT`;
      } catch (error) {
        await client.queryObject`ROLLBACK`;
        throw error;
      }
    });
  }

  async getAllRepositories(): Promise<TrackedRepository[]> {
    const result = await this._withClient(
      (client) =>
        client.queryObject<{ owner: string; repo: string; issue_numbers: number[] }>`
        SELECT
          owner,
          repo,
          array_agg(issue_number ORDER BY issue_number) AS issue_numbers
        FROM tracked_issues
        GROUP BY owner, repo
        ORDER BY owner, repo
      `
    );

    return result.rows.map((row) => ({
      owner: row.owner,
      repo: row.repo,
      issueNumbers: row.issue_numbers ?? [],
    }));
  }

  async hasData(): Promise<boolean> {
    const result = await this._withClient(
      (client) =>
        client.queryObject<{ has_data: boolean }>`
        SELECT EXISTS (SELECT 1 FROM tracked_issues) AS has_data
      `
    );

    return result.rows[0]?.has_data ?? false;
  }

  async close(): Promise<void> {
    await this._pool.end();
  }

  private async _withClient<T>(callback: (client: PostgresClient) => Promise<T>): Promise<T> {
    const client = await this._pool.connect();

    try {
      return await callback(client);
    } finally {
      client.release();
    }
  }
}

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  return databaseUrl;
}

export async function createPostgresIssueStore(): Promise<PostgresIssueStore> {
  const pool = await createPostgresPool(getDatabaseUrl());
  const issueStore = new PostgresIssueStore(pool);
  await issueStore.initialize();
  return issueStore;
}
