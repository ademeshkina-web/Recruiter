// Простой in-memory rate-limit (на globalThis, чтобы жить между бандлами роутов
// в dev и переживать пересоздание модуля). Для одного контейнера этого
// достаточно; при горизонтальном масштабировании нужен общий стор (Redis).
const g = globalThis as unknown as {
  __rl?: Map<string, { count: number; reset: number }>;
};
function bucket() {
  if (!g.__rl) g.__rl = new Map();
  return g.__rl;
}

// Регистрирует попытку по ключу. Возвращает true, если лимит превышен (нужно
// заблокировать). Скользящее окно: счётчик сбрасывается по истечении windowMs.
export function rateLimited(key: string, limit: number, windowMs: number): boolean {
  const m = bucket();
  const now = Date.now();
  const e = m.get(key);
  if (!e || now > e.reset) {
    m.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  e.count++;
  return e.count > limit;
}

// Достаёт IP клиента из заголовков прокси (Timeweb/Vercel ставят x-forwarded-for).
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
