"use client";

import { useState } from "react";
import Markdown from "@/components/Markdown";
import {
  AnalyzeResult,
  CandidatesResult,
  CompareResult,
} from "@/lib/types";
import { SAMPLE_BRIEF } from "@/lib/sample";

type Tab = "vacancy" | "brief" | "sourcing" | "candidates" | "compare";

const TABS: { id: Tab; label: string }[] = [
  { id: "vacancy", label: "Вакансия" },
  { id: "brief", label: "Сильный бриф" },
  { id: "sourcing", label: "Стратегия и каналы" },
  { id: "candidates", label: "Кандидаты" },
  { id: "compare", label: "Сравнение резюме" },
];

function buildContext(a: AnalyzeResult): string {
  const lines: string[] = [];
  lines.push(`Роль: ${a.role_title}`);
  lines.push(`Суть: ${a.headline}`);
  lines.push(`Рамка роли: ${a.brief.role_frame}`);
  lines.push(`Must-have: ${a.brief.must_have.join("; ")}`);
  lines.push(`Смежные пулы: ${a.sourcing.adjacent_pools.map((p) => p.name).join("; ")}`);
  lines.push(`Компании-доноры: ${a.sourcing.donor_companies.map((p) => p.name).join("; ")}`);
  lines.push(`Каналы: ${a.sourcing.channels.map((c) => `${c.name} (${c.type})`).join("; ")}`);
  lines.push(`Условия: ${a.brief.conditions}`);
  return lines.join("\n");
}

export default function Page() {
  const [brief, setBrief] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeErr, setAnalyzeErr] = useState("");
  const [analyze, setAnalyze] = useState<(AnalyzeResult & { demo?: boolean }) | null>(null);
  const [tab, setTab] = useState<Tab>("vacancy");

  async function runAnalyze() {
    setAnalyzing(true);
    setAnalyzeErr("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, company, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setAnalyze(data);
      setTab("vacancy");
    } catch (e) {
      setAnalyzeErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-6">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Ассистент рекрутера
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            Бриф → интересная вакансия, сильный бриф, стратегия поиска и каналы,
            кандидаты из открытых источников и сравнение резюме с брифом.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8">
        {/* Ввод брифа */}
        <section className="rounded-xl border border-ink/10 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Компания (необязательно)"
              className="rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Роль / подсказка (необязательно)"
              className="rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Вставьте бриф или описание вакансии…"
            rows={7}
            className="mt-3 w-full resize-y rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={runAnalyze}
              disabled={analyzing || brief.trim().length < 20}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {analyzing ? "Анализирую…" : "Проанализировать бриф"}
            </button>
            <button
              onClick={() => setBrief(SAMPLE_BRIEF)}
              className="text-sm text-ink/50 underline underline-offset-2 hover:text-ink"
            >
              Вставить пример
            </button>
            {analyzeErr && <span className="text-sm text-red-600">{analyzeErr}</span>}
          </div>
        </section>

        {analyze && (
          <section className="mt-8">
            {analyze.demo && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                Демо-режим: задан пример без обращения к модели. Добавьте
                <code className="mx-1 rounded bg-amber-100 px-1">ANTHROPIC_API_KEY</code>,
                чтобы работать с реальными брифами.
              </div>
            )}

            <div className="flex flex-wrap gap-1 border-b border-ink/10">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
                    tab === t.id
                      ? "border-accent text-ink"
                      : "border-transparent text-ink/50 hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="py-6">
              {tab === "vacancy" && <VacancyView a={analyze} />}
              {tab === "brief" && <BriefView a={analyze} />}
              {tab === "sourcing" && <SourcingView a={analyze} />}
              {tab === "candidates" && <CandidatesView context={buildContext(analyze)} />}
              {tab === "compare" && <CompareView defaultBrief={brief || SAMPLE_BRIEF} />}
            </div>
          </section>
        )}
      </div>

      <footer className="border-t border-ink/10 py-6 text-center text-xs text-ink/40">
        Только публичная профессиональная информация, для легитимного найма.
      </footer>
    </main>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* noop */
        }
      }}
      className="rounded-md border border-ink/15 px-2 py-1 text-xs text-ink/60 hover:bg-paper"
    >
      {done ? "Скопировано" : "Копировать"}
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/50">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((x, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink/90">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

function VacancyView({ a }: { a: AnalyzeResult }) {
  return (
    <div className="space-y-5">
      <p className="text-lg font-medium italic text-ink/80">«{a.headline}»</p>
      {(
        [
          ["Энергичный текст для публикации", a.vacancy.energetic],
          ["Сдержанный / корпоративный вариант", a.vacancy.formal],
          ["Короткий тизер (Telegram / соцсети)", a.vacancy.short],
        ] as const
      ).map(([title, text]) => (
        <div key={title} className="rounded-xl border border-ink/10 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/50">
              {title}
            </h3>
            <CopyBtn text={text} />
          </div>
          <div className="text-sm text-ink/90">
            <Markdown text={text} />
          </div>
        </div>
      ))}
    </div>
  );
}

function BriefView({ a }: { a: AnalyzeResult }) {
  const b = a.brief;
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Card title="Контекст роли">
        <p className="text-sm leading-relaxed text-ink/90">{b.context}</p>
        <p className="mt-3 text-sm leading-relaxed text-ink/70">
          <span className="font-semibold">Почему ищем: </span>
          {b.why_searching}
        </p>
      </Card>
      <Card title="Рамка роли">
        <p className="text-sm italic leading-relaxed text-ink/90">{b.role_frame}</p>
      </Card>
      <Card title="Ключевые задачи (6–12 мес.)">
        <Bullets items={b.key_tasks} />
      </Card>
      <Card title="Профиль (must-have)">
        <Bullets items={b.must_have} />
      </Card>
      <Card title="Стоп-факторы (анти-профиль)">
        <Bullets items={b.anti_profile} />
      </Card>
      <Card title="Метрики и условия">
        <Bullets items={b.metrics} />
        <p className="mt-3 text-sm leading-relaxed text-ink/70">{b.conditions}</p>
      </Card>
      <div className="md:col-span-2">
        <Card title="Проверка на реализм рынка">
          <p className="text-sm leading-relaxed text-ink/90">{a.market_reality}</p>
        </Card>
      </div>
    </div>
  );
}

function SourcingView({ a }: { a: AnalyzeResult }) {
  const s = a.sourcing;
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Card title="Смежные пулы">
        <NamedList items={s.adjacent_pools} />
      </Card>
      <Card title="Компании-доноры">
        <NamedList items={s.donor_companies} />
      </Card>
      <Card title="Сигналы-триггеры («кто в моменте»)">
        <Bullets items={s.trigger_signals} />
      </Card>
      <Card title="Реферальные ходы">
        <Bullets items={s.referral_moves} />
      </Card>
      <div className="md:col-span-2">
        <Card title="Каналы">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {s.channels.map((c, i) => (
              <div key={i} className="rounded-lg border border-ink/10 bg-paper p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">{c.name}</span>
                  <span className="rounded-full bg-accentsoft px-2 py-0.5 text-xs text-ink/70">
                    {c.type}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink/70">{c.why}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="md:col-span-2">
        <Card title="Boolean / X-ray строки">
          <div className="space-y-2">
            {s.boolean_strings.map((str, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-lg bg-ink/5 px-3 py-2"
              >
                <code className="text-xs text-ink/80">{str}</code>
                <CopyBtn text={str} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function NamedList({ items }: { items: { name: string; why: string }[] }) {
  return (
    <ul className="space-y-3">
      {items.map((x, i) => (
        <li key={i}>
          <div className="text-sm font-semibold text-ink">{x.name}</div>
          <div className="text-sm text-ink/70">{x.why}</div>
        </li>
      ))}
    </ul>
  );
}

function CandidatesView({ context }: { context: string }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState<(CandidatesResult & { demo?: boolean }) | null>(null);

  async function run() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Ошибка");
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {loading ? "Ищу по открытым источникам…" : "Найти кандидатов"}
        </button>
        <span className="text-xs text-ink/50">
          Поиск по публичным профессиональным источникам. Результат — гипотезы для аутрича.
        </span>
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>

      {data && (
        <div className="space-y-4">
          {data.demo && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              Демо-режим: реальный OSINT-поиск включается при заданном ANTHROPIC_API_KEY.
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-ink/10 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper text-xs uppercase text-ink/50">
                <tr>
                  <th className="px-4 py-3">Кандидат</th>
                  <th className="px-4 py-3">Текущая позиция</th>
                  <th className="px-4 py-3">Чем релевантен</th>
                  <th className="px-4 py-3">Сигнал</th>
                  <th className="px-4 py-3">Источник</th>
                  <th className="px-4 py-3">Увер.</th>
                </tr>
              </thead>
              <tbody>
                {data.candidates.map((c, i) => (
                  <tr key={i} className="border-t border-ink/10 align-top">
                    <td className="px-4 py-3 font-semibold text-ink">{c.name}</td>
                    <td className="px-4 py-3 text-ink/80">
                      {c.current_role}
                      {c.company ? `, ${c.company}` : ""}
                    </td>
                    <td className="px-4 py-3 text-ink/80">{c.relevance}</td>
                    <td className="px-4 py-3 text-ink/70">{c.signal || "—"}</td>
                    <td className="px-4 py-3">
                      {c.source ? (
                        <a
                          href={c.source}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent underline underline-offset-2"
                        >
                          ссылка
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ConfidenceBadge value={c.confidence} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.recommendation && (
            <Card title="С кого начать">
              <p className="text-sm leading-relaxed text-ink/90">{data.recommendation}</p>
            </Card>
          )}
          {data.note && <p className="text-xs text-ink/50">{data.note}</p>}
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ value }: { value: string }) {
  const v = (value || "").toLowerCase();
  const cls =
    v.includes("выс")
      ? "bg-green-100 text-green-800"
      : v.includes("сред")
        ? "bg-amber-100 text-amber-800"
        : "bg-ink/10 text-ink/60";
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{value || "—"}</span>;
}

function CompareView({ defaultBrief }: { defaultBrief: string }) {
  const [cbrief, setCbrief] = useState(defaultBrief);
  const [resumes, setResumes] = useState<{ name: string; text: string }[]>([
    { name: "", text: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState<(CompareResult & { demo?: boolean }) | null>(null);

  function update(i: number, field: "name" | "text", val: string) {
    setResumes((r) => r.map((x, idx) => (idx === i ? { ...x, [field]: val } : x)));
  }
  function add() {
    setResumes((r) => [...r, { name: "", text: "" }]);
  }
  function remove(i: number) {
    setResumes((r) => (r.length > 1 ? r.filter((_, idx) => idx !== i) : r));
  }

  async function run() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: cbrief,
          resumes: resumes.filter((r) => r.text.trim().length > 30),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Ошибка");
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card title="Требования / бриф для сравнения">
        <textarea
          value={cbrief}
          onChange={(e) => setCbrief(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </Card>

      <div className="space-y-3">
        {resumes.map((r, i) => (
          <div key={i} className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <input
                value={r.name}
                onChange={(e) => update(i, "name", e.target.value)}
                placeholder={`Имя кандидата ${i + 1} (необязательно)`}
                className="flex-1 rounded-lg border border-ink/15 px-3 py-1.5 text-sm outline-none focus:border-accent"
              />
              <button
                onClick={() => remove(i)}
                className="rounded-md border border-ink/15 px-2 py-1 text-xs text-ink/50 hover:bg-paper"
              >
                Убрать
              </button>
            </div>
            <textarea
              value={r.text}
              onChange={(e) => update(i, "text", e.target.value)}
              placeholder="Вставьте текст резюме…"
              rows={5}
              className="w-full resize-y rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={add}
          className="rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink/70 hover:bg-paper"
        >
          + Ещё резюме
        </button>
        <button
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {loading ? "Сравниваю…" : "Сравнить с брифом"}
        </button>
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>

      {data && (
        <div className="space-y-4">
          {data.demo && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              Демо-режим: реальная оценка включается при заданном ANTHROPIC_API_KEY.
            </div>
          )}
          {data.ranking.map((c, i) => (
            <div key={i} className="rounded-xl border border-ink/10 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-bold text-ink">{c.name}</div>
                  <div className="text-sm text-ink/70">{c.verdict}</div>
                </div>
                <ScoreBadge score={c.score} />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase text-ink/40">Сильные стороны</div>
                  <Bullets items={c.strengths} />
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase text-ink/40">Пробелы</div>
                  <Bullets items={c.gaps} />
                </div>
              </div>
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase text-ink/40">
                  Соответствие must-have
                </div>
                <div className="space-y-1.5">
                  {c.must_have_match.map((m, j) => (
                    <div key={j} className="flex items-start gap-2 text-sm">
                      <StatusDot status={m.status} />
                      <span className="text-ink/90">
                        <span className="font-medium">{m.requirement}</span> — {m.evidence}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-paper px-3 py-2 text-sm">
                <span className="font-semibold text-ink">Рекомендация: </span>
                <span className="text-ink/80">{c.recommendation}</span>
              </div>
            </div>
          ))}
          {data.summary && (
            <Card title="Сравнительный вывод">
              <p className="text-sm leading-relaxed text-ink/90">{data.summary}</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 75 ? "bg-green-100 text-green-800" : score >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  return (
    <div className={`shrink-0 rounded-lg px-3 py-2 text-center ${cls}`}>
      <div className="text-xl font-bold leading-none">{score}</div>
      <div className="text-[10px] uppercase">соответствие</div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const color = s.includes("есть")
    ? "bg-green-500"
    : s.includes("частич")
      ? "bg-amber-500"
      : s.includes("нет")
        ? "bg-red-500"
        : "bg-ink/30";
  return <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${color}`} title={status} />;
}
