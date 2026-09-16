/**
 * Поиск по публикациям открытых Telegram-каналов и чатов через TGStat API.
 *
 * Документация: https://api.tgstat.ru/docs/ru/posts/search.html
 * Нужен тариф «API Search» в личном кабинете TGStat; токен — параметр token.
 * Telegram-аккаунт не используется, поэтому блокировать нечего.
 */

const BASE = process.env.TGSTAT_BASE_URL || "https://api.tgstat.ru";

export function hasTgstat(): boolean {
  return Boolean(process.env.TGSTAT_TOKEN);
}

export interface TelegramPost {
  link: string;
  date: string; // ГГГГ-ММ-ДД
  views?: number;
  channel?: string; // название канала/чата, если сервис его вернул
  text: string;
}

const DAY = 24 * 60 * 60;

export async function searchPosts(q: {
  query: string;
  days?: number; // глубина поиска назад; у TGStat по умолчанию всего 10 дней
  peerType?: "channel" | "chat" | "all";
  limit?: number;
}): Promise<TelegramPost[]> {
  const token = process.env.TGSTAT_TOKEN;
  if (!token) throw new Error("Не задан TGSTAT_TOKEN.");

  const now = Math.floor(Date.now() / 1000);
  const days = Math.min(Math.max(q.days ?? 180, 1), 365);
  const params = new URLSearchParams({
    token,
    q: q.query,
    limit: String(Math.min(Math.max(q.limit ?? 30, 1), 50)),
    peerType: q.peerType || "all",
    startDate: String(now - days * DAY),
    hideForwards: "1",
    hideDeleted: "1",
    extended: "1",
  });

  const res = await fetch(`${BASE}/posts/search?${params}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const raw = await res.text();

  let json: {
    status?: string;
    error?: string;
    response?: { items?: Record<string, unknown>[]; channels?: Record<string, unknown>[] };
  };
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`TGStat вернул нечитаемый ответ (${res.status}).`);
  }
  if (!res.ok || json.status !== "ok") {
    throw new Error(`TGStat: ${json.error || `ошибка ${res.status}`}`);
  }

  const channels = new Map<unknown, string>();
  for (const c of json.response?.channels || []) {
    if (typeof c.title === "string") channels.set(c.id, c.title);
  }

  return (json.response?.items || []).map((p) => {
    const text = String(p.text ?? p.snippet ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      link: String(p.link ?? ""),
      date: typeof p.date === "number" ? new Date(p.date * 1000).toISOString().slice(0, 10) : "",
      views: typeof p.views === "number" ? p.views : undefined,
      channel: channels.get(p.channel_id),
      // Посты бывают длинными, а каждый символ дальше оплачивается как вход модели.
      text: text.length > 700 ? text.slice(0, 700) + "…" : text,
    };
  });
}
