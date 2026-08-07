import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getStore, DbUnavailableError, DB_UNAVAILABLE_TEXT } from "@/lib/db";
import { Position } from "@/lib/types";
import { badBodyResponse, readJsonLimited } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function uid(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4) +
    Math.random().toString(36).slice(2, 6)
  );
}

/**
 * Передать копию позиции другому рекрутёру.
 *
 * Копия, а не общий доступ: коллега получает готовую стратегию, найденных
 * кандидатов, собранные досье и письма — и работает дальше в своём кабинете,
 * не тратя токены на повторный поиск. Дальше две доски живут независимо, и
 * правки одного не затирают правки другого.
 */
export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
  }

  let body: { positionId?: string; email?: string };
  try {
    body = await readJsonLimited(req, 8 * 1024);
  } catch (e) {
    return badBodyResponse(e);
  }

  const positionId = (body.positionId || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  if (!positionId || !email) {
    return NextResponse.json({ error: "Нужны позиция и e-mail получателя." }, { status: 400 });
  }
  if (email === me.email) {
    return NextResponse.json({ error: "Это ваш собственный аккаунт." }, { status: 400 });
  }

  try {
    const store = getStore();
    await store.init();

    const mine = await store.listPositions(me.id);
    const src = mine.find((p) => p.id === positionId);
    if (!src) {
      return NextResponse.json({ error: "Позиция не найдена." }, { status: 404 });
    }

    const target = await store.getUserByEmail(email);
    if (!target) {
      return NextResponse.json(
        { error: `Рекрутёр ${email} не зарегистрирован. Пусть сначала заведёт аккаунт по ссылке и коду приглашения.` },
        { status: 404 },
      );
    }
    if (target.disabled) {
      return NextResponse.json({ error: "Аккаунт получателя отключён." }, { status: 400 });
    }

    const now = Date.now();
    const copy: Position = {
      ...src,
      id: uid(),
      createdAt: now,
      updatedAt: now,
      // Кандидатам новые id: иначе доски двух рекрутёров делили бы одни ключи.
      candidates: (src.candidates || []).map((c) => ({ ...c, id: uid() })),
    };
    await store.upsertPosition(target.id, copy);

    return NextResponse.json({
      ok: true,
      to: target.email,
      candidates: copy.candidates.length,
      title: copy.title,
    });
  } catch (e) {
    if (e instanceof DbUnavailableError) {
      return NextResponse.json({ error: DB_UNAVAILABLE_TEXT }, { status: 503 });
    }
    return NextResponse.json({ error: "Не удалось передать позицию." }, { status: 500 });
  }
}
