// Usage: pnpm user:create <email> <password> [name]
// Creates a user, or resets the password if the email already exists.
import { hashPassword } from "../lib/password.mjs";
import { connect } from "./db.mjs";

const [emailArg, password, name] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
if (!email || !password) {
  console.error("Usage: pnpm user:create <email> <password> [name]");
  process.exit(1);
}
if (password.length < 10) {
  console.error("Use a password of at least 10 characters.");
  process.exit(1);
}

const db = await connect();
await db.query(
  "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), name = COALESCE(VALUES(name), name)",
  [email, name || null, await hashPassword(password)],
);
await db.end();
console.log(`Saved user ${email}.`);
