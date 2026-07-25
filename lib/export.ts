"use client";

import { AnalyzeResult, Position, STAGES } from "./types";

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slug(s: string): string {
  return (s || "position").replace(/[^\wА-Яа-яё-]+/g, "_").slice(0, 40);
}

// ---- Markdown (бриф + вакансия + стратегия) ----

export function buildMarkdown(p: Position): string {
  const a = p.analyze;
  const L: string[] = [];
  L.push(`# ${a?.role_title || p.title}`);
  if (p.company) L.push(`_${p.company}_`);
  if (a?.headline) L.push(`\n> ${a.headline}\n`);

  if (a) {
    L.push(`\n## Текст вакансии\n`);
    L.push(`### Для публикации\n${a.vacancy.energetic}`);
    L.push(`\n### Корпоративный вариант (hh.ru)\n${a.vacancy.formal}`);
    L.push(`\n### Короткий тизер\n${a.vacancy.short}`);

    const b = a.brief;
    L.push(`\n## Сильный бриф\n`);
    L.push(`**Контекст.** ${b.context}`);
    L.push(`\n**Почему ищем.** ${b.why_searching}`);
    L.push(`\n**Рамка роли.** _${b.role_frame}_`);
    L.push(`\n**Ключевые задачи (6–12 мес.):**`);
    b.key_tasks.forEach((x) => L.push(`- ${x}`));
    L.push(`\n**Профиль (must-have):**`);
    b.must_have.forEach((x) => L.push(`- ${x}`));
    L.push(`\n**Стоп-факторы (анти-профиль):**`);
    b.anti_profile.forEach((x) => L.push(`- ${x}`));
    L.push(`\n**Метрики:**`);
    b.metrics.forEach((x) => L.push(`- ${x}`));
    L.push(`\n**Условия.** ${b.conditions}`);
    L.push(`\n**Реализм рынка.** ${a.market_reality}`);

    const s = a.sourcing;
    L.push(`\n## Стратегия сорсинга\n`);
    L.push(`**Смежные пулы:**`);
    s.adjacent_pools.forEach((x) => L.push(`- **${x.name}** — ${x.why}`));
    L.push(`\n**Компании-доноры:**`);
    s.donor_companies.forEach((x) => L.push(`- **${x.name}** — ${x.why}`));
    L.push(`\n**Сигналы-триггеры:**`);
    s.trigger_signals.forEach((x) => L.push(`- ${x}`));
    L.push(`\n**Каналы:**`);
    s.channels.forEach((c) => L.push(`- **${c.name}** (${c.type}) — ${c.why}`));
    L.push(`\n**Реферальные ходы:**`);
    s.referral_moves.forEach((x) => L.push(`- ${x}`));
    L.push(`\n**Boolean / X-ray:**`);
    s.boolean_strings.forEach((x) => L.push(`- \`${x}\``));
  }

  if (p.candidates.length) {
    L.push(`\n## Доска кандидатов\n`);
    STAGES.forEach((st) => {
      const inStage = p.candidates.filter((c) => c.stage === st.id);
      if (!inStage.length) return;
      L.push(`\n### ${st.label}`);
      inStage.forEach((c) => {
        const score = typeof c.score === "number" ? ` · ${c.score}/100` : "";
        L.push(`- **${c.name}**${score} — ${c.role}${c.note ? ` — ${c.note}` : ""}${c.source ? ` (${c.source})` : ""}`);
      });
    });
  }

  return L.join("\n");
}

export function exportMarkdown(p: Position) {
  const blob = new Blob([buildMarkdown(p)], { type: "text/markdown;charset=utf-8" });
  download(`${slug(p.analyze?.role_title || p.title)}.md`, blob);
}

// ---- CSV доски кандидатов ----

export function exportCandidatesCsv(p: Position) {
  const stageLabel = (id: string) => STAGES.find((s) => s.id === id)?.label || id;
  const esc = (v: string | number | undefined) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [
    ["Этап", "Имя", "Позиция/компания", "Соответствие", "Источник", "Заметка", "Добавлен"].join(";"),
    ...p.candidates.map((c) =>
      [
        stageLabel(c.stage),
        c.name,
        c.role,
        typeof c.score === "number" ? c.score : "",
        c.source,
        c.note,
        c.addedFrom,
      ]
        .map(esc)
        .join(";"),
    ),
  ];
  const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
  download(`${slug(p.title)}_kandidaty.csv`, blob);
}

// ---- DOCX (бриф + вакансия) через динамический импорт ----

export async function exportDocx(p: Position) {
  const a: AnalyzeResult | null = p.analyze;
  const docx = await import("docx");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;

  const paras: InstanceType<typeof Paragraph>[] = [];
  const H = (text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) =>
    paras.push(new Paragraph({ text, heading: level }));
  const P = (text: string, opts?: { italic?: boolean; bold?: boolean }) =>
    paras.push(
      new Paragraph({
        children: [new TextRun({ text, italics: opts?.italic, bold: opts?.bold })],
        spacing: { after: 120 },
      }),
    );
  const Bul = (text: string) => paras.push(new Paragraph({ text, bullet: { level: 0 } }));

  H(a?.role_title || p.title, HeadingLevel.TITLE);
  if (p.company) P(p.company, { italic: true });
  if (a?.headline) P(a.headline, { italic: true });

  if (a) {
    H("Текст вакансии", HeadingLevel.HEADING_1);
    H("Для публикации", HeadingLevel.HEADING_2);
    a.vacancy.energetic.split(/\n+/).forEach((t) => t.trim() && P(t.replace(/\*\*/g, "")));
    H("Корпоративный вариант", HeadingLevel.HEADING_2);
    a.vacancy.formal.split(/\n+/).forEach((t) => t.trim() && P(t.replace(/\*\*/g, "")));
    H("Короткий тизер", HeadingLevel.HEADING_2);
    P(a.vacancy.short.replace(/\*\*/g, ""));

    const b = a.brief;
    H("Сильный бриф", HeadingLevel.HEADING_1);
    P("Контекст. " + b.context);
    P("Почему ищем. " + b.why_searching);
    P("Рамка роли: " + b.role_frame, { italic: true });
    H("Ключевые задачи (6–12 мес.)", HeadingLevel.HEADING_2);
    b.key_tasks.forEach(Bul);
    H("Профиль (must-have)", HeadingLevel.HEADING_2);
    b.must_have.forEach(Bul);
    H("Стоп-факторы (анти-профиль)", HeadingLevel.HEADING_2);
    b.anti_profile.forEach(Bul);
    H("Метрики", HeadingLevel.HEADING_2);
    b.metrics.forEach(Bul);
    P("Условия. " + b.conditions);
    P("Реализм рынка. " + a.market_reality);

    const s = a.sourcing;
    H("Стратегия сорсинга", HeadingLevel.HEADING_1);
    H("Смежные пулы", HeadingLevel.HEADING_2);
    s.adjacent_pools.forEach((x) => Bul(`${x.name} — ${x.why}`));
    H("Компании-доноры", HeadingLevel.HEADING_2);
    s.donor_companies.forEach((x) => Bul(`${x.name} — ${x.why}`));
    H("Сигналы-триггеры", HeadingLevel.HEADING_2);
    s.trigger_signals.forEach(Bul);
    H("Каналы", HeadingLevel.HEADING_2);
    s.channels.forEach((c) => Bul(`${c.name} (${c.type}) — ${c.why}`));
    H("Реферальные ходы", HeadingLevel.HEADING_2);
    s.referral_moves.forEach(Bul);
    H("Boolean / X-ray", HeadingLevel.HEADING_2);
    s.boolean_strings.forEach(Bul);
  }

  const doc = new Document({ sections: [{ children: paras }] });
  const blob = await Packer.toBlob(doc);
  download(`${slug(a?.role_title || p.title)}.docx`, blob);
}
