// src/lib/server/auth/middleware.ts
import type { Handle } from "@sveltejs/kit";
import { authService } from "./bff.js";

export const authMiddleware: Handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get("session_id");

  if (!sessionId) {
    event.locals.user = undefined;
    event.locals.accessToken = undefined;
    return resolve(event);
  }

  const session = await authService.getSession(sessionId);

  if (!session || session.expiresAt < Date.now()) {
    event.cookies.delete("session_id", { path: "/" });
    event.locals.user = undefined;
    event.locals.accessToken = undefined;
    return resolve(event);
  }

  // Проверяем и обновляем access token если нужно
  if (authService.shouldRefreshToken(session) && session.refreshToken) {
    try {
      const newTokens = await authService.refreshToken(session.refreshToken);

      // Обновляем сессию
      const updated = await authService.updateSession(sessionId, {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || session.refreshToken,
        expiresAt: Date.now() + newTokens.expires_in * 1000,
      });

      if (!updated) {
        event.cookies.delete("session_id", { path: "/" });
        event.locals.user = undefined;
        event.locals.accessToken = undefined;
        return resolve(event);
      }

      // Получаем обновлённую сессию
      const updatedSession = await authService.getSession(sessionId);
      if (updatedSession) {
        event.locals.user = {
          userId: updatedSession.userId,
          sessionId: updatedSession.sessionId,
        };
        event.locals.accessToken = updatedSession.accessToken;
      }

      return resolve(event);
    } catch (error) {
      console.error("Token refresh failed:", error);
      event.cookies.delete("session_id", { path: "/" });
      event.locals.user = undefined;
      event.locals.accessToken = undefined;
      return resolve(event);
    }
  }

  // Устанавливаем данные пользователя в locals
  event.locals.user = {
    userId: session.userId,
    sessionId: session.sessionId,
  };
  event.locals.accessToken = session.accessToken;

  return resolve(event);
};
