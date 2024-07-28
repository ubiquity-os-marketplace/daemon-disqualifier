// cSpell:disable
import { factory, nullable, primaryKey } from "@mswjs/data";

/**
 * Creates an object that can be used as a db to persist data within tests
 */
export const db = factory({
  issues: {
    id: primaryKey(Number),
    created_at: String,
    url: String,
    last_check: String,
    deadline: String,
    last_reminder: nullable(String),
  },
  repos: {
    id: primaryKey(Number),
    name: String,
    owner: String,
  },
});
