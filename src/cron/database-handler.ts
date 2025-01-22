import { JSONFilePreset } from "lowdb/node";
import path from "node:path";

export const DB_FILE_NAME = "db.json";

export interface DbComment {
  [repo: string]: {
    commentId: number;
    issueNumber: number;
  };
}

export default await JSONFilePreset<DbComment>(path.join(process.env.GITHUB_WORKSPACE || import.meta.dirname, DB_FILE_NAME), {});
