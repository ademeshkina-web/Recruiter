import { NextResponse } from "next/server";
import { getStore, DbUnavailableError, DB_UNAVAILABLE_TEXT } from "@/lib/db";
import { sessionCookie, userIsAdmin, verifyPasswordConstantTime } from "@/lib/auth";
import { badBodyResponse, readJsonLimited } from "@/lib/http";
import { clientIp, rateLimited } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Защита от перебора паролей: не более 20 попыток входа с IP за 10 минут.
  // Лимит по IP (а не по e-mail), чтобы нельзя было залочить чужую учётку.
  if (rateLimited("login:" + clientIp(req), 20, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Слишком много попыток входа. Попробуйте через несколько минут." },
      { status: 429 },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await readJsonLimited(req, 8 * 1024);
  } catch (e) {
    return badBodyResponse(e);
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  try {
    const store = getStore();
    await store.init();
    const user = await store.getUserByEmail(email);
    // Сравнение выполняется всегда (даже без пользователя) — тайминг не выдаёт,
    // зарегистрирован ли e-mail.
    const ok = await verifyPasswordConstantTime(password, user?.password_hash);
    if (!user || !ok) {
      return NextResponse.json({ error: "Неверный e-mail или пароль." }, { status: 401 });
    }
    if (user.disabled) {
      return NextResponse.json({ error: "Доступ отключён администратором." }, { status: 403 });
    }
    const res = NextResponse.json({ email: user.email, isAdmin: userIsAdmin(user) });
    res.cookies.set(sessionCookie(user.id));
    return res;
  } catch (e) {
    if (e instanceof DbUnavailableError) {
      return NextResponse.json({ error: DB_UNAVAILABLE_TEXT }, { status: 503 });
    }
    const msg = e instanceof Error ? e.message : "Ошибка входа.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
