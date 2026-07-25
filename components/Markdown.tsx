"use client";

// Минимальный безопасный рендер: экранируем HTML, поддерживаем **жирный**,
// заголовки-строки и абзацы. Внешних зависимостей нет.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default function Markdown({ text }: { text: string }) {
  const html = escapeHtml(text || "")
    .split(/\n{2,}/)
    .map((block) => {
      const withBold = block.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      return `<p>${withBold.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");
  return <div className="prose-vacancy" dangerouslySetInnerHTML={{ __html: html }} />;
}
