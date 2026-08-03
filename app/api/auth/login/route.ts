import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { sessionCookie, verifyPasswordConstantTime } from "@/lib/auth";
import { badBodyResponse, readJsonLimited } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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
    const res = NextResponse.json({ email: user.email });
    res.cookies.set(sessionCookie(user.id));
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка входа.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
