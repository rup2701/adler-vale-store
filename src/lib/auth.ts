import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { loginAttempts, ownerSessions } from "@/db/schema";
import { settings } from "@/config/settings";
import { verifyPassword } from "@/lib/password";
import { isDeployed } from "@/lib/env";

const A = settings.auth;
const sha = (v: string) => createHash("sha256").update(v).digest("hex");

export async function getClientAddress(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim() || "local";
}

export type LoginResult =
  | { ok: true }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "locked"; minutesLeft: number };

async function lockState(address: string): Promise<{ locked: boolean; minutesLeft: number }> {
  const windowMs = A.lockoutMinutes * 60_000;
  const [latest] = await db
    .select({ createdAt: loginAttempts.createdAt })
    .from(loginAttempts)
    .where(eq(loginAttempts.address, address))
    .orderBy(desc(loginAttempts.createdAt))
    .limit(1);
  if (!latest) return { locked: false, minutesLeft: 0 };
  const since = new Date(latest.createdAt.getTime() - windowMs);
  const recent = await db
    .select({ id: loginAttempts.id })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.address, address), gt(loginAttempts.createdAt, since)));
  const until = latest.createdAt.getTime() + windowMs;
  if (recent.length >= A.maxFailedAttempts && Date.now() < until) {
    return { locked: true, minutesLeft: Math.max(1, Math.ceil((until - Date.now()) / 60_000)) };
  }
  return { locked: false, minutesLeft: 0 };
}

export async function signIn(email: string, password: string): Promise<LoginResult> {
  const address = await getClientAddress();
  const lock = await lockState(address);
  if (lock.locked) return { ok: false, reason: "locked", minutesLeft: lock.minutesLeft };

  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const emailOk =
    !!ownerEmail &&
    email.trim().length === ownerEmail.length &&
    timingSafeEqual(Buffer.from(email.trim().toLowerCase()), Buffer.from(ownerEmail));
  // Always verify the password so timing does not reveal which part was wrong.
  const passOk = verifyPassword(password, process.env.OWNER_PASSWORD_HASH);
  if (!emailOk || !passOk) {
    await db.insert(loginAttempts).values({ address });
    const after = await lockState(address);
    if (after.locked) return { ok: false, reason: "locked", minutesLeft: after.minutesLeft };
    return { ok: false, reason: "invalid" };
  }

  await db.delete(loginAttempts).where(eq(loginAttempts.address, address));
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + A.sessionDays * 86_400_000);
  await db.insert(ownerSessions).values({ tokenHash: sha(token), expiresAt });
  await db.delete(ownerSessions).where(lt(ownerSessions.expiresAt, new Date()));
  const jar = await cookies();
  jar.set(A.cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isDeployed(),
    path: "/",
    expires: expiresAt,
  });
  return { ok: true };
}

export async function isOwner(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(A.cookieName)?.value;
  if (!token) return false;
  const [row] = await db
    .select({ tokenHash: ownerSessions.tokenHash })
    .from(ownerSessions)
    .where(and(eq(ownerSessions.tokenHash, sha(token)), gt(ownerSessions.expiresAt, new Date())));
  return !!row;
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(A.cookieName)?.value;
  if (token) await db.delete(ownerSessions).where(eq(ownerSessions.tokenHash, sha(token)));
  jar.delete(A.cookieName);
}

/** For owner pages and server actions: redirects to sign-in when there is no owner session. */
export async function requireOwner() {
  if (!(await isOwner())) redirect("/admin/login");
}

/** For owner API routes: returns a 401 response when not signed in, otherwise null. */
export async function requireOwnerApi(): Promise<Response | null> {
  if (await isOwner()) return null;
  return Response.json({ error: "Sign in to the owner area first." }, { status: 401 });
}
