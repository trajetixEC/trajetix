import { PrismaClient } from "../generated/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma() {
  if (
    !globalForPrisma.prisma ||
    !("walletRecharge" in (globalForPrisma.prisma as unknown as Record<string, unknown>))
  ) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}
