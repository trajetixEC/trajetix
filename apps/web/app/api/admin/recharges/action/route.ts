export const dynamic = "force-dynamic";

import { z } from "zod";
import { getPrisma } from "../../../../../lib/prisma";
import { auth } from "../../../../../auth";
import { RechargeStatus, WalletTransactionType } from "../../../../../generated/client";

const actionSchema = z.object({
  rechargeId: z.string().uuid(),
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
        { error: "Acceso denegado. Solo un SuperAdmin puede aprobar o rechazar recargas de saldo." },
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

    const { rechargeId, action, note } = parsed.data;
    const prisma = getPrisma();

    // Fetch recharge request
    const recharge = await prisma.walletRecharge.findUnique({
      where: { id: rechargeId },
      include: {
        tenant: { select: { displayName: true } },
      },
    });

    if (!recharge) {
      return Response.json({ error: "Solicitud de recarga no encontrada" }, { status: 404 });
    }

    if (recharge.status !== RechargeStatus.PENDING) {
      return Response.json(
        { error: `Esta solicitud de recarga ya fue procesada anteriormente (${recharge.status}).` },
        { status: 400 }
      );
    }

    // Execute atomic resolution
    await prisma.$transaction(async (tx) => {
      if (action === "APPROVE") {
        // 1. Update recharge status
        await tx.walletRecharge.update({
          where: { id: recharge.id },
          data: {
            status: RechargeStatus.APPROVED,
            approvedById: session.user.id,
            approvedAt: new Date(),
            note: note ? `Aprobado por ${user.email}: ${note}` : `Aprobado por ${user.email}`,
          },
        });

        // 2. Increment wallet balance
        const updatedWallet = await tx.wallet.upsert({
          where: { tenantId: recharge.tenantId },
          update: {
            balanceMinor: { increment: recharge.amountMinor },
          },
          create: {
            tenantId: recharge.tenantId,
            balanceMinor: recharge.amountMinor,
            currency: "USD",
          },
        });

        const balanceAfter = Number(updatedWallet.balanceMinor);
        const balanceBefore = balanceAfter - Number(recharge.amountMinor);

        // 3. Record positive CREDIT wallet transaction
        await tx.walletTransaction.create({
          data: {
            tenantId: recharge.tenantId,
            type: WalletTransactionType.CREDIT,
            amountMinor: recharge.amountMinor,
            balanceBeforeMinor: BigInt(balanceBefore),
            balanceAfterMinor: BigInt(balanceAfter),
            description: `Recarga de saldo aprobada por administración (Ref: ${recharge.referenceNumber} - ${recharge.bankName})`,
            referenceType: "RECHARGE",
            referenceId: recharge.id,
          },
        });
      } else {
        // REJECT action
        await tx.walletRecharge.update({
          where: { id: recharge.id },
          data: {
            status: RechargeStatus.REJECTED,
            approvedById: session.user.id,
            approvedAt: new Date(),
            note: note ? `Rechazado por ${user.email}: ${note}` : `Rechazado por ${user.email}`,
          },
        });
      }
    });

    return Response.json({
      success: true,
      message: action === "APPROVE"
        ? "La recarga fue aprobada exitosamente y el saldo acreditado a la billetera."
        : "La solicitud de recarga fue rechazada.",
    });
  } catch (error) {
    console.error("Error al procesar acción de recarga:", error);
    return Response.json({ error: "Error en el servidor al procesar la recarga" }, { status: 500 });
  }
}
