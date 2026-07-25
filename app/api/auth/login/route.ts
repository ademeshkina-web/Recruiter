import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { sessionCookie, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  try {
    const store = getStore();
    await store.init();
    const user = await store.getUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
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
