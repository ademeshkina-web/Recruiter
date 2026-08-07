"use client";

import { useState } from "react";
import { postJson } from "@/lib/client";

/**
 * Передача копии позиции коллеге. Копия, а не общий доступ: коллега получает
 * готовую стратегию и найденных кандидатов и работает параллельно, не запуская
 * поиск заново — то есть не оплачивая те же токены второй раз.
 */
export default function SharePosition({
  positionId,
  title,
  candidates,
}: {
  positionId: string;
  title: string;
  candidates: number;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function send() {
    if (!email.trim() || busy) return;
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const d = await postJson<{ to: string; candidates: number }>("/api/positions/share", {
        positionId,
        email: email.trim(),
      });
      setMsg(`Копия передана: ${d.to}. Кандидатов в копии: ${d.candidates}.`);
      setEmail("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось передать");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="pressable rounded-lg border border-ink/15 px-3 py-1.5 text-sm text-ink/70 transition-colors hover:bg-paper"
        title="Передать копию позиции коллеге"
      >
        ↗ Передать коллеге
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-ink/10 bg-white p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-ink">Передать копию коллеге</span>
        <button
          onClick={() => { setOpen(false); setErr(""); setMsg(""); }}
          className="text-xs text-ink/45 hover:text-ink"
        >
          закрыть
        </button>
      </div>
      <p className="mt-1 text-xs text-ink/55">
        «{title}» — стратегия, {candidates} кандидат(ов), собранные досье и письма. Коллега
        продолжит в своём кабинете, не запуская поиск заново.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="e-mail рекрутёра"
          type="email"
          className="min-w-[240px] flex-1 rounded-lg border border-ink/15 px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={send}
          disabled={busy || !email.trim()}
          className="pressable rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Передаю…" : "Передать"}
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-green-700">{msg}</p>}
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      <p className="mt-2 text-xs text-ink/45">
        Дальше две доски живут независимо: правки коллеги не меняют вашу и наоборот.
      </p>
    </div>
  );
}
