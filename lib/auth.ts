import crypto from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

const COOKIE = "rec_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 дней

function secret(): string {
  return process.env.SESSION_SECRET || "dev-insecure-secret-change-me";
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

// Токен = base64url(userId).HMAC — самодостаточный, без хранения сессий.
export function signToken(userId: string): string {
  const payload = Buffer.from(userId).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  try {
    if (
      sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return Buffer.from(payload, "base64url").toString("utf-8");
}

// Прочитать текущего пользователя из cookie (в route handlers).
export function getSessionUserId(): string | null {
  const token = cookies().get(COOKIE)?.value;
  return verifyToken(token);
}

export function sessionCookie(userId: string) {
  return {
    name: COOKIE,
    value: signToken(userId),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE,
  };
}

export function clearedCookie() {
  return {
    name: COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
