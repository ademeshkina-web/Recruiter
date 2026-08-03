"use client";

import { useState } from "react";
import { OutreachResult } from "@/lib/types";

export default function OutreachModal({
  name,
  data,
  loading,
  err,
  onClose,
  onRefresh,
}: {
  name: string;
  data: (OutreachResult & { demo?: boolean }) | null;
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
        className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-ink/40">Мотивация и письма для аутрича</div>
            <h3 className="text-lg font-bold text-ink">{name}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-ink/15 px-2 py-1 text-sm text-ink/60 hover:bg-paper"
          >
            Закрыть
          </button>
        </div>

        {loading && <p className="mt-6 text-sm text-ink/60">Собираю гипотезы мотивации и письма…</p>}
        {err && <p className="mt-6 text-sm text-red-600">{err}</p>}

        {data && !loading && (
          <div className="mt-5 space-y-4">
            {data.demo && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                Демо. Персонализация под кандидата включается при заданном ANTHROPIC_API_KEY.
              </div>
            )}

            {data.motivation_hypotheses && data.motivation_hypotheses.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase text-ink/40">
                  Мотивация и как зайти (гипотезы)
                </div>
                <div className="space-y-3">
                  {data.motivation_hypotheses.map((h, i) => (
                    <div key={i} className="rounded-xl border border-ink/10 bg-paper/50 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-ink">
                          {i === 0 && <span className="mr-1 text-accent">★</span>}
                          {h.motivation}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-ink/50">
                        <span className="font-medium">На чём гипотеза:</span> {h.basis}
                      </p>
                      <p className="mt-1 text-sm text-ink/80">
                        <span className="font-medium">Как зайти:</span> {h.approach}
                      </p>
                      {h.hook_text && (
                        <div className="mt-2 flex items-start justify-between gap-2 rounded-lg bg-white px-3 py-2">
                          <p className="whitespace-pre-wrap text-sm italic leading-relaxed text-ink/90">
                            {h.hook_text}
                          </p>
                          <CopyBtn text={h.hook_text} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.messages.length > 0 && (
              <div className="mb-1 text-xs font-semibold uppercase text-ink/40">Сообщения</div>
            )}
            {data.messages.map((m, i) => (
              <div key={i} className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">{m.channel}</span>
                  <CopyBtn text={m.text} />
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{m.text}</p>
              </div>
            ))}
            <div className="flex justify-end">
              <button
                onClick={onRefresh}
                className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm text-ink/70 hover:bg-paper"
              >
                Сгенерировать заново
              </button>
            </div>
          </div>
        )}

        {!data && !loading && !err && (
          <p className="mt-6 text-sm text-ink/60">Письма ещё не сгенерированы.</p>
        )}
      </div>
    </div>
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
