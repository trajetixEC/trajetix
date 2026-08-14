export const dynamic = "force-dynamic";

import { ShipmentStatus } from "../../../../generated/client";
import { getPrisma } from "../../../../lib/prisma";
import { fetchLaarTracking } from "../../../../lib/integrations/laar-client";

// Terminal status set: Shipments in these states will NEVER be queried again.
const TERMINAL_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.DELIVERED,
  ShipmentStatus.RETURNED,
  ShipmentStatus.CANCELLED,
];

/**
 * Maps LAAR Courier status string to Trajetix ShipmentStatus enum.
 * 
 * 10 LAAR Courier Statuses:
 * - Terminal: "Entregado", "Devolución / Entrega", "Anulado", "Cancelado"
 * - Active: "Con Novedad", "Por Recolectar", "En Bodega", "En Tránsito", "Zona de Entrega", "Pendiente Creación"
 */
function mapLaarStatusToShipmentStatus(laarStatus?: string): ShipmentStatus {
  if (!laarStatus) return ShipmentStatus.IN_TRANSIT;
  const s = laarStatus.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Estados Finales (Terminal Statuses)
  if (s.includes("entregad")) {
    return ShipmentStatus.DELIVERED;
  }
  if (s.includes("devoluc") || s.includes("devuelt")) {
    return ShipmentStatus.RETURNED;
  }
  if (s.includes("anulad") || s.includes("cancelad")) {
    return ShipmentStatus.CANCELLED;
  }

  // 2. Estados Activos / Intermedios (Active Statuses)
  if (s.includes("novedad")) {
    return ShipmentStatus.EXCEPTION;
  }
  if (s.includes("zona de entrega") || s.includes("reparto") || s.includes("ruta")) {
    return ShipmentStatus.OUT_FOR_DELIVERY;
  }
  if (s.includes("transito") || s.includes("bodega")) {
    return ShipmentStatus.IN_TRANSIT;
  }
  if (s.includes("recolect")) {
    return ShipmentStatus.PICKUP_SCHEDULED;
  }
  if (s.includes("pendiente creac") || s.includes("creac") || s.includes("label")) {
    return ShipmentStatus.LABEL_CREATED;
  }

  return ShipmentStatus.IN_TRANSIT;
}

export async function GET(request: Request) {
  return handleCronSync(request);
}

export async function POST(request: Request) {
  return handleCronSync(request);
}

async function handleCronSync(request: Request) {
  try {
    const url = new URL(request.url);
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;
    const secretQuery = url.searchParams.get("secret");

    if (!cronSecret && process.env.NODE_ENV === "production") {
      return Response.json(
        { error: "Falta configuración de seguridad (CRON_SECRET)" },
        { status: 500 }
      );
    }

    // Authorize request (Vercel Cron or secret match)
    const isAuthorized =
      (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      (cronSecret && secretQuery === cronSecret) ||
      request.headers.get("x-vercel-cron") === "1" ||
      process.env.NODE_ENV !== "production";

    if (!isAuthorized) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    // 1. Fetch active shipments (excluding terminal statuses DELIVERED, RETURNED, CANCELLED)
    const activeShipments = await getPrisma().shipment.findMany({
      where: {
        trackingNumber: { not: null },
        status: { notIn: TERMINAL_STATUSES },
      },
      select: {
        id: true,
        tenantId: true,
        carrier: true,
        trackingNumber: true,
        status: true,
        codMinor: true,
        updatedAt: true,
      },
      take: 150, // Batch limit per cron run for memory & API rate optimization
      orderBy: { updatedAt: "asc" }, // Prioritize shipments that haven't been updated recently
    });

    if (activeShipments.length === 0) {
      return Response.json({
        message: "No hay guías activas pendientes de actualización.",
        processedCount: 0,
        updatedCount: 0,
        terminalExclusions: true,
      });
    }

    let updatedCount = 0;
    let errorCount = 0;
    const results: Array<{ id: string; tracking: string; oldStatus: string; newStatus: string }> = [];

    // 2. Process in controlled parallel batches of 5 requests to optimize concurrency
    const BATCH_SIZE = 5;
    for (let i = 0; i < activeShipments.length; i += BATCH_SIZE) {
      const batch = activeShipments.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (shipment: (typeof activeShipments)[number]) => {
          if (!shipment.trackingNumber) return;

          try {
            const laarData = await fetchLaarTracking(shipment.trackingNumber);
            if (!laarData || !laarData.estadoActual) return;

            const newStatus = mapLaarStatusToShipmentStatus(laarData.estadoActual);
            const isStatusChanged = newStatus !== shipment.status;

            if (isStatusChanged || (laarData.novedades && laarData.novedades.length > 0)) {
              await getPrisma().$transaction(async (tx) => {
                // Update shipment status
                await tx.shipment.update({
                  where: { id: shipment.id },
                  data: {
                    status: newStatus,
                    ...(newStatus === ShipmentStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
                  },
                });

                // Create tracking event record
                await tx.shipmentTrackingEvent.create({
                  data: {
                    tenantId: shipment.tenantId,
                    shipmentId: shipment.id,
                    carrierCode: shipment.carrier || "LAAR",
                    status: newStatus,
                    description: `Actualizado vía Cron LAAR: ${laarData.estadoActual}`,
                    location: laarData.ciudadDestino || laarData.ciudadOrigen || null,
                    occurredAt: new Date(),
                    raw: laarData,
                  },
                });

                const codAmount = Number(shipment.codMinor ?? 0);
                const codMinorBigInt = shipment.codMinor ?? 0n;
                if (newStatus === ShipmentStatus.DELIVERED && codAmount > 0 && shipment.status !== ShipmentStatus.DELIVERED) {
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
              });

              updatedCount++;
              results.push({
                id: shipment.id,
                tracking: shipment.trackingNumber,
                oldStatus: shipment.status,
                newStatus,
              });
            }
          } catch (err) {
            errorCount++;
            console.error(`Error actualizando guía ${shipment.trackingNumber}:`, err);
          }
        })
      );
    }

    return Response.json({
      success: true,
      message: `Sincronización completada. ${updatedCount} guías actualizadas de ${activeShipments.length} procesadas.`,
      processedCount: activeShipments.length,
      updatedCount,
      errorCount,
      updates: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error en la ejecución del Cron Job de sincronización:", error);
    return Response.json(
      { error: "Error en el servidor durante la sincronización cron" },
      { status: 500 }
    );
  }
}
