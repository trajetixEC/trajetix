import type { PrismaClient } from "../generated/client";

export const REFERRAL_COOKIE = "trajetix_referral";
export const REFERRAL_COMMISSION_MINOR = 10;

export function normalizeReferralCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export function defaultReferralCode(tenantSlug: string, userId: string) {
  const base = normalizeReferralCode(tenantSlug).slice(0, 40) || "trajetix";
  return `${base}-${userId.slice(0, 8).toLowerCase()}`;
}

export async function findActiveReferral(
  prisma: Pick<PrismaClient, "referralProfile">,
  rawCode: string | null | undefined,
) {
  const code = normalizeReferralCode(rawCode ?? "");
  if (!code) return null;
  return prisma.referralProfile.findFirst({
    where: { code, active: true },
    select: { id: true, tenantId: true },
  });
}
