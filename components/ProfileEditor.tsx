"use client";

import { useEffect, useState } from "react";

/**
 * Профиль рекрутёра: ФИО, должность, Telegram. ФИО нужно, чтобы коллеги
 * выбирали друг друга по имени, а не по почте.
 */
export default function ProfileEditor({ email, onClose }: { email: string; onClose: () => void }) {
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [telegram, setTelegram] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!alive) return;
        setFullName(d.fullName || "");
        setJobTitle(d.jobTitle || "");
        setTelegram(d.telegram || "");
        setLoaded(true);
      })
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, jobTitle, telegram }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Не удалось сохранить");
      setTelegram(d.telegram || "");
      setMsg("Профиль сохранён.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-16">
      <div className="w-full max-w-lg rounded-xl border border-ink/10 bg-white p-5 shadow-lift">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-base font-semibold text-ink">Мой профиль</h3>
          <button onClick={onClose} className="text-sm text-ink/45 hover:text-ink">
            Закрыть
          </button>
        </div>
        <p className="mt-1 text-xs text-ink/50">{email}</p>

        {!loaded ? (
          <p className="mt-4 text-sm text-ink/45">Загружаю…</p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-sm text-ink/70">ФИО</span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Демешкина Анна Сергеевна"
                className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <span className="mt-1 block text-xs text-ink/45">
                По нему коллеги будут выбирать вас при передаче позиции.
              </span>
            </label>

            <label className="block">
              <span className="text-sm text-ink/70">Должность</span>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Руководитель подбора"
                className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </label>

            <label className="block">
              <span className="text-sm text-ink/70">Telegram</span>
              <input
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="@username"
                className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <span className="mt-1 block text-xs text-ink/45">
                Можно вставить ссылку t.me/… — приведём к виду @username. Если имени
                пользователя нет, его задают в самом Telegram: Настройки → Имя пользователя.
                Назначить его за человека нельзя, поле необязательное.
              </span>
            </label>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={save}
                disabled={busy}
                className="pressable rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {busy ? "Сохраняю…" : "Сохранить"}
              </button>
              {msg && <span className="text-sm text-green-700">{msg}</span>}
              {err && <span className="text-sm text-red-600">{err}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
