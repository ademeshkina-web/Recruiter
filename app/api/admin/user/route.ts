import { NextResponse } from "next/server";
import crypto from "crypto";
import { getStore } from "@/lib/db";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { isAdminEmail } from "@/lib/roles";
import { badBodyResponse, readJsonLimited } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "setAdmin" | "setDisabled" | "resetPassword" | "delete";

// Действия админа над учёткой рекрутёра.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Нет доступа." }, { status: 403 });

  let body: { userId?: string; action?: Action; value?: boolean };
  try {
    body = await readJsonLimited(req, 8 * 1024);
  } catch (e) {
    return badBodyResponse(e);
  }

  const { userId, action } = body;
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "Не указан пользователь." }, { status: 400 });
  }
  // Защита от самоблокировки: над своей учёткой нельзя делать опасные действия.
  if (userId === admin.id && action !== "resetPassword") {
    return NextResponse.json(
      { error: "Нельзя менять права, блокировать или удалять свою учётку." },
      { status: 400 },
    );
  }

  const store = getStore();
  await store.init();
  const target = await store.getUserById(userId);
  if (!target) return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });

  // «Корневого» админа из ADMIN_EMAILS нельзя отключить, удалить или разжаловать
  // (сброс пароля разрешён). Иначе другой админ мог бы случайно его вырубить.
  if (action !== "resetPassword" && isAdminEmail(target.email)) {
    return NextResponse.json(
      { error: "Это защищённый администратор (ADMIN_EMAILS) — его нельзя отключить, удалить или разжаловать." },
      { status: 400 },
    );
  }

  switch (action) {
    case "setAdmin":
      await store.setUserAdmin(userId, Boolean(body.value));
      return NextResponse.json({ ok: true });
    case "setDisabled":
      await store.setUserDisabled(userId, Boolean(body.value));
      return NextResponse.json({ ok: true });
    case "delete":
      await store.deleteUser(userId);
      return NextResponse.json({ ok: true });
    case "resetPassword": {
      // Временный пароль показывается один раз — админ передаёт его рекрутёру.
      const temp = crypto.randomBytes(9).toString("base64url");
      await store.setUserPassword(userId, await hashPassword(temp));
      return NextResponse.json({ ok: true, tempPassword: temp });
    }
    default:
      return NextResponse.json({ error: "Неизвестное действие." }, { status: 400 });
  }
}
