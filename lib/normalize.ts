import { BoardCandidate, Candidate, CandidatesResult, Position } from "./types";

// Ответ модели и сохранённые позиции могут прийти не той формы (нет массива,
// null вместо строки). Интерфейс на такое падает целиком, поэтому приводим
// данные к ожидаемым типам на входе — и на сервере, и при загрузке позиций.

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [];
}

export function normalizeCandidates(raw: unknown): CandidatesResult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const candidates: Candidate[] = arr(o.candidates).map((c) => ({
    ...c,
    name: s(c.name) || "Без имени",
    current_role: s(c.current_role),
    company: s(c.company),
    relevance: s(c.relevance),
    signal: s(c.signal),
    source: s(c.source),
    confidence: s(c.confidence) || "гипотеза",
    angle: c.angle == null ? undefined : s(c.angle),
    outreach_hook: c.outreach_hook == null ? undefined : s(c.outreach_hook),
    fit_score: typeof c.fit_score === "number" ? c.fit_score : Number(c.fit_score) || undefined,
    fit_reason: c.fit_reason == null ? undefined : s(c.fit_reason),
  }));
  return { ...o, candidates, recommendation: s(o.recommendation), note: s(o.note) };
}

export function normalizePosition(p: Position): Position {
  return {
    ...p,
    sourced: p.sourced ? normalizeCandidates(p.sourced) : null,
    candidates: (arr(p.candidates) as unknown as BoardCandidate[]).map((c) => ({
      ...c,
      name: s(c.name) || "Без имени",
      role: s(c.role),
      source: s(c.source),
      note: s(c.note),
    })),
  };
}
