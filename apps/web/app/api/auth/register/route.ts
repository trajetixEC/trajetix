import { hash } from "bcryptjs";
import { cookies } from "next/headers";
import { z } from "zod";
import { getPrisma } from "../../../../lib/prisma";
import { findActiveReferral, REFERRAL_COOKIE } from "../../../../lib/referrals";
import { SYSTEM_ROLES, SYSTEM_ROLE_LABELS } from "../../../../lib/rbac";

const registrationInput = z.object({
  name: z.string().trim().min(2).max(120),
  organization: z.string().trim().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(12).max(128),
  referralCode: z.string().max(50).optional(),
});

function organizationSlug(organization: string, userId: string) {
  const base = organization
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return `${base || "empresa"}-${userId.slice(0, 8)}`;
}

export async function POST(request: Request) {
  const parsed = registrationInput.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const cookieStore = await cookies();
  const referralCode =
    parsed.data.referralCode || cookieStore.get(REFERRAL_COOKIE)?.value;

  try {
    await getPrisma().$transaction(
      async (tx) => {
        if (
          await tx.user.findUnique({ where: { email }, select: { id: true } })
        ) {
          throw new Error("EMAIL_EXISTS");
        }

        const referrer = await findActiveReferral(tx, referralCode);
        const user = await tx.user.create({
          data: {
            name: parsed.data.name,
            email,
            passwordHash: await hash(parsed.data.password, 12),
            emailVerified: new Date(),
          },
        });
        const tenant = await tx.tenant.create({
          data: {
            slug: organizationSlug(parsed.data.organization, user.id),
            legalName: parsed.data.organization,
            displayName: parsed.data.organization,
            status: "ACTIVE",
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
        );
        if (!ownerRole) throw new Error("OWNER_ROLE_MISSING");
        await tx.membershipRole.create({
          data: {
            membershipId: tenant.memberships[0]!.id,
            roleId: ownerRole.id,
          },
        });
        if (referrer && referrer.tenantId !== tenant.id) {
          await tx.referralAttribution.create({
            data: {
              referralProfileId: referrer.id,
              referredTenantId: tenant.id,
            },
          });
        }
      },
      { isolationLevel: "Serializable" },
    );
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_EXISTS") {
      return Response.json(
        { error: "Ya existe una cuenta con este correo" },
        { status: 409 },
      );
    }
    console.error(error);
    return Response.json(
      { error: "No se pudo crear la cuenta" },
      { status: 500 },
    );
  }
}
