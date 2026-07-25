import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { generateJson, hasApiKey } from "@/lib/anthropic";
import { OUTREACH_SCHEMA, OUTREACH_SYSTEM, outreachUser } from "@/lib/prompts";
import { OutreachResult } from "@/lib/types";
import { SAMPLE_OUTREACH } from "@/lib/sample";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!getSessionUserId()) {
    return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
  }
  let body: { name?: string; role?: string; context?: string; dossierSummary?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
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
      "medium",
    );
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка генерации писем.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
