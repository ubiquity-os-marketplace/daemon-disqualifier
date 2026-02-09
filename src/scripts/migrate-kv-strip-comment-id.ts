import { IssueEntry, KV_PREFIX } from "../adapters/kv-database-handler";

function normalizeEntries(value: unknown): { entries: IssueEntry[]; shouldRewrite: boolean } {
  if (!Array.isArray(value)) {
    return { entries: [], shouldRewrite: false };
  }

  const issueNumbers = new Set<number>();
  let shouldRewrite = false;
  let recognizedEntries = 0;

  for (const item of value) {
    if (typeof item === "number") {
      recognizedEntries++;
      if (issueNumbers.has(item)) {
        shouldRewrite = true;
      }
      issueNumbers.add(item);
      shouldRewrite = true;
      continue;
    }

    if (typeof item !== "object" || item === null || !("issueNumber" in item)) {
      continue;
    }

    const issueNumber = item.issueNumber;
    if (typeof issueNumber !== "number") {
      continue;
    }

    recognizedEntries++;
    if ("commentId" in item) {
      shouldRewrite = true;
    }

    if (issueNumbers.has(issueNumber)) {
      shouldRewrite = true;
    }
    issueNumbers.add(issueNumber);
  }

  const entries = Array.from(issueNumbers).map((issueNumber) => ({ issueNumber }));
  if (issueNumbers.size !== recognizedEntries) {
    shouldRewrite = true;
  }
  return { entries, shouldRewrite };
}

async function main() {
  const startedAt = performance.now();
  const kvUrl = Deno.env.get("DENO_KV_URL");
  const kv = await Deno.openKv(kvUrl);
  const iter = kv.list({ prefix: [KV_PREFIX] });

  let scanned = 0;
  let converted = 0;
  let skipped = 0;
  let invalid = 0;

  for await (const item of iter) {
    if (item.key.length < 3) {
      continue;
    }

    scanned++;
    if (!Array.isArray(item.value)) {
      invalid++;
      console.warn(`[warn] Skipping non-array value at key: ${JSON.stringify(item.key)}`);
      continue;
    }

    const { entries, shouldRewrite } = normalizeEntries(item.value);
    if (!entries.length) {
      skipped++;
      continue;
    }

    if (!shouldRewrite) {
      skipped++;
      continue;
    }

    await kv.set(item.key, entries);
    converted++;
  }

  kv.close();

  const elapsed = performance.now() - startedAt;
  console.log("=== KV Migration Summary ===");
  console.log(`Scanned entries : ${scanned}`);
  console.log(`Converted       : ${converted}`);
  console.log(`Skipped         : ${skipped}`);
  console.log(`Invalid         : ${invalid}`);
  console.log(`Elapsed         : ${elapsed.toFixed(1)} ms`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("[error] KV migration failed:", err);
    Deno.exit(1);
  });
}
