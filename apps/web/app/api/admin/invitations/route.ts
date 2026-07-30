import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { auth } from "../../../../auth";
import { emailLayout, sendTransactionalEmail } from "../../../../lib/email";
import { getPrisma } from "../../../../lib/prisma";
import { isTeamProfile } from "../../../../lib/rbac";
import { requireTenantOwner, tenantError } from "../../../../lib/tenant";

export async function POST(request: Request) {
  try {
    const { tenantId, userId } = await requireTenantOwner();
    const session = await auth();
    const parsed = z
      .object({ email: z.string().email(), roleId: z.string().uuid() })
      .safeParse(await request.json());
    if (!parsed.success)
      return Response.json({ error: "Datos inválidos" }, { status: 400 });
    const role = await getPrisma().role.findFirst({
      where: { id: parsed.data.roleId, tenantId },
    });
    if (!role || !isTeamProfile(role.systemKey))
      return Response.json(
        { error: "Perfil de tienda no permitido" },
        { status: 400 },
      );
    const email = parsed.data.email.toLowerCase();
    const token = randomBytes(32).toString("base64url");
    await getPrisma().invitation.upsert({
      where: { tenantId_email: { tenantId, email } },
      update: {
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 7 * 86400000),
        roleId: role.id,
        invitedById: userId,
        acceptedAt: null,
      },
      create: {
        tenantId,
        email,
        roleId: role.id,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 7 * 86400000),
        invitedById: userId,
      },
    });
    const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const url = `${base}/invitacion/${token}`;
    await sendTransactionalEmail({
      to: email,
      subject: `Invitación a ${session?.user?.tenantName ?? "TrajetixERP"}`,
      html: emailLayout(
        "Te invitaron a TrajetixERP",
        `${session?.user?.name ?? session?.user?.email} te invitó como ${role.name} en ${session?.user?.tenantName ?? "su organización"}.`,
        "Aceptar invitación",
        url,
      ),
    });
    return Response.json({ ok: true });
  } catch (error) {
    return tenantError(error);
  }
}
