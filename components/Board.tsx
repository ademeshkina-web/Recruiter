"use client";

import { useState } from "react";
import { BoardCandidate, Dossier, OutreachResult, Position, Stage, STAGES } from "@/lib/types";
import { uid } from "@/lib/store";
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
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/dossier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: c.name, role: c.role, context: dossierContext }),
      });
      const d = (await res.json()) as Dossier & { error?: string };
      if (!res.ok) throw new Error(d.error || "Ошибка");
      onUpdateCandidate(c.id, { dossier: d });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  function openDossier(c: BoardCandidate) {
    setErr("");
    setOpenId(c.id);
    if (!c.dossier) runDossier(c);
  }

  async function runOutreach(c: BoardCandidate) {
    setOutLoading(true);
    setOutErr("");
    try {
      const dossierSummary = c.dossier
        ? [c.dossier.recommendation, ...c.dossier.findings.map((f) => f.text)].join(" ")
        : c.note || "";
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: c.name, role: c.role, context: dossierContext, dossierSummary }),
      });
      const d = (await res.json()) as OutreachResult & { error?: string };
      if (!res.ok) throw new Error(d.error || "Ошибка");
      onUpdateCandidate(c.id, { outreach: d });
    } catch (e) {
      setOutErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
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

      {position.candidates.length === 0 ? (
        <p className="mt-6 text-sm text-ink/50">
          Доска пуста. Добавляйте кандидатов кнопкой «+ на доску» на вкладках
          «Кандидаты» и «Сравнение резюме» — или вручную выше.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {STAGES.map((st) => {
            const cards = position.candidates.filter((c) => c.stage === st.id);
            return (
              <div key={st.id} className="rounded-xl border border-ink/10 bg-paper/60 p-2">
                <div className="mb-2 flex items-center justify-between px-1 py-1">
                  <span className="text-sm font-semibold text-ink">{st.label}</span>
                  <span className="rounded-full bg-ink/10 px-2 text-xs text-ink/60">
                    {cards.length}
                  </span>
                </div>
                <div className="space-y-2">
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
  return (
    <div className="rounded-lg border border-ink/10 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-ink">{c.name}</div>
        {typeof c.score === "number" && (
          <span className="shrink-0 rounded bg-accentsoft px-1.5 text-xs text-ink/70">
            {c.score}
          </span>
        )}
      </div>
      {c.role && <div className="mt-0.5 text-xs text-ink/60">{c.role}</div>}
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
            <a
              href={c.source}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent underline underline-offset-2"
            >
              источник
            </a>
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
        className={`mt-2 w-full rounded-md border px-2 py-1 text-xs transition ${
          c.dossier
            ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
            : "border-ink/15 text-ink/60 hover:bg-paper"
        }`}
      >
        {c.dossier ? "★ Досье собрано — открыть" : "Собрать OSINT-досье"}
      </button>
      <button
        onClick={onOutreach}
        className={`mt-1.5 w-full rounded-md border px-2 py-1 text-xs transition ${
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
