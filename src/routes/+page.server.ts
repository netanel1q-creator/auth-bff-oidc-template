// src/routes/+page.server.ts
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  return {
    user: locals.user
      ? {
          userId: locals.user.userId,
          isAuthenticated: true,
        }
      : null,
    error: url.searchParams.get("error"),
  };
};
