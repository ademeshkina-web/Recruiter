import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ассистент рекрутера — бриф, вакансия, каналы, кандидаты",
  description:
    "Загрузите бриф — получите текст вакансии, сильный бриф, стратегию поиска, каналы, кандидатов из открытых источников и сравнение резюме.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
