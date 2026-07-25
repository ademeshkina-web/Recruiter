import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { hashPassword, sessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { email?: string; password?: string; invite?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const invite = (body.invite || "").trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Введите корректный e-mail." }, { status: 400 });
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
    const res = NextResponse.json({ email: user.email });
    res.cookies.set(sessionCookie(user.id));
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка регистрации.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
