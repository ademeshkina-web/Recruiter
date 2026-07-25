import type { Pool } from "pg";
import { Position } from "./types";

export interface DBUser {
  id: string;
  email: string;
  password_hash: string;
}

export interface Store {
  init(): Promise<void>;
  getUserByEmail(email: string): Promise<DBUser | null>;
  getUserById(id: string): Promise<DBUser | null>;
  createUser(email: string, passwordHash: string): Promise<DBUser>;
  listPositions(userId: string): Promise<Position[]>;
  upsertPosition(userId: string, position: Position): Promise<void>;
  deletePosition(userId: string, id: string): Promise<void>;
}

function uid(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4) +
    Math.random().toString(36).slice(2, 6)
  );
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
    const u: DBUser = { id: uid(), email, password_hash: passwordHash };
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
}

// ---- PostgreSQL (прод). Позиции хранятся как JSONB. ----
class PgStore implements Store {
  private pool: Pool;
  private ready: Promise<void> | null = null;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  init() {
    if (!this.ready) {
      this.ready = (async () => {
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          );
        `);
        await this.pool.query(`
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

  async getUserByEmail(email: string) {
    const r = await this.pool.query(
      "SELECT id, email, password_hash FROM users WHERE email = $1",
      [email],
    );
    return r.rows[0] || null;
  }
  async getUserById(id: string) {
    const r = await this.pool.query(
      "SELECT id, email, password_hash FROM users WHERE id = $1",
      [id],
    );
    return r.rows[0] || null;
  }
  async createUser(email: string, passwordHash: string) {
    const id = uid();
    await this.pool.query(
      "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)",
      [id, email, passwordHash],
    );
    return { id, email, password_hash: passwordHash };
  }
  async listPositions(userId: string) {
    const r = await this.pool.query(
      "SELECT data FROM positions WHERE user_id = $1 ORDER BY updated_at DESC",
      [userId],
    );
    return r.rows.map((row) => row.data as Position);
  }
  async upsertPosition(userId: string, position: Position) {
    await this.pool.query(
      `INSERT INTO positions (id, user_id, data, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
      [position.id, userId, position, position.updatedAt],
    );
  }
  async deletePosition(userId: string, id: string) {
    await this.pool.query("DELETE FROM positions WHERE user_id = $1 AND id = $2", [userId, id]);
  }
}

// Кэшируем на globalThis: в dev каждый route — отдельный бандл, и обычный
// модульный синглтон не разделяется между роутами (in-memory режим ломался бы).
const globalForStore = globalThis as unknown as { __recruiterStore?: Store };

export function getStore(): Store {
  if (!globalForStore.__recruiterStore) {
    if (process.env.DATABASE_URL) {
      // Ленивая загрузка pg, чтобы in-memory режим не требовал драйвер.

      const { Pool } = require("pg") as typeof import("pg");
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PGSSL === "disable" ? undefined : { rejectUnauthorized: false },
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
