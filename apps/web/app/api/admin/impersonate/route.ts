export const dynamic = "force-dynamic";

import { requireTenantOwner, tenantError } from "../../../../lib/tenant";
import { getPrisma } from "../../../../lib/prisma";
import { generateImpersonateToken } from "../../../../lib/impersonate";

export async function POST(request: Request) {
  try {
    const { tenantId, userId: adminUserId, isSuperAdmin } = await requireTenantOwner();

    const body = await request.json().catch(() => ({}));
    const targetUserId = body.targetUserId;

    if (!targetUserId || typeof targetUserId !== "string") {
      return Response.json(
        { error: "Se requiere el ID del usuario destino" },
        { status: 400 }
      );
    }

    // Verify target user belongs to this tenant (unless requester is super admin)
    const targetMembership = await getPrisma().membership.findFirst({
      where: isSuperAdmin
        ? { userId: targetUserId }
        : { tenantId, userId: targetUserId },
      include: { user: true },
    });

    if (!targetMembership || !targetMembership.user) {
      return Response.json(
        { error: "El usuario seleccionado no pertenece a esta empresa o no existe" },
        { status: 404 }
      );
    }

    const token = generateImpersonateToken(targetMembership.user.id, adminUserId);

    return Response.json({
      ok: true,
      token,
      email: targetMembership.user.email,
      name: targetMembership.user.name,
    });
  } catch (error) {
    return tenantError(error);
  }
}
