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

/**
 * Держит HTTP-соединение живым во время долгой операции (модель + веб-поиск).
 * Многие прокси (в т.ч. у хостингов) рвут соединение после ~60с БЕЗ данных —
 * поэтому пока идёт работа, шлём «пульс» (пробел) каждые 15с, а в конце —
 * финальный JSON. Пробелы в начале тела не мешают JSON.parse на клиенте.
 * Статус всегда 200 (заголовки уходят сразу), поэтому ошибку кодируем в теле
 * как {error}: клиентский postJson это распознаёт.
 */
export function streamJson(work: () => Promise<unknown>): Response {
  const encoder = new TextEncoder();
  let finished = false;
  let beat: ReturnType<typeof setInterval> | undefined;
  const stop = () => {
    finished = true;
    if (beat) clearInterval(beat);
  };
  const stream = new ReadableStream({
    async start(controller) {
      // Любая запись в уже закрытый/отменённый поток безопасна — не роняем процесс.
      const push = (s: string) => {
        if (finished) return;
        try {
          controller.enqueue(encoder.encode(s));
        } catch {
          /* поток закрыт/отменён */
        }
      };
      beat = setInterval(() => push(" "), 15000);
      try {
        const result = await work();
        try {
          controller.enqueue(encoder.encode(JSON.stringify(result)));
        } catch {
          /* клиент отвалился до финала */
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Ошибка генерации.";
        try {
          controller.enqueue(encoder.encode(JSON.stringify({ error: msg })));
        } catch {
          /* клиент отвалился */
        }
      } finally {
        stop();
        try {
          controller.close();
        } catch {
          /* уже закрыт */
        }
      }
    },
    // Клиент отвалился (закрыл вкладку / сработал таймаут): гасим «пульс».
    // Сам вызов модели продолжится в фоне — его отмена вынесена отдельно.
    cancel: stop,
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      // Отключаем буферизацию nginx/прокси, иначе «пульс» не дойдёт до клиента.
      "X-Accel-Buffering": "no",
    },
  });
}
