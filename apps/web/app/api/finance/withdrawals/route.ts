export const dynamic = "force-dynamic";

import { z } from "zod";
import { getPrisma } from "../../../../lib/prisma";
import { requireTenant, tenantError } from "../../../../lib/tenant";

const input = z.object({
  bankAccountId: z.string().uuid(),
  amount: z.number().min(1).max(1000000),
  note: z.string().trim().max(250).optional(),
});
const WITHDRAWAL_FEE_MINOR = 50n; // $0.50 fixed commission fee per withdrawal

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
    const totalCostMinor = amountMinor + WITHDRAWAL_FEE_MINOR;

    const prisma = getPrisma();
    const withdrawal = await prisma.$transaction(async (transaction) => {
      const account = await transaction.bankAccount.findFirst({
        where: { id: parsed.data.bankAccountId, tenantId, active: true },
        select: { id: true, bankName: true, accountLast4: true },
      });
      if (!account) throw new Error("BANK_NOT_FOUND");

      await transaction.wallet.upsert({
        where: { tenantId },
        update: {},
        create: { tenantId },
      });

      // Atomic debit for TOTAL cost (requested amount + $0.50 fee)
      const debit = await transaction.wallet.updateMany({
        where: { tenantId, balanceMinor: { gte: totalCostMinor } },
        data: { balanceMinor: { decrement: totalCostMinor } },
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

      // Query balance after total decrement to calculate audit balances
      const updatedWallet = await transaction.wallet.findUnique({
        where: { tenantId },
        select: { balanceMinor: true },
      });

      const balanceAfterAll = updatedWallet?.balanceMinor ?? 0n;
      const balanceAfterAmountOnly = balanceAfterAll + WITHDRAWAL_FEE_MINOR;
      const balanceBefore = balanceAfterAll + totalCostMinor;

      // MOVIMIENTO 1: Egreso del monto solicitado del retiro
      await transaction.walletTransaction.create({
        data: {
          tenantId,
          type: "DEBIT",
          amountMinor: amountMinor,
          balanceBeforeMinor: balanceBefore,
          balanceAfterMinor: balanceAfterAmountOnly,
          description: `Solicitud de retiro de fondos a ${account.bankName || "Banco"} (*${account.accountLast4 || "0000"})`,
          referenceType: "WITHDRAWAL",
          referenceId: created.id,
        },
      });

      // MOVIMIENTO 2: Egreso independiente por comisión de retiro ($0.50)
      await transaction.walletTransaction.create({
        data: {
          tenantId,
          type: "DEBIT",
          amountMinor: WITHDRAWAL_FEE_MINOR,
          balanceBeforeMinor: balanceAfterAmountOnly,
          balanceAfterMinor: balanceAfterAll,
          description: `Comisión por solicitud de retiro ($0.50)`,
          referenceType: "WITHDRAWAL_FEE",
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
      return Response.json(
        { error: "Saldo insuficiente. Para este retiro requieres el monto a retirar más $0.50 de comisión en tu billetera." },
        { status: 409 },
      );
    return tenantError(error);
  }
}
