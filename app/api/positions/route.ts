import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { Position } from "@/lib/types";
import { badBodyResponse, readJsonLimited } from "@/lib/http";

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
    body = await readJsonLimited(req, 1024 * 1024);
  } catch (e) {
    return badBodyResponse(e);
  }
  const p = body.position;
  // id обязан быть непустой строкой: это первичный ключ, число/объект сломали бы
  // предсказуемость upsert по (user_id, id) в PostgreSQL.
  if (!p || typeof p.id !== "string" || !p.id.trim()) {
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
