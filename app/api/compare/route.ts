import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { EFFORT, generateJson, hasApiKey, LIGHT_MODEL } from "@/lib/anthropic";
import { COMPARE_SCHEMA, COMPARE_SYSTEM, compareUser } from "@/lib/prompts";
import { CompareRequest, CompareResult } from "@/lib/types";
import { SAMPLE_COMPARE } from "@/lib/sample";
import { badBodyResponse, readJsonLimited } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
  }
  let body: CompareRequest;
  try {
    // Больше остальных: сравнение принимает пачку резюме текстом.
    body = await readJsonLimited(req, 2 * 1024 * 1024);
  } catch (e) {
    return badBodyResponse(e);
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
      compareUser(body.brief, resumes, {
        // Защита от некорректного тела: только массивы строк / строка.
        mustHave: Array.isArray(body.mustHave) ? body.mustHave : undefined,
        antiProfile: Array.isArray(body.antiProfile) ? body.antiProfile : undefined,
        roleFrame: typeof body.roleFrame === "string" ? body.roleFrame : undefined,
        keyTasks: Array.isArray(body.keyTasks) ? body.keyTasks : undefined,
      }),
      COMPARE_SCHEMA,
      EFFORT,
      "compare",
      LIGHT_MODEL,
    );
    result.ranking.sort((a, b) => b.score - a.score);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка сравнения.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
