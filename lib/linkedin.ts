/**
 * Поиск по LinkedIn через сервис-посредник LinkdAPI (linkdapi.com).
 *
 * Свой аккаунт LinkedIn в поиске не участвует — запросы идут от сервиса,
 * поэтому личный профиль рекрутёра не рискует блокировкой.
 * База: https://linkdapi.com/api/v1, авторизация — заголовок X-linkdapi-apikey.
 *
 * Посредники такого рода могут закрыться (так ушёл Proxycurl в 2025),
 * поэтому всё общение с сервисом собрано здесь: замена провайдера — правка
 * одного файла, наружу отдаётся нейтральный LinkedInPerson.
 */

const BASE = process.env.LINKDAPI_BASE_URL || "https://linkdapi.com/api/v1";

export function hasLinkedIn(): boolean {
  return Boolean(process.env.LINKDAPI_KEY);
}

export interface LinkedInPerson {
  name: string;
  headline: string;
  location?: string;
  url?: string;
}

async function request<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const key = process.env.LINKDAPI_KEY;
  if (!key) throw new Error("Не задан LINKDAPI_KEY.");

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }

  const res = await fetch(`${BASE}${path}?${qs}`, {
    headers: { "X-linkdapi-apikey": key },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  const raw = await res.text();
  if (!res.ok) {
    const known: Record<number, string> = {
      401: "LinkdAPI отклонил ключ (401). Проверьте LINKDAPI_KEY.",
      402: "На балансе LinkdAPI закончились кредиты (402).",
      429: "Слишком много запросов к LinkdAPI (429).",
    };
    throw new Error(known[res.status] || `LinkdAPI вернул ${res.status}: ${raw.slice(0, 200)}`);
  }

  let json: { success?: boolean; message?: string; data?: unknown };
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("LinkdAPI вернул нечитаемый ответ.");
  }
  if (json.success === false) {
    throw new Error(`LinkdAPI: ${json.message || "запрос не выполнен"}`);
  }
  return json.data as T;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// Поля у сервиса называются по-разному в разных эндпоинтах — читаем терпимо.
function toPerson(o: Record<string, unknown>): LinkedInPerson | null {
  const name =
    str(o.fullName) || str(o.name) || [str(o.firstName), str(o.lastName)].filter(Boolean).join(" ");
  if (!name) return null;
  const username = str(o.username) || str(o.publicIdentifier);
  const loc = o.location;
  return {
    name,
    headline: str(o.headline) || str(o.title) || str(o.summary),
    location: typeof loc === "string" ? loc : str((loc as Record<string, unknown>)?.fullLocation) || undefined,
    url: str(o.url) || str(o.profileUrl) || (username ? `https://www.linkedin.com/in/${username}` : undefined),
  };
}

/** Город/страна текстом → geoUrn, который понимает поиск. Не нашли — ищем без гео. */
async function geoUrn(location: string): Promise<string | undefined> {
  try {
    const data = await request<unknown>("/geos/name-lookup", { query: location });
    const first = Array.isArray(data) ? (data[0] as Record<string, unknown>) : undefined;
    const urn = first?.urn ?? first?.id;
    return urn !== undefined ? String(urn) : undefined;
  } catch {
    return undefined;
  }
}

export async function searchPeople(q: {
  keywords: string;
  title?: string;
  location?: string;
  count?: number;
}): Promise<LinkedInPerson[]> {
  const geo = q.location ? await geoUrn(q.location) : undefined;
  const data = await request<Record<string, unknown>>("/search/people", {
    keyword: q.keywords,
    title: q.title,
    geoUrn: geo,
    start: 0,
    count: Math.min(Math.max(q.count ?? 20, 1), 50),
  });
  const items = (Array.isArray(data) ? data : (data?.items ?? data?.people)) as unknown;
  if (!Array.isArray(items)) return [];
  return items
    .map((i) => toPerson(i as Record<string, unknown>))
    .filter((p): p is LinkedInPerson => p !== null);
}

/** Публичный профиль по ссылке linkedin.com/in/<username> или самому username. */
export async function getProfile(urlOrUsername: string): Promise<Record<string, unknown>> {
  const m = urlOrUsername.match(/linkedin\.com\/in\/([^/?#]+)/i);
  const username = decodeURIComponent(m ? m[1] : urlOrUsername).trim();
  if (!username) throw new Error("Не указан профиль LinkedIn.");
  return request<Record<string, unknown>>("/profile/overview", { username });
}
