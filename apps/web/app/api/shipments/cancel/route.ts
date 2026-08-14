export const dynamic = "force-dynamic";

import { compare } from "bcryptjs";
import { z } from "zod";
import { getPrisma } from "../../../../lib/prisma";
import { requireTenant, tenantError } from "../../../../lib/tenant";
import { cancelLaarShipment } from "../../../../lib/integrations/laar-client";
import { ShipmentStatus } from "../../../../generated/client";

const cancelSchema = z.object({
  shipmentId: z.string().uuid(),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export async function POST(request: Request) {
  try {
    const { tenantId, userId } = await requireTenant("shipments:update");
    const json = await request.json();
    const parsed = cancelSchema.safeParse(json);

    if (!parsed.success) {
      return Response.json(
        { error: "Datos de solicitud inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // 1. Verify user password and platform role
    const user = await getPrisma().user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, platformRole: true },
    });

    if (!user || !user.passwordHash) {
      return Response.json(
        { error: "No se encontró la credencial del usuario" },
        { status: 400 }
      );
    }

    const isPasswordValid = await compare(parsed.data.password, user.passwordHash);
    if (!isPasswordValid) {
      return Response.json(
        { error: "Contraseña incorrecta. Confirma tu identidad para anular la guía." },
        { status: 401 }
      );
    }

    const isSuperAdmin = user.platformRole === "SUPER_ADMIN";

    // 2. Fetch target shipment (SuperAdmin can target any shipment)
    const shipment = await getPrisma().shipment.findFirst({
      where: isSuperAdmin ? { id: parsed.data.shipmentId } : { id: parsed.data.shipmentId, tenantId },
    });

    if (!shipment) {
      return Response.json({ error: "Guía de envío no encontrada" }, { status: 404 });
    }

    // 3. Verify shipment status is NOT in a subsequent state to "Por Recolectar"
    const allowedStatusToCancel: ShipmentStatus[] = [
      ShipmentStatus.DRAFT,
      ShipmentStatus.QUOTED,
      ShipmentStatus.LABEL_CREATED,
      ShipmentStatus.PICKUP_SCHEDULED,
    ];

    if (!allowedStatusToCancel.includes(shipment.status)) {
      return Response.json(
        { error: "No se puede anular esta guía porque ya se encuentra en tránsito o entrega." },
        { status: 400 }
      );
    }

    // 4. Cancel shipment on LAAR Courier API if tracking number exists
    if (shipment.trackingNumber && shipment.carrier.toLowerCase().includes("laar")) {
      try {
        await cancelLaarShipment(shipment.trackingNumber);
      } catch (laarErr) {
        console.error("Aviso al anular en LAAR API:", laarErr);
      }
    }

    // 5. Update shipment status in database
    await getPrisma().$transaction(async (tx: any) => {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { status: ShipmentStatus.CANCELLED },
      });

      await tx.shipmentTrackingEvent.create({
        data: {
          tenantId: shipment.tenantId,
          shipmentId: shipment.id,
          carrierCode: shipment.carrier || "LAAR",
          status: ShipmentStatus.CANCELLED,
          description: "Guía anulada por el SuperAdmin en el panel.",
          occurredAt: new Date(),
        },
      });
    });

    return Response.json({
      success: true,
      message: `Guía ${shipment.trackingNumber || shipment.id} anulada exitosamente.`,
    });
  } catch (error) {
    return tenantError(error);
  }
}
