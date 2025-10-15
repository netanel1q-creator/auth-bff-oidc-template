// src/routes/+layout.server.ts
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user
      ? {
          userId: locals.user.userId,
          isAuthenticated: true,
        }
      : null,
  };
};
