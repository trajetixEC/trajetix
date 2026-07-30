export const dynamic = "force-dynamic";

import { z } from "zod";
import { getPrisma } from "../../../../lib/prisma";
import { requireTenant, tenantError } from "../../../../lib/tenant";

const input = z.object({
  bankAccountId: z.string().uuid(),
  amount: z.number().min(1).max(1000000),
  note: z.string().trim().max(250).optional(),
});
export async function POST(request: Request) {
  try {
    const { tenantId, userId } = await requireTenant("finance:manage");
    const parsed = input.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: "Solicitud inválida", details: parsed.error.flatten() },
        { status: 400 },
      );
    const amountMinor = BigInt(Math.round(parsed.data.amount * 100));
    const prisma = getPrisma();
    const withdrawal = await prisma.$transaction(async (transaction) => {
      const account = await transaction.bankAccount.findFirst({
        where: { id: parsed.data.bankAccountId, tenantId, active: true },
        select: { id: true },
      });
      if (!account) throw new Error("BANK_NOT_FOUND");
      await transaction.wallet.upsert({
        where: { tenantId },
        update: {},
        create: { tenantId },
      });
      const debit = await transaction.wallet.updateMany({
        where: { tenantId, balanceMinor: { gte: amountMinor } },
        data: { balanceMinor: { decrement: amountMinor } },
      });
      if (debit.count !== 1) throw new Error("INSUFFICIENT_FUNDS");
      const created = await transaction.withdrawal.create({
        data: {
          tenantId,
          bankAccountId: account.id,
          requestedById: userId,
          amountMinor,
          note: parsed.data.note || null,
        },
      });
      await transaction.walletTransaction.create({
        data: {
          tenantId,
          type: "HOLD",
          amountMinor: -amountMinor,
          description: "Retiro solicitado",
          referenceType: "WITHDRAWAL",
          referenceId: created.id,
        },
      });
      return created;
    });
    return Response.json(
      { id: withdrawal.id, status: withdrawal.status },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "BANK_NOT_FOUND")
      return Response.json(
        { error: "Cuenta bancaria no encontrada" },
        { status: 404 },
      );
    if (error instanceof Error && error.message === "INSUFFICIENT_FUNDS")
      return Response.json({ error: "Saldo insuficiente" }, { status: 409 });
    return tenantError(error);
  }
}
