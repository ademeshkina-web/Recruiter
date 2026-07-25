import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
  }
  try {
    const store = getStore();
    await store.init();
    const user = await store.getUserById(userId);
    if (!user) return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
    return NextResponse.json({ email: user.email });
  } catch {
    return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
  }
}
