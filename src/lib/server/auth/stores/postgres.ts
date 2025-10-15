// src/lib/server/auth/stores/postgres.ts
import type { SessionStore, SessionData } from "../session-store.js";

/**
 * PostgreSQL Session Store
 *
 * ✅ Отличный выбор если у вас уже есть PostgreSQL
 * - Полная персистентность
 * - ACID транзакции
 * - Легко интегрируется с существующей БД
 * - Поддержка индексов для быстрого поиска
 *
 * Установка:
 *   npm install pg  // или используйте свой ORM (Drizzle, Prisma и т.д.)
 *
 * SQL для создания таблицы:
 *   CREATE TABLE sessions (
 *     session_id VARCHAR(255) PRIMARY KEY,
 *     user_id VARCHAR(255) NOT NULL,
 *     access_token TEXT,
 *     refresh_token TEXT,
 *     id_token TEXT,
 *     expires_at BIGINT NOT NULL,
 *     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 *   );
 *   CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
 *   CREATE INDEX idx_sessions_user_id ON sessions(user_id);
 *
 * Использование:
 *   import { Pool } from 'pg';
 *   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 *   const store = new PostgresSessionStore(pool);
 */

interface PostgresClient {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
  end(): Promise<void>;
}

export class PostgresSessionStore implements SessionStore {
  private tableName: string;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private db: PostgresClient,
    private options?: {
      tableName?: string;
      cleanupIntervalMs?: number;
    },
  ) {
    this.tableName = options?.tableName ?? "sessions";

    const cleanupIntervalMs = options?.cleanupIntervalMs ?? 60 * 60 * 1000; // 1 час
    this.startCleanupTimer(cleanupIntervalMs);
  }

  async createSession(sessionData: SessionData): Promise<void> {
    const query = `
      INSERT INTO ${this.tableName} 
        (session_id, user_id, access_token, refresh_token, id_token, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (session_id) 
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        id_token = EXCLUDED.id_token,
        expires_at = EXCLUDED.expires_at,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.db.query(query, [
      sessionData.sessionId,
      sessionData.userId,
      sessionData.accessToken ?? null,
      sessionData.refreshToken ?? null,
      sessionData.idToken ?? null,
      sessionData.expiresAt,
    ]);
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const query = `
      SELECT session_id, user_id, access_token, refresh_token, id_token, expires_at
      FROM ${this.tableName}
      WHERE session_id = $1 AND expires_at > $2
    `;

    const result = await this.db.query(query, [sessionId, Date.now()]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0] as Record<string, unknown>;

    return {
      sessionId: row.session_id as string,
      userId: row.user_id as string,
      accessToken: (row.access_token as string) ?? undefined,
      refreshToken: (row.refresh_token as string) ?? undefined,
      idToken: (row.id_token as string) ?? undefined,
      expiresAt: row.expires_at as number,
    };
  }

  async updateSession(
    sessionId: string,
    updates: Partial<SessionData>,
  ): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    const updated = { ...session, ...updates };
    await this.createSession(updated);
    return true;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE session_id = $1`;
    const result = (await this.db.query(query, [sessionId])) as unknown;
    return (result as { rowCount?: number }).rowCount !== undefined
      ? ((result as { rowCount: number }).rowCount ?? 0) > 0
      : false;
  }

  async cleanupExpiredSessions(): Promise<void> {
    const query = `DELETE FROM ${this.tableName} WHERE expires_at < $1`;
    const result = (await this.db.query(query, [Date.now()])) as unknown;
    const deleted =
      (result as { rowCount?: number }).rowCount !== undefined
        ? ((result as { rowCount: number }).rowCount ?? 0)
        : 0;

    if (deleted > 0) {
      console.log(`Postgres cleanup: ${deleted} expired sessions deleted`);
    }
  }

  private startCleanupTimer(intervalMs: number): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions().catch((error) => {
        console.error("Session cleanup error:", error);
      });
    }, intervalMs);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    await this.db.end();
  }

  // Дополнительные методы для мониторинга
  async getSessionCount(): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE expires_at > $1`;
    const result = await this.db.query(query, [Date.now()]);
    return (result.rows[0] as { count: string }).count
      ? parseInt((result.rows[0] as { count: string }).count)
      : 0;
  }

  async getUserSessions(userId: string): Promise<SessionData[]> {
    const query = `
      SELECT session_id, user_id, access_token, refresh_token, id_token, expires_at
      FROM ${this.tableName}
      WHERE user_id = $1 AND expires_at > $2
      ORDER BY expires_at DESC
    `;

    const result = await this.db.query(query, [userId, Date.now()]);

    return result.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        sessionId: r.session_id as string,
        userId: r.user_id as string,
        accessToken: (r.access_token as string) ?? undefined,
        refreshToken: (r.refresh_token as string) ?? undefined,
        idToken: (r.id_token as string) ?? undefined,
        expiresAt: r.expires_at as number,
      };
    });
  }
}
