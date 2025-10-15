// src/routes/auth/logout/+server.ts
import type { RequestHandler } from "./$types";
import { redirect } from "@sveltejs/kit";
import { authService } from "$lib/server/auth/bff.js";

export const POST: RequestHandler = async ({ cookies, locals }) => {
  const sessionId = cookies.get("session_id");

  if (sessionId && locals.user) {
    // Получаем сессию перед удалением для отзыва токена
    const session = await authService.getSession(sessionId);

    // Отзываем refresh token в IdP
    if (session?.refreshToken) {
      await authService.revokeToken(session.refreshToken);
    }

    // Удаляем сессию с сервера
    await authService.deleteSession(sessionId);
  }

  // Удаляем cookie
  cookies.delete("session_id", { path: "/" });

  throw redirect(302, "/");
};
