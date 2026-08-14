export const dynamic = "force-dynamic";

import { z } from "zod";
import { getPrisma } from "../../../../lib/prisma";
import { requireTenant, tenantError } from "../../../../lib/tenant";
import { resolveLaarNovelty } from "../../../../lib/integrations/laar-client";
import { ShipmentStatus } from "../../../../generated/client";

const resolveNoveltySchema = z.object({
  shipmentId: z.string().uuid(),
  action: z.enum(["RETRY_DELIVERY", "RETURN_TO_SENDER"]),
  callePrincipal: z.string().optional(),
  numeracion: z.string().optional(),
  calleSecundaria: z.string().optional(),
  referencia: z.string().optional(),
  telefono: z.string().optional(),
  observacion: z.string().min(3, "Ingresa una indicación u observación para el courier"),
});

export async function POST(request: Request) {
  try {
    const { tenantId, userId } = await requireTenant("shipments:update");
    const json = await request.json();
    const parsed = resolveNoveltySchema.safeParse(json);

    if (!parsed.success) {
      return Response.json(
        { error: "Datos de novedad inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // 1. Fetch user for manager name
    const user = await getPrisma().user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    // 2. Fetch shipment belonging to tenant
    const shipment = await getPrisma().shipment.findFirst({
      where: { id: data.shipmentId, tenantId },
    });

    if (!shipment) {
      return Response.json({ error: "Guía de envío no encontrada" }, { status: 404 });
    }

    const currentRecipient = (shipment.recipient as any) || {};
    const currentAddress = (shipment.address as any) || {};

    const isDevolucion = data.action === "RETURN_TO_SENDER";

    // 3. Attempt LAAR API resolution if tracking number exists
    let laarResultNotice = "";
    if (shipment.trackingNumber && shipment.carrier.toLowerCase().includes("laar")) {
      try {
        const laarRes = await resolveLaarNovelty({
          guia: shipment.trackingNumber,
          destino: {
            callePrincipal: data.callePrincipal || currentAddress.line1 || "Calle Principal",
            numeracion: data.numeracion || "SN",
            calleSecundaria: data.calleSecundaria || currentAddress.line2 || "Calle Secundaria",
            referencia: data.referencia || currentAddress.reference || "Sin referencia",
            telefono: data.telefono || currentRecipient.phone || "0999999999",
            celular: data.telefono || currentRecipient.phone || "0999999999",
            observacion: data.observacion,
          },
          autorizado: {
            isDevolucion,
            nombre: user?.name || user?.email || "Tienda Cliente",
            observacion: data.observacion,
          },
        });
        if (laarRes?.mensaje) {
          laarResultNotice = laarRes.mensaje;
        }
      } catch (laarErr) {
        console.warn("Aviso al notificar novedad a LAAR API:", laarErr);
      }
    }

    // 4. Update local DB records
    const updatedAddress = {
      ...currentAddress,
      line1: data.callePrincipal ? `${data.callePrincipal} ${data.numeracion || ""}`.trim() : currentAddress.line1,
      line2: data.calleSecundaria || currentAddress.line2 || "",
      reference: data.referencia || currentAddress.reference || "",
    };

    const updatedRecipient = {
      ...currentRecipient,
      phone: data.telefono || currentRecipient.phone || "",
    };

    const newStatus = isDevolucion ? ShipmentStatus.RETURNED : ShipmentStatus.IN_TRANSIT;
    const eventDescription = isDevolucion
      ? `Devolución autorizada por la tienda. Motivo: ${data.observacion}`
      : `Novedad resuelta por la tienda. Reintento programado con dirección actualizada: ${updatedAddress.line1}, Ref: ${updatedAddress.reference}. Obs: ${data.observacion}`;

    await getPrisma().$transaction(async (tx: any) => {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          status: newStatus,
          address: updatedAddress,
          recipient: updatedRecipient,
        },
      });

      await tx.shipmentTrackingEvent.create({
        data: {
          tenantId: shipment.tenantId,
          shipmentId: shipment.id,
          carrierCode: shipment.carrier || "LAAR",
          status: newStatus,
          description: eventDescription,
          occurredAt: new Date(),
        },
      });
    });

    return Response.json({
      success: true,
      message: isDevolucion
        ? "Se ha procesado la solicitud de devolución con la transportadora."
        : `Novedad resuelta correctamente. ${laarResultNotice || "Se ha programado el reintento de entrega con los datos actualizados."}`,
    });
  } catch (error) {
    return tenantError(error);
  }
}
