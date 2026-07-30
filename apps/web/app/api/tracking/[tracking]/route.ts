import { getPrisma } from "../../../../lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ tracking: string }> }) {
  const { tracking } = await context.params;
  const guide = decodeURIComponent(tracking).trim();
  if (guide.length < 3 || guide.length > 150) return Response.json({ error: "Guía inválida" }, { status: 400 });
  const shipment = await getPrisma().shipment.findFirst({
    where: { OR: [{ trackingNumber: { equals: guide, mode: "insensitive" } }, { metadata: { path: ["reference"], equals: guide } }] },
    include: { trackingEvents: { orderBy: { occurredAt: "desc" }, take: 100 } },
    orderBy: { updatedAt: "desc" },
  });
  if (!shipment) return Response.json({ error: "No encontramos esa guía" }, { status: 404 });
  const recipient = shipment.recipient as { name?: string };
  const address = shipment.address as { city?: string };
  return Response.json({
    guide: shipment.trackingNumber ?? (shipment.metadata as { reference?: string }).reference ?? shipment.id,
    carrier: shipment.carrier,
    service: shipment.service,
    status: shipment.status,
    destination: address.city ?? "",
    recipient: recipient.name ? `${recipient.name.slice(0, 1)}***` : "",
    updatedAt: shipment.updatedAt,
    events: shipment.trackingEvents.length > 0
      ? shipment.trackingEvents.map((event) => ({ status: event.status, description: event.description, location: event.location, occurredAt: event.occurredAt }))
      : [{ status: shipment.status, description: "Estado actual del envío", location: null, occurredAt: shipment.updatedAt }],
  });
}
