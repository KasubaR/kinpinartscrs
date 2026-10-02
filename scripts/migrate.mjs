// Creates the tables from sql/schema.sql. Safe to run repeatedly.
import { readFileSync } from "node:fs";
import { connect } from "./db.mjs";

const statements = readFileSync(new URL("../sql/schema.sql", import.meta.url), "utf8")
  .replace(/^\s*--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

const db = await connect();
for (const statement of statements) await db.query(statement);
await db.end();
console.log(`Database ready (${statements.length} tables checked).`);
