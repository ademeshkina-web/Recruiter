import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { generateWithWebSearch, hasApiKey, parseJsonLoose } from "@/lib/anthropic";
import { DOSSIER_SYSTEM, dossierUser } from "@/lib/prompts";
import { Dossier } from "@/lib/types";
import { SAMPLE_DOSSIER } from "@/lib/sample";
import { badBodyResponse, readJsonLimited } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!getSessionUserId()) {
    return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
  }
  let body: { name?: string; role?: string; context?: string };
  try {
    body = await readJsonLimited(req, 256 * 1024);
  } catch (e) {
    return badBodyResponse(e);
  }

  const name = (body.name || "").trim();
  if (name.length < 2) {
    return NextResponse.json({ error: "Не указан кандидат." }, { status: 400 });
  }

  if (!hasApiKey()) {
    return NextResponse.json({ ...SAMPLE_DOSSIER, demo: true });
  }

  try {
    const text = await generateWithWebSearch(
      DOSSIER_SYSTEM,
      dossierUser(name, body.role || "", body.context || ""),
      12,
    );
    const result = parseJsonLoose<Dossier>(text);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка сбора досье.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
