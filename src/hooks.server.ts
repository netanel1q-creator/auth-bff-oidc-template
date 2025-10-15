// src/hooks.server.ts
import { sequence } from "@sveltejs/kit/hooks";
import { authMiddleware } from "$lib/server/auth/middleware.js";
import {
  createRateLimiter,
  rateLimitPresets,
} from "$lib/server/auth/rate-limiter.js";

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Строгий rate limiting для auth endpoints
 * 5 попыток за минуту для защиты от брутфорса
 */
const authRateLimiter = createRateLimiter(rateLimitPresets.strictAuth);

/**
 * Мягкий rate limiting для API endpoints
 * 30 запросов за минуту
 */
const apiRateLimiter = createRateLimiter(rateLimitPresets.api);

// ============================================================================
// Middleware Chain
// ============================================================================

export const handle = sequence(
  // 1. Rate limiting для auth endpoints (защита от брутфорса)
  authRateLimiter({
    routes: ["/auth/login", "/auth/callback", "/auth/logout"],
  }),

  // 2. Rate limiting для API endpoints
  apiRateLimiter({
    routes: ["/api"],
  }),

  // 3. Аутентификация (проверка сессий, обновление токенов)
  authMiddleware,
);

// ============================================================================
// Настройка rate limiting (опционально)
// ============================================================================

// Для более тонкой настройки раскомментируйте и измените:

/*
const customAuthLimiter = createRateLimiter({
  maxRequests: 3,              // Максимум запросов
  windowMs: 60000,             // За 1 минуту
  skipSuccessfulRequests: true, // Не считать успешные
  message: 'Слишком много попыток входа. Попробуйте через минуту.',
  skipIps: ['127.0.0.1']       // Whitelist IP
});

export const handle = sequence(
  customAuthLimiter({ routes: ['/auth/login'] }),
  authMiddleware
);
*/

// ============================================================================
// Production Tips
// ============================================================================

// 1. Для production используйте Redis-based rate limiter:
//    - npm install ioredis
//    - Создайте RedisRateLimiter (аналогично RedisSessionStore)
//
// 2. Настройте мониторинг:
//    - Логируйте 429 ошибки
//    - Отслеживайте IP с частыми блокировками
//
// 3. Рассмотрите дополнительные защиты:
//    - Captcha после N неудачных попыток
//    - Временная блокировка аккаунта
//    - Email уведомления о подозрительной активности
