import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { compare } from "bcryptjs";
import { TOTP } from "otpauth";
import { z } from "zod";
import { cookies } from "next/headers";
import { getPrisma } from "./lib/prisma";
import { findActiveReferral, REFERRAL_COOKIE } from "./lib/referrals";
import { isTeamProfile, SYSTEM_ROLES, SYSTEM_ROLE_LABELS } from "./lib/rbac";
import { authConfig } from "./auth.config";

import { verifyImpersonateToken } from "./lib/impersonate";

const credentialsSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  otp: z.string().optional(),
  impersonateToken: z.string().optional(),
});
const providers: any[] = [Google];
if (process.env.RESEND_API_KEY)
  providers.push(
    Resend({
      from:
        process.env.AUTH_EMAIL_FROM ?? "TrajetixERP <onboarding@resend.dev>",
    }),
  );

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(getPrisma()),
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  providers: [
    ...providers,
    Credentials({
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
        otp: { label: "Código 2FA", type: "text" },
        impersonateToken: { label: "Token de Impersonación", type: "text" },
      },
      async authorize(raw: Record<string, any>) {
        if (raw?.impersonateToken && typeof raw.impersonateToken === "string") {
          const verified = verifyImpersonateToken(raw.impersonateToken);
          if (verified) {
            const user = await getPrisma().user.findUnique({
              where: { id: verified.targetUserId },
            });
            if (user) {
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                image: user.image,
              };
            }
          }
        }

        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success || !parsed.data.email || !parsed.data.password) return null;
        const user = await getPrisma().user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (
          !user?.passwordHash ||
          !(await compare(parsed.data.password, user.passwordHash))
        )
          return null;
        if (user.twoFactorReady) {
          if (!user.twoFactorSecret || !parsed.data.otp) return null;
          const totp = new TOTP({ secret: user.twoFactorSecret });
          if (totp.validate({ token: parsed.data.otp, window: 1 }) === null)
            return null;
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }: { token: any; user?: any }) {
      const userId = user?.id ?? String(token.userId ?? token.sub ?? "");
      if (userId) {
        token.userId = userId;
        const dbUser = await getPrisma().user.findUnique({
          where: { id: userId },
          select: { platformRole: true },
        });
        token.platformRole = dbUser?.platformRole;

        const membership = await getPrisma().membership.findFirst({
          where: { userId, status: "ACTIVE" },
          include: { tenant: true, roles: { include: { role: true } } },
        });
        token.tenantId = membership?.tenantId;
        token.tenantName = membership?.tenant.displayName;
        token.roles = membership?.roles.map(({ role }) => role.name) ?? [
          "viewer",
        ];
        if (membership) {
          const rolePermissions = [
            ...new Set(
              membership.roles.flatMap(({ role }): string[] =>
                role.systemKey && SYSTEM_ROLES[role.systemKey]
                  ? [...SYSTEM_ROLES[role.systemKey]!]
                  : role.permissions,
              ),
            ),
          ];
          const limitedProfile = membership.roles.some(({ role }) =>
            isTeamProfile(role.systemKey),
          );
          token.permissions = membership.usePermissionOverrides
            ? membership.permissionOverrides.filter(
                (permission) =>
                  !limitedProfile ||
                  rolePermissions.includes(permission as never),
              )
            : rolePermissions;
        } else token.permissions = ["dashboard:read"];
      }
      return token;
    },
    session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = String(token.userId ?? token.sub);
        session.user.platformRole = token.platformRole;
        if (token.tenantId) session.user.tenantId = String(token.tenantId);
        if (token.tenantName)
          session.user.tenantName = String(token.tenantName);
        session.user.roles = (token.roles as string[] | undefined) ?? [];
        session.user.permissions =
          (token.permissions as string[] | undefined) ?? [];
      }
      return session;
    },
  },
  events: {
    async signIn({ user }: { user: any }) {
      if (!user.email || !user.id) return;
      const email = user.email.toLowerCase();
      await getPrisma().user.update({
        where: { id: user.id },
        data: { email, lastLoginAt: new Date() },
      });
      const existing = await getPrisma().membership.findFirst({
        where: { userId: user.id },
      });
      if (existing) return;
      const invitation = await getPrisma().invitation.findFirst({
        where: { email, acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      });
      if (invitation) {
        const membership = await getPrisma().membership.create({
          data: {
            userId: user.id,
            tenantId: invitation.tenantId,
            status: "ACTIVE",
          },
        });
        let roleId = invitation.roleId;
        if (!roleId) {
          const customerRoleName = SYSTEM_ROLE_LABELS.cliente!;
          const customer = await getPrisma().role.upsert({
            where: {
              tenantId_name: {
                tenantId: invitation.tenantId,
                name: customerRoleName,
              },
            },
            update: {},
            create: {
              tenantId: invitation.tenantId,
              name: customerRoleName,
              systemKey: "cliente",
              permissions: [...SYSTEM_ROLES.cliente!],
            },
          });
          roleId = customer.id;
        }
        await getPrisma().$transaction([
          getPrisma().membershipRole.create({
            data: { membershipId: membership.id, roleId },
          }),
          getPrisma().invitation.update({
            where: { id: invitation.id },
            data: { acceptedAt: new Date() },
          }),
        ]);
        return;
      }
      const baseSlug =
        email
          .split("@")[0]!
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 50) || "organizacion";
      let referralCode: string | undefined;
      try {
        referralCode = (await cookies()).get(REFERRAL_COOKIE)?.value;
      } catch {
        referralCode = undefined;
      }
      const referrer = await findActiveReferral(getPrisma(), referralCode);
      const tenant = await getPrisma().tenant.create({
        data: {
          slug: `${baseSlug}-${user.id.slice(0, 6)}`,
          legalName: user.name ?? email,
          displayName: user.name ? `Equipo de ${user.name}` : "Mi organización",
          memberships: { create: { userId: user.id, status: "ACTIVE" } },
          roles: {
            create: Object.entries(SYSTEM_ROLES).map(
              ([systemKey, permissions]) => ({
                name: SYSTEM_ROLE_LABELS[systemKey] ?? systemKey,
                systemKey,
                permissions: [...permissions],
              }),
            ),
          },
          branding: { create: {} },
          configuration: { create: {} },
        },
        include: { memberships: true, roles: true },
      });
      const ownerRole = tenant.roles.find(
        (role) => role.systemKey === "owner",
      )!;
      await getPrisma().membershipRole.create({
        data: { membershipId: tenant.memberships[0]!.id, roleId: ownerRole.id },
      });
      if (referrer && referrer.tenantId !== tenant.id) {
        await getPrisma().referralAttribution.create({
          data: {
            referralProfileId: referrer.id,
            referredTenantId: tenant.id,
          },
        });
      }
    },
  },
});
