import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { generateJson, hasApiKey, LIGHT_MODEL } from "@/lib/anthropic";
import { OUTREACH_SCHEMA, OUTREACH_SYSTEM, outreachUser } from "@/lib/prompts";
import { OutreachResult } from "@/lib/types";
import { SAMPLE_OUTREACH } from "@/lib/sample";
import { badBodyResponse, readJsonLimited } from "@/lib/http";

export const runtime = "nodejs";
// Не ниже таймаута SDK (240с) — см. пояснение в extract/route.ts.
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
  }
  let body: { name?: string; role?: string; context?: string; dossierSummary?: string };
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
    return NextResponse.json({ ...SAMPLE_OUTREACH, demo: true });
  }

  try {
    const result = await generateJson<OutreachResult>(
      OUTREACH_SYSTEM,
      outreachUser(name, body.role || "", body.context || "", body.dossierSummary || ""),
      OUTREACH_SCHEMA,
      // Три коротких письма по готовому контексту — глубокие размышления тут
      // ничего не добавляют, а стоят как выходные токены.
      "low",
      "outreach",
      LIGHT_MODEL,
    );
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка генерации писем.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
