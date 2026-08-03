import crypto from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getStore, DBUser } from "./db";
import { isAdminEmail } from "./roles";

const COOKIE = "rec_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 дней
const MIN_SECRET_LEN = 32;

// В проде запасного секрета нет: если SESSION_SECRET не задан или слишком
// короткий, приложение обязано падать, а не подписывать сессии предсказуемым
// значением из исходников (иначе любой смог бы подделать чужую cookie).
function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= MIN_SECRET_LEN) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET не задан или слишком короткий. Задайте переменную окружения " +
        "SESSION_SECRET длиной от 32 символов (например: openssl rand -hex 32).",
    );
  }
  // Только dev/test: удобство локального запуска, в прод не попадает.
  return s || "dev-insecure-secret-change-me";
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

// Фиктивный хеш для выравнивания времени ответа логина: сравниваем пароль даже
// когда пользователя нет, чтобы по задержке нельзя было перечислять e-mail.
const DUMMY_HASH = bcrypt.hashSync("timing-equalizer-not-a-real-password", 10);

export async function verifyPasswordConstantTime(
  pw: string,
  hash: string | undefined,
): Promise<boolean> {
  const ok = await bcrypt.compare(pw, hash || DUMMY_HASH);
  return Boolean(hash) && ok;
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

// Прочитать id текущего пользователя из cookie (только проверка подписи, без БД).
export function getSessionUserId(): string | null {
  const token = cookies().get(COOKIE)?.value;
  return verifyToken(token);
}

// Загрузить текущего пользователя из БД. Возвращает null, если сессии нет, либо
// пользователь удалён или заблокирован — так «отзыв доступа» действует сразу,
// не дожидаясь истечения cookie.
export async function getSessionUser(): Promise<DBUser | null> {
  const id = getSessionUserId();
  if (!id) return null;
  const store = getStore();
  await store.init();
  const user = await store.getUserById(id);
  if (!user || user.disabled) return null;
  return user;
}

// Админ = флаг is_admin в БД ИЛИ e-mail в списке ADMIN_EMAILS (стартовые админы).
export { isAdminEmail } from "./roles";

export function userIsAdmin(user: Pick<DBUser, "email" | "is_admin">): boolean {
  return user.is_admin || isAdminEmail(user.email);
}

// Требует админ-сессию: возвращает пользователя-админа или null.
export async function requireAdmin(): Promise<DBUser | null> {
  const user = await getSessionUser();
  if (!user || !userIsAdmin(user)) return null;
  return user;
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
