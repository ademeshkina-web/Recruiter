/**
 * Платные источники сорсинга как инструменты модели: модель сама решает,
 * какие запросы отправить в LinkedIn и Telegram, а сервер их выполняет.
 * Подключаются только те источники, для которых задан ключ.
 */

import { hasLinkedIn, searchPeople, getProfile } from "./linkedin";
import { hasTgstat, searchPosts } from "./tgstat";

export interface ClientTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type ToolRunner = (name: string, input: Record<string, unknown>) => Promise<string>;

/** Потолок вызовов на источник за один прогон — каждый вызов стоит денег у провайдера. */
const MAX_CALLS = Number(process.env.SOURCE_TOOL_MAX_CALLS || 6);

export function sourcingTools(): { tools: ClientTool[]; run: ToolRunner; prompt: string } {
  const tools: ClientTool[] = [];
  const notes: string[] = [];

  if (hasLinkedIn()) {
    tools.push(
      {
        name: "linkedin_search_people",
        description:
          "Поиск людей в LinkedIn через API (полнее, чем X-ray через поисковик). Возвращает имя, заголовок профиля, город и ссылку.",
        input_schema: {
          type: "object",
          properties: {
            keywords: { type: "string", description: "Ключевые слова: должность, отрасль, компания-донор" },
            title: { type: "string", description: "Фильтр по текущей должности (лучше на английском)" },
            location: { type: "string", description: "Город или страна, напр. «Moscow» или «Russia»" },
          },
          required: ["keywords"],
        },
      },
      {
        name: "linkedin_profile",
        description:
          "Подробности публичного профиля LinkedIn по ссылке: опыт, компании, даты. Вызывай только для самых перспективных кандидатов.",
        input_schema: {
          type: "object",
          properties: { url: { type: "string", description: "Ссылка linkedin.com/in/…" } },
          required: ["url"],
        },
      },
    );
    notes.push(
      "- linkedin_search_people / linkedin_profile — прямой поиск по LinkedIn. Используй ИХ вместо X-ray site:linkedin.com: выдача полнее и точнее. Ссылку из результата клади в source, angle начинай с «LinkedIn».",
    );
  }

  if (hasTgstat()) {
    tools.push({
      name: "telegram_search_posts",
      description:
        "Полнотекстовый поиск по постам открытых Telegram-каналов и чатов за последние месяцы (TGStat). Возвращает ссылку на пост, дату, канал и текст.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Короткий запрос, 2–5 слов, напр. «ищу работу главный инженер обогатительной»" },
          peer_type: {
            type: "string",
            enum: ["all", "channel", "chat"],
            description: "chat — обсуждения, где видно, кто отвечает содержательно; channel — авторские каналы",
          },
          days: { type: "integer", description: "Глубина поиска в днях (по умолчанию 180, максимум 365)" },
        },
        required: ["query"],
      },
    });
    notes.push(
      "- telegram_search_posts — прямой поиск по постам Telegram. Используй ЕГО вместо site:t.me. Ищи авторов экспертных постов, людей, публикующих резюме («ищу работу», «#резюме», «открыт к предложениям»), и содержательных участников чатов. В source — ссылка на пост, angle начинай с «Telegram». Берёшь человека только если из поста видно, кто он (подпись, @username, имя автора канала) — не додумывай.",
    );
  }

  const calls = new Map<string, number>();

  const run: ToolRunner = async (name, input) => {
    const source = name.split("_")[0];
    const used = calls.get(source) || 0;
    if (used >= MAX_CALLS) {
      return `Лимит запросов к источнику исчерпан (${MAX_CALLS}). Работай с уже найденным.`;
    }
    calls.set(source, used + 1);

    try {
      if (name === "linkedin_search_people") {
        const people = await searchPeople({
          keywords: String(input.keywords || ""),
          title: input.title ? String(input.title) : undefined,
          location: input.location ? String(input.location) : undefined,
        });
        return people.length ? JSON.stringify(people) : "Ничего не найдено — переформулируй запрос.";
      }
      if (name === "linkedin_profile") {
        const profile = await getProfile(String(input.url || ""));
        const json = JSON.stringify(profile);
        return json.length > 6000 ? json.slice(0, 6000) + "…" : json;
      }
      if (name === "telegram_search_posts") {
        const posts = await searchPosts({
          query: String(input.query || ""),
          peerType: input.peer_type as "all" | "channel" | "chat" | undefined,
          days: typeof input.days === "number" ? input.days : undefined,
        });
        return posts.length ? JSON.stringify(posts) : "Постов не найдено — попробуй синонимы или шире.";
      }
      return `Неизвестный инструмент ${name}.`;
    } catch (e) {
      // Ошибку отдаём модели текстом: поиск продолжится по другим источникам,
      // а в note она честно напишет, что площадка не отработала.
      return `Ошибка источника: ${e instanceof Error ? e.message : String(e)}`;
    }
  };

  const prompt = notes.length
    ? `\n\nПРЯМЫЕ ИСТОЧНИКИ (подключены по API, не тратят бюджет веб-поиска):\n${notes.join("\n")}\nЕсли инструмент вернул ошибку — не повторяй его бесконечно, пройди площадку через веб-поиск и отметь это в note.`
    : "";

  return { tools, run, prompt };
}
