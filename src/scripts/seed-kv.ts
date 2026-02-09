// Seeds Deno KV with data from db.json using KvDatabaseHandler.
//
// Prerequisites:
//   - Environment variable DENO_KV_URL (remote KV) or omit for local (file-based) KV.
//   - Run with appropriate permissions, e.g.:
//       deno run --allow-read=db.json --allow-env --allow-net --unstable-kv src/scripts/seed-kv.ts
//
// (Add a package.json script after creating this file:
//   "seed:kv": "deno run --allow-read=db.json --allow-env --allow-net --unstable-kv src/scripts/seed-kv.ts"
// )

import { KvDatabaseHandler } from "../adapters/kv-database-handler";

interface RawIssueEntry {
  issueNumber: number;
  commentId?: number;
}

type DbFileShape = Record<string, RawIssueEntry[]>;

async function loadDbFile(path: string): Promise<DbFileShape> {
  const text = await Deno.readTextFile(path);
  return JSON.parse(text) as DbFileShape;
}

function buildIssueUrl(owner: string, repo: string, issueNumber: number): string {
  return `https://github.com/${owner}/${repo}/issues/${issueNumber}`;
}

async function main() {
  const started = performance.now();
  const kvUrl = Deno.env.get("DENO_KV_URL");
  const kv = await Deno.openKv(kvUrl);
  console.log(process.env.DENO_KV_URL ? `Connecting to remote KV at ${kvUrl}` : "Using local file-based KV");
  const handler = new KvDatabaseHandler(kv);

  const db = await loadDbFile("db.json");

  let totalRepos = 0;
  let totalEntries = 0;
  let added = 0;
  let skipped = 0;

  for (const fullName of Object.keys(db)) {
    const parts = fullName.split("/");
    if (parts.length !== 2) {
      console.warn(`[warn] Skipping invalid repo key: ${fullName}`);
      continue;
    }
    const [owner, repo] = parts;
    totalRepos++;

    const entries = db[fullName] || [];
    // Fetch existing issue numbers once for faster duplicate detection.
    const existingIssueNumbers = new Set<number>(await handler.getIssueNumbers(owner, repo));

    for (const entry of entries) {
      totalEntries++;
      const { issueNumber } = entry;
      if (existingIssueNumbers.has(issueNumber)) {
        skipped++;
        continue;
      }
      const url = buildIssueUrl(owner, repo, issueNumber);
      await handler.addIssue(url);
      existingIssueNumbers.add(issueNumber);
      added++;
    }
  }

  const elapsedMs = performance.now() - started;
  console.log("=== KV Seed Summary ===");
  console.log(`Repositories processed : ${totalRepos}`);
  console.log(`Issue entries scanned  : ${totalEntries}`);
  console.log(`Added (new)            : ${added}`);
  console.log(`Skipped (duplicates)   : ${skipped}`);
  console.log(`Elapsed                : ${elapsedMs.toFixed(1)} ms`);

  kv.close();
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("[error] Seeding failed:", err);
    Deno.exit(1);
  });
}
