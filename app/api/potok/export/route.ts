import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  DOSSIER_SEARCH_MAX_USES,
  generateWithWebSearch,
  hasApiKey,
  parseJsonLoose,
} from "@/lib/anthropic";
import { DOSSIER_SYSTEM, dossierUser } from "@/lib/prompts";
import { createApplicant, ExportResult, hasPotok } from "@/lib/potok";
import { BoardCandidate, Dossier } from "@/lib/types";
import { badBodyResponse, readJsonLimited } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 300;

interface Body {
  candidates?: BoardCandidate[];
  jobId?: number;
  context?: string; // контекст позиции — нужен, чтобы собрать досье
  withDossier?: boolean; // собирать досье тем, у кого его нет
}

/**
 * Выгрузка кандидатов с доски в ATS «Поток».
 *
 * Если включён withDossier, то кандидату без досье оно сначала собирается
 * (веб-поиск по открытым источникам) и уже вместе с ним уезжает в Поток.
 * Собранное досье возвращается наружу, чтобы доска его сохранила и второй раз
 * не платила за то же самое.
 *
 * Кандидаты идут по одному и последовательно: у Потока лимит 100 запросов за
 * 10 секунд, а сбор досье — тяжёлая операция. Ошибка по одному кандидату не
 * должна ронять выгрузку остальных, поэтому по каждому свой результат.
 */
export async function POST(req: Request) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
  }
  if (!hasPotok()) {
    return NextResponse.json(
      { error: "Интеграция с Потоком не настроена: не задан POTOK_TOKEN." },
      { status: 400 },
    );
  }

  let body: Body;
  try {
    body = await readJsonLimited(req, 2 * 1024 * 1024);
  } catch (e) {
    return badBodyResponse(e);
  }

  const candidates = (body.candidates || []).filter((c) => c && c.name?.trim());
  if (candidates.length === 0) {
    return NextResponse.json({ error: "Не выбрано ни одного кандидата." }, { status: 400 });
  }
  if (candidates.length > 50) {
    return NextResponse.json(
      { error: "За раз можно выгрузить не более 50 кандидатов." },
      { status: 400 },
    );
  }

  // Досье собираем только в живом режиме: в демо это был бы пример, выданный
  // за настоящую проверку человека, — такого в ATS попасть не должно.
  const withDossier = Boolean(body.withDossier) && hasApiKey();
  const context = (body.context || "").trim();

  const jobId = Number(body.jobId) || undefined;
  const results: ExportResult[] = [];

  for (const c of candidates) {
    let candidate = c;
    let freshDossier: Dossier | undefined;
    let dossierError: string | undefined;

    if (withDossier && !c.dossier) {
      try {
        const text = await generateWithWebSearch(
          DOSSIER_SYSTEM,
          dossierUser(c.name, c.role || "", context),
          DOSSIER_SEARCH_MAX_USES,
          "dossier:export",
        );
        freshDossier = parseJsonLoose<Dossier>(text);
        candidate = { ...c, dossier: freshDossier };
      } catch (e) {
        // Досье не собралось — кандидата всё равно заводим, но честно говорим,
        // что карточка ушла без него.
        dossierError = e instanceof Error ? e.message : "Не удалось собрать досье.";
      }
    }

    try {
      const potokId = await createApplicant(candidate, jobId);
      results.push({
        candidateId: c.id,
        name: c.name,
        potokId,
        ok: true,
        dossier: freshDossier,
        warning: dossierError,
      });
    } catch (e) {
      results.push({
        candidateId: c.id,
        name: c.name,
        ok: false,
        error: e instanceof Error ? e.message : "Неизвестная ошибка.",
        dossier: freshDossier,
      });
    }
  }

  const sent = results.filter((r) => r.ok).length;
  return NextResponse.json({
    results,
    sent,
    failed: results.length - sent,
    dossiersCollected: results.filter((r) => r.dossier).length,
  });
}
