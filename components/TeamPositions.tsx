"use client";

import { useEffect, useState } from "react";
import { STAGES, Stage } from "@/lib/types";

/**
 * Витрина позиций команды. Показывает, кто какую роль ведёт и как заполнена
 * воронка — но НЕ кандидатов: их имена, досье и заметки остаются в аккаунте
 * владельца. Цель — видеть загрузку коллег и не искать одно и то же дважды.
 */

interface TeamPosition {
  id: string;
  title: string;
  company: string;
  owner: string;
  isMine: boolean;
  candidates: number;
  byStage: Record<Stage, number>;
  dossiers: number;
  outreach: number;
  hasStrategy: boolean;
  updatedAt: number;
}

const STAGE_DOT: Record<Stage, string> = {
  longlist: "bg-stage-longlist",
  outreach: "bg-stage-outreach",
  interview: "bg-stage-interview",
  final: "bg-stage-final",
  rejected: "bg-stage-rejected",
};

function ago(ts: number) {
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) return "сегодня";
  if (d === 1) return "вчера";
  if (d < 7) return `${d} дн. назад`;
  return new Date(ts).toLocaleDateString("ru-RU");
}

export default function TeamPositions() {
  const [rows, setRows] = useState<TeamPosition[] | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || rows) return;
    let alive = true;
    fetch("/api/positions/team")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Не удалось загрузить");
        return d;
      })
      .then((d) => alive && setRows(d.positions || []))
      .catch((e) => alive && setErr(e instanceof Error ? e.message : "Ошибка"));
    return () => {
      alive = false;
    };
  }, [open, rows]);

  const others = (rows || []).filter((r) => !r.isMine);

  return (
    <div className="mt-10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="pressable flex items-center gap-2 text-sm font-semibold text-ink/70 transition-colors hover:text-ink"
      >
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
        Позиции команды
        {rows && <span className="text-ink/40">· {others.length} у коллег</span>}
      </button>

      {open && (
        <div className="mt-3">
          {err && <p className="text-sm text-red-600">{err}</p>}
          {!rows && !err && <p className="text-sm text-ink/45">Загружаю…</p>}

          {rows && others.length === 0 && (
            <p className="rounded-xl border border-dashed border-ink/15 bg-white/50 p-6 text-center text-sm text-ink/50">
              У коллег пока нет позиций. Здесь появится, кто чем занят, — чтобы не искать
              одно и то же дважды.
            </p>
          )}

          {rows && others.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-xl border border-ink/10 bg-white shadow-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-ink/45">
                      <th className="px-4 py-2.5 font-medium">Позиция</th>
                      <th className="px-4 py-2.5 font-medium">Рекрутёр</th>
                      <th className="px-4 py-2.5 font-medium">Воронка</th>
                      <th className="px-4 py-2.5 text-right font-medium">Досье</th>
                      <th className="px-4 py-2.5 text-right font-medium">Активность</th>
                    </tr>
                  </thead>
                  <tbody className="stagger">
                    {others.map((p) => (
                      <tr key={p.id} className="border-b border-ink/6 last:border-0">
                        <td className="px-4 py-3">
                          <div className="font-medium text-ink">{p.title}</div>
                          <div className="text-xs text-ink/45">
                            {p.company || "без компании"}
                            {!p.hasStrategy && " · черновик"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink/70">{p.owner}</td>
                        <td className="px-4 py-3">
                          {p.candidates === 0 ? (
                            <span className="text-xs text-ink/35">нет кандидатов</span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              {STAGES.map((s) =>
                                p.byStage[s.id] ? (
                                  <span
                                    key={s.id}
                                    className="flex items-center gap-1 text-xs text-ink/60"
                                    title={s.label}
                                  >
                                    <span className={`h-2 w-2 rounded-full ${STAGE_DOT[s.id]}`} />
                                    {p.byStage[s.id]}
                                  </span>
                                ) : null,
                              )}
                              <span className="text-xs text-ink/35">всего {p.candidates}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-ink/60">
                          {p.dossiers || "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-ink/45">
                          {ago(p.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-ink/45">
                Видно загрузку коллег и заполненность воронки. Кандидаты, досье и заметки
                остаются в аккаунте владельца позиции и здесь не показываются.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
