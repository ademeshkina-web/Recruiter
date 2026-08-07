"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BoardCandidate, Dossier, OutreachResult, Position, Stage, STAGES } from "@/lib/types";
import { uid } from "@/lib/store";
import { postJson } from "@/lib/client";
import { SafeLink } from "@/components/SafeLink";
import DossierModal from "@/components/Dossier";
import OutreachModal from "@/components/Outreach";

export default function Board({
  position,
  dossierContext,
  onUpdateCandidate,
  onRemoveCandidate,
  onAddManual,
}: {
  position: Position;
  dossierContext: string;
  onUpdateCandidate: (candId: string, patch: Partial<BoardCandidate>) => void;
  onRemoveCandidate: (candId: string) => void;
  onAddManual: (c: BoardCandidate) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [outId, setOutId] = useState<string | null>(null);
  const [outLoading, setOutLoading] = useState(false);
  const [outErr, setOutErr] = useState("");
  // Защита от двойного клика: не запускать второй дорогой сбор досье/писем
  // по тому же кандидату, пока первый не завершился.
  const runningDossier = useRef<Set<string>>(new Set());
  const runningOutreach = useRef<Set<string>>(new Set());

  const openCand = position.candidates.find((c) => c.id === openId) || null;
  const outCand = position.candidates.find((c) => c.id === outId) || null;

  function addManual() {
    if (!name.trim()) return;
    onAddManual({
      id: uid(),
      name: name.trim(),
      role: role.trim(),
      source: "",
      note: "",
      stage: "longlist",
      addedFrom: "manual",
      createdAt: Date.now(),
    });
    setName("");
    setRole("");
  }

  async function runDossier(c: BoardCandidate) {
    if (runningDossier.current.has(c.id)) return; // уже собирается
    runningDossier.current.add(c.id);
    setLoading(true);
    setErr("");
    try {
      // Досье — тяжёлая операция (до 12 веб-поисков); ждём дольше стандартного.
      const d = await postJson<Dossier>(
        "/api/dossier",
        { name: c.name, role: c.role, context: dossierContext },
        480_000,
      );
      onUpdateCandidate(c.id, { dossier: d });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      runningDossier.current.delete(c.id);
      setLoading(false);
    }
  }

  function openDossier(c: BoardCandidate) {
    setErr("");
    setOpenId(c.id);
    if (!c.dossier) runDossier(c);
  }

  async function runOutreach(c: BoardCandidate) {
    if (runningOutreach.current.has(c.id)) return; // уже генерируется
    runningOutreach.current.add(c.id);
    setOutLoading(true);
    setOutErr("");
    try {
      const dossierSummary = c.dossier
        ? [c.dossier.recommendation, ...c.dossier.findings.map((f) => f.text)].join(" ")
        : c.note || "";
      const d = await postJson<OutreachResult>("/api/outreach", {
        name: c.name,
        role: c.role,
        context: dossierContext,
        dossierSummary,
      });
      onUpdateCandidate(c.id, { outreach: d });
    } catch (e) {
      setOutErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      runningOutreach.current.delete(c.id);
      setOutLoading(false);
    }
  }

  function openOutreach(c: BoardCandidate) {
    setOutErr("");
    setOutId(c.id);
    if (!c.outreach) runOutreach(c);
  }

  return (
    <div>
      <ManualAdd name={name} role={role} setName={setName} setRole={setRole} add={addManual} />

      <PotokPanel
        candidates={position.candidates}
        dossierContext={dossierContext}
        onUpdateCandidate={onUpdateCandidate}
      />

      {position.candidates.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-ink/15 bg-white/50 p-8 text-center">
          <div className="text-2xl">🗂</div>
          <p className="mt-2 text-sm font-semibold text-ink">Доска пуста</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink/55">
            Кандидаты попадают сюда кнопкой «+ на доску» на вкладках «Кандидаты» и
            «Сравнение резюме». Или добавьте вручную полем выше.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {STAGES.map((st) => {
            const cards = position.candidates.filter((c) => c.stage === st.id);
            const s = STAGE_STYLE[st.id];
            return (
              <div
                key={st.id}
                className={`overflow-hidden rounded-xl border ${s.border} ${s.bg}`}
              >
                {/* Цветная полоса сверху: этап читается боковым зрением,
                    не приходится вчитываться в заголовок каждой колонки. */}
                <div className={`h-1 w-full ${s.bar}`} />
                <div className="p-2">
                  <div className="mb-2 flex items-center justify-between px-1 py-1">
                    <span className={`text-sm font-semibold ${s.text}`}>{st.label}</span>
                    <span
                      className={`rounded-full px-2 text-xs font-semibold tabular-nums ${
                        cards.length ? s.pill : "bg-ink/8 text-ink/40"
                      }`}
                    >
                      {cards.length}
                    </span>
                  </div>
                  <div className="stagger space-y-2">
                    {cards.map((c) => (
                      <Card
                        key={c.id}
                        c={c}
                        onUpdate={(patch) => onUpdateCandidate(c.id, patch)}
                        onRemove={() => onRemoveCandidate(c.id)}
                        onDossier={() => openDossier(c)}
                        onOutreach={() => openOutreach(c)}
                      />
                    ))}
                    {cards.length === 0 && (
                      <div className="rounded-lg border border-dashed border-ink/10 px-2 py-4 text-center text-xs text-ink/35">
                        пусто
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openId && openCand && (
        <DossierModal
          name={openCand.name}
          dossier={(openCand.dossier as (Dossier & { demo?: boolean }) | undefined) || null}
          loading={loading}
          err={err}
          onClose={() => {
            setOpenId(null);
            setErr("");
          }}
          onRefresh={() => runDossier(openCand)}
        />
      )}

      {outId && outCand && (
        <OutreachModal
          name={outCand.name}
          data={(outCand.outreach as (OutreachResult & { demo?: boolean }) | undefined) || null}
          loading={outLoading}
          err={outErr}
          onClose={() => {
            setOutId(null);
            setOutErr("");
          }}
          onRefresh={() => runOutreach(outCand)}
        />
      )}
    </div>
  );
}

/**
 * Цвета этапов. Классы перечислены целиком, а не собраны из кусков строк:
 * Tailwind вырезает всё, чего не видит в исходнике, и динамическое
 * `bg-stage-${id}` молча не доедет до сборки.
 */
const STAGE_STYLE: Record<Stage, {
  bar: string; bg: string; border: string; text: string; pill: string; edge: string;
}> = {
  longlist: {
    bar: "bg-stage-longlist", bg: "bg-stage-longlist/5", border: "border-stage-longlist/20",
    text: "text-stage-longlist", pill: "bg-stage-longlist/15 text-stage-longlist",
    edge: "border-l-stage-longlist",
  },
  outreach: {
    bar: "bg-stage-outreach", bg: "bg-stage-outreach/5", border: "border-stage-outreach/20",
    text: "text-stage-outreach", pill: "bg-stage-outreach/15 text-stage-outreach",
    edge: "border-l-stage-outreach",
  },
  interview: {
    bar: "bg-stage-interview", bg: "bg-stage-interview/5", border: "border-stage-interview/20",
    text: "text-stage-interview", pill: "bg-stage-interview/15 text-stage-interview",
    edge: "border-l-stage-interview",
  },
  final: {
    bar: "bg-stage-final", bg: "bg-stage-final/5", border: "border-stage-final/20",
    text: "text-stage-final", pill: "bg-stage-final/15 text-stage-final",
    edge: "border-l-stage-final",
  },
  rejected: {
    bar: "bg-stage-rejected", bg: "bg-stage-rejected/5", border: "border-stage-rejected/20",
    text: "text-stage-rejected", pill: "bg-stage-rejected/15 text-stage-rejected",
    edge: "border-l-stage-rejected",
  },
};

interface PotokJob {
  id: number;
  name: string;
}

interface ExportResult {
  candidateId: string;
  name: string;
  potokId?: number;
  ok: boolean;
  error?: string;
  warning?: string;
  dossier?: Dossier;
}

/**
 * Выгрузка кандидатов с доски в ATS «Поток». Панель скрыта, если интеграция
 * не настроена (нет POTOK_TOKEN) — тогда /api/potok/jobs отвечает 400.
 */
function PotokPanel({
  candidates,
  dossierContext,
  onUpdateCandidate,
}: {
  candidates: BoardCandidate[];
  dossierContext: string;
  onUpdateCandidate: (candId: string, patch: Partial<BoardCandidate>) => void;
}) {
  const [jobs, setJobs] = useState<PotokJob[] | null>(null);
  const [jobId, setJobId] = useState<string>("");
  const [withDossier, setWithDossier] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/potok/jobs")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setJobs(d.jobs || []))
      .catch(() => alive && setJobs(null));
    return () => {
      alive = false;
    };
  }, []);

  const pending = candidates.filter((c) => !c.potokId);
  const needDossier = pending.filter((c) => !c.dossier).length;

  const send = useCallback(
    async (list: BoardCandidate[]) => {
      if (list.length === 0 || busy) return;
      setBusy(true);
      setMsg("");
      setErr("");
      try {
        const d = await postJson<{
          results: ExportResult[];
          sent: number;
          failed: number;
          dossiersCollected: number;
        }>("/api/potok/export", {
          candidates: list,
          jobId: jobId ? Number(jobId) : undefined,
          context: dossierContext,
          withDossier,
        });

        for (const r of d.results || []) {
          const patch: Partial<BoardCandidate> = {};
          if (r.ok && r.potokId) patch.potokId = r.potokId;
          if (r.dossier) patch.dossier = r.dossier; // не платить за досье дважды
          if (Object.keys(patch).length) onUpdateCandidate(r.candidateId, patch);
        }

        const parts = [`Выгружено в Поток: ${d.sent ?? 0}`];
        if (d.dossiersCollected) parts.push(`собрано досье: ${d.dossiersCollected}`);
        setMsg(parts.join(", ") + ".");

        const bad = (d.results || []).filter((r) => !r.ok || r.warning);
        if (bad.length) {
          setErr(
            bad
              .map((f) => `${f.name} — ${f.error || f.warning}`)
              .join("; "),
          );
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Ошибка выгрузки");
      } finally {
        setBusy(false);
      }
    },
    [busy, jobId, dossierContext, withDossier, onUpdateCandidate],
  );

  // Интеграция не настроена или Поток недоступен — панель не мешается.
  if (jobs === null) return null;

  return (
    <div className="mt-3 rounded-xl border border-ink/10 bg-paper/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink">ATS «Поток»</span>
        <select
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          className="min-w-[220px] rounded-lg border border-ink/15 bg-white px-2 py-1.5 text-sm text-ink/80 outline-none focus:border-accent"
        >
          <option value="">Без привязки к вакансии</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => send(pending)}
          disabled={busy || pending.length === 0}
          className="pressable rounded-lg bg-accent px-3 py-1.5 text-sm text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Выгружаю…" : `Выгрузить в Поток (${pending.length})`}
        </button>
        {candidates.length > pending.length && (
          <span className="text-xs text-ink/50">
            уже в Потоке: {candidates.length - pending.length}
          </span>
        )}
      </div>

      <label className="mt-2 flex items-start gap-2 text-xs text-ink/70">
        <input
          type="checkbox"
          checked={withDossier}
          onChange={(e) => setWithDossier(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Собирать OSINT-досье тем, у кого его нет
          {withDossier && needDossier > 0 && (
            <b className="text-ink"> — сейчас это {needDossier} чел.</b>
          )}
          <br />
          <span className="text-ink/50">
            Досье — самая долгая и дорогая операция (веб-поиск по каждому человеку).
            Готовые досье не пересобираются, а собранные здесь сохранятся на доске.
          </span>
        </span>
      </label>

      <p className="mt-1.5 text-xs text-ink/50">
        Кандидаты заводятся как найденные прямым поиском (source_type: sourced). В карточку
        попадают публичные ссылки, находки досье с датами и источниками, красные флаги,
        вывод для ГД и ваша заметка.
      </p>
      {msg && <p className="mt-1.5 text-xs text-green-700">{msg}</p>}
      {err && <p className="mt-1.5 text-xs text-red-600">{err}</p>}
    </div>
  );
}

function ManualAdd({
  name,
  role,
  setName,
  setRole,
  add,
}: {
  name: string;
  role: string;
  setName: (v: string) => void;
  setRole: (v: string) => void;
  add: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Имя кандидата"
        className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm outline-none focus:border-accent"
      />
      <input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="Позиция / компания"
        className="min-w-[220px] flex-1 rounded-lg border border-ink/15 px-3 py-1.5 text-sm outline-none focus:border-accent"
      />
      <button
        onClick={add}
        className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm text-ink/70 hover:bg-white"
      >
        + Добавить вручную
      </button>
    </div>
  );
}

function Card({
  c,
  onUpdate,
  onRemove,
  onDossier,
  onOutreach,
}: {
  c: BoardCandidate;
  onUpdate: (patch: Partial<BoardCandidate>) => void;
  onRemove: () => void;
  onDossier: () => void;
  onOutreach: () => void;
}) {
  // Балл соответствия — цветом, а не только цифрой: 34 карточки глазами
  // не отсортируешь, а красное/зелёное считывается мгновенно.
  const scoreCls =
    typeof c.score !== "number"
      ? ""
      : c.score >= 75
        ? "bg-green-100 text-green-800"
        : c.score >= 50
          ? "bg-amber-100 text-amber-800"
          : "bg-red-100 text-red-700";

  return (
    <div
      className={`card-hover rounded-lg border border-l-[3px] border-ink/10 bg-white p-3 shadow-card ${
        STAGE_STYLE[c.stage]?.edge || ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold leading-snug text-ink">{c.name}</div>
        <div className="flex shrink-0 items-center gap-1">
          {c.potokId && (
            <SafeLink
              url={`https://app.potok.io/applicants/${c.potokId}`}
              className="rounded bg-green-100 px-1.5 text-xs font-medium text-green-700"
            >
              Поток ✓
            </SafeLink>
          )}
          {typeof c.score === "number" && (
            <span
              className={`rounded px-1.5 text-xs font-semibold tabular-nums ${scoreCls}`}
              title="Соответствие брифу"
            >
              {c.score}
            </span>
          )}
        </div>
      </div>
      {c.role && <div className="mt-0.5 text-xs leading-snug text-ink/60">{c.role}</div>}
      <input
        defaultValue={c.note}
        onBlur={(e) => e.target.value !== c.note && onUpdate({ note: e.target.value })}
        placeholder="заметка…"
        className="mt-2 w-full rounded border border-ink/10 px-2 py-1 text-xs outline-none focus:border-accent"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <select
          value={c.stage}
          onChange={(e) => onUpdate({ stage: e.target.value as Stage })}
          className="rounded border border-ink/15 bg-white px-1.5 py-1 text-xs text-ink/70 outline-none"
        >
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          {c.source && (
            <SafeLink
              url={c.source}
              whenUnsafe={null}
              className="text-xs text-accent underline underline-offset-2"
            >
              источник
            </SafeLink>
          )}
          <button
            onClick={onRemove}
            className="text-xs text-ink/40 hover:text-red-600"
            title="Убрать"
          >
            ✕
          </button>
        </div>
      </div>
      <button
        onClick={onDossier}
        className={`pressable mt-2 w-full rounded-md border px-2 py-1 text-xs transition-colors ${
          c.dossier
            ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
            : "border-ink/15 text-ink/60 hover:bg-paper"
        }`}
      >
        {c.dossier ? "★ Досье собрано — открыть" : "Собрать OSINT-досье"}
      </button>
      <button
        onClick={onOutreach}
        className={`pressable mt-1.5 w-full rounded-md border px-2 py-1 text-xs transition-colors ${
          c.outreach
            ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
            : "border-ink/15 text-ink/60 hover:bg-paper"
        }`}
      >
        {c.outreach ? "✉ Письма готовы — открыть" : "✉ Письма для аутрича"}
      </button>
    </div>
  );
}
