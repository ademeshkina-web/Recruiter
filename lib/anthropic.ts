import Anthropic from "@anthropic-ai/sdk";
import { addUsage, logUsage, RawUsage } from "./usage";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

/**
 * Модель для лёгких задач (извлечение текста из резюме, письма для аутрича,
 * сравнение резюме). По умолчанию — та же, но её можно удешевить отдельно,
 * не трогая качество главного анализа брифа.
 */
export const LIGHT_MODEL = process.env.ANTHROPIC_LIGHT_MODEL || MODEL;

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/**
 * Глубина размышлений модели. Замеры: high → medium даёт ~10% экономии при
 * неотличимом качестве, low → ~24%, но заметно короче ответ.
 */
export const EFFORT: Effort = (process.env.ANTHROPIC_EFFORT as Effort) || "medium";

/**
 * Сколько раз модели разрешено сходить в веб-поиск за один запрос.
 * Каждый поиск — это и плата за сам запрос, и объёмные результаты,
 * которые дальше оплачиваются как входные токены на каждой итерации.
 */
export const WEB_SEARCH_MAX_USES = Number(process.env.WEB_SEARCH_MAX_USES || 16);

/** Досье глубже лонг-листа, поэтому поисков больше — но тоже с потолком. */
export const DOSSIER_SEARCH_MAX_USES = Number(process.env.DOSSIER_SEARCH_MAX_USES || 8);

// «Живой» режим включается, если есть ключ или OAuth-токен. Иначе — демо.
export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    // Таймаут и один ретрай вместо дефолтных SDK (до 10 минут ожидания):
    // сервер не должен висеть на зависшем/отфильтрованном запросе к модели.
    const opts = { timeout: 240_000, maxRetries: 1 };
    client = process.env.ANTHROPIC_API_KEY
      ? new Anthropic(opts)
      : new Anthropic({ ...opts, authToken: process.env.ANTHROPIC_AUTH_TOKEN });
  }
  return client;
}

/**
 * Приводит ошибку вызова модели к понятному пользователю сообщению на русском.
 * Главный случай — гео-блокировка Anthropic (403 «Request not allowed»), когда
 * сервер размещён в неподдерживаемом регионе: раньше пользователь видел сырой
 * английский JSON.
 */
export function mapModelError(e: unknown): Error {
  const status = (e as { status?: number })?.status;
  const msg = e instanceof Error ? e.message : String(e);
  if (status === 403 || /request not allowed|permission_error|unsupported.?countr/i.test(msg)) {
    return new Error(
      "Модель Anthropic недоступна из региона, где размещён сервер (гео-блокировка). " +
        "Разместите приложение или прокси в поддерживаемой стране.",
    );
  }
  if (status === 401 || /authentication|invalid x-api-key/i.test(msg)) {
    return new Error("Ключ Anthropic не принят — проверьте ANTHROPIC_API_KEY.");
  }
  if (status === 429 || status === 529 || /rate.?limit|overloaded/i.test(msg)) {
    return new Error("Модель перегружена или превышен лимит — попробуйте через минуту.");
  }
  if (
    e instanceof Anthropic.APIConnectionError ||
    /timeout|timed out|aborted|connection error|ETIMEDOUT|ECONNRESET|ENOTFOUND|network/i.test(msg)
  ) {
    return new Error("Модель слишком долго не отвечает или нет связи — попробуйте ещё раз.");
  }
  return e instanceof Error ? e : new Error(String(e));
}

function textFromContent(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/**
 * Системный промпт как кэшируемый блок: он одинаков от запроса к запросу,
 * поэтому со второго вызова оплачивается по 0.1× вместо полной цены входа.
 */
function cachedSystem(system: string) {
  return [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
}

/**
 * Генерация строго структурированного JSON по схеме.
 * Стримим (adaptive thinking считается в max_tokens), затем отдаём финальное сообщение.
 */
export async function generateJson<T>(
  system: string,
  user: string,
  schema: Record<string, unknown>,
  effort: Effort = EFFORT,
  label = "generateJson",
  model: string = MODEL,
): Promise<T> {
  const c = getClient();
  const started = Date.now();
  // SDK-типы этой версии не знают adaptive thinking / output_config,
  // но поля пробрасываются в запрос к API как есть.
  const params = {
    model,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: { effort, format: { type: "json_schema", schema } },
    system: cachedSystem(system),
    messages: [{ role: "user", content: user }],
  };
  let message;
  try {
    const stream = c.messages.stream(params as unknown as Anthropic.MessageStreamParams);
    message = await stream.finalMessage();
  } catch (e) {
    throw mapModelError(e);
  }

  if (message.stop_reason === "refusal") {
    throw new Error("Модель отклонила запрос по соображениям безопасности.");
  }

  logUsage(label, model, effort, message.usage as RawUsage, (Date.now() - started) / 1000);

  const text = textFromContent(message.content);
  return parseJsonLoose<T>(text);
}

/**
 * Генерация с веб-поиском (OSINT по открытым источникам).
 * Обрабатываем pause_turn (серверный лимит итераций инструмента).
 *
 * Цикл дорогой: на каждой итерации весь накопленный диалог (включая результаты
 * поиска — а они объёмные) отправляется заново. Поэтому ставим точку кэша на
 * последний блок — повторный вход оплачивается по 0.1×. На замере это дало
 * 40% экономии от стоимости вызова.
 */
export async function generateWithWebSearch(
  system: string,
  user: string,
  maxUses = WEB_SEARCH_MAX_USES,
  label = "webSearch",
  effort: Effort = EFFORT,
): Promise<string> {
  const c = getClient();
  const started = Date.now();
  const tools = [{ type: "web_search_20260209", name: "web_search", max_uses: maxUses }];

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];

  let lastText = "";
  let total: RawUsage = {};

  for (let i = 0; i < 6; i++) {
    const params = {
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort },
      system: cachedSystem(system),
      tools,
      messages,
    };
    let res;
    try {
      res = await c.messages.create(params as unknown as Anthropic.MessageCreateParamsNonStreaming);
    } catch (e) {
      throw mapModelError(e);
    }

    if (res.stop_reason === "refusal") {
      throw new Error("Модель отклонила запрос по соображениям безопасности.");
    }

    total = addUsage(total, res.usage as RawUsage);
    lastText = textFromContent(res.content);

    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: markLastForCache(res.content) });
      continue; // сервер продолжит инструментальный цикл
    }
    break;
  }

  logUsage(label, MODEL, effort, total, (Date.now() - started) / 1000);
  return lastText;
}

/**
 * Ставит точку кэширования на последний блок сообщения. Разрешено максимум
 * 4 точки на запрос, поэтому держим ровно одну — на самом свежем блоке:
 * она покрывает весь диалог до неё.
 */
function markLastForCache(content: Anthropic.ContentBlock[]): Anthropic.ContentBlock[] {
  if (!content.length) return content;
  const copy = content.map((b) => {
    const { cache_control, ...rest } = b as unknown as Record<string, unknown>;
    return rest;
  });
  copy[copy.length - 1] = {
    ...copy[copy.length - 1],
    cache_control: { type: "ephemeral" },
  };
  return copy as unknown as Anthropic.ContentBlock[];
}

/**
 * Извлечение текста резюме из документа (PDF/изображение) через нативный
 * document-вход модели. Для .txt текст декодируется без модели (в роуте).
 */
export async function extractText(
  system: string,
  base64: string,
  mediaType: string,
): Promise<string> {
  const c = getClient();
  const started = Date.now();
  const params = {
    model: LIGHT_MODEL,
    max_tokens: 8000,
    output_config: { effort: "low" },
    system,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: "Извлеки текст этого резюме." },
        ],
      },
    ],
  };
  let res;
  try {
    res = await c.messages.create(params as unknown as Anthropic.MessageCreateParamsNonStreaming);
  } catch (e) {
    throw mapModelError(e);
  }
  if (res.stop_reason === "refusal") {
    throw new Error("Модель отклонила запрос.");
  }
  logUsage("extract", LIGHT_MODEL, "low", res.usage as RawUsage, (Date.now() - started) / 1000);
  return textFromContent(res.content);
}

/**
 * Устойчивый парсер JSON: снимает markdown-ограждения и вытаскивает
 * первый сбалансированный объект, если модель добавила пояснения.
 */
export function parseJsonLoose<T>(raw: string): T {
  let s = raw.trim();
  // снять ```json ... ```
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  try {
    return JSON.parse(s) as T;
  } catch {
    // вытащить первый сбалансированный { ... }
    const start = s.indexOf("{");
    if (start >= 0) {
      let depth = 0;
      let inStr = false;
      let esc = false;
      for (let i = start; i < s.length; i++) {
        const ch = s[i];
        if (esc) {
          esc = false;
          continue;
        }
        if (ch === "\\") {
          esc = true;
          continue;
        }
        if (ch === '"') inStr = !inStr;
        if (inStr) continue;
        if (ch === "{") depth++;
        if (ch === "}") {
          depth--;
          if (depth === 0) {
            const candidate = s.slice(start, i + 1);
            return JSON.parse(candidate) as T;
          }
        }
      }
    }
    throw new Error("Не удалось разобрать ответ модели как JSON.");
  }
}
