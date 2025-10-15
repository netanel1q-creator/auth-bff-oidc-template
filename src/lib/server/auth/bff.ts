// src/lib/server/auth/bff.ts
import crypto from "crypto";
import {
  OIDC_ISSUER,
  OIDC_CLIENT_ID,
  OIDC_CLIENT_SECRET,
  OIDC_REDIRECT_URI,
} from "$env/static/private";
import type { SessionStore, SessionData } from "./session-store.js";
import { MemorySessionStore } from "./stores/memory.js";

export type { SessionData } from "./session-store.js";

export interface OIDCConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
  sub: string;
}

/**
 * Backend-for-Frontend Auth Service
 *
 * Управляет OAuth/OIDC потоком и хранением сессий.
 * Токены остаются на сервере, браузер получает только HTTP-only cookie.
 *
 * По умолчанию использует MemorySessionStore (только для dev).
 * Для production передайте RedisSessionStore или PostgresSessionStore:
 *
 * @example
 * ```ts
 * import { Redis } from 'ioredis';
 * import { RedisSessionStore } from './stores/redis';
 *
 * const redis = new Redis(process.env.REDIS_URL);
 * const sessionStore = new RedisSessionStore(redis);
 * const authService = new BFFAuthService(config, sessionStore);
 * ```
 */
export class BFFAuthService {
  public config: OIDCConfig;
  private sessionStore: SessionStore;

  constructor(config: OIDCConfig, sessionStore?: SessionStore) {
    this.config = config;
    this.sessionStore = sessionStore ?? new MemorySessionStore();
  }

  // ==================== PKCE & OAuth ====================

  /**
   * Генерация PKCE challenge для защиты OAuth flow
   */
  generatePKCE() {
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    return { codeVerifier, codeChallenge };
  }

  /**
   * Создание URL для редиректа на Identity Provider
   */
  getAuthUrl(state: string, codeChallenge: string) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(" "),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    return `${this.config.issuer}/auth?${params.toString()}`;
  }

  /**
   * Обмен authorization code на токены
   */
  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
  ): Promise<TokenResponse> {
    const response = await fetch(`${this.config.issuer}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${this.config.clientId}:${this.config.clientSecret}`,
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.config.redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Token exchange failed: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  }

  /**
   * Обновление access token с помощью refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const response = await fetch(`${this.config.issuer}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Token refresh failed: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  }

  /**
   * Отзыв токена в Identity Provider
   */
  async revokeToken(token: string): Promise<void> {
    try {
      await fetch(`${this.config.issuer}/revoke`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          token,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });
    } catch (error) {
      console.error("Token revocation failed:", error);
    }
  }

  // ==================== Session Management ====================

  /**
   * Получение сессии по ID
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const result = this.sessionStore.getSession(sessionId);
    return result instanceof Promise ? await result : result;
  }

  /**
   * Создание новой сессии
   */
  async createSession(sessionData: SessionData): Promise<void> {
    const result = this.sessionStore.createSession(sessionData);
    if (result instanceof Promise) await result;
  }

  /**
   * Обновление существующей сессии
   */
  async updateSession(
    sessionId: string,
    updates: Partial<SessionData>,
  ): Promise<boolean> {
    const result = this.sessionStore.updateSession(sessionId, updates);
    return result instanceof Promise ? await result : result;
  }

  /**
   * Удаление сессии
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const result = this.sessionStore.deleteSession(sessionId);
    return result instanceof Promise ? await result : result;
  }

  /**
   * Проверка необходимости обновления токена
   */
  shouldRefreshToken(session: SessionData): boolean {
    return session.expiresAt - Date.now() < 300000; // За 5 минут до истечения
  }

  /**
   * Очистка истекших сессий
   */
  async cleanupExpiredSessions(): Promise<void> {
    const result = this.sessionStore.cleanupExpiredSessions();
    if (result instanceof Promise) await result;
  }

  /**
   * Остановка сервиса и очистка ресурсов
   */
  async shutdown(): Promise<void> {
    if (this.sessionStore.shutdown) {
      const result = this.sessionStore.shutdown();
      if (result instanceof Promise) await result;
    }
  }
}

// ==================== Default Instance ====================

/**
 * Экземпляр по умолчанию с MemorySessionStore
 *
 * ⚠️ Для production создайте свой экземпляр с Redis или Postgres:
 *
 * @example
 * ```ts
 * // src/lib/server/auth/index.ts
 * import { Redis } from 'ioredis';
 * import { BFFAuthService } from './bff';
 * import { RedisSessionStore } from './stores/redis';
 * import { REDIS_URL, ... } from '$env/static/private';
 *
 * const redis = new Redis(REDIS_URL);
 * const sessionStore = new RedisSessionStore(redis);
 *
 * export const authService = new BFFAuthService({
 *   issuer: OIDC_ISSUER,
 *   clientId: OIDC_CLIENT_ID,
 *   clientSecret: OIDC_CLIENT_SECRET,
 *   redirectUri: OIDC_REDIRECT_URI,
 *   scopes: ['openid', 'profile', 'email']
 * }, sessionStore);
 * ```
 */
export const authService = new BFFAuthService({
  issuer: OIDC_ISSUER || "https://your-oidc-provider.com",
  clientId: OIDC_CLIENT_ID || "your-client-id",
  clientSecret: OIDC_CLIENT_SECRET || "your-client-secret",
  redirectUri: OIDC_REDIRECT_URI || "http://localhost:5173/auth/callback",
  scopes: ["openid", "profile", "email"],
});
