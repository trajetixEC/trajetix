import { PrismaClient } from "../generated/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma() {
  if (!globalForPrisma.prisma) {
    const dbUrl =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_URL_NON_POOLING;

    globalForPrisma.prisma = new PrismaClient(
      dbUrl ? { datasources: { db: { url: dbUrl } } } : undefined,
    );
  }
  return globalForPrisma.prisma;
}
