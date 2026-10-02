// Usage: pnpm db:import [path/to/records.json]   (default: backup/records.json)
// Loads a saved backup into MySQL, keeping the original ids so customer links still work.
// Records whose id already exists are left untouched.
import { readFileSync } from "node:fs";
import { connect } from "./db.mjs";

const file = process.argv[2] || "backup/records.json";
const backup = JSON.parse(readFileSync(file, "utf8"));
const records = Array.isArray(backup) ? backup : backup.records;
if (!Array.isArray(records)) {
  console.error(`${file} does not look like a records backup.`);
  process.exit(1);
}

const db = await connect();
let added = 0;
for (const { id, kind, source, ...data } of records) {
  const docKey = typeof data.docNumber === "string" && data.docNumber.trim() ? data.docNumber.trim().toLowerCase() : null;
  const [existing] = await db.query("SELECT id FROM records WHERE id = ?", [id]);
  if (existing.length) continue;
  await db.query("INSERT INTO records (id, kind, data, source, doc_number_key) VALUES (?, ?, ?, ?, ?)", [
    id,
    kind,
    JSON.stringify(data),
    source ?? null,
    docKey,
  ]);
  added++;
}
await db.end();
console.log(`Imported ${added} of ${records.length} records (${records.length - added} already existed).`);
