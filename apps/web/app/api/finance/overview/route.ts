export const dynamic = "force-dynamic";

import { getPrisma } from "../../../../lib/prisma";
import { requireTenant, tenantError } from "../../../../lib/tenant";

export async function GET() {
  try {
    const { tenantId } = await requireTenant("finance:read");
    const prisma = getPrisma();

    // 1. Get or create tenant wallet
    const wallet = await prisma.wallet.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });

    // 2. Fetch parallel financial metrics including recharges
    const [transactions, accounts, withdrawals, activeCodShipments, pendingWithdrawals, recharges] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.bankAccount.findMany({
        where: { tenantId, active: true },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      }),
      prisma.withdrawal.findMany({
        where: { tenantId },
        include: {
          bankAccount: { select: { bankName: true, accountLast4: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      // Active COD shipments in transit (pending collection)
      prisma.shipment.findMany({
        where: {
          tenantId,
          codMinor: { gt: 0 },
          status: { in: ["LABEL_CREATED", "PICKUP_SCHEDULED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "EXCEPTION"] },
        },
        select: { codMinor: true },
      }),
      // Withdrawals waiting for admin approval (blocked funds)
      prisma.withdrawal.findMany({
        where: { tenantId, status: "PENDING" },
        select: { amountMinor: true },
      }),
      // Recharge requests submitted by store
      prisma.walletRecharge.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    // 3. Compute the 3 exact balances (in dollars)
    const availableMinor = Number(wallet.balanceMinor ?? 0);
    const pendingCodMinor = activeCodShipments.reduce((sum, s) => sum + Number(s.codMinor ?? 0), 0);
    const blockedMinor = pendingWithdrawals.reduce((sum, w) => sum + Number(w.amountMinor ?? 0), 0);

    const availableBalance = availableMinor / 100;
    const pendingBalance = pendingCodMinor / 100;
    const blockedBalance = blockedMinor / 100;
    const availableForWithdrawal = Math.max(0, availableBalance);

    return Response.json({
      wallet: {
        balance: availableBalance, // Backward compatibility
        available: availableBalance,
        pending: pendingBalance,
        blocked: blockedBalance,
        availableForWithdrawal,
        currency: wallet.currency,
      },
      transactions: transactions.map((item) => ({
        id: item.id,
        type: item.type,
        amount: Number(item.amountMinor) / 100,
        balanceBefore: item.balanceBeforeMinor !== null ? Number(item.balanceBeforeMinor) / 100 : null,
        balanceAfter: item.balanceAfterMinor !== null ? Number(item.balanceAfterMinor) / 100 : null,
        description: item.description,
        referenceType: item.referenceType,
        referenceId: item.referenceId,
        createdAt: item.createdAt,
      })),
      accounts: accounts.map((item) => ({
        id: item.id,
        bankCode: item.bankCode,
        bankName: item.bankName,
        accountType: item.accountType,
        accountLast4: item.accountLast4,
        holderName: item.holderName,
        holderId: item.holderId,
        isDefault: item.isDefault,
      })),
      withdrawals: withdrawals.map((item) => ({
        id: item.id,
        amount: Number(item.amountMinor) / 100,
        status: item.status,
        note: item.note,
        receiptUrl: item.receiptUrl,
        createdAt: item.createdAt,
        bankName: item.bankAccount?.bankName || "Banco",
        accountLast4: item.bankAccount?.accountLast4 || "****",
      })),
      recharges: recharges.map((item) => ({
        id: item.id,
        amount: Number(item.amountMinor) / 100,
        bankName: item.bankName,
        referenceNumber: item.referenceNumber,
        receiptUrl: item.receiptUrl,
        status: item.status,
        note: item.note,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    return tenantError(error);
  }
}
