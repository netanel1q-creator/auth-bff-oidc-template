// src/lib/server/auth/rate-limiter.ts
import type { Handle, RequestEvent } from "@sveltejs/kit";
import { error } from "@sveltejs/kit";

/**
 * Simple in-memory rate limiter
 *
 * Отслеживает количество запросов с IP адреса за определённый период.
 * Для production рекомендуется использовать Redis или специализированные решения.
 *
 * @example
 * ```ts
 * // src/hooks.server.ts
 * import { createRateLimiter } from '$lib/server/auth/rate-limiter';
 *
 * const authRateLimiter = createRateLimiter({
 *   maxRequests: 5,
 *   windowMs: 60000, // 1 минута
 *   skipSuccessfulRequests: true
 * });
 *
 * export const handle = sequence(
 *   authRateLimiter({ routes: ['/auth/login', '/auth/callback'] }),
 *   authMiddleware
 * );
 * ```
 */

interface RateLimitOptions {
  /**
   * Максимальное количество запросов за окно
   * @default 10
   */
  maxRequests?: number;

  /**
   * Размер временного окна в миллисекундах
   * @default 60000 (1 минута)
   */
  windowMs?: number;

  /**
   * Не учитывать успешные запросы (status < 400)
   * @default false
   */
  skipSuccessfulRequests?: boolean;

  /**
   * Кастомное сообщение об ошибке
   */
  message?: string;

  /**
   * Пропустить rate limit для определённых IP
   */
  skipIps?: string[];
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private records = new Map<string, RateLimitRecord>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private options: Required<RateLimitOptions>) {
    this.startCleanupTimer();
  }

  /**
   * Проверить лимит для IP
   */
  check(ip: string): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const now = Date.now();
    let record = this.records.get(ip);

    // Создаём новую запись или сбрасываем истекшую
    if (!record || record.resetTime < now) {
      record = {
        count: 0,
        resetTime: now + this.options.windowMs,
      };
      this.records.set(ip, record);
    }

    const allowed = record.count < this.options.maxRequests;
    const remaining = Math.max(0, this.options.maxRequests - record.count - 1);

    return { allowed, remaining, resetTime: record.resetTime };
  }

  /**
   * Увеличить счётчик для IP
   */
  increment(ip: string): void {
    const record = this.records.get(ip);
    if (record) {
      record.count++;
    }
  }

  /**
   * Очистка истекших записей
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [ip, record] of this.records.entries()) {
      if (record.resetTime < now) {
        this.records.delete(ip);
      }
    }
  }

  private startCleanupTimer(): void {
    // Очищаем каждую минуту
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.records.clear();
  }
}

/**
 * Получить IP адрес из события
 */
function getClientIp(event: RequestEvent): string {
  // Проверяем заголовки от проксей
  const forwardedFor = event.request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = event.request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  // Fallback на getClientAddress
  return event.getClientAddress();
}

/**
 * Создать rate limiting middleware
 */
export function createRateLimiter(options: RateLimitOptions = {}) {
  const config: Required<RateLimitOptions> = {
    maxRequests: options.maxRequests ?? 10,
    windowMs: options.windowMs ?? 60000,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    message:
      options.message ??
      "Too many requests from this IP, please try again later.",
    skipIps: options.skipIps ?? [],
  };

  const limiter = new RateLimiter(config);

  return function rateLimitMiddleware(middlewareOptions?: {
    routes?: string[];
  }): Handle {
    const routes = middlewareOptions?.routes;

    return async ({ event, resolve }) => {
      // Если указаны конкретные роуты - проверяем их
      if (
        routes &&
        !routes.some((route) => event.url.pathname.startsWith(route))
      ) {
        return resolve(event);
      }

      const ip = getClientIp(event);

      // Пропускаем whitelist IP
      if (config.skipIps.includes(ip)) {
        return resolve(event);
      }

      // Проверяем лимит
      const { allowed, remaining, resetTime } = limiter.check(ip);

      if (!allowed) {
        error(429, config.message);
      }

      // Увеличиваем счётчик перед запросом
      limiter.increment(ip);

      // Выполняем запрос
      const response = await resolve(event);

      // Если нужно пропускать успешные запросы - откатываем счётчик
      if (config.skipSuccessfulRequests && response.status < 400) {
        const record = limiter["records"].get(ip);
        if (record && record.count > 0) {
          record.count--;
        }
      }

      // Добавляем заголовки с информацией о лимитах
      response.headers.set("X-RateLimit-Limit", config.maxRequests.toString());
      response.headers.set("X-RateLimit-Remaining", remaining.toString());
      response.headers.set(
        "X-RateLimit-Reset",
        new Date(resetTime).toISOString(),
      );

      return response;
    };
  };
}

/**
 * Готовые конфигурации для разных сценариев
 */
export const rateLimitPresets = {
  /**
   * Строгий лимит для аутентификации
   * 5 попыток за минуту
   */
  strictAuth: {
    maxRequests: 5,
    windowMs: 60000,
    skipSuccessfulRequests: true,
    message: "Too many login attempts. Please try again in a minute.",
  },

  /**
   * Средний лимит для API
   * 30 запросов за минуту
   */
  api: {
    maxRequests: 30,
    windowMs: 60000,
    message: "API rate limit exceeded.",
  },

  /**
   * Мягкий лимит для общих запросов
   * 100 запросов за минуту
   */
  general: {
    maxRequests: 100,
    windowMs: 60000,
  },
} as const;
