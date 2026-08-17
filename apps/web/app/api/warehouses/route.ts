export const dynamic = "force-dynamic";

import { z } from "zod";
import { getPrisma } from "../../../lib/prisma";
import { requireTenant, tenantError } from "../../../lib/tenant";

const warehouseInput = z.object({
  code: z.string().trim().min(2).max(40).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(100),
  address: z.string().trim().min(4).max(300),
  phone: z.string().trim().min(5, "El teléfono de la bodega es obligatorio").max(40),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  timezone: z.string().trim().min(3).max(60).default("America/Guayaquil"),
});

export async function GET() {
  try {
    const { tenantId } = await requireTenant("warehouses:read");
    const warehouses = await getPrisma().warehouse.findMany({
      where: { tenantId, active: true },
      include: { balances: { select: { onHand: true, reserved: true, productId: true } } },
      orderBy: { createdAt: "asc" },
    });
    return Response.json(
      warehouses.map((warehouse) => {
        const addr = (warehouse.address as { city?: string; line1?: string; phone?: string; latitude?: number; longitude?: number; lat?: number; lng?: number }) || {};
        const rawLat = addr.latitude ?? addr.lat;
        const rawLng = addr.longitude ?? addr.lng;
        const lat = typeof rawLat === "number" && !isNaN(rawLat) && rawLat !== 0 ? rawLat : null;
        const lng = typeof rawLng === "number" && !isNaN(rawLng) && rawLng !== 0 ? rawLng : null;
        return {
          id: warehouse.id,
          code: warehouse.code,
          name: warehouse.name,
          timezone: warehouse.timezone,
          city: addr.city ?? "",
          address: addr.line1 ?? "",
          phone: addr.phone ?? "",
          latitude: lat,
          longitude: lng,
          products: new Set(warehouse.balances.filter((balance) => Number(balance.onHand) > 0).map((balance) => balance.productId)).size,
          stock: warehouse.balances.reduce((sum, balance) => sum + Number(balance.onHand) - Number(balance.reserved), 0),
        };
      }),
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (error) { return tenantError(error); }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenant("warehouses:create");
    const parsed = warehouseInput.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "El teléfono de la bodega es obligatorio y debe contener al menos 5 dígitos", details: parsed.error.flatten() }, { status: 400 });
    const warehouse = await getPrisma().warehouse.create({ data: {
      tenantId,
      code: parsed.data.code,
      name: parsed.data.name,
      timezone: parsed.data.timezone,
      address: {
        city: parsed.data.city,
        line1: parsed.data.address,
        phone: parsed.data.phone,
        latitude: parsed.data.latitude ?? null,
        longitude: parsed.data.longitude ?? null,
        lat: parsed.data.latitude ?? null,
        lng: parsed.data.longitude ?? null,
      },
    }});
    return Response.json({ id: warehouse.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return Response.json({ error: "Ya existe una bodega con ese código" }, { status: 409 });
    return tenantError(error);
  }
}
