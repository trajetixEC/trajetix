export const dynamic = "force-dynamic";

import { z } from "zod";
import { getPrisma } from "../../../../../lib/prisma";
import { auth } from "../../../../../auth";
import { WithdrawalStatus, WalletTransactionType } from "../../../../../generated/client";

const actionSchema = z.object({
  withdrawalId: z.string().uuid(),
  action: z.enum(["APPROVE", "REJECT"]),
  note: z.string().max(250).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify SuperAdmin platform role
    const user = await getPrisma().user.findUnique({
      where: { id: session.user.id },
      select: { platformRole: true, email: true },
    });

    if (user?.platformRole !== "SUPER_ADMIN") {
      return Response.json(
        { error: "Acceso denegado. Solo un SuperAdmin puede aprobar o rechazar retiros." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = actionSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Datos de solicitud inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { withdrawalId, action, note } = parsed.data;
    const prisma = getPrisma();

    // Fetch withdrawal
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: {
        tenant: { select: { displayName: true } },
        bankAccount: { select: { bankName: true, accountLast4: true } },
      },
    });

    if (!withdrawal) {
      return Response.json({ error: "Solicitud de retiro no encontrada" }, { status: 404 });
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      return Response.json(
        { error: `Esta solicitud de retiro ya fue procesada anteriormente (${withdrawal.status}).` },
        { status: 400 }
      );
    }

    // Execute atomic resolution
    await prisma.$transaction(async (tx: any) => {
      if (action === "APPROVE") {
        await tx.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: WithdrawalStatus.PAID,
            note: note ? `Aprobado por ${user.email}: ${note}` : `Aprobado por ${user.email}`,
          },
        });

        await tx.walletTransaction.create({
          data: {
            tenantId: withdrawal.tenantId,
            type: WalletTransactionType.DEBIT,
            amountMinor: -withdrawal.amountMinor,
            description: `Retiro aprobado y transferido a la cuenta ${withdrawal.bankAccount?.bankName || "Banco"} (*${withdrawal.bankAccount?.accountLast4 || "0000"})`,
            referenceType: "WITHDRAWAL",
            referenceId: withdrawal.id,
          },
        });
      } else {
        // REJECT action: Restore balance to tenant wallet and release hold
        await tx.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: WithdrawalStatus.REJECTED,
            note: note ? `Rechazado por ${user.email}: ${note}` : `Rechazado por ${user.email}`,
          },
        });

        await tx.wallet.update({
          where: { tenantId: withdrawal.tenantId },
          data: {
            balanceMinor: { increment: withdrawal.amountMinor },
          },
        });

        await tx.walletTransaction.create({
          data: {
            tenantId: withdrawal.tenantId,
            type: WalletTransactionType.RELEASE,
            amountMinor: withdrawal.amountMinor,
            description: `Retiro rechazado por administración - Fondos desbloqueados y devueltos a la billetera`,
            referenceType: "WITHDRAWAL",
            referenceId: withdrawal.id,
          },
        });
      }
    });

    return Response.json({
      success: true,
      message: action === "APPROVE"
        ? "El retiro fue aprobado exitosamente y transferido."
        : "El retiro fue rechazado y los fondos liberados nuevamente a la billetera.",
    });
  } catch (error) {
    console.error("Error al procesar acción de retiro:", error);
    return Response.json({ error: "Error en el servidor al procesar el retiro" }, { status: 500 });
  }
}
