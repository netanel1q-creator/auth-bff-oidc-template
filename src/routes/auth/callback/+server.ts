// src/routes/auth/callback/+server.ts
import type { RequestHandler } from "./$types";
import { redirect } from "@sveltejs/kit";
import crypto from "crypto";
import { authService } from "$lib/server/auth/bff.js";
import {
  parseOAuthState,
  getSecureCookieOptions,
} from "$lib/server/auth/utils.js";

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedData = cookies.get("oauth_state");

  if (!storedData || !code || !state) {
    throw redirect(302, "/?error=invalid_request");
  }

  // Безопасное извлечение данных OAuth state
  const oauthData = parseOAuthState(storedData);
  if (!oauthData) {
    throw redirect(302, "/?error=invalid_request");
  }

  if (state !== oauthData.state) {
    throw redirect(302, "/?error=invalid_state");
  }

  try {
    // Обмениваем код на токены через BFF сервис
    const tokens = await authService.exchangeCodeForTokens(
      code,
      oauthData.codeVerifier,
    );

    // Создаём сессию с токенами на сервере
    const sessionId = crypto.randomUUID();
    const sessionData = {
      sessionId,
      userId: tokens.sub,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    };

    authService.createSession(sessionData);

    // Устанавливаем только session cookie в браузер
    cookies.set("session_id", sessionId, {
      ...getSecureCookieOptions(),
      maxAge: 86400, // 24 часа
    });

    // Очищаем OAuth state
    cookies.delete("oauth_state", { path: "/" });

    throw redirect(302, "/");
  } catch (error) {
    console.error("OAuth callback error:", error);
    throw redirect(302, "/?error=auth_failed");
  }
};
