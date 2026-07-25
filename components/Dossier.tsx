"use client";

import { Dossier } from "@/lib/types";

export default function DossierModal({
  name,
  dossier,
  loading,
  err,
  onClose,
  onRefresh,
}: {
  name: string;
  dossier: (Dossier & { demo?: boolean }) | null;
  loading: boolean;
  err: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-ink/40">OSINT-досье</div>
            <h3 className="text-lg font-bold text-ink">{name}</h3>
          </div>
          <div className="flex items-center gap-2">
            {dossier && <ScoreBadge score={dossier.weighted_score} />}
            <button
              onClick={onClose}
              className="rounded-md border border-ink/15 px-2 py-1 text-sm text-ink/60 hover:bg-paper"
            >
              Закрыть
            </button>
          </div>
        </div>

        {loading && (
          <p className="mt-6 text-sm text-ink/60">Собираю досье по открытым источникам…</p>
        )}
        {err && <p className="mt-6 text-sm text-red-600">{err}</p>}

        {dossier && !loading && (
          <div className="mt-5 space-y-5">
            {dossier.demo && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                Демо-досье. Реальный OSINT-разбор включается при заданном ANTHROPIC_API_KEY.
              </div>
            )}

            <Section title="Идентификация">
              <p className="text-sm leading-relaxed text-ink/90">{dossier.identity}</p>
            </Section>

            <Section title="Взвешенная оценка">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-ink/40">
                    <tr>
                      <th className="py-1 pr-3">Критерий</th>
                      <th className="py-1 pr-3">Вес</th>
                      <th className="py-1 pr-3">1–10</th>
                      <th className="py-1">Комментарий</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dossier.criteria.map((c, i) => (
                      <tr key={i} className="border-t border-ink/10 align-top">
                        <td className="py-1.5 pr-3 font-medium text-ink">{c.name}</td>
                        <td className="py-1.5 pr-3 text-ink/60">{c.weight}</td>
                        <td className="py-1.5 pr-3 font-semibold text-ink">{c.score}</td>
                        <td className="py-1.5 text-ink/70">{c.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Слои источников">
              <div className="space-y-2">
                {dossier.layers.map((l, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <LayerBadge status={l.status} />
                    <span className="text-ink/90">
                      <span className="font-semibold">{l.name}.</span> {l.summary}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            {dossier.findings.length > 0 && (
              <Section title="Находки (с датами)">
                <ul className="space-y-2">
                  {dossier.findings.map((f, i) => (
                    <li key={i} className="text-sm text-ink/90">
                      {f.text}{" "}
                      <span className="text-ink/40">· {f.date || "дата ?"}</span>{" "}
                      {f.source && (
                        <a
                          href={f.source}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent underline underline-offset-2"
                        >
                          источник
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {dossier.links && dossier.links.length > 0 && (
              <Section title="Публичные профили и точки выхода">
                <ul className="space-y-1.5">
                  {dossier.links.map((l, i) => (
                    <li key={i} className="text-sm">
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent underline underline-offset-2"
                      >
                        {l.label || l.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {dossier.red_flags.length > 0 && (
              <Section title="Красные флаги и оговорки">
                <ul className="space-y-1.5">
                  {dossier.red_flags.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm text-ink/90">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {dossier.verify_on_interview.length > 0 && (
              <Section title="Проверить на интервью">
                <ul className="space-y-1.5">
                  {dossier.verify_on_interview.map((v, i) => (
                    <li key={i} className="flex gap-2 text-sm text-ink/90">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <div className="rounded-lg bg-paper px-4 py-3 text-sm">
              <span className="font-semibold text-ink">Вывод для ГД: </span>
              <span className="text-ink/80">{dossier.recommendation}</span>
            </div>

            <div className="flex justify-end">
              <button
                onClick={onRefresh}
                className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm text-ink/70 hover:bg-paper"
              >
                Пересобрать досье
              </button>
            </div>
          </div>
        )}

        {!dossier && !loading && !err && (
          <p className="mt-6 text-sm text-ink/60">Досье ещё не собрано.</p>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">{title}</h4>
      {children}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 75 ? "bg-green-100 text-green-800" : score >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  return (
    <div className={`rounded-lg px-3 py-1.5 text-center ${cls}`}>
      <span className="text-lg font-bold">{score}</span>
      <span className="ml-1 text-[10px] uppercase">/100</span>
    </div>
  );
}

function LayerBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const { cls, label } = s.includes("провер")
    ? { cls: "bg-green-100 text-green-800", label: "проверено" }
    : s.includes("недост")
      ? { cls: "bg-ink/10 text-ink/60", label: "недоступно" }
      : s.includes("расхожд")
        ? { cls: "bg-red-100 text-red-800", label: "расхождение" }
        : { cls: "bg-ink/10 text-ink/60", label: status };
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${cls}`}>{label}</span>
  );
}
