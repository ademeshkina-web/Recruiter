import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getStore, DbUnavailableError, DB_UNAVAILABLE_TEXT } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Список активных рекрутёров — для выбора коллеги при передаче позиции.
 * Отдаём только рабочий профиль: имя, должность, почта, телеграм. Ни паролей,
 * ни ролей, ни данных по кандидатам.
 */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
  try {
    const store = getStore();
    await store.init();
    return NextResponse.json({ recruiters: await store.listRecruiters(me.id) });
  } catch (e) {
    if (e instanceof DbUnavailableError) {
      return NextResponse.json({ error: DB_UNAVAILABLE_TEXT }, { status: 503 });
    }
    return NextResponse.json({ error: "Не удалось получить список рекрутёров." }, { status: 500 });
  }
}
