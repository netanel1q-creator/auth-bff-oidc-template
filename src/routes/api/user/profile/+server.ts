// src/routes/api/user/profile/+server.ts
import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ locals, fetch }) => {
  if (!locals.user || !locals.accessToken) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Используем access token для вызова внешнего API
    const response = await fetch("https://api.example.com/user/profile", {
      headers: {
        Authorization: `Bearer ${locals.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const userData = await response.json();
    return json(userData);
  } catch (err) {
    console.error("Failed to fetch user data:", err);
    return json({ error: "Failed to fetch user data" }, { status: 500 });
  }
};
