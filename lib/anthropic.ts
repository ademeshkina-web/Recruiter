import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

// «Живой» режим включается, если есть ключ или OAuth-токен. Иначе — демо.
export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    client = process.env.ANTHROPIC_API_KEY
      ? new Anthropic()
      : new Anthropic({ authToken: process.env.ANTHROPIC_AUTH_TOKEN });
  }
  return client;
}

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

function textFromContent(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/**
 * Генерация строго структурированного JSON по схеме.
 * Стримим (adaptive thinking считается в max_tokens), затем отдаём финальное сообщение.
 */
export async function generateJson<T>(
  system: string,
  user: string,
  schema: Record<string, unknown>,
  effort: Effort = "high",
): Promise<T> {
  const c = getClient();
  // SDK-типы этой версии не знают adaptive thinking / output_config,
  // но поля пробрасываются в запрос к API как есть.
  const params = {
    model: MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: { effort, format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content: user }],
  };
  const stream = c.messages.stream(params as unknown as Anthropic.MessageStreamParams);

  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error("Модель отклонила запрос по соображениям безопасности.");
  }

  const text = textFromContent(message.content);
  return parseJsonLoose<T>(text);
}

/**
 * Генерация с веб-поиском (OSINT по открытым источникам).
 * Обрабатываем pause_turn (серверный лимит итераций инструмента).
 */
export async function generateWithWebSearch(
  system: string,
  user: string,
  maxUses = 8,
): Promise<string> {
  const c = getClient();
  const tools = [
    { type: "web_search_20260209", name: "web_search", max_uses: maxUses },
  ];

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];

  let lastText = "";
  for (let i = 0; i < 6; i++) {
    const params = {
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system,
      tools,
      messages,
    };
    const res = await c.messages.create(
      params as unknown as Anthropic.MessageCreateParamsNonStreaming,
    );

    if (res.stop_reason === "refusal") {
      throw new Error("Модель отклонила запрос по соображениям безопасности.");
    }

    lastText = textFromContent(res.content);

    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue; // сервер продолжит инструментальный цикл
    }
    break;
  }
  return lastText;
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
