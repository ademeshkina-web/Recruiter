import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getStore, DbUnavailableError, DB_UNAVAILABLE_TEXT } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Витрина позиций команды: кто какую роль ведёт и на каком этапе воронка.
 * Кандидаты, досье и заметки НЕ отдаются — только счётчики, чтобы персональные
 * данные кандидатов не расходились между аккаунтами рекрутёров.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
  }
  try {
    const store = getStore();
    await store.init();
    return NextResponse.json({ positions: await store.listTeamPositions(user.id) });
  } catch (e) {
    if (e instanceof DbUnavailableError) {
      return NextResponse.json({ error: DB_UNAVAILABLE_TEXT }, { status: 503 });
    }
    return NextResponse.json({ error: "Не удалось получить позиции команды." }, { status: 500 });
  }
}
