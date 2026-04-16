import { beforeEach, mock } from "bun:test";
import { createMockPostgresPool, mockDatabaseUrl, resetMockPostgres } from "./helpers/mock-postgres";

process.env.DATABASE_URL = process.env.DATABASE_URL ?? mockDatabaseUrl;

const mockPostgresPool = createMockPostgresPool();

mock.module("../src/adapters/postgres-driver", () => ({
  createPostgresPool: () => Promise.resolve(mockPostgresPool),
}));

beforeEach(() => {
  resetMockPostgres();
});
