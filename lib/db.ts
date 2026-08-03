import type { Pool } from "pg";
import { Position, Stage, STAGES } from "./types";
import { isAdminEmail } from "./roles";

export interface DBUser {
  id: string;
  email: string;
  password_hash: string;
  is_admin: boolean;
  disabled: boolean;
  created_at: number; // ms epoch
}

// Активность рекрутёра — считается из его позиций (JSONB), без отдельных полей.
export interface RecruiterStats {
  positions: number;
  candidates: number;
  byStage: Record<Stage, number>;
  dossiers: number;
  outreach: number;
  lastActivity: number; // ms, 0 если активности нет
}

// Строка для админки: пользователь + его активность (без password_hash).
export interface AdminUser {
  id: string;
  email: string;
  isAdmin: boolean;
  disabled: boolean;
  createdAt: number;
  stats: RecruiterStats;
}

// Бросается, когда e-mail уже занят. Роут регистрации ловит и отдаёт 409
// (в т.ч. при гонке двух одновременных регистраций одного адреса).
export class EmailTakenError extends Error {
  constructor() {
    super("EMAIL_TAKEN");
    this.name = "EmailTakenError";
  }
}

/**
 * База недоступна: не удалось установить соединение (канал до неё оборван).
 * Отдельный тип нужен, чтобы роуты не показывали «Ошибка регистрации» —
 * пользователь ничего не сделал не так, и повторять ввод бессмысленно.
 */
export class DbUnavailableError extends Error {
  constructor(cause: string) {
    super(cause);
    this.name = "DbUnavailableError";
  }
}

export const DB_UNAVAILABLE_TEXT =
  "База данных сейчас недоступна — связь с ней временно потеряна. " +
  "Данные целы, попробуйте через минуту.";

export interface Store {
  init(): Promise<void>;
  getUserByEmail(email: string): Promise<DBUser | null>;
  getUserById(id: string): Promise<DBUser | null>;
  createUser(email: string, passwordHash: string): Promise<DBUser>;
  listPositions(userId: string): Promise<Position[]>;
  upsertPosition(userId: string, position: Position): Promise<void>;
  deletePosition(userId: string, id: string): Promise<void>;
  // --- админ ---
  listUsersWithStats(): Promise<AdminUser[]>;
  setUserAdmin(userId: string, isAdmin: boolean): Promise<void>;
  setUserDisabled(userId: string, disabled: boolean): Promise<void>;
  setUserPassword(userId: string, passwordHash: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}

function uid(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4) +
    Math.random().toString(36).slice(2, 6)
  );
}

// Считает активность рекрутёра из его позиций.
function computeStats(positions: Position[]): RecruiterStats {
  const byStage = Object.fromEntries(STAGES.map((s) => [s.id, 0])) as Record<Stage, number>;
  let candidates = 0;
  let dossiers = 0;
  let outreach = 0;
  let lastActivity = 0;
  for (const p of positions) {
    if (p.updatedAt > lastActivity) lastActivity = p.updatedAt;
    for (const c of p.candidates || []) {
      candidates++;
      if (c.stage && byStage[c.stage] !== undefined) byStage[c.stage]++;
      if (c.dossier) dossiers++;
      if (c.outreach) outreach++;
    }
  }
  return { positions: positions.length, candidates, byStage, dossiers, outreach, lastActivity };
}

// ---- In-memory (dev / без DATABASE_URL). Данные живут до перезапуска. ----
class MemoryStore implements Store {
  private users = new Map<string, DBUser>();
  private positions = new Map<string, Map<string, Position>>();

  async init() {}
  async getUserByEmail(email: string) {
    for (const u of this.users.values()) if (u.email === email) return u;
    return null;
  }
  async getUserById(id: string) {
    return this.users.get(id) || null;
  }
  async createUser(email: string, passwordHash: string) {
    // Проверка и вставка — синхронно, без await между ними, поэтому атомарны
    // в одном потоке Node: параллельные регистрации не создадут дубль.
    for (const u of this.users.values()) if (u.email === email) throw new EmailTakenError();
    const u: DBUser = {
      id: uid(),
      email,
      password_hash: passwordHash,
      is_admin: false,
      disabled: false,
      created_at: Date.now(),
    };
    this.users.set(u.id, u);
    this.positions.set(u.id, new Map());
    return u;
  }
  async listPositions(userId: string) {
    const m = this.positions.get(userId);
    if (!m) return [];
    return Array.from(m.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async upsertPosition(userId: string, position: Position) {
    if (!this.positions.has(userId)) this.positions.set(userId, new Map());
    this.positions.get(userId)!.set(position.id, position);
  }
  async deletePosition(userId: string, id: string) {
    this.positions.get(userId)?.delete(id);
  }

  async listUsersWithStats() {
    return Array.from(this.users.values())
      .sort((a, b) => a.created_at - b.created_at)
      .map((u) => ({
        id: u.id,
        email: u.email,
        // Учитываем и флаг в БД, и ADMIN_EMAILS — иначе «корневой» админ выглядел
        // бы обычным рекрутёром, и его могли бы по ошибке отключить/удалить.
        isAdmin: u.is_admin || isAdminEmail(u.email),
        disabled: u.disabled,
        createdAt: u.created_at,
        stats: computeStats(Array.from(this.positions.get(u.id)?.values() || [])),
      }));
  }
  async setUserAdmin(userId: string, isAdmin: boolean) {
    const u = this.users.get(userId);
    if (u) u.is_admin = isAdmin;
  }
  async setUserDisabled(userId: string, disabled: boolean) {
    const u = this.users.get(userId);
    if (u) u.disabled = disabled;
  }
  async setUserPassword(userId: string, passwordHash: string) {
    const u = this.users.get(userId);
    if (u) u.password_hash = passwordHash;
  }
  async deleteUser(userId: string) {
    this.users.delete(userId);
    this.positions.delete(userId);
  }
}

// ---- PostgreSQL (прод). Позиции хранятся как JSONB. ----
class PgStore implements Store {
  private pool: Pool;
  private ready: Promise<void> | null = null;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Запрос с одной повторной попыткой, если соединение не удалось установить.
   * Канал до базы бывает трансграничным и иногда моргает: единичный сбой
   * подключения не должен превращаться в ошибку на экране пользователя.
   *
   * Повторяем ТОЛЬКО сбои на этапе подключения — когда запрос заведомо не
   * дошёл до сервера. Обрыв в середине запроса не повторяем: неизвестно,
   * успел ли он выполниться, и повтор мог бы завести второго пользователя
   * или продублировать запись.
   */
  private async q(text: string, values?: unknown[]) {
    try {
      return await this.pool.query(text, values as never);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // «timeout exceeded when trying to connect» — от пула pg;
      // «connect ETIMEDOUT/ECONNREFUSED/...» — от Node на этапе установки TCP.
      const beforeQuerySent =
        /timeout exceeded when trying to connect|connect\s+(ETIMEDOUT|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|ENOTFOUND)/i.test(
          msg,
        );
      if (!beforeQuerySent) throw e;
      console.warn("[db] не удалось подключиться, повтор:", msg);
      await new Promise((r) => setTimeout(r, 400));
      try {
        return await this.pool.query(text, values as never);
      } catch (again) {
        // Повтор тоже не дошёл — это не ошибка пользователя, а обрыв связи.
        throw new DbUnavailableError(again instanceof Error ? again.message : String(again));
      }
    }
  }

  init() {
    if (!this.ready) {
      this.ready = (async () => {
        await this.q(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          );
        `);
        // Миграции колонок ролей/блокировки для уже существующих таблиц.
        await this.q(
          `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;`,
        );
        await this.q(
          `ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT false;`,
        );
        await this.q(`
          CREATE TABLE IF NOT EXISTS positions (
            id TEXT NOT NULL,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            data JSONB NOT NULL,
            updated_at BIGINT NOT NULL,
            PRIMARY KEY (user_id, id)
          );
        `);
      })();
    }
    return this.ready;
  }

  private mapUser(row: Record<string, unknown>): DBUser {
    return {
      id: row.id as string,
      email: row.email as string,
      password_hash: row.password_hash as string,
      is_admin: Boolean(row.is_admin),
      disabled: Boolean(row.disabled),
      created_at: row.created_at ? new Date(row.created_at as string).getTime() : 0,
    };
  }

  async getUserByEmail(email: string) {
    const r = await this.q(
      "SELECT id, email, password_hash, is_admin, disabled, created_at FROM users WHERE email = $1",
      [email],
    );
    return r.rows[0] ? this.mapUser(r.rows[0]) : null;
  }
  async getUserById(id: string) {
    const r = await this.q(
      "SELECT id, email, password_hash, is_admin, disabled, created_at FROM users WHERE id = $1",
      [id],
    );
    return r.rows[0] ? this.mapUser(r.rows[0]) : null;
  }
  async createUser(email: string, passwordHash: string) {
    const id = uid();
    try {
      await this.q(
        "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)",
        [id, email, passwordHash],
      );
    } catch (e) {
      // 23505 = unique_violation по users.email (в т.ч. при гонке регистраций).
      if ((e as { code?: string }).code === "23505") throw new EmailTakenError();
      throw e;
    }
    return {
      id,
      email,
      password_hash: passwordHash,
      is_admin: false,
      disabled: false,
      created_at: Date.now(),
    };
  }
  async listPositions(userId: string) {
    const r = await this.q(
      "SELECT data FROM positions WHERE user_id = $1 ORDER BY updated_at DESC",
      [userId],
    );
    return r.rows.map((row) => row.data as Position);
  }
  async upsertPosition(userId: string, position: Position) {
    await this.q(
      `INSERT INTO positions (id, user_id, data, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
      [position.id, userId, position, position.updatedAt],
    );
  }
  async deletePosition(userId: string, id: string) {
    await this.q("DELETE FROM positions WHERE user_id = $1 AND id = $2", [userId, id]);
  }

  async listUsersWithStats() {
    const users = await this.q(
      "SELECT id, email, is_admin, disabled, created_at FROM users ORDER BY created_at ASC",
    );
    const posRows = await this.q("SELECT user_id, data FROM positions");
    const byUser = new Map<string, Position[]>();
    for (const row of posRows.rows) {
      const arr = byUser.get(row.user_id) || [];
      arr.push(row.data as Position);
      byUser.set(row.user_id, arr);
    }
    return users.rows.map((u) => ({
      id: u.id as string,
      email: u.email as string,
      // Флаг в БД ИЛИ ADMIN_EMAILS (см. пояснение в MemoryStore).
      isAdmin: Boolean(u.is_admin) || isAdminEmail(u.email as string),
      disabled: Boolean(u.disabled),
      createdAt: u.created_at ? new Date(u.created_at as string).getTime() : 0,
      stats: computeStats(byUser.get(u.id as string) || []),
    }));
  }
  async setUserAdmin(userId: string, isAdmin: boolean) {
    await this.q("UPDATE users SET is_admin = $2 WHERE id = $1", [userId, isAdmin]);
  }
  async setUserDisabled(userId: string, disabled: boolean) {
    await this.q("UPDATE users SET disabled = $2 WHERE id = $1", [userId, disabled]);
  }
  async setUserPassword(userId: string, passwordHash: string) {
    await this.q("UPDATE users SET password_hash = $2 WHERE id = $1", [userId, passwordHash]);
  }
  async deleteUser(userId: string) {
    // positions удалятся каскадом (ON DELETE CASCADE).
    await this.q("DELETE FROM users WHERE id = $1", [userId]);
  }
}

// Кэшируем на globalThis: в dev каждый route — отдельный бандл, и обычный
// модульный синглтон не разделяется между роутами (in-memory режим ломался бы).
const globalForStore = globalThis as unknown as { __recruiterStore?: Store };

export function getStore(): Store {
  if (!globalForStore.__recruiterStore) {
    // В проде in-memory запрещён: без БД данные тихо терялись бы при рестарте
    // контейнера, а регистрации были бы не изолированы. Требуем DATABASE_URL.
    if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL не задан. В продакшене нужна PostgreSQL — задайте переменную " +
          "окружения DATABASE_URL (иначе данные не сохраняются).",
      );
    }
    if (process.env.DATABASE_URL) {
      // Ленивая загрузка pg, чтобы in-memory режим не требовал драйвер.

      const { Pool } = require("pg") as typeof import("pg");
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PGSSL === "disable" ? undefined : { rejectUnauthorized: false },
        // Приложение и база могут стоять в разных странах, и канал между ними
        // иногда подтормаживает. Без явного таймаута зависшее TCP-соединение
        // держит запрос до таймаута ОС — пользователь смотрит на крутилку
        // полторы минуты и получает «Ошибка регистрации».
        connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 8000),
        idleTimeoutMillis: 30_000,
        keepAlive: true,
        max: 10,
      });
      // Иначе ошибка простаивающего соединения роняет процесс целиком.
      pool.on("error", (e) => {
        console.error("[db] соединение в пуле оборвалось:", e.message);
      });
      globalForStore.__recruiterStore = new PgStore(pool);
    } else {
      globalForStore.__recruiterStore = new MemoryStore();
    }
  }
  return globalForStore.__recruiterStore;
}

export function usingDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
