import mysql from "mysql2/promise";

const globalForPool = globalThis as unknown as { crmPool?: mysql.Pool };

export function pool(): mysql.Pool {
  if (!globalForPool.crmPool) {
    const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
    if (!DB_USER || !DB_NAME) {
      throw new Error("Database is not configured. Set DB_USER, DB_PASSWORD and DB_NAME.");
    }
    globalForPool.crmPool = mysql.createPool({
      host: DB_HOST || "localhost",
      port: Number(DB_PORT || 3306),
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      charset: "utf8mb4",
      waitForConnections: true,
      connectionLimit: 5,
    });
  }
  return globalForPool.crmPool;
}
