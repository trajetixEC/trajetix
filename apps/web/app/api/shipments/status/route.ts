export const dynamic = "force-dynamic";

import { z } from "zod";
import { getPrisma } from "../../../../lib/prisma";
import { requireTenantOwner, tenantError } from "../../../../lib/tenant";
import { ShipmentStatus } from "../../../../generated/client";

const updateStatusSchema = z.object({
  shipmentId: z.string().uuid(),
  status: z.nativeEnum(ShipmentStatus),
});

export async function POST(request: Request) {
  try {
    const { tenantId, isSuperAdmin } = await requireTenantOwner();
    const body = await request.json();
    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Datos de estado inválidos" }, { status: 400 });
    }

    const prisma = getPrisma();
    const shipment = await prisma.shipment.findFirst({
      where: isSuperAdmin ? { id: parsed.data.shipmentId } : { id: parsed.data.shipmentId, tenantId },
    });

    if (!shipment) {
      return Response.json({ error: "Guía no encontrada" }, { status: 404 });
    }

    const newStatus = parsed.data.status;
    const oldStatus = shipment.status;

    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          status: newStatus,
          ...(newStatus === ShipmentStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
        },
      });

      await tx.shipmentTrackingEvent.create({
        data: {
          tenantId: shipment.tenantId,
          shipmentId: shipment.id,
          carrierCode: shipment.carrier || "LAAR",
          status: newStatus,
          description: `Estado actualizado a ${newStatus}`,
          occurredAt: new Date(),
        },
      });

      const codAmount = Number(shipment.codMinor ?? 0);
      const codMinorBigInt = shipment.codMinor ?? 0n;

      if (newStatus === ShipmentStatus.DELIVERED && codAmount > 0 && oldStatus !== ShipmentStatus.DELIVERED) {
        const currentWallet = await tx.wallet.upsert({
          where: { tenantId: shipment.tenantId },
          update: { balanceMinor: { increment: codMinorBigInt } },
          create: { tenantId: shipment.tenantId, balanceMinor: codMinorBigInt },
        });

        const balanceAfter = Number(currentWallet.balanceMinor);
        const balanceBefore = balanceAfter - codAmount;

        await tx.walletTransaction.create({
          data: {
            tenantId: shipment.tenantId,
            type: "CREDIT",
            amountMinor: codMinorBigInt,
            balanceBeforeMinor: BigInt(balanceBefore),
            balanceAfterMinor: BigInt(balanceAfter),
            description: `Recaudo COD liquidado por entrega exitosa de guía ${shipment.trackingNumber}`,
            referenceType: "SHIPMENT",
            referenceId: shipment.id,
          },
        });
      }

      // Automatic Return Fee Debit (Egreso por Devolución)
      const returnFeeMinorBigInt = shipment.quotedMinor ?? 0n;
      const returnFeeAmount = Number(returnFeeMinorBigInt);

      if (newStatus === ShipmentStatus.RETURNED && oldStatus !== ShipmentStatus.RETURNED && returnFeeAmount > 0) {
        const currentWallet = await tx.wallet.upsert({
          where: { tenantId: shipment.tenantId },
          update: { balanceMinor: { decrement: returnFeeMinorBigInt } },
          create: { tenantId: shipment.tenantId, balanceMinor: -returnFeeMinorBigInt },
        });

        const balanceAfter = Number(currentWallet.balanceMinor);
        const balanceBefore = balanceAfter + returnFeeAmount;

        await tx.walletTransaction.create({
          data: {
            tenantId: shipment.tenantId,
            type: "DEBIT",
            amountMinor: returnFeeMinorBigInt,
            balanceBeforeMinor: BigInt(balanceBefore),
            balanceAfterMinor: BigInt(balanceAfter),
            description: `Flete de retorno por devolución de guía ${shipment.trackingNumber}`,
            referenceType: "SHIPMENT_RETURN",
            referenceId: shipment.id,
          },
        });
      }
    });

    return Response.json({ success: true, status: newStatus });
  } catch (error) {
    const err = tenantError(error);
    if (err) return err;
    console.error("Error actualizando estado de guía:", error);
    return Response.json({ error: "No se pudo actualizar el estado" }, { status: 500 });
  }
}
