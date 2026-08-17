export const dynamic = "force-dynamic";

import { getPrisma } from "../../../../lib/prisma";
import { requireTenant, tenantError } from "../../../../lib/tenant";

export async function GET() {
  try {
    const { tenantId } = await requireTenant("shipments:create");
    const [shipments, customers, carriers, warehouses, products] =
      await Promise.all([
        getPrisma().shipment.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: { recipient: true, address: true },
        }),
        getPrisma().customer.findMany({
          where: { tenantId, active: true },
          orderBy: { updatedAt: "desc" },
          take: 100,
          select: {
            id: true,
            name: true,
            phone: true,
            metadata: true,
            addresses: true,
          },
        }),
        getPrisma().carrierIntegration.findMany({
          where: {
            tenantId,
            active: true,
            capabilities: { hasEvery: ["quote", "label"] },
          },
          select: { id: true, carrierKey: true, name: true },
        }),
        getPrisma().warehouse.findMany({
          where: { tenantId, active: true },
          orderBy: { createdAt: "asc" },
          select: { id: true, code: true, name: true, address: true },
        }),
        getPrisma().product.findMany({
          where: { tenantId, status: "ACTIVE" },
          orderBy: { updatedAt: "desc" },
          take: 250,
          include: { balances: { select: { onHand: true, reserved: true } } },
        }),
      ]);
    const recipientMap = new Map<
      string,
      {
        id: string;
        name: string;
        phone: string;
        city: string;
        address: string;
        reference: string;
      }
    >();
    for (const shipment of shipments) {
      const recipient = shipment.recipient as { name?: string; phone?: string };
      const address = shipment.address as {
        city?: string;
        line1?: string;
        reference?: string;
      };
      if (recipient.name && recipient.phone)
        recipientMap.set(recipient.phone, {
          id: `shipment:${recipient.phone}`,
          name: recipient.name,
          phone: recipient.phone,
          city: address.city ?? "",
          address: address.line1 ?? "",
          reference: address.reference ?? "",
        });
    }
    for (const customer of customers) {
      const metadata = customer.metadata as { city?: string };
      const addresses = customer.addresses as Array<{
        line1?: string;
        reference?: string;
      }>;
      if (customer.phone)
        recipientMap.set(customer.phone, {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          city: metadata.city ?? "",
          address: addresses[0]?.line1 ?? "",
          reference: addresses[0]?.reference ?? "",
        });
    }
    return Response.json({
      recipients: [...recipientMap.values()],
      carriers,
      warehouses: warehouses.map((warehouse) => {
        const addr = (warehouse.address as { city?: string; line1?: string; phone?: string; latitude?: number; longitude?: number; lat?: number; lng?: number }) || {};
        const rawLat = addr.latitude ?? addr.lat;
        const rawLng = addr.longitude ?? addr.lng;
        const lat = typeof rawLat === "number" && !isNaN(rawLat) && rawLat !== 0 ? rawLat : null;
        const lng = typeof rawLng === "number" && !isNaN(rawLng) && rawLng !== 0 ? rawLng : null;
        return {
          id: warehouse.id,
          code: warehouse.code,
          name: warehouse.name,
          phone: addr.phone ?? "",
          city: addr.city ?? "",
          address: addr.line1 ?? "",
          latitude: lat,
          longitude: lng,
        };
      }),
      products: products.map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        price: Number(product.priceMinor) / 100,
        stock: product.balances.reduce(
          (total, balance) =>
            total + Number(balance.onHand) - Number(balance.reserved),
          0,
        ),
        weightKg: product.weightKg === null ? null : Number(product.weightKg),
        lengthCm: product.lengthCm === null ? null : Number(product.lengthCm),
        widthCm: product.widthCm === null ? null : Number(product.widthCm),
        heightCm: product.heightCm === null ? null : Number(product.heightCm),
      })),
    });
  } catch (error) {
    return tenantError(error);
  }
}
