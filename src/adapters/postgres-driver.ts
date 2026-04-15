export interface QueryResult<T> {
  rows: T[];
}

export interface PostgresClient {
  queryObject<T>(query: TemplateStringsArray, ...args: unknown[]): Promise<QueryResult<T>>;
  release(): void;
}

export interface PostgresPool {
  connect(): Promise<PostgresClient>;
  end(): Promise<void>;
}

type DenoPostgresModule = {
  Pool: new (
    connectionString: string,
    size: number,
    lazy?: boolean
  ) => {
    available: number;
    initialized: boolean;
    size: number;
    connect(): Promise<PostgresClient>;
    end(): Promise<void>;
  };
};

const DEFAULT_POOL_SIZE = 3;

function importDenoPostgresModule(): Promise<DenoPostgresModule> {
  // Keep the import opaque so ncc does not try to bundle a JSR-only dependency.
  const dynamicImport = Function("specifier", "return import(specifier);") as (specifier: string) => Promise<unknown>;
  return dynamicImport(["jsr:", "@db/postgres"].join("")) as Promise<DenoPostgresModule>;
}

export async function createPostgresPool(connectionString: string): Promise<PostgresPool> {
  const { Pool } = await importDenoPostgresModule();
  return new Pool(connectionString, DEFAULT_POOL_SIZE, true);
}
