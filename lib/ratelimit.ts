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

// Достаёт IP клиента из заголовков прокси. ВАЖНО про спуфинг: атакующий может
// сам прислать X-Forwarded-For, а доверенный прокси (nginx у Timeweb) допишет
// реальный IP в КОНЕЦ цепочки. Поэтому:
//  1) сначала доверяем x-real-ip (его ставит сам прокси, клиент не контролирует);
//  2) иначе берём ПОСЛЕДНИЙ элемент XFF (добавленный доверенным хопом), а не
//     первый (его мог подделать клиент).
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "unknown";
}
