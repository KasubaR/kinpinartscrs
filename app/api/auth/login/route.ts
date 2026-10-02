import type { RowDataPacket } from "mysql2";
import { cookies } from "next/headers";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password.mjs";

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

// Compared against when the email is unknown, so timing doesn't reveal which emails exist.
const dummyHash = hashPassword("not-a-real-password");

const fail = (error: string, status: number) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password || password.length > 200) return fail("Enter your email and password.", 400);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const key = `${ip}|${email}`;
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && entry.resetAt > now && entry.count >= MAX_ATTEMPTS) {
    return fail("Too many attempts. Please wait 15 minutes and try again.", 429);
  }

  try {
    const [rows] = await pool().query<RowDataPacket[]>(
      "SELECT id, password_hash FROM users WHERE email = ?",
      [email],
    );
    const user = rows[0];
    const valid = await verifyPassword(password, user?.password_hash ?? (await dummyHash));

    if (!user || !valid) {
      attempts.set(key, {
        count: entry && entry.resetAt > now ? entry.count + 1 : 1,
        resetAt: entry && entry.resetAt > now ? entry.resetAt : now + WINDOW_MS,
      });
      return fail("Incorrect email or password.", 401);
    }

    attempts.delete(key);
    (await cookies()).set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions());
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return fail("Could not sign in. Please try again.", 503);
  }
}
