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
  angle?: string; // каким ходом сорсинга найден (донор, спикер, премия, telegram…)
  outreach_hook?: string; // с чего зайти в аутрич именно к нему
}

export interface CandidatesResult {
  candidates: Candidate[];
  recommendation: string; // с кого начать аутрич
  note: string; // оговорки/этика
}

export interface CompareRequest {
  brief: string; // исходный бриф или сжатые требования
  resumes: { name?: string; text: string }[];
  // Структурированный бриф из анализа (если позиция уже проанализирована) —
  // даёт точный скоринг по извлечённым must-have и анти-профилю, а не по прозе.
  mustHave?: string[];
  antiProfile?: string[];
  roleFrame?: string;
  keyTasks?: string[];
}

export interface MustHaveCheck {
  requirement: string;
  status: "есть" | "частично" | "нет" | string;
  evidence: string;
}

// Проверка кандидата по стоп-фактору (анти-профилю).
export interface AntiProfileFlag {
  factor: string; // стоп-фактор из брифа
  status: "чисто" | "риск" | "совпадает" | string;
  evidence: string; // из резюме, или «в резюме не отражено»
}

export interface CandidateEvaluation {
  name: string;
  score: number; // 0–100 соответствие брифу
  verdict: string; // короткий вердикт
  strengths: string[];
  gaps: string[];
  must_have_match: MustHaveCheck[];
  // Схема API делает поле обязательным (модель всегда вернёт массив, пусть пустой);
  // опционально в типе — для обратной совместимости со старыми сохранёнными
  // сравнениями, сделанными до появления анти-профиля.
  anti_profile_flags?: AntiProfileFlag[];
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

export interface DossierLayer {
  name: string; // Базовый / Личность / Риски
  status: "проверено" | "недоступно" | "расхождение" | string;
  summary: string;
}

export interface DossierFinding {
  text: string;
  date: string; // дата публикации источника
  source: string;
}

export interface DossierCriterion {
  name: string;
  weight: "×2" | "×1.5" | "×1" | string;
  score: number; // 1–10
  note: string;
}

export interface PublicLink {
  label: string; // напр. «Профиль на сайте компании», «Telegram-канал», «Доклад на конференции»
  url: string;
}

export interface Dossier {
  identity: string; // якоря личности + предупреждение об однофамильцах
  layers: DossierLayer[];
  findings: DossierFinding[];
  links: PublicLink[]; // публичные профессиональные профили и упоминания
  red_flags: string[];
  criteria: DossierCriterion[];
  weighted_score: number; // 0–100 средневзвешенное
  verify_on_interview: string[];
  recommendation: string; // вывод для ГД
}

export interface OutreachMessage {
  channel: string; // «Прямое сообщение кандидату», «Запрос рекомендации у коннектора», «Короткий тизер»
  text: string;
}

// Гипотеза мотивации кандидата и как под неё «зайти».
export interface MotivationHypothesis {
  motivation: string; // что вероятно движет (драйвер перехода)
  basis: string; // на чём гипотеза (карьерный этап, ситуация, сигналы из досье)
  approach: string; // как зайти: с каким акцентом открывать разговор
  hook_text: string; // готовый текст-заход под эту мотивацию (1–2 фразы)
}

export interface OutreachResult {
  // Гипотезы мотивации — опционально для обратной совместимости со старыми
  // сохранёнными письмами, сделанными до появления блока.
  motivation_hypotheses?: MotivationHypothesis[];
  messages: OutreachMessage[];
}

export interface BoardCandidate {
  id: string;
  name: string;
  role: string; // текущая позиция и компания одной строкой
  source: string; // ссылка/источник
  note: string; // заметка рекрутера
  stage: Stage;
  score?: number; // соответствие брифу, если оценивали
  addedFrom: "osint" | "compare" | "manual";
  dossier?: Dossier; // глубокий OSINT-разбор, если собран
  outreach?: OutreachResult; // сгенерированные письма для аутрича
  potokId?: number; // id кандидата в ATS «Поток», если уже выгружен
  createdAt: number;
}

export interface Position {
  id: string;
  title: string;
  company: string;
  role: string;
  brief: string;
  analyze: AnalyzeResult | null;
  sourced: CandidatesResult | null; // найденные по открытым источникам
  candidates: BoardCandidate[];
  createdAt: number;
  updatedAt: number;
}
