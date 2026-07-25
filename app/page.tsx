"use client";

import { useEffect, useState } from "react";
import Markdown from "@/components/Markdown";
import Board from "@/components/Board";
import {
  AnalyzeResult,
  BoardCandidate,
  CandidatesResult,
  CompareResult,
  Position,
} from "@/lib/types";
import { SAMPLE_BRIEF } from "@/lib/sample";
import { usePositions, uid } from "@/lib/store";
import { exportDocx, exportMarkdown, exportCandidatesCsv } from "@/lib/export";

type Tab = "overview" | "vacancy" | "brief" | "sourcing" | "candidates" | "compare" | "board";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Обзор" },
  { id: "vacancy", label: "Вакансия" },
  { id: "brief", label: "Сильный бриф" },
  { id: "sourcing", label: "Стратегия и каналы" },
  { id: "candidates", label: "Кандидаты" },
  { id: "compare", label: "Сравнение резюме" },
  { id: "board", label: "Доска" },
];

export default function Page() {
  const store = usePositions();
  return (
    <main className="min-h-screen">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <button onClick={() => store.setCurrentId(null)} className="text-left">
            <h1 className="text-xl font-bold tracking-tight text-ink">Ассистент рекрутера</h1>
            <p className="text-xs text-ink/50">
              Одна кнопка: бриф → вакансия, стратегия, каналы, кандидаты и доска подбора
            </p>
          </button>
          <div className="flex items-center gap-3">
            <ModeBadge />
            {store.current && (
              <button
                onClick={() => store.setCurrentId(null)}
                className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm text-ink/70 hover:bg-paper"
              >
                ← Все позиции
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        {!store.ready ? (
          <div className="text-sm text-ink/40">Загрузка…</div>
        ) : store.current ? (
          <Workspace key={store.current.id} store={store} position={store.current} />
        ) : (
          <Home store={store} />
        )}
      </div>

      <footer className="border-t border-ink/10 py-6 text-center text-xs text-ink/40">
        Только публичная профессиональная информация, для легитимного найма.
      </footer>
    </main>
  );
}

function ModeBadge() {
  const [status, setStatus] = useState<{ live: boolean; model: string } | null>(null);
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ live: false, model: "" }));
  }, []);
  if (!status) return null;
  return (
    <span
      title={
        status.live
          ? `Живой режим · ${status.model}`
          : "Демо-режим · задайте ANTHROPIC_API_KEY, чтобы работать с реальными брифами"
      }
      className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs sm:inline-flex ${
        status.live ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${status.live ? "bg-green-500" : "bg-amber-500"}`} />
      {status.live ? "Живой режим" : "Демо-режим"}
    </span>
  );
}

type Store = ReturnType<typeof usePositions>;

function Home({ store }: { store: Store }) {
  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Позиции</h2>
        <button
          onClick={() => store.create()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          + Добавить новую позицию
        </button>
      </div>
      {store.positions.length === 0 ? (
        <button
          onClick={() => store.create()}
          className="block w-full rounded-xl border border-dashed border-ink/20 bg-white/60 p-12 text-center text-sm text-ink/50 transition hover:border-accent/40 hover:text-ink"
        >
          Пока нет ни одной позиции.
          <br />
          Нажмите, чтобы создать первую стратегию поиска и вставить бриф.
        </button>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {store.positions.map((p) => (
            <div
              key={p.id}
              className="group rounded-xl border border-ink/10 bg-white p-4 shadow-sm transition hover:border-accent/40"
            >
              <button onClick={() => store.setCurrentId(p.id)} className="block w-full text-left">
                <div className="font-semibold text-ink">{p.analyze?.role_title || p.title}</div>
                <div className="mt-0.5 text-xs text-ink/50">
                  {p.company || "без компании"} ·{" "}
                  {new Date(p.updatedAt).toLocaleDateString("ru-RU")}
                </div>
                <div className="mt-3 flex gap-3 text-xs text-ink/50">
                  <span>{p.analyze ? "стратегия готова" : "черновик"}</span>
                  <span>· {p.candidates.length} на доске</span>
                </div>
              </button>
              <button
                onClick={() => {
                  if (confirm("Удалить позицию?")) store.remove(p.id);
                }}
                className="mt-3 text-xs text-ink/30 opacity-0 transition group-hover:opacity-100 hover:text-red-600"
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function buildContext(a: AnalyzeResult): string {
  return [
    `Роль: ${a.role_title}`,
    `Суть: ${a.headline}`,
    `Рамка роли: ${a.brief.role_frame}`,
    `Must-have: ${a.brief.must_have.join("; ")}`,
    `Смежные пулы: ${a.sourcing.adjacent_pools.map((p) => p.name).join("; ")}`,
    `Компании-доноры: ${a.sourcing.donor_companies.map((p) => p.name).join("; ")}`,
    `Каналы: ${a.sourcing.channels.map((c) => `${c.name} (${c.type})`).join("; ")}`,
    `Условия: ${a.brief.conditions}`,
  ].join("\n");
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || ""); // убрать data:...;base64,
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

function mapSourced(d: CandidatesResult): BoardCandidate[] {
  return d.candidates.map((c) => ({
    id: uid(),
    name: c.name,
    role: `${c.current_role}${c.company ? ", " + c.company : ""}`,
    source: c.source,
    note: c.relevance,
    stage: "longlist",
    addedFrom: "osint",
    createdAt: Date.now(),
  }));
}

function Workspace({ store, position }: { store: Store; position: Position }) {
  const a = position.analyze;
  const [brief, setBrief] = useState(position.brief);
  const [company, setCompany] = useState(position.company);
  const [role, setRole] = useState(position.role);
  const [editing, setEditing] = useState(!a);
  const [phase, setPhase] = useState(0); // 0 idle · 1 анализ · 2 кандидаты
  const [candLoading, setCandLoading] = useState(false);
  const [err, setErr] = useState("");
  const [candErr, setCandErr] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  function persistInputs() {
    store.update(position.id, { brief, company, role });
  }

  async function runCandidates(aData: AnalyzeResult) {
    const res = await fetch("/api/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: buildContext(aData) }),
    });
    const d = (await res.json()) as CandidatesResult & { error?: string };
    if (!res.ok) throw new Error(d.error || "Ошибка поиска кандидатов");
    store.update(position.id, { sourced: d });
    store.addCandidates(position.id, mapSourced(d));
    return d;
  }

  // Единый прогон: бриф → вакансия/стратегия → кандидаты → доска.
  async function runAll() {
    setErr("");
    setCandErr("");
    try {
      setPhase(1);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, company, role }),
      });
      const aData = (await res.json()) as AnalyzeResult & { error?: string };
      if (!res.ok) throw new Error(aData.error || "Ошибка анализа");
      store.update(position.id, {
        analyze: aData,
        brief,
        company,
        role,
        title: aData.role_title || position.title,
      });
      setEditing(false);
      setTab("overview");

      setPhase(2);
      try {
        await runCandidates(aData);
      } catch (ce) {
        // Поиск кандидатов может не пройти (веб-поиск) — не валим весь прогон.
        setCandErr(ce instanceof Error ? ce.message : "Ошибка поиска кандидатов");
      }
      setPhase(0);
    } catch (e) {
      setPhase(0);
      setErr(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function refreshCandidates() {
    if (!a) return;
    setCandLoading(true);
    setCandErr("");
    try {
      await runCandidates(a);
    } catch (e) {
      setCandErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setCandLoading(false);
    }
  }

  // ---- Экран ввода брифа (единая точка входа) ----
  if (editing || !a) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl border border-ink/10 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">Новая стратегия поиска</h2>
          <p className="mt-1 text-sm text-ink/60">
            Вставьте бриф — приложение само переформатирует вакансию, соберёт сильный бриф,
            стратегию и каналы и найдёт кандидатов по открытым источникам.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onBlur={persistInputs}
              placeholder="Компания (необязательно)"
              className="rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              onBlur={persistInputs}
              placeholder="Роль / подсказка (необязательно)"
              className="rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            onBlur={persistInputs}
            placeholder="Вставьте бриф или описание вакансии…"
            rows={8}
            className="mt-3 w-full resize-y rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={runAll}
              disabled={phase > 0 || brief.trim().length < 20}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {phase > 0 ? "Формирую…" : "Сформировать стратегию и найти кандидатов"}
            </button>
            {a && (
              <button
                onClick={() => setEditing(false)}
                className="text-sm text-ink/50 underline underline-offset-2 hover:text-ink"
              >
                Отмена
              </button>
            )}
            <button
              onClick={() => setBrief(SAMPLE_BRIEF)}
              className="text-sm text-ink/50 underline underline-offset-2 hover:text-ink"
            >
              Вставить пример
            </button>
          </div>
          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
          {phase > 0 && <Stepper phase={phase} />}
        </div>
      </div>
    );
  }

  // ---- Готовая стратегия ----
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">{a.role_title}</h2>
          {position.company && <div className="text-xs text-ink/50">{position.company}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm text-ink/70 hover:bg-paper"
          >
            Изменить бриф
          </button>
          <button
            onClick={runAll}
            disabled={phase > 0}
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm text-ink/70 hover:bg-paper disabled:opacity-40"
          >
            {phase > 0 ? "Пересобираю…" : "Пересобрать"}
          </button>
          <span className="mx-1 h-5 w-px bg-ink/10" />
          <button
            onClick={() => exportDocx(position)}
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm text-ink/70 hover:bg-paper"
          >
            .docx
          </button>
          <button
            onClick={() => exportMarkdown(position)}
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm text-ink/70 hover:bg-paper"
          >
            .md
          </button>
          <button
            onClick={() => exportCandidatesCsv(position)}
            disabled={position.candidates.length === 0}
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm text-ink/70 hover:bg-paper disabled:opacity-40"
          >
            Доска .csv
          </button>
        </div>
      </div>

      {(a as { demo?: boolean }).demo && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Демо-режим: пример без обращения к модели. Добавьте ANTHROPIC_API_KEY для реальных брифов.
        </div>
      )}
      {phase > 0 && <Stepper phase={phase} />}

      <div className="flex flex-wrap gap-1 border-b border-ink/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t.id ? "border-accent text-ink" : "border-transparent text-ink/50 hover:text-ink"
            }`}
          >
            {t.label}
            {t.id === "board" && position.candidates.length > 0 && (
              <span className="ml-1 rounded-full bg-ink/10 px-1.5 text-xs">
                {position.candidates.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="py-6">
        {tab === "overview" && (
          <Overview position={position} onGo={setTab} onboardCount={position.candidates.length} />
        )}
        {tab === "vacancy" && <VacancyView a={a} />}
        {tab === "brief" && <BriefView a={a} />}
        {tab === "sourcing" && <SourcingView a={a} />}
        {tab === "candidates" && (
          <CandidatesView
            data={position.sourced}
            loading={candLoading || phase === 2}
            err={candErr}
            onRefresh={refreshCandidates}
            onboard={new Set(position.candidates.map((c) => c.name.toLowerCase()))}
            onAdd={(c) => store.addCandidates(position.id, [c])}
          />
        )}
        {tab === "compare" && (
          <CompareView
            defaultBrief={position.brief || SAMPLE_BRIEF}
            onboard={new Set(position.candidates.map((c) => c.name.toLowerCase()))}
            onAdd={(c) => store.addCandidates(position.id, [c])}
          />
        )}
        {tab === "board" && (
          <Board
            position={position}
            dossierContext={buildContext(a)}
            onUpdateCandidate={(cid, patch) => store.updateCandidate(position.id, cid, patch)}
            onRemoveCandidate={(cid) => store.removeCandidate(position.id, cid)}
            onAddManual={(c) => store.addCandidates(position.id, [c])}
          />
        )}
      </div>
    </div>
  );
}

function Stepper({ phase }: { phase: number }) {
  const steps = [
    { n: 1, label: "Вакансия, сильный бриф и стратегия" },
    { n: 2, label: "Кандидаты из открытых источников" },
  ];
  return (
    <div className="my-4 rounded-lg border border-ink/10 bg-white p-4">
      <ul className="space-y-2">
        {steps.map((s) => {
          const status = phase > s.n ? "done" : phase === s.n ? "active" : "pending";
          return (
            <li key={s.n} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  status === "done"
                    ? "bg-green-500 text-white"
                    : status === "active"
                      ? "bg-accent text-white"
                      : "bg-ink/10 text-ink/40"
                }`}
              >
                {status === "done" ? "✓" : status === "active" ? "•" : s.n}
              </span>
              <span className={status === "pending" ? "text-ink/40" : "text-ink/80"}>
                {s.label}
                {status === "active" && " …"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---- Обзор ----

function Overview({
  position,
  onGo,
  onboardCount,
}: {
  position: Position;
  onGo: (t: Tab) => void;
  onboardCount: number;
}) {
  const a = position.analyze!;
  const found = position.sourced?.candidates.length ?? 0;
  const tiles = [
    { label: "must-have", value: a.brief.must_have.length, tab: "brief" as Tab },
    { label: "каналов", value: a.sourcing.channels.length, tab: "sourcing" as Tab },
    { label: "найдено кандидатов", value: found, tab: "candidates" as Tab },
    { label: "на доске", value: onboardCount, tab: "board" as Tab },
  ];
  return (
    <div className="space-y-5">
      <p className="text-lg font-medium italic text-ink/80">«{a.headline}»</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.label}
            onClick={() => onGo(t.tab)}
            className="rounded-xl border border-ink/10 bg-white p-4 text-left shadow-sm transition hover:border-accent/40"
          >
            <div className="text-2xl font-bold text-ink">{t.value}</div>
            <div className="text-xs text-ink/50">{t.label}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card title="Рамка роли">
          <p className="text-sm italic leading-relaxed text-ink/90">{a.brief.role_frame}</p>
          <button
            onClick={() => onGo("vacancy")}
            className="mt-3 text-sm text-accent underline underline-offset-2"
          >
            Открыть тексты вакансии →
          </button>
        </Card>
        <Card title="С чего начать поиск">
          <p className="text-sm leading-relaxed text-ink/90">
            {position.sourced?.recommendation || "Кандидаты ещё не найдены — откройте вкладку «Кандидаты»."}
          </p>
          <button
            onClick={() => onGo(found ? "board" : "candidates")}
            className="mt-3 text-sm text-accent underline underline-offset-2"
          >
            {found ? "Перейти к доске подбора →" : "Найти кандидатов →"}
          </button>
        </Card>
      </div>

      <Card title="Ключевые каналы">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {a.sourcing.channels.slice(0, 4).map((c, i) => (
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
        <button
          onClick={() => onGo("sourcing")}
          className="mt-3 text-sm text-accent underline underline-offset-2"
        >
          Вся стратегия и Boolean-строки →
        </button>
      </Card>
    </div>
  );
}

// ---- Мелкие UI-хелперы ----

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
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/50">{title}</h3>
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
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/50">{title}</h3>
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

function AddBtn({ added, onClick }: { added: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={added}
      className={`rounded-md border px-2 py-1 text-xs transition ${
        added
          ? "border-green-300 bg-green-50 text-green-700"
          : "border-ink/15 text-ink/60 hover:bg-paper"
      }`}
    >
      {added ? "на доске" : "+ на доску"}
    </button>
  );
}

function CandidatesView({
  data,
  loading,
  err,
  onRefresh,
  onboard,
  onAdd,
}: {
  data: CandidatesResult | null;
  loading: boolean;
  err: string;
  onRefresh: () => void;
  onboard: Set<string>;
  onAdd: (c: BoardCandidate) => void;
}) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-semibold text-ink/80 transition hover:bg-paper disabled:opacity-40"
        >
          {loading ? "Ищу по открытым источникам…" : data ? "Обновить список" : "Найти кандидатов"}
        </button>
        <span className="text-xs text-ink/50">
          Найденные автоматически попадают на доску (Лонг-лист). Результат — гипотезы для аутрича.
        </span>
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>

      {!data && !loading && (
        <p className="text-sm text-ink/50">Кандидаты ещё не найдены.</p>
      )}

      {(data as (CandidatesResult & { demo?: boolean }) | null)?.demo && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Демо-режим: реальный OSINT-поиск включается при заданном ANTHROPIC_API_KEY.
        </div>
      )}

      {data && (
        <div className="space-y-4">
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
                  <th className="px-4 py-3"></th>
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
                    <td className="px-4 py-3">
                      <AddBtn
                        added={onboard.has(c.name.toLowerCase())}
                        onClick={() =>
                          onAdd({
                            id: uid(),
                            name: c.name,
                            role: `${c.current_role}${c.company ? ", " + c.company : ""}`,
                            source: c.source,
                            note: c.relevance,
                            stage: "longlist",
                            addedFrom: "osint",
                            createdAt: Date.now(),
                          })
                        }
                      />
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
  const cls = v.includes("выс")
    ? "bg-green-100 text-green-800"
    : v.includes("сред")
      ? "bg-amber-100 text-amber-800"
      : "bg-ink/10 text-ink/60";
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{value || "—"}</span>;
}

function CompareView({
  defaultBrief,
  onboard,
  onAdd,
}: {
  defaultBrief: string;
  onboard: Set<string>;
  onAdd: (c: BoardCandidate) => void;
}) {
  const [cbrief, setCbrief] = useState(defaultBrief);
  const [resumes, setResumes] = useState<{ name: string; text: string }[]>([{ name: "", text: "" }]);
  const [loading, setLoading] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [data, setData] = useState<(CompareResult & { demo?: boolean }) | null>(null);

  function update(i: number, field: "name" | "text", val: string) {
    setResumes((r) => r.map((x, idx) => (idx === i ? { ...x, [field]: val } : x)));
  }

  async function uploadFor(i: number, file: File) {
    setErr("");
    setUploadingIdx(i);
    try {
      const b64 = await fileToBase64(file);
      const name = file.name.toLowerCase();
      const byExt = name.endsWith(".pdf")
        ? "application/pdf"
        : name.endsWith(".docx")
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "text/plain";
      const mediaType = file.type || byExt;
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64: b64, mediaType, filename: file.name }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Ошибка загрузки");
      if (d.note) setErr(d.note);
      setResumes((r) =>
        r.map((x, idx) =>
          idx === i
            ? {
                name: x.name || file.name.replace(/\.(pdf|docx|txt)$/i, ""),
                text: d.text || x.text,
              }
            : x,
        ),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploadingIdx(null);
    }
  }

  async function run() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: cbrief, resumes: resumes.filter((r) => r.text.trim().length > 30) }),
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
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <input
                value={r.name}
                onChange={(e) => update(i, "name", e.target.value)}
                placeholder={`Имя кандидата ${i + 1} (необязательно)`}
                className="min-w-[180px] flex-1 rounded-lg border border-ink/15 px-3 py-1.5 text-sm outline-none focus:border-accent"
              />
              <label className="cursor-pointer rounded-md border border-ink/15 px-2 py-1 text-xs text-ink/60 hover:bg-paper">
                {uploadingIdx === i ? "Загружаю…" : "Загрузить PDF/DOCX/TXT"}
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFor(i, f);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                onClick={() => setResumes((r) => (r.length > 1 ? r.filter((_, idx) => idx !== i) : r))}
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
          onClick={() => setResumes((r) => [...r, { name: "", text: "" }])}
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
                <div className="flex items-center gap-3">
                  <AddBtn
                    added={onboard.has(c.name.toLowerCase())}
                    onClick={() =>
                      onAdd({
                        id: uid(),
                        name: c.name,
                        role: "",
                        source: "",
                        note: c.verdict,
                        stage: "interview",
                        score: c.score,
                        addedFrom: "compare",
                        createdAt: Date.now(),
                      })
                    }
                  />
                  <ScoreBadge score={c.score} />
                </div>
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
