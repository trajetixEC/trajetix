export const dynamic = "force-dynamic";

import { getPrisma } from "../../../../lib/prisma";
import { fetchLaarTracking } from "../../../../lib/integrations/laar-client";

export async function GET(_request: Request, context: { params: Promise<{ tracking: string }> }) {
  try {
    const { tracking } = await context.params;
    const guide = decodeURIComponent(tracking).trim();
    if (guide.length < 3 || guide.length > 150) return Response.json({ error: "Guía inválida" }, { status: 400 });

    // 1. Query LAAR Courier live tracking API
    let laarData: {
      noGuia?: string;
      estadoActual?: string;
      ciudadOrigen?: string;
      ciudadDestino?: string;
      producto?: string;
      para?: string;
      tracking?: Record<string, { nombre?: string; fecha?: string }>;
      novedades?: Array<{ nombre?: string; observacion?: string; fecha?: string }>;
    } | null = null;

    try {
      laarData = await fetchLaarTracking(guide);
    } catch {
      // Ignore LAAR tracking API errors and fall back to local DB
    }

    // 2. Query local PostgreSQL shipment record
    const shipment = await getPrisma().shipment.findFirst({
      where: {
        OR: [
          { trackingNumber: { equals: guide, mode: "insensitive" } },
          { metadata: { path: ["reference"], equals: guide } },
        ],
      },
      include: { trackingEvents: { orderBy: { occurredAt: "desc" }, take: 100 } },
      orderBy: { updatedAt: "desc" },
    });

    if (!shipment && !laarData) {
      return Response.json({ error: "No encontramos información para esta guía" }, { status: 404 });
    }

    const recipient = shipment?.recipient as { name?: string } | undefined;
    const address = shipment?.address as { city?: string } | undefined;

    // 3. Process events list
    let events: Array<{ status: string; description: string; location: string | null; occurredAt: string | Date }> = [];

    if (laarData?.tracking && typeof laarData.tracking === "object") {
      const rawEvents = Object.values(laarData.tracking) as Array<{ nombre?: string; fecha?: string }>;
      events = rawEvents
        .map((item) => ({
          status: item.nombre || "Evento de Rastreo",
          description: `Movilización LAAR Courier: ${item.nombre || ""}`,
          location: laarData?.ciudadDestino || laarData?.ciudadOrigen || null,
          occurredAt: item.fecha ? new Date(item.fecha) : new Date(),
        }))
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    }

    if (laarData?.novedades && Array.isArray(laarData.novedades) && laarData.novedades.length > 0) {
      for (const nov of laarData.novedades) {
        if (nov && typeof nov === "object") {
          events.unshift({
            status: nov.nombre || "Novedad en la Entrega",
            description: nov.observacion || "Novedad registrada por el operador de LAAR Courier",
            location: laarData?.ciudadDestino || null,
            occurredAt: nov.fecha ? new Date(nov.fecha) : new Date(),
          });
        }
      }
    }

    if (events.length === 0 && shipment && shipment.trackingEvents.length > 0) {
      events = shipment.trackingEvents.map((event) => ({
        status: event.status,
        description: event.description,
        location: event.location,
        occurredAt: event.occurredAt,
      }));
    }

    if (events.length === 0) {
      events = [
        {
          status: laarData?.estadoActual || shipment?.status || "Guía Creada",
          description: `Guía creada y procesada por LAAR Courier`,
          location: laarData?.ciudadDestino || address?.city || null,
          occurredAt: shipment?.updatedAt || new Date(),
        },
      ];
    }

    return Response.json({
      guide: laarData?.noGuia || shipment?.trackingNumber || guide,
      carrier: shipment?.carrier || "LAAR Courier",
      service: shipment?.service || laarData?.producto || "Entrega Estándar Puerta a Puerta",
      status: laarData?.estadoActual || shipment?.status || "Por Recolectar",
      destination: laarData?.ciudadDestino || address?.city || "",
      recipient: laarData?.para ? laarData.para : (recipient?.name ? `${recipient.name.slice(0, 1)}***` : ""),
      updatedAt: shipment?.updatedAt || new Date(),
      events,
      laarData,
    });
  } catch (error) {
    console.error("Error al consultar el rastreo de la guía:", error);
    return Response.json(
      { error: "Error al consultar el rastreo en la plataforma" },
      { status: 500 }
    );
  }
}
