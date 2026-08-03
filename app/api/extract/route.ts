import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import mammoth from "mammoth";
import { extractText, hasApiKey } from "@/lib/anthropic";
import { EXTRACT_SYSTEM } from "@/lib/prompts";
import { badBodyResponse, readJsonLimited } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 120;

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ALLOWED = new Set(["application/pdf", "text/plain", DOCX]);

export async function POST(req: Request) {
  if (!getSessionUserId()) {
    return NextResponse.json({ error: "Не авторизован." }, { status: 401 });
  }
  let body: { base64?: string; mediaType?: string; filename?: string };
  try {
    // Файл приходит base64 — крупнее прочих, но не безлимитно (~9 МБ файла).
    body = await readJsonLimited(req, 12 * 1024 * 1024);
  } catch (e) {
    return badBodyResponse(e);
  }

  const { base64, mediaType } = body;
  if (!base64 || !mediaType) {
    return NextResponse.json({ error: "Файл не передан." }, { status: 400 });
  }
  if (!ALLOWED.has(mediaType)) {
    return NextResponse.json(
      { error: "Поддерживаются PDF, DOCX и TXT." },
      { status: 400 },
    );
  }

  // Текстовые файлы — без модели.
  if (mediaType === "text/plain") {
    try {
      const text = Buffer.from(base64, "base64").toString("utf-8");
      return NextResponse.json({ text });
    } catch {
      return NextResponse.json({ error: "Не удалось прочитать файл." }, { status: 400 });
    }
  }

  // DOCX — извлекаем локально (модель не нужна, работает и в демо).
  if (mediaType === DOCX) {
    try {
      const buffer = Buffer.from(base64, "base64");
      const { value } = await mammoth.extractRawText({ buffer });
      const text = (value || "").trim();
      if (!text) {
        return NextResponse.json(
          { error: "В DOCX не найден текст. Попробуйте PDF или вставьте текст вручную." },
          { status: 400 },
        );
      }
      return NextResponse.json({ text });
    } catch {
      return NextResponse.json({ error: "Не удалось прочитать DOCX." }, { status: 400 });
    }
  }

  // PDF — извлечение через нативный document-вход модели.
  if (!hasApiKey()) {
    return NextResponse.json({
      text: "",
      demo: true,
      note: "Демо-режим: извлечение текста из PDF работает при заданном ANTHROPIC_API_KEY. Пока вставьте текст резюме вручную.",
    });
  }

  try {
    const text = await extractText(EXTRACT_SYSTEM, base64, mediaType);
    return NextResponse.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка извлечения текста.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
