// Типы данных, которыми обмениваются фронтенд и API-роуты.

export interface AnalyzeRequest {
  brief: string;
  company?: string;
  role?: string;
}

export interface VacancyCopy {
  energetic: string; // энергичный текст для публикации (markdown)
  formal: string; // сдержанный/корпоративный вариант
  short: string; // короткий тизер для Telegram/соцсетей
}

export interface StrongBrief {
  context: string;
  why_searching: string;
  key_tasks: string[];
  must_have: string[];
  role_frame: string; // рамка роли: «не X, а Y»
  anti_profile: string[]; // стоп-факторы
  metrics: string[];
  conditions: string;
}

export interface NamedItem {
  name: string;
  why: string;
}

export interface Channel {
  name: string;
  type: string; // напр. «Telegram», «Конференция», «Сообщество», «Премия»
  why: string;
}

export interface SourcingStrategy {
  adjacent_pools: NamedItem[];
  donor_companies: NamedItem[];
  trigger_signals: string[];
  channels: Channel[];
  referral_moves: string[];
  boolean_strings: string[];
}

export interface AnalyzeResult {
  role_title: string;
  headline: string; // стержневая мысль одной строкой
  vacancy: VacancyCopy;
  brief: StrongBrief;
  sourcing: SourcingStrategy;
  market_reality: string; // проверка на реализм рынка / «единорога»
}

export interface Candidate {
  name: string;
  current_role: string;
  company: string;
  relevance: string; // чем подходит
  signal: string; // сигнал к переходу, если виден
  source: string; // ссылка/источник
  confidence: "высокая" | "средняя" | "гипотеза" | string;
}

export interface CandidatesResult {
  candidates: Candidate[];
  recommendation: string; // с кого начать аутрич
  note: string; // оговорки/этика
}

export interface CompareRequest {
  brief: string; // исходный бриф или сжатые требования
  resumes: { name?: string; text: string }[];
}

export interface MustHaveCheck {
  requirement: string;
  status: "есть" | "частично" | "нет" | string;
  evidence: string;
}

export interface CandidateEvaluation {
  name: string;
  score: number; // 0–100 соответствие брифу
  verdict: string; // короткий вердикт
  strengths: string[];
  gaps: string[];
  must_have_match: MustHaveCheck[];
  recommendation: string; // выводить / посмотреть / пропустить
}

export interface CompareResult {
  ranking: CandidateEvaluation[]; // отсортировано по score убыв.
  summary: string; // сравнительный вывод
}

export interface ApiError {
  error: string;
}

// ---- Позиция и доска кандидатов (персистентная модель) ----

export type Stage = "longlist" | "outreach" | "interview" | "final" | "rejected";

export const STAGES: { id: Stage; label: string }[] = [
  { id: "longlist", label: "Лонг-лист" },
  { id: "outreach", label: "Аутрич" },
  { id: "interview", label: "Интервью" },
  { id: "final", label: "Финал" },
  { id: "rejected", label: "Отказ" },
];

export interface BoardCandidate {
  id: string;
  name: string;
  role: string; // текущая позиция и компания одной строкой
  source: string; // ссылка/источник
  note: string; // заметка рекрутера
  stage: Stage;
  score?: number; // соответствие брифу, если оценивали
  addedFrom: "osint" | "compare" | "manual";
  createdAt: number;
}

export interface Position {
  id: string;
  title: string;
  company: string;
  role: string;
  brief: string;
  analyze: AnalyzeResult | null;
  candidates: BoardCandidate[];
  createdAt: number;
  updatedAt: number;
}
