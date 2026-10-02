import { createHmac, timingSafeEqual } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { cookies } from "next/headers";
import { pool } from "./db";

export const SESSION_COOKIE = "kp_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

export type User = { id: number; email: string; name: string | null };

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters.");
  }
  return value;
}

const sign = (payload: string) =>
  createHmac("sha256", secret()).update(payload).digest("base64url");

export function createSessionToken(userId: number): string {
  const payload = Buffer.from(
    JSON.stringify({ u: userId, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function userIdFromToken(token: string | undefined): number | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return Number.isInteger(u) && exp > Date.now() / 1000 ? u : null;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_SECONDS,
});

export async function getCurrentUser(): Promise<User | null> {
  const id = userIdFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!id) return null;

  const [rows] = await pool().query<RowDataPacket[]>(
    "SELECT id, email, name FROM users WHERE id = ?",
    [id],
  );
  return (rows[0] as User | undefined) ?? null;
}
