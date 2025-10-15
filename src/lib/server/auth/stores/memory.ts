// src/lib/server/auth/stores/memory.ts
import type { SessionStore, SessionData } from "../session-store.js";

/**
 * In-Memory Session Store
 *
 * ⚠️ ВНИМАНИЕ: Только для разработки!
 * - Сессии теряются при перезапуске
 * - Не подходит для горизонтального масштабирования
 * - Возможна утечка памяти при большом количестве сессий
 *
 * Для production используйте RedisSessionStore или PostgresSessionStore
 */
export class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, SessionData>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options?: { cleanupIntervalMs?: number }) {
    const cleanupIntervalMs = options?.cleanupIntervalMs ?? 5 * 60 * 1000; // 5 минут
    this.startCleanupTimer(cleanupIntervalMs);
  }

  createSession(sessionData: SessionData): void {
    this.sessions.set(sessionData.sessionId, sessionData);
  }

  getSession(sessionId: string): SessionData | null {
    return this.sessions.get(sessionId) ?? null;
  }

  updateSession(sessionId: string, updates: Partial<SessionData>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    this.sessions.set(sessionId, { ...session, ...updates });
    return true;
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
      }
    }
  }

  private startCleanupTimer(intervalMs: number): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, intervalMs);

    // Не блокируем выход из процесса
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.sessions.clear();
  }

  // Дополнительные методы для отладки
  getSessionCount(): number {
    return this.sessions.size;
  }

  getAllSessions(): SessionData[] {
    return Array.from(this.sessions.values());
  }
}
