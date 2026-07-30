import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId?: string;
      tenantName?: string;
      roles: string[];
      permissions: string[];
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT { userId?: string; tenantId?: string; tenantName?: string; roles?: string[]; permissions?: string[] }
}
