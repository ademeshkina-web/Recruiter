import { NextResponse } from "next/server";
import { getSessionUser, userIsAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // getSessionUser вернёт null, если пользователь удалён или заблокирован —
    // тогда клиент разлогинит его на следующей загрузке/опросе.
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
    return NextResponse.json({ email: user.email, isAdmin: userIsAdmin(user) });
  } catch {
    return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
  }
}
