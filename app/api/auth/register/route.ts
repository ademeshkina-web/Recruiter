import { NextResponse } from "next/server";
import { getStore, EmailTakenError, DbUnavailableError, DB_UNAVAILABLE_TEXT } from "@/lib/db";
import { hashPassword, sessionCookie, userIsAdmin } from "@/lib/auth";
import { badBodyResponse, readJsonLimited } from "@/lib/http";
import { clientIp, rateLimited } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Ограничение на спам регистраций: не более 10 с одного IP за 10 минут.
  if (rateLimited("register:" + clientIp(req), 10, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Слишком много попыток. Попробуйте позже." },
      { status: 429 },
    );
  }

  let body: { email?: string; password?: string; invite?: string };
  try {
    body = await readJsonLimited(req, 8 * 1024);
  } catch (e) {
    return badBodyResponse(e);
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const invite = (body.invite || "").trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Введите корректный e-mail." }, { status: 400 });
  }
  // Ограничение регистрации корпоративным доменом (если задан ALLOWED_EMAIL_DOMAIN).
  const domain = (process.env.ALLOWED_EMAIL_DOMAIN || "").trim().toLowerCase();
  if (domain && !email.endsWith("@" + domain)) {
    return NextResponse.json(
      { error: `Регистрация доступна только для почты @${domain}.` },
      { status: 403 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Пароль — минимум 6 символов." }, { status: 400 });
  }
  const required = process.env.INVITE_CODE;
  if (required && invite !== required) {
    return NextResponse.json({ error: "Неверный код приглашения." }, { status: 403 });
  }

  try {
    const store = getStore();
    await store.init();
    if (await store.getUserByEmail(email)) {
      return NextResponse.json({ error: "Пользователь с таким e-mail уже есть." }, { status: 409 });
    }
    const user = await store.createUser(email, await hashPassword(password));
    const res = NextResponse.json({ email: user.email, isAdmin: userIsAdmin(user) });
    res.cookies.set(sessionCookie(user.id));
    return res;
  } catch (e) {
    if (e instanceof EmailTakenError) {
      return NextResponse.json({ error: "Пользователь с таким e-mail уже есть." }, { status: 409 });
    }
    if (e instanceof DbUnavailableError) {
      return NextResponse.json({ error: DB_UNAVAILABLE_TEXT }, { status: 503 });
    }
    return NextResponse.json({ error: "Ошибка регистрации." }, { status: 500 });
  }
}
