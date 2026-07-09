import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no db / bcrypt imports). Used by middleware AND extended in auth.ts.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [], // real providers are added in auth.ts (Node runtime)
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const onAuthPage =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/register");

      if (onAuthPage) {
        // Already signed in? bounce to the dashboard.
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }
      // Everything else requires a session.
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
