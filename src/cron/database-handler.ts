import { JSONFilePreset } from "lowdb/node";
import path from "node:path";

export const DB_FILE_NAME = "db.json";

export interface DbComment {
  commentId: number;
  issueNumber: number;
}

export interface DbIssues {
  [repo: string]: DbComment[];
}

export default await JSONFilePreset<DbIssues>(path.join(process.env.GITHUB_WORKSPACE || import.meta.dirname || "", DB_FILE_NAME), {});
