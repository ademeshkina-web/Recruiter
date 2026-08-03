import { NextResponse } from "next/server";

// Ошибка «тело запроса слишком большое» — распознаётся в роутах и отдаётся как 413.
export class BodyTooLargeError extends Error {
  constructor(public limit: number) {
    super("BODY_TOO_LARGE");
    this.name = "BodyTooLargeError";
  }
}

/**
 * Читает JSON из запроса с жёстким лимитом размера. Без лимита один большой
 * запрос раздувает счёт за токены и грузит память процесса (DoS на self-hosted,
 * где vercel-лимиты не действуют). Считаем размер по сырому тексту до JSON.parse.
 */
export async function readJsonLimited<T>(req: Request, maxBytes: number): Promise<T> {
  const text = await req.text();
  // Байтовая длина (UTF-8), а не число символов — кириллица занимает 2 байта.
  const bytes = Buffer.byteLength(text, "utf-8");
  if (bytes > maxBytes) throw new BodyTooLargeError(maxBytes);
  return JSON.parse(text) as T;
}

// Единая обработка ошибок парсинга тела: 413 при превышении, 400 при кривом JSON.
export function badBodyResponse(e: unknown): NextResponse {
  if (e instanceof BodyTooLargeError) {
    const kb = Math.round(e.limit / 1024);
    return NextResponse.json(
      { error: `Запрос слишком большой (лимит ~${kb} КБ).` },
      { status: 413 },
    );
  }
  return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
}
