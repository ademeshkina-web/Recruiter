import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { Position } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
}

export async function GET() {
  const userId = getSessionUserId();
  if (!userId) return unauthorized();
  const store = getStore();
  await store.init();
  const positions = await store.listPositions(userId);
  return NextResponse.json({ positions });
}

export async function PUT(req: Request) {
  const userId = getSessionUserId();
  if (!userId) return unauthorized();
  let body: { position?: Position };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }
  const p = body.position;
  if (!p || !p.id) {
    return NextResponse.json({ error: "Нет данных позиции." }, { status: 400 });
  }
  const store = getStore();
  await store.init();
  await store.upsertPosition(userId, p);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const userId = getSessionUserId();
  if (!userId) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Нет id." }, { status: 400 });
  const store = getStore();
  await store.init();
  await store.deletePosition(userId, id);
  return NextResponse.json({ ok: true });
}
