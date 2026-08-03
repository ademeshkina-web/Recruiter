/**
 * Интеграция с ATS «Поток Рекрутмент» (app.potok.io).
 *
 * Документация: https://api-doc.potok.io/public-api/
 * База: https://app.potok.io/api/v3, авторизация — Authorization: Bearer <токен>.
 * Токен создаётся в Потоке: Настройки компании → Генерация токенов.
 */

import { BoardCandidate, Dossier, PublicLink } from "./types";

const BASE = process.env.POTOK_BASE_URL || "https://app.potok.io/api/v3";

export function hasPotok(): boolean {
  return Boolean(process.env.POTOK_TOKEN);
}

export interface PotokJob {
  id: number;
  name: string;
  city?: string;
  state?: string;
}

class PotokError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.POTOK_TOKEN;
  if (!token) throw new PotokError(500, "Не задан POTOK_TOKEN.");

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const raw = await res.text();
  if (!res.ok) {
    // Поток отвечает осмысленными кодами — переводим их в понятный текст.
    const known: Record<number, string> = {
      401: "Поток отклонил токен (401). Проверьте POTOK_TOKEN.",
      402: "Подписка компании в Потоке просрочена (402).",
      404: "Поток не нашёл объект (404).",
      422: "Поток отклонил данные кандидата (422): " + raw.slice(0, 300),
      429: "Слишком много запросов к Потоку (429). Повторите через несколько секунд.",
    };
    throw new PotokError(res.status, known[res.status] || `Поток вернул ${res.status}: ${raw.slice(0, 300)}`);
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new PotokError(502, "Поток вернул нечитаемый ответ.");
  }
}

/** Список вакансий компании — чтобы рекрутёр выбрал, куда класть кандидата. */
export async function listJobs(): Promise<PotokJob[]> {
  const data = await request<unknown>("/jobs.json?per_page=100");
  const arr = Array.isArray(data)
    ? data
    : ((data as Record<string, unknown>)?.jobs as unknown[]) ||
      (Object.values(data as Record<string, unknown>).find(Array.isArray) as unknown[]) ||
      [];
  return (arr as Record<string, unknown>[])
    .map((j) => ({
      id: Number(j.id),
      name: String(j.name ?? j.title ?? `Вакансия ${j.id}`),
      city: typeof j.city === "string" ? j.city : undefined,
      state: typeof j.state === "string" ? j.state : undefined,
    }))
    .filter((j) => Number.isFinite(j.id));
}

const PATRONYMIC = /(вич|вна|ична|оглы|кызы)$/i;

/**
 * Разбор ФИО. В открытых источниках встречаются оба порядка
 * («Иван Петров» и «Петров Иван Иванович»), поэтому опираемся на отчество.
 */
export function splitName(full: string): {
  first_name: string;
  last_name: string;
  middle_name?: string;
} {
  const w = full.trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return { first_name: "", last_name: "" };
  if (w.length === 1) return { first_name: w[0], last_name: "" };
  if (w.length === 2) return { first_name: w[0], last_name: w[1] };

  // Три слова и больше: отчество определяет порядок.
  if (PATRONYMIC.test(w[2])) {
    // «Петров Иван Иванович»
    return { last_name: w[0], first_name: w[1], middle_name: w[2] };
  }
  if (PATRONYMIC.test(w[1])) {
    // «Иван Иванович Петров»
    return { first_name: w[0], middle_name: w[1], last_name: w.slice(2).join(" ") };
  }
  return { first_name: w[0], last_name: w.slice(1).join(" ") };
}

/**
 * icon_id в Потоке — строгий перечень, произвольное значение отклоняется
 * с 422 (проверено на живом API). Всё неопознанное помечаем как "other".
 */
function iconFor(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("t.me") || u.includes("telegram")) return "telegram";
  if (u.includes("linkedin")) return "linkedin";
  if (u.includes("vk.com")) return "vk";
  if (u.includes("github")) return "github";
  if (u.includes("bitbucket")) return "bitbucket";
  if (u.includes("hh.ru") || u.includes("headhunter")) return "headhunter";
  if (u.includes("moikrug")) return "moikrug";
  if (u.includes("superjob")) return "superjob";
  if (u.includes("avito")) return "avito";
  if (u.includes("facebook") || u.includes("fb.com")) return "facebook";
  if (u.includes("instagram")) return "instagram";
  if (u.includes("twitter") || u.includes("x.com")) return "twitter";
  if (u.includes("youtube")) return "youtube";
  if (u.includes("medium.com")) return "medium";
  if (u.includes("behance")) return "behance";
  if (u.includes("dribbble")) return "dribbble";
  if (u.includes("stackoverflow")) return "stackoverflow";
  if (u.includes("livejournal")) return "livejournal";
  if (u.includes("odnoklassniki") || u.includes("ok.ru")) return "odnoklassniki";
  return "other";
}

function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

/** Собирает текст «о кандидате» из того, что нашло приложение. */
function aboutText(c: BoardCandidate): string {
  const parts: string[] = [];
  if (c.role) parts.push(c.role);
  if (c.note) parts.push(`Заметка рекрутера: ${c.note}`);
  if (typeof c.score === "number") parts.push(`Соответствие брифу: ${c.score}/100`);
  const d = c.dossier;
  if (d) {
    if (d.identity) parts.push(`Идентификация: ${d.identity}`);
    if (d.recommendation) parts.push(`Вывод OSINT-досье: ${d.recommendation}`);
    if (typeof d.weighted_score === "number") {
      parts.push(`Взвешенная оценка досье: ${d.weighted_score}/100`);
    }
    if (d.red_flags?.length) parts.push(`Красные флаги: ${d.red_flags.join("; ")}`);
    if (d.findings?.length) {
      parts.push(
        "Находки:\n" +
          d.findings.map((f) => `— ${f.text} (${f.date || "без даты"}, ${f.source})`).join("\n"),
      );
    }
    if (d.verify_on_interview?.length) {
      parts.push("Проверить на интервью:\n" + d.verify_on_interview.map((x) => `— ${x}`).join("\n"));
    }
  }
  parts.push("Найден через ассистента рекрутера по открытым источникам.");
  return parts.filter(Boolean).join("\n\n");
}

function accountsFrom(c: BoardCandidate): { url: string; icon_id: string }[] {
  const links: PublicLink[] = c.dossier?.links || [];
  const urls = new Set<string>();
  const out: { url: string; icon_id: string }[] = [];
  for (const l of links) {
    if (!l?.url || !isUrl(l.url) || urls.has(l.url)) continue;
    urls.add(l.url);
    out.push({ url: l.url, icon_id: iconFor(l.url) });
  }
  if (c.source && isUrl(c.source) && !urls.has(c.source)) {
    out.push({ url: c.source, icon_id: iconFor(c.source) });
  }
  return out;
}

export interface ExportResult {
  candidateId: string;
  name: string;
  potokId?: number;
  ok: boolean;
  error?: string;
  dossier?: Dossier; // досье, собранное прямо при выгрузке — доска его сохранит
  warning?: string; // кандидат ушёл, но с оговоркой (напр. досье не собралось)
}

/**
 * Заводит кандидата в Потоке и, если указана вакансия, сразу привязывает
 * его к ней (ajs_joins). source_type = sourced — это прямой поиск, не отклик.
 */
export async function createApplicant(
  c: BoardCandidate,
  jobId?: number,
): Promise<number | undefined> {
  const name = splitName(c.name);
  const applicant: Record<string, unknown> = {
    ...name,
    title: c.role || undefined,
    source_type: "sourced",
    source_url: c.source && isUrl(c.source) ? c.source : undefined,
    accounts: accountsFrom(c),
    // ext_source / ext_id в cv_params не отправляем: Поток отвечает на них
    // 500 (проверено на живом API). Связь с нашей карточкой держим через
    // potokId, который сохраняется на доске.
    resumes: [
      {
        cv_params: {
          title: c.role || undefined,
          about_me: aboutText(c),
        },
      },
    ],
  };
  if (jobId) applicant.ajs_joins = [{ job_id: jobId }];

  // Убираем пустые поля — Поток строг к валидации.
  for (const k of Object.keys(applicant)) {
    const v = applicant[k];
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) {
      delete applicant[k];
    }
  }

  const res = await request<Record<string, unknown>>("/applicants.json", {
    method: "POST",
    body: JSON.stringify({ applicant }),
  });

  const obj = (res.applicant as Record<string, unknown>) || res;
  const id = Number(obj?.id);
  return Number.isFinite(id) ? id : undefined;
}
