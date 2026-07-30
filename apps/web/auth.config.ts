import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: { signIn: "/login", verifyRequest: "/login/verificar", error: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }: { auth: any; request: any }) {
      if (request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/api/admin") || request.nextUrl.pathname.startsWith("/api/account")) return Boolean(auth?.user);
      return true;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
