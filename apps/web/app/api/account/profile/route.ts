export const dynamic = "force-dynamic";

import { compare, hash } from "bcryptjs";
import type { Prisma } from "../../../../generated/client";
import { auth } from "../../../../auth";
import {
  appearanceInput,
  formatUserId,
  passwordUpdateInput,
  profileUpdateInput,
  record,
} from "../../../../lib/account-profile";
import { getPrisma } from "../../../../lib/prisma";

async function getContext() {
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId) return null;
  const membership = await getPrisma().membership.findFirst({
    where: {
      userId: session.user.id,
      tenantId: session.user.tenantId,
    },
    include: {
      user: true,
      tenant: true,
      roles: { include: { role: true } },
    },
  });
  return membership ? { session, membership } : null;
}

export async function GET() {
  const context = await getContext();
  if (!context)
    return Response.json({ error: "No autenticado" }, { status: 401 });
  const { membership } = context;
  const preferences = record(membership.user.preferences);
  const tenantSettings = record(membership.tenant.settings);
  const company = record(tenantSettings.company);
  const billing = record(tenantSettings.billing);
  const owner = membership.roles.some(({ role }) => role.systemKey === "owner");

  return Response.json({
    user: {
      id: membership.user.id,
      publicId: formatUserId(membership.user.id),
      name: membership.user.name ?? "Usuario",
      email: membership.user.email,
      phone: membership.user.phone ?? "",
      identificationType: String(preferences.identificationType ?? ""),
      identificationNumber: String(preferences.identificationNumber ?? ""),
      appearance: ["LIGHT", "DARK", "SYSTEM"].includes(
        String(preferences.appearance),
      )
        ? String(preferences.appearance)
        : "DARK",
      status: membership.status,
      emailVerified: Boolean(membership.user.emailVerified),
      role: membership.roles[0]?.role.name ?? "Usuario",
      owner,
      hasPassword: Boolean(membership.user.passwordHash),
    },
    company: {
      displayName: membership.tenant.displayName,
      legalName: membership.tenant.legalName,
      phone: String(company.phone ?? ""),
      email: String(company.email ?? membership.user.email),
      address: String(company.address ?? ""),
      status: membership.tenant.status,
    },
    billing: {
      identificationType: String(billing.identificationType ?? ""),
      identificationNumber: String(billing.identificationNumber ?? ""),
      legalName: String(billing.legalName ?? membership.tenant.legalName),
      fiscalAddress: String(billing.fiscalAddress ?? ""),
      phone: String(billing.phone ?? membership.user.phone ?? ""),
      email: String(billing.email ?? membership.user.email),
    },
  });
}

export async function PATCH(request: Request) {
  const context = await getContext();
  if (!context)
    return Response.json({ error: "No autenticado" }, { status: 401 });
  const body: unknown = await request.json();
  const { membership } = context;
  const owner = membership.roles.some(({ role }) => role.systemKey === "owner");
  const preferences = record(membership.user.preferences);
  const prisma = getPrisma();

  const appearance = appearanceInput.safeParse(body);
  if (appearance.success) {
    await prisma.user.update({
      where: { id: membership.userId },
      data: {
        preferences: {
          ...preferences,
          appearance: appearance.data.appearance,
        } as Prisma.InputJsonValue,
      },
    });
    return Response.json({ ok: true });
  }

  const password = passwordUpdateInput.safeParse(body);
  if (password.success) {
    if (!membership.user.passwordHash)
      return Response.json(
        {
          error:
            "Esta cuenta usa Google o enlace mágico. Usa Recuperar contraseña para crear una clave.",
        },
        { status: 400 },
      );
    if (
      !(await compare(
        password.data.currentPassword,
        membership.user.passwordHash,
      ))
    )
      return Response.json(
        { error: "La contraseña actual no es correcta" },
        { status: 400 },
      );
    await prisma.user.update({
      where: { id: membership.userId },
      data: { passwordHash: await hash(password.data.newPassword, 12) },
    });
    return Response.json({ ok: true });
  }

  const profile = profileUpdateInput.safeParse(body);
  if (!profile.success)
    return Response.json(
      { error: "Revisa los datos ingresados" },
      { status: 400 },
    );
  if (!owner && (profile.data.company || profile.data.billing))
    return Response.json(
      { error: "Sólo el propietario puede cambiar empresa y facturación" },
      { status: 403 },
    );

  const updates: Prisma.PrismaPromise<unknown>[] = [
    prisma.user.update({
      where: { id: membership.userId },
      data: {
        name: profile.data.name,
        phone: profile.data.phone || null,
        preferences: {
          ...preferences,
          identificationType: profile.data.identificationType,
          identificationNumber: profile.data.identificationNumber,
        } as Prisma.InputJsonValue,
      },
    }),
  ];
  if (owner && profile.data.company && profile.data.billing) {
    const tenantSettings = record(membership.tenant.settings);
    updates.push(
      prisma.tenant.update({
        where: { id: membership.tenantId },
        data: {
          displayName: profile.data.company.displayName,
          legalName: profile.data.company.legalName,
          settings: {
            ...tenantSettings,
            company: profile.data.company,
            billing: profile.data.billing,
          } as Prisma.InputJsonValue,
        },
      }),
    );
  }
  await prisma.$transaction(updates);
  return Response.json({ ok: true });
}
