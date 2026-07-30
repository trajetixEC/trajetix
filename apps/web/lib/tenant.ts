import { auth } from "../auth";
import { can, type Permission } from "./rbac";

export class TenantAccessError extends Error {
  constructor(
    public status: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}

export async function requireTenant(permission: Permission) {
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId) {
    throw new TenantAccessError(401, "No autenticado");
  }
  if (!can(session.user.permissions, permission)) {
    throw new TenantAccessError(403, "Permiso insuficiente");
  }
  return { tenantId: session.user.tenantId, userId: session.user.id };
}

export async function requirePlatformAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new TenantAccessError(401, "No autenticado");
  const user = await getPlatformUser(session.user.id);
  if (user?.platformRole !== "SUPER_ADMIN")
    throw new TenantAccessError(403, "Acceso exclusivo de Trajetix");
  return { userId: session.user.id };
}

export async function requireTenantOwner() {
  const context = await requireTenant("members:manage");
  const { getPrisma } = await import("./prisma");
  const owner = await getPrisma().membership.findFirst({
    where: {
      tenantId: context.tenantId,
      userId: context.userId,
      status: "ACTIVE",
      roles: { some: { role: { systemKey: "owner" } } },
    },
    select: { id: true },
  });
  if (!owner)
    throw new TenantAccessError(
      403,
      "Sólo el propietario puede administrar usuarios",
    );
  return context;
}

async function getPlatformUser(userId: string) {
  const { getPrisma } = await import("./prisma");
  return getPrisma().user.findUnique({
    where: { id: userId },
    select: { platformRole: true },
  });
}

export function tenantError(error: unknown) {
  if (error instanceof TenantAccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Error interno" }, { status: 500 });
}
