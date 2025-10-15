// src/lib/server/auth/session-store.ts

/**
 * Интерфейс для хранения сессий
 * Позволяет легко переключаться между разными storage решениями
 */

export interface SessionData {
  sessionId: string;
  userId: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number;
}

export interface SessionStore {
  /**
   * Создать новую сессию
   */
  createSession(sessionData: SessionData): Promise<void> | void;

  /**
   * Получить сессию по ID
   */
  getSession(
    sessionId: string,
  ): Promise<SessionData | null> | SessionData | null;

  /**
   * Обновить существующую сессию
   */
  updateSession(
    sessionId: string,
    updates: Partial<SessionData>,
  ): Promise<boolean> | boolean;

  /**
   * Удалить сессию
   */
  deleteSession(sessionId: string): Promise<boolean> | boolean;

  /**
   * Очистить истекшие сессии
   */
  cleanupExpiredSessions(): Promise<void> | void;

  /**
   * Остановить автоматическую очистку (если есть)
   */
  shutdown?(): Promise<void> | void;
}
