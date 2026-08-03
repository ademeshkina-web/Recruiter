import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { hasPotok, listJobs } from "@/lib/potok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Список вакансий из Потока — рекрутёр выбирает, в какую класть кандидатов.
export async function GET() {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
  }
  if (!hasPotok()) {
    return NextResponse.json(
      { error: "Интеграция с Потоком не настроена: не задан POTOK_TOKEN." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json({ jobs: await listJobs() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка обращения к Потоку.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
