import { NextResponse } from "next/server";
import { generateJson, hasApiKey } from "@/lib/anthropic";
import { COMPARE_SCHEMA, COMPARE_SYSTEM, compareUser } from "@/lib/prompts";
import { CompareRequest, CompareResult } from "@/lib/types";
import { SAMPLE_COMPARE } from "@/lib/sample";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: CompareRequest;
  try {
    body = (await req.json()) as CompareRequest;
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  if (!body.brief || body.brief.trim().length < 20) {
    return NextResponse.json(
      { error: "Нужен бриф/требования для сравнения." },
      { status: 400 },
    );
  }
  const resumes = (body.resumes || []).filter((r) => r && r.text && r.text.trim().length > 30);
  if (resumes.length === 0) {
    return NextResponse.json(
      { error: "Добавьте хотя бы одно резюме (текстом)." },
      { status: 400 },
    );
  }

  if (!hasApiKey()) {
    return NextResponse.json({ ...SAMPLE_COMPARE, demo: true });
  }

  try {
    const result = await generateJson<CompareResult>(
      COMPARE_SYSTEM,
      compareUser(body.brief, resumes),
      COMPARE_SCHEMA,
      "high",
    );
    result.ranking.sort((a, b) => b.score - a.score);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка сравнения.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
