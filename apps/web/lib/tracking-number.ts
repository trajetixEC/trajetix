import { getPrisma } from "./prisma";

/**
 * Generates sequential 6-digit tracking numbers starting from TRJ000001.
 * Format: TRJ + 6 digits (e.g. TRJ000001, TRJ000002, etc.)
 */
export async function generateNextTrackingNumber(): Promise<string> {
  const prisma = getPrisma();

  try {
    const recentShipments = await prisma.shipment.findMany({
      where: {
        trackingNumber: {
          startsWith: "TRJ",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
      select: {
        trackingNumber: true,
      },
    });

    let maxSeq = 0;

    for (const item of recentShipments) {
      if (!item.trackingNumber) continue;
      const match = item.trackingNumber.match(/^TRJ(\d+)$/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        // Exclude legacy 13-digit millisecond timestamps (> 999999)
        if (num > 0 && num <= 999999 && num > maxSeq) {
          maxSeq = num;
        }
      }
    }

    let nextSeq = maxSeq + 1;

    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate = `TRJ${String(nextSeq).padStart(6, "0")}`;
      const existing = await prisma.shipment.findFirst({
        where: { trackingNumber: candidate },
        select: { id: true },
      });
      if (!existing) {
        return candidate;
      }
      nextSeq++;
    }

    return `TRJ${String(nextSeq).padStart(6, "0")}`;
  } catch (error) {
    console.error("Error al generar número de guía secuencial TRJ:", error);
    const random6 = Math.floor(100000 + Math.random() * 900000);
    return `TRJ${random6}`;
  }
}
