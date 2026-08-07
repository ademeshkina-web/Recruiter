import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getStore, DbUnavailableError, DB_UNAVAILABLE_TEXT } from "@/lib/db";
import { badBodyResponse, readJsonLimited } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Свой профиль: ФИО, должность, телеграм. */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
  return NextResponse.json({
    email: me.email,
    fullName: me.full_name || "",
    jobTitle: me.job_title || "",
    telegram: me.telegram || "",
  });
}

export async function PUT(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Не авторизован." }, { status: 401 });

  let body: { fullName?: string; jobTitle?: string; telegram?: string };
  try {
    body = await readJsonLimited(req, 8 * 1024);
  } catch (e) {
    return badBodyResponse(e);
  }

  const fullName = (body.fullName || "").trim().slice(0, 120);
  const jobTitle = (body.jobTitle || "").trim().slice(0, 120);
  // Приводим к виду @username: человек может ввести ссылку, @ или просто ник.
  let telegram = (body.telegram || "").trim().slice(0, 80);
  telegram = telegram.replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "").replace(/^@+/, "");
  if (telegram && !/^[A-Za-z0-9_]{4,32}$/.test(telegram)) {
    return NextResponse.json(
      {
        error:
          "Имя пользователя в Telegram — латиница, цифры и подчёркивание, от 4 до 32 символов. " +
          "Его задаёт сам человек в Telegram: Настройки → Имя пользователя.",
      },
      { status: 400 },
    );
  }

  try {
    const store = getStore();
    await store.init();
    await store.updateProfile(me.id, { fullName, jobTitle, telegram: telegram ? "@" + telegram : "" });
    return NextResponse.json({ ok: true, fullName, jobTitle, telegram: telegram ? "@" + telegram : "" });
  } catch (e) {
    if (e instanceof DbUnavailableError) {
      return NextResponse.json({ error: DB_UNAVAILABLE_TEXT }, { status: 503 });
    }
    return NextResponse.json({ error: "Не удалось сохранить профиль." }, { status: 500 });
  }
}
