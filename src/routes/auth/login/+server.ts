// src/routes/auth/login/+server.ts
import type { RequestHandler } from "./$types";
import { redirect, isRedirect } from "@sveltejs/kit";
import { authService } from "$lib/server/auth/bff.js";
import {
  generateSecureState,
  getOAuthStateCookieOptions,
} from "$lib/server/auth/utils.js";

export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const { codeVerifier, codeChallenge } = authService.generatePKCE();
    const state = generateSecureState();

    // Сохраняем PKCE данные в защищённой cookie
    cookies.set(
      "oauth_state",
      JSON.stringify({
        state,
        codeVerifier,
        timestamp: Date.now(),
      }),
      getOAuthStateCookieOptions(),
    );

    const authUrl = authService.getAuthUrl(state, codeChallenge);
    redirect(302, authUrl);
  } catch (error) {
    // Если это редирект - пробрасываем его дальше
    if (isRedirect(error)) {
      throw error;
    }
    // Только реальные ошибки логируем
    console.error("Login initiation error:", error);
    redirect(302, "/?error=auth_failed");
  }
};
