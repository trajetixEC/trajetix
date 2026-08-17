export const dynamic = "force-dynamic";

import { z } from "zod";
import { getPrisma } from "../../../../lib/prisma";
import { requireTenant, tenantError } from "../../../../lib/tenant";

const warehouseUpdateInput = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  address: z.string().trim().min(4).max(300).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  active: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await requireTenant("warehouses:create");
    const { id } = await params;
    const parsed = warehouseUpdateInput.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Datos de bodega inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await getPrisma().warehouse.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return Response.json({ error: "Bodega no encontrada" }, { status: 404 });
    }

    const currentAddress = (existing.address as Record<string, unknown>) || {};
    const hasValidLat = typeof parsed.data.latitude === "number" && !isNaN(parsed.data.latitude) && parsed.data.latitude !== 0;
    const hasValidLng = typeof parsed.data.longitude === "number" && !isNaN(parsed.data.longitude) && parsed.data.longitude !== 0;
    const updatedAddress = {
      ...currentAddress,
      ...(parsed.data.city ? { city: parsed.data.city } : {}),
      ...(parsed.data.address ? { line1: parsed.data.address } : {}),
      ...(hasValidLat ? { latitude: parsed.data.latitude, lat: parsed.data.latitude } : {}),
      ...(hasValidLng ? { longitude: parsed.data.longitude, lng: parsed.data.longitude } : {}),
    };

    const warehouse = await getPrisma().warehouse.update({
      where: { id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
        address: updatedAddress,
      },
    });

    return Response.json(warehouse);
  } catch (error) {
    return tenantError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await requireTenant("warehouses:create");
    const { id } = await params;

    const existing = await getPrisma().warehouse.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return Response.json({ error: "Bodega no encontrada" }, { status: 404 });
    }

    // SOFT DELETE: Deactivate warehouse so it is hidden and preserved in DB
    await getPrisma().warehouse.update({
      where: { id },
      data: { active: false },
    });

    return Response.json({ ok: true, message: "Bodega desactivada exitosamente" });
  } catch (error) {
    return tenantError(error);
  }
}
