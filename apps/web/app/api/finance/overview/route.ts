import { getPrisma } from "../../../../lib/prisma";
import { requireTenant, tenantError } from "../../../../lib/tenant";

export async function GET() {
  try {
    const { tenantId } = await requireTenant("finance:read");
    const prisma = getPrisma();
    const wallet = await prisma.wallet.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });
    const [transactions, accounts, withdrawals] = await Promise.all([
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
    ]);
    return Response.json({
      wallet: {
        balance: Number(wallet.balanceMinor) / 100,
        currency: wallet.currency,
      },
      transactions: transactions.map((item) => ({
        ...item,
        amountMinor: undefined,
        amount: Number(item.amountMinor) / 100,
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
        createdAt: item.createdAt,
        bankName: item.bankAccount.bankName,
        accountLast4: item.bankAccount.accountLast4,
      })),
    });
  } catch (error) {
    return tenantError(error);
  }
}
