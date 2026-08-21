export const dynamic = "force-dynamic";

import { hash } from "bcryptjs";
import { z } from "zod";
import { getPrisma } from "../../../../lib/prisma";
import {
  isTeamProfile,
  MODULE_PERMISSIONS,
  SYSTEM_ROLES,
  SYSTEM_ROLE_LABELS,
  TEAM_PROFILE_KEYS,
} from "../../../../lib/rbac";
import { requireTenantOwner, tenantError } from "../../../../lib/tenant";

const allPermissions = new Set<string>(
  Object.values(MODULE_PERMISSIONS).flat(),
);

async function getMembership(tenantId: string, membershipId: string) {
  return getPrisma().membership.findFirst({
    where: { id: membershipId, tenantId },
    include: { user: true, roles: { include: { role: true } } },
  });
}

function isOwner(membership: Awaited<ReturnType<typeof getMembership>>) {
  return (
    membership?.roles.some(({ role }) => role.systemKey === "owner") ?? false
  );
}

async function syncTeamRoles(tenantId: string) {
  const prisma = getPrisma();
  return Promise.all(
    TEAM_PROFILE_KEYS.map(async (systemKey) => {
      const name = SYSTEM_ROLE_LABELS[systemKey]!;
      const permissions = [...SYSTEM_ROLES[systemKey]!];
      const existing = await prisma.role.findFirst({
        where: { tenantId, systemKey },
      });
      return existing
        ? prisma.role.update({
            where: { id: existing.id },
            data: { name, permissions },
          })
        : prisma.role.create({
            data: { tenantId, systemKey, name, permissions },
          });
    }),
  );
}

export async function GET() {
  try {
    const { tenantId, isSuperAdmin } = await requireTenantOwner();
    const prisma = getPrisma();
    const roles = await syncTeamRoles(tenantId);
    const members = await prisma.membership.findMany({
      where: isSuperAdmin ? {} : { tenantId },
      include: {
        tenant: {
          select: {
            displayName: true,
            legalName: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            phone: true,
            platformRole: true,
            lastLoginAt: true,
          },
        },
        roles: { include: { role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({
      members: members.map((member) => {
        const rolePermissions = [
          ...new Set(
            member.roles.flatMap(({ role }): string[] =>
              role.systemKey && SYSTEM_ROLES[role.systemKey]
                ? [...SYSTEM_ROLES[role.systemKey]!]
                : role.permissions,
            ),
          ),
        ];
        return {
          id: member.id,
          status: member.status,
          storeName: member.tenant?.displayName || member.tenant?.legalName || "Mi tienda",
          user: member.user,
          roles: member.roles.map(({ role }) => ({
            id: role.id,
            name: role.name,
            systemKey: role.systemKey,
          })),
          permissions: member.usePermissionOverrides
            ? member.permissionOverrides.filter((permission) =>
                rolePermissions.includes(permission as never),
              )
            : rolePermissions,
          customPermissions: member.usePermissionOverrides,
        };
      }),
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        systemKey: role.systemKey,
        permissions: role.permissions,
      })),
      modules: MODULE_PERMISSIONS,
    });
  } catch (error) {
    return tenantError(error);
  }
}

const createInput = z.object({
  name: z.string().trim().min(2).max(150),
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(40).optional().default(""),
  password: z.string().min(8).max(100),
  roleId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenantOwner();
    const parsed = createInput.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: "Revisa nombre, correo, contraseña y perfil" },
        { status: 400 },
      );
    const prisma = getPrisma();
    const [existingUser, role] = await Promise.all([
      prisma.user.findUnique({
        where: { email: parsed.data.email },
        include: { memberships: { where: { tenantId } } },
      }),
      prisma.role.findFirst({ where: { id: parsed.data.roleId, tenantId } }),
    ]);
    if (!role || !isTeamProfile(role.systemKey))
      return Response.json(
        { error: "Selecciona Vendedor, Bodeguero o Finanzas" },
        { status: 400 },
      );
    if (existingUser) {
      return Response.json(
        {
          error: existingUser.memberships.length
            ? "Ese correo ya pertenece a esta empresa"
            : "Ese correo ya tiene una cuenta. Invítalo para conservar sus credenciales.",
        },
        { status: 409 },
      );
    }
    const passwordHash = await hash(parsed.data.password, 12);
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone || null,
          passwordHash,
          emailVerified: new Date(),
        },
      });
      const membership = await tx.membership.create({
        data: { tenantId, userId: user.id, status: "ACTIVE" },
      });
      await tx.membershipRole.create({
        data: { membershipId: membership.id, roleId: role.id },
      });
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return tenantError(error);
  }
}

const patchInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("role"),
    membershipId: z.string().uuid(),
    roleId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("permissions"),
    membershipId: z.string().uuid(),
    permissions: z.array(z.string()).max(allPermissions.size),
  }),
  z.object({
    action: z.literal("status"),
    membershipId: z.string().uuid(),
    status: z.enum(["ACTIVE", "SUSPENDED"]),
  }),
  z.object({
    action: z.literal("profile"),
    membershipId: z.string().uuid(),
    name: z.string().trim().min(2).max(150),
    email: z
      .string()
      .trim()
      .email()
      .max(320)
      .transform((value) => value.toLowerCase()),
    phone: z.string().trim().max(40).optional().default(""),
    password: z.string().max(100).optional(),
  }),
]);

export async function PATCH(request: Request) {
  try {
    const { tenantId } = await requireTenantOwner();
    const parsed = patchInput.safeParse(await request.json());
    if (!parsed.success)
      return Response.json({ error: "Cambio inválido" }, { status: 400 });
    const prisma = getPrisma();
    const membership = await getMembership(tenantId, parsed.data.membershipId);
    if (!membership)
      return Response.json({ error: "Usuario no encontrado" }, { status: 404 });

    if (parsed.data.action === "role") {
      const role = await prisma.role.findFirst({
        where: { id: parsed.data.roleId, tenantId },
      });
      if (!role || !isTeamProfile(role.systemKey))
        return Response.json(
          { error: "Perfil de tienda no permitido" },
          { status: 400 },
        );
      await prisma.$transaction([
        prisma.membershipRole.deleteMany({
          where: { membershipId: membership.id },
        }),
        prisma.membershipRole.create({
          data: { membershipId: membership.id, roleId: role.id },
        }),
        prisma.membership.update({
          where: { id: membership.id },
          data: { usePermissionOverrides: false, permissionOverrides: [] },
        }),
      ]);
    }

    if (parsed.data.action === "permissions") {
      if (
        parsed.data.permissions.some(
          (permission) => !allPermissions.has(permission),
        )
      )
        return Response.json(
          { error: "La lista contiene un permiso desconocido" },
          { status: 400 },
        );
      const allowedPermissions = new Set<string>(
        membership.roles.flatMap(({ role }) =>
          isTeamProfile(role.systemKey)
            ? [...SYSTEM_ROLES[role.systemKey]!]
            : [],
        ),
      );
      if (
        parsed.data.permissions.some(
          (permission) => !allowedPermissions.has(permission),
        )
      ) {
        return Response.json(
          {
            error:
              "Ese perfil no puede recibir uno de los permisos seleccionados",
          },
          { status: 400 },
        );
      }
      await prisma.membership.update({
        where: { id: membership.id },
        data: {
          usePermissionOverrides: true,
          permissionOverrides: [...new Set(parsed.data.permissions)],
        },
      });
    }

    if (parsed.data.action === "status") {
      await prisma.membership.update({
        where: { id: membership.id },
        data: { status: parsed.data.status },
      });
    }

    if (parsed.data.action === "profile") {
      const password = parsed.data.password?.trim();
      if (password && password.length < 8)
        return Response.json(
          { error: "La contraseña debe tener al menos 8 caracteres" },
          { status: 400 },
        );
      const conflict = await prisma.user.findFirst({
        where: { email: parsed.data.email, id: { not: membership.userId } },
        select: { id: true },
      });
      if (conflict)
        return Response.json(
          { error: "Ese correo ya está en uso" },
          { status: 409 },
        );
      await prisma.user.update({
        where: { id: membership.userId },
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone || null,
          ...(password ? { passwordHash: await hash(password, 12) } : {}),
        },
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return tenantError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { tenantId } = await requireTenantOwner();
    const membershipId = new URL(request.url).searchParams.get("membershipId");
    if (!membershipId || !z.string().uuid().safeParse(membershipId).success)
      return Response.json({ error: "Usuario inválido" }, { status: 400 });
    const membership = await getMembership(tenantId, membershipId);
    if (!membership)
      return Response.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (isOwner(membership))
      return Response.json(
        { error: "El propietario no se administra desde Usuarios de tienda" },
        { status: 403 },
      );
    await getPrisma().membership.delete({ where: { id: membership.id } });
    return Response.json({ ok: true });
  } catch (error) {
    return tenantError(error);
  }
}
