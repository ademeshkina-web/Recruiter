import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Список всех рекрутёров с активностью — только для админов.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  const store = getStore();
  await store.init();
  const users = await store.listUsersWithStats();
  return NextResponse.json({ users, me: admin.id });
}
