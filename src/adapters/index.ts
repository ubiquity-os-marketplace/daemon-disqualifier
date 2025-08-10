import { KvDatabaseHandler, createKvDatabaseHandler } from "./kv-database-handler";

export interface Adapters {
  kv: KvDatabaseHandler;
}

export async function createAdapters(): Promise<Adapters> {
  return {
    kv: await createKvDatabaseHandler(),
  };
}
