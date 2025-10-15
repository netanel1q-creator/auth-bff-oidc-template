// src/lib/server/auth/utils.ts
import crypto from "crypto";

/**
 * Безопасная генерация случайного состояния для OAuth
 */
export function generateSecureState(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Проверка валидности OAuth state
 */
export function isValidState(state: string): boolean {
  return typeof state === "string" && state.length >= 16;
}

/**
 * Проверка валидности session ID
 */
export function isValidSessionId(sessionId: string): boolean {
  return typeof sessionId === "string" && sessionId.length > 0;
}

/**
 * Проверка валидности OAuth кода
 */
export function isValidAuthCode(code: string): boolean {
  return typeof code === "string" && code.length > 0;
}

/**
 * Проверка валидности timestamp (не старше 10 минут)
 */
export function isValidTimestamp(timestamp: number): boolean {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 минут
  return now - timestamp < maxAge;
}

/**
 * Безопасное извлечение данных из cookie
 */
export function parseOAuthState(
  stateData: string,
): { state: string; codeVerifier: string; timestamp: number } | null {
  try {
    const parsed = JSON.parse(stateData);

    if (
      typeof parsed.state === "string" &&
      typeof parsed.codeVerifier === "string" &&
      typeof parsed.timestamp === "number" &&
      isValidState(parsed.state) &&
      isValidTimestamp(parsed.timestamp)
    ) {
      return parsed;
    }

    return null;
  } catch (error) {
    console.error("Failed to parse OAuth state:", error);
    return null;
  }
}

/**
 * Проверка окружения production
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Проверка безопасности cookie настроек
 */
export function getSecureCookieOptions(production?: boolean) {
  const isProd = production ?? isProduction();
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict" as const,
    path: "/",
  };
}

/**
 * Проверка безопасности OAuth state cookie настроек
 */
export function getOAuthStateCookieOptions(production?: boolean) {
  const isProd = production ?? isProduction();
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    maxAge: 600, // 10 минут
    path: "/",
  };
}
