import { existsSync } from "node:fs";
import mysql from "mysql2/promise";

// Load .env.local / .env like Next.js does, without overriding real environment variables.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

export async function connect(options = {}) {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_USER || !DB_NAME) {
    console.error("Set DB_USER, DB_PASSWORD and DB_NAME (see .env.example).");
    process.exit(1);
  }
  return mysql.createConnection({
    host: DB_HOST || "localhost",
    port: Number(DB_PORT || 3306),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    charset: "utf8mb4",
    ...options,
  });
}
