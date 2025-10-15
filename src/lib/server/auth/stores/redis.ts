// src/lib/server/auth/stores/redis.ts
import type { SessionStore, SessionData } from "../session-store.js";

/**
 * Redis Session Store
 *
 * ✅ Рекомендуется для production
 * - Персистентность данных
 * - Горизонтальное масштабирование
 * - Автоматическое истечение через TTL
 * - Высокая производительность
 *
 * Установка:
 *   npm install ioredis
 *
 * Использование:
 *   import { Redis } from 'ioredis';
 *   const redis = new Redis(process.env.REDIS_URL);
 *   const store = new RedisSessionStore(redis);
 */

interface RedisClient {
  setex(key: string, seconds: number, value: string): Promise<"OK">;
  get(key: string): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  ttl(key: string): Promise<number>;
  quit(): Promise<"OK">;
}

export class RedisSessionStore implements SessionStore {
  private prefix: string;
  private defaultTTL: number;

  constructor(
    private redis: RedisClient,
    private options?: {
      prefix?: string;
      defaultTTL?: number;
    },
  ) {
    this.prefix = options?.prefix ?? "session:";
    this.defaultTTL = options?.defaultTTL ?? 86400; // 24 часа
  }

  async createSession(sessionData: SessionData): Promise<void> {
    const key = this.getKey(sessionData.sessionId);
    const ttl = Math.floor((sessionData.expiresAt - Date.now()) / 1000);

    await this.redis.setex(key, Math.max(ttl, 60), JSON.stringify(sessionData));
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const key = this.getKey(sessionId);
    const data = await this.redis.get(key);

    if (!data) return null;

    try {
      const session = JSON.parse(data) as SessionData;

      // Дополнительная проверка на истечение
      if (session.expiresAt < Date.now()) {
        await this.deleteSession(sessionId);
        return null;
      }

      return session;
    } catch (error) {
      console.error("Failed to parse session data:", error);
      await this.deleteSession(sessionId);
      return null;
    }
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
    const key = this.getKey(sessionId);
    const deleted = await this.redis.del(key);
    return deleted > 0;
  }

  async cleanupExpiredSessions(): Promise<void> {
    // Redis автоматически удаляет истекшие ключи через TTL
    // Этот метод можно оставить пустым или использовать для логирования
    const keys = await this.redis.keys(`${this.prefix}*`);
    let expiredCount = 0;

    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl === -2) {
        // Ключ уже не существует
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      console.log(`Redis cleanup: ${expiredCount} expired sessions`);
    }
  }

  async shutdown(): Promise<void> {
    await this.redis.quit();
  }

  private getKey(sessionId: string): string {
    return `${this.prefix}${sessionId}`;
  }

  // Дополнительные методы для мониторинга
  async getSessionCount(): Promise<number> {
    const keys = await this.redis.keys(`${this.prefix}*`);
    return keys.length;
  }
}
