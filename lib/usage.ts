/**
 * Учёт расхода токенов и денег. Пишет строку в лог на каждый вызов модели,
 * чтобы было видно, куда уходит бюджет, и можно было сравнивать настройки.
 */

export interface RawUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  server_tool_use?: { web_search_requests?: number };
}

// Цены в долларах за 1 млн токенов.
const PRICES: Record<string, { in: number; out: number }> = {
  "claude-opus-5": { in: 5, out: 25 },
  "claude-sonnet-5": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};

// Веб-поиск: $10 за 1000 запросов.
const WEB_SEARCH_PER_REQUEST = 10 / 1000;

// Запись в кэш стоит 1.25×, чтение из кэша — 0.1× от цены входа.
const CACHE_WRITE_MULT = 1.25;
const CACHE_READ_MULT = 0.1;

export interface CostBreakdown {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
  webSearches: number;
  usd: number;
}

export function cost(model: string, u: RawUsage): CostBreakdown {
  const p = PRICES[model] || PRICES["claude-opus-5"];
  const input = u.input_tokens || 0;
  const cacheWrite = u.cache_creation_input_tokens || 0;
  const cacheRead = u.cache_read_input_tokens || 0;
  const output = u.output_tokens || 0;
  const webSearches = u.server_tool_use?.web_search_requests || 0;

  const usd =
    (input * p.in) / 1e6 +
    (cacheWrite * p.in * CACHE_WRITE_MULT) / 1e6 +
    (cacheRead * p.in * CACHE_READ_MULT) / 1e6 +
    (output * p.out) / 1e6 +
    webSearches * WEB_SEARCH_PER_REQUEST;

  return { input, cacheWrite, cacheRead, output, webSearches, usd };
}

export function addUsage(a: RawUsage, b: RawUsage): RawUsage {
  return {
    input_tokens: (a.input_tokens || 0) + (b.input_tokens || 0),
    output_tokens: (a.output_tokens || 0) + (b.output_tokens || 0),
    cache_creation_input_tokens:
      (a.cache_creation_input_tokens || 0) + (b.cache_creation_input_tokens || 0),
    cache_read_input_tokens:
      (a.cache_read_input_tokens || 0) + (b.cache_read_input_tokens || 0),
    server_tool_use: {
      web_search_requests:
        (a.server_tool_use?.web_search_requests || 0) +
        (b.server_tool_use?.web_search_requests || 0),
    },
  };
}

/** Печатает строку вида: [cost] analyze opus-5 effort=medium in=12 cacheR=2482 out=41230 $1.04 */
export function logUsage(
  label: string,
  model: string,
  effort: string,
  u: RawUsage,
  seconds?: number,
): CostBreakdown {
  const c = cost(model, u);
  const parts = [
    `[cost] ${label}`,
    model.replace("claude-", ""),
    `effort=${effort}`,
    `in=${c.input}`,
    `cacheW=${c.cacheWrite}`,
    `cacheR=${c.cacheRead}`,
    `out=${c.output}`,
  ];
  if (c.webSearches) parts.push(`web=${c.webSearches}`);
  if (seconds !== undefined) parts.push(`${seconds.toFixed(0)}s`);
  parts.push(`$${c.usd.toFixed(3)}`);
  console.log(parts.join(" "));
  return c;
}
