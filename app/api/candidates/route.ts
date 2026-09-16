import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  generateWithWebSearch,
  hasApiKey,
  parseJsonLoose,
  WEB_SEARCH_MAX_USES,
} from "@/lib/anthropic";
import { CANDIDATES_SYSTEM, candidatesUser } from "@/lib/prompts";
import { CandidatesResult } from "@/lib/types";
import { SAMPLE_CANDIDATES } from "@/lib/sample";
import { badBodyResponse, readJsonLimited } from "@/lib/http";
import { sourcingTools } from "@/lib/sourcingTools";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
  }
  let body: { context?: string };
  try {
    body = await readJsonLimited(req, 256 * 1024);
  } catch (e) {
    return badBodyResponse(e);
  }

  const context = (body.context || "").trim();
  if (context.length < 20) {
    return NextResponse.json(
      { error: "Сначала проанализируйте бриф — из него берётся контекст поиска." },
      { status: 400 },
    );
  }

  if (!hasApiKey()) {
    return NextResponse.json({ ...SAMPLE_CANDIDATES, demo: true });
  }

  try {
    // LinkedIn и Telegram по API — если заданы ключи; иначе только веб-поиск.
    const sources = sourcingTools();
    const text = await generateWithWebSearch(
      CANDIDATES_SYSTEM + sources.prompt,
      candidatesUser(context),
      WEB_SEARCH_MAX_USES,
      "candidates",
      undefined,
      sources,
    );
    const result = parseJsonLoose<CandidatesResult>(text);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка поиска кандидатов.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
