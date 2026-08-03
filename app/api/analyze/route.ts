import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { generateJson, hasApiKey } from "@/lib/anthropic";
import { ANALYZE_SCHEMA, ANALYZE_SYSTEM, analyzeUser } from "@/lib/prompts";
import { AnalyzeRequest, AnalyzeResult } from "@/lib/types";
import { SAMPLE_ANALYZE } from "@/lib/sample";
import { badBodyResponse, readJsonLimited } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
  }
  let body: AnalyzeRequest;
  try {
    body = await readJsonLimited(req, 256 * 1024);
  } catch (e) {
    return badBodyResponse(e);
  }

  if (!body.brief || body.brief.trim().length < 20) {
    return NextResponse.json(
      { error: "Вставьте бриф или описание вакансии (хотя бы пару предложений)." },
      { status: 400 },
    );
  }

  if (!hasApiKey()) {
    return NextResponse.json({ ...SAMPLE_ANALYZE, demo: true });
  }

  try {
    const result = await generateJson<AnalyzeResult>(
      ANALYZE_SYSTEM,
      analyzeUser(body.brief, body.company, body.role),
      ANALYZE_SCHEMA,
      "high",
    );
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка генерации.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
