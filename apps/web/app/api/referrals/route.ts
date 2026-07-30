import { z } from "zod";
import { getPrisma } from "../../../lib/prisma";
import {
  defaultReferralCode,
  normalizeReferralCode,
  REFERRAL_COMMISSION_MINOR,
} from "../../../lib/referrals";
import { requireTenant, tenantError } from "../../../lib/tenant";

const codeInput = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9-]+$/),
});

async function getOrCreateProfile(tenantId: string, userId: string) {
  const prisma = getPrisma();
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { slug: true },
  });
  return prisma.referralProfile.upsert({
    where: { tenantId_userId: { tenantId, userId } },
    update: {},
    create: {
      tenantId,
      userId,
      code: defaultReferralCode(tenant.slug, userId),
      commissionMinor: REFERRAL_COMMISSION_MINOR,
    },
  });
}

export async function GET() {
  try {
    const { tenantId, userId } = await requireTenant("referrals:read");
    const profile = await getOrCreateProfile(tenantId, userId);
    const referrals = await getPrisma().referralAttribution.findMany({
      where: { referralProfileId: profile.id },
      include: {
        referredTenant: { select: { displayName: true, status: true } },
        commissions: { select: { amountMinor: true } },
      },
      orderBy: { joinedAt: "desc" },
    });

    const rows = referrals.map((referral) => {
      const commissionMinor = referral.commissions.reduce(
        (total, commission) => total + commission.amountMinor,
        0,
      );
      return {
        id: referral.id,
        company: referral.referredTenant.displayName,
        status: referral.referredTenant.status,
        shipments: referral.commissions.length,
        commissionMinor,
        joinedAt: referral.joinedAt,
      };
    });
    const networkShipments = rows.reduce(
      (total, referral) => total + referral.shipments,
      0,
    );
    const earnedMinor = rows.reduce(
      (total, referral) => total + referral.commissionMinor,
      0,
    );

    return Response.json({
      code: profile.code,
      commissionMinor: profile.commissionMinor,
      totals: {
        referrals: rows.length,
        active: rows.filter((row) => row.status === "ACTIVE").length,
        networkShipments,
        earnedMinor,
      },
      referrals: rows,
    });
  } catch (error) {
    return tenantError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { tenantId, userId } = await requireTenant("referrals:manage");
    const parsed = codeInput.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Usa entre 3 y 50 letras, números o guiones" },
        { status: 400 },
      );
    }
    const code = normalizeReferralCode(parsed.data.code);
    const profile = await getOrCreateProfile(tenantId, userId);
    try {
      const updated = await getPrisma().referralProfile.update({
        where: { id: profile.id },
        data: { code },
        select: { code: true },
      });
      return Response.json(updated);
    } catch (error) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return Response.json(
          { error: "Ese enlace ya está siendo utilizado" },
          { status: 409 },
        );
      }
      throw error;
    }
  } catch (error) {
    return tenantError(error);
  }
}
