"use client";

import { useEffect, useState } from "react";
import { postJson } from "@/lib/client";
import { STAGES } from "@/lib/types";

type Stats = {
  positions: number;
  candidates: number;
  byStage: Record<string, number>;
  dossiers: number;
  outreach: number;
  lastActivity: number;
};
type AdminUser = {
  id: string;
  email: string;
  isAdmin: boolean;
  disabled: boolean;
  createdAt: number;
  stats: Stats;
};

function fmtDate(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default function AdminScreen() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [meId, setMeId] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(""); // userId+action, пока действие выполняется
  const [temp, setTemp] = useState<{ email: string; pw: string } | null>(null);

  async function load() {
    setErr("");
    try {
      const r = await fetch("/api/admin/users");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Ошибка загрузки");
      setUsers(d.users);
      setMeId(d.me);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function act(u: AdminUser, action: string, value?: boolean, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(u.id + action);
    setErr("");
    try {
      const d = await postJson<{ tempPassword?: string }>("/api/admin/user", {
        userId: u.id,
        action,
        value,
      });
      if (action === "resetPassword" && d.tempPassword) {
        setTemp({ email: u.email, pw: d.tempPassword });
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy("");
    }
  }

  if (!users) {
    return <div className="text-sm text-ink/40">{err || "Загрузка…"}</div>;
  }

  const totalPos = users.reduce((s, u) => s + u.stats.positions, 0);
  const totalCand = users.reduce((s, u) => s + u.stats.candidates, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">Админка · рекрутёры и результативность</h2>
        <p className="mt-1 text-sm text-ink/60">
          Управление доступами и активность каждого рекрутёра. Данные считаются из позиций.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Tile label="Рекрутёров" value={users.length} />
        <Tile label="Позиций всего" value={totalPos} />
        <Tile label="Кандидатов всего" value={totalCand} />
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3">Рекрутёр</th>
              <th className="px-4 py-3">Позиции</th>
              <th className="px-4 py-3">Кандидаты</th>
              <th className="px-4 py-3">Досье</th>
              <th className="px-4 py-3">Письма</th>
              <th className="px-4 py-3">Активность</th>
              <th className="px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === meId;
              return (
                <tr key={u.id} className="border-t border-ink/10 align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">{u.email}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {u.isAdmin && (
                        <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[11px] text-accent">
                          админ
                        </span>
                      )}
                      {u.disabled && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] text-red-700">
                          отключён
                        </span>
                      )}
                      {self && <span className="text-[11px] text-ink/40">это вы</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink/80">{u.stats.positions}</td>
                  <td className="px-4 py-3 text-ink/80">
                    {u.stats.candidates}
                    <div className="mt-0.5 text-[11px] text-ink/40">
                      {STAGES.map((s) => `${s.label.split(" ")[0]}: ${u.stats.byStage[s.id] || 0}`).join(" · ")}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink/80">{u.stats.dossiers}</td>
                  <td className="px-4 py-3 text-ink/80">{u.stats.outreach}</td>
                  <td className="px-4 py-3 text-ink/70">{fmtDate(u.stats.lastActivity)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <ActBtn
                        label={u.isAdmin ? "Снять админа" : "Сделать админом"}
                        disabled={self || busy === u.id + "setAdmin"}
                        onClick={() => act(u, "setAdmin", !u.isAdmin)}
                      />
                      <ActBtn
                        label={u.disabled ? "Включить" : "Отключить"}
                        disabled={self || busy === u.id + "setDisabled"}
                        onClick={() =>
                          act(
                            u,
                            "setDisabled",
                            !u.disabled,
                            u.disabled ? undefined : `Отключить доступ ${u.email}?`,
                          )
                        }
                      />
                      <ActBtn
                        label="Сбросить пароль"
                        disabled={busy === u.id + "resetPassword"}
                        onClick={() =>
                          act(u, "resetPassword", undefined, `Сбросить пароль ${u.email}?`)
                        }
                      />
                      <ActBtn
                        label="Удалить"
                        danger
                        disabled={self || busy === u.id + "delete"}
                        onClick={() =>
                          act(
                            u,
                            "delete",
                            undefined,
                            `Удалить ${u.email} и все его позиции без возврата?`,
                          )
                        }
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {temp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-ink">Временный пароль</h3>
            <p className="mt-1 text-sm text-ink/60">
              Передайте его рекрутёру <b>{temp.email}</b>. Пусть войдёт и сменит пароль. Пароль
              показывается один раз.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-paper px-3 py-2 text-sm">{temp.pw}</code>
              <button
                onClick={() => navigator.clipboard?.writeText(temp.pw)}
                className="rounded-lg border border-ink/15 px-3 py-2 text-sm hover:bg-paper"
              >
                Копировать
              </button>
            </div>
            <button
              onClick={() => setTemp(null)}
              className="mt-4 w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Готово
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4">
      <div className="text-2xl font-bold text-ink">{value}</div>
      <div className="text-xs text-ink/50">{label}</div>
    </div>
  );
}

function ActBtn({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-2.5 py-1 text-xs transition disabled:opacity-30 ${
        danger
          ? "border-red-200 text-red-700 hover:bg-red-50"
          : "border-ink/15 text-ink/70 hover:bg-paper"
      }`}
    >
      {label}
    </button>
  );
}
