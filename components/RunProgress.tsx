"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Ход длинной операции. Модель отвечает одним куском, реального процента
 * прогресса взять неоткуда — поэтому показываем то, что знаем точно: какой шаг
 * идёт, сколько он уже длится и сколько обычно занимает. Фальшивая полоса,
 * замирающая на 99%, раздражает сильнее честного таймера.
 */

export interface RunStep {
  n: number;
  label: string;
  hint: string;
  /** Сколько обычно длится, в секундах — по замерам на реальных прогонах. */
  typical: number;
}

export const RUN_STEPS: RunStep[] = [
  { n: 1, label: "Вакансия, сильный бриф и стратегия", hint: "разбираю бриф и собираю стратегию поиска", typical: 180 },
  { n: 2, label: "Кандидаты из открытых источников", hint: "ищу людей по открытым источникам", typical: 300 },
];

function mmss(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function RunProgress({
  phase,
  steps = RUN_STEPS,
}: {
  phase: number;
  steps?: RunStep[];
}) {
  const [now, setNow] = useState(0); // секунд с начала шага
  const [total, setTotal] = useState(0); // секунд с начала прогона
  const stepStart = useRef<number>(Date.now());
  const runStart = useRef<number>(Date.now());
  const prevPhase = useRef<number>(phase);

  useEffect(() => {
    if (phase > 0 && prevPhase.current === 0) runStart.current = Date.now();
    if (phase !== prevPhase.current) stepStart.current = Date.now();
    prevPhase.current = phase;
  }, [phase]);

  useEffect(() => {
    if (phase === 0) return;
    const t = setInterval(() => {
      setNow(Math.floor((Date.now() - stepStart.current) / 1000));
      setTotal(Math.floor((Date.now() - runStart.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  if (phase === 0) return null;

  const active = steps.find((s) => s.n === phase);
  const overdue = active ? now > active.typical * 1.5 : false;

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card">
      {/* Неопределённая полоса: честно сообщает «идёт работа», не притворяясь,
          что знает процент. */}
      <div className="h-0.5 w-full overflow-hidden bg-accentsoft">
        <div className="run-bar h-full w-1/3 bg-accent" />
      </div>

      <div className="p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-ink">
            {active ? active.hint.charAt(0).toUpperCase() + active.hint.slice(1) : "Работаю"}…
          </span>
          <span className="tabular-nums text-xs text-ink/45">всего {mmss(total)}</span>
        </div>

        <ul className="space-y-2.5">
          {steps.map((s) => {
            const status = phase > s.n ? "done" : phase === s.n ? "active" : "pending";
            return (
              <li key={s.n} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    status === "done"
                      ? "bg-green-500 text-white"
                      : status === "active"
                        ? "bg-accent text-white"
                        : "bg-ink/10 text-ink/40"
                  }`}
                >
                  {status === "done" ? "✓" : status === "active" ? <Spinner /> : s.n}
                </span>
                <span
                  className={
                    status === "pending"
                      ? "text-ink/40"
                      : status === "done"
                        ? "text-ink/55"
                        : "font-medium text-ink"
                  }
                >
                  {s.label}
                </span>
                {status === "active" && (
                  <span className="ml-auto shrink-0 tabular-nums text-xs text-ink/45">
                    {mmss(now)} <span className="text-ink/30">/ ~{mmss(s.typical)}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-3 border-t border-ink/8 pt-3 text-xs text-ink/50">
          {overdue
            ? "Идёт дольше обычного — модель всё ещё работает. Это бывает на сложных брифах, отменять не нужно."
            : "Не закрывайте вкладку: результат придёт одним ответом и сразу сохранится в позицию."}
        </p>
      </div>
    </div>
  );
}

/** Быстрый спиннер: чем быстрее вращение, тем быстрее ощущается ожидание. */
function Spinner() {
  return (
    <span className="block h-2.5 w-2.5 animate-[spin_700ms_linear_infinite] rounded-full border-[1.5px] border-white/40 border-t-white" />
  );
}
