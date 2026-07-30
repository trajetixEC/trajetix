import { z } from "zod";
import { getPrisma } from "../../../lib/prisma";
import { requireTenant, tenantError } from "../../../lib/tenant";

const warehouseInput = z.object({
  code: z.string().trim().min(2).max(40).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(100),
  address: z.string().trim().min(4).max(300),
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
    return Response.json(warehouses.map((warehouse) => ({
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      timezone: warehouse.timezone,
      city: (warehouse.address as { city?: string }).city ?? "",
      address: (warehouse.address as { line1?: string }).line1 ?? "",
      products: new Set(warehouse.balances.filter((balance) => Number(balance.onHand) > 0).map((balance) => balance.productId)).size,
      stock: warehouse.balances.reduce((sum, balance) => sum + Number(balance.onHand) - Number(balance.reserved), 0),
    })));
  } catch (error) { return tenantError(error); }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenant("warehouses:create");
    const parsed = warehouseInput.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Bodega inválida", details: parsed.error.flatten() }, { status: 400 });
    const warehouse = await getPrisma().warehouse.create({ data: {
      tenantId,
      code: parsed.data.code,
      name: parsed.data.name,
      timezone: parsed.data.timezone,
      address: { city: parsed.data.city, line1: parsed.data.address },
    }});
    return Response.json({ id: warehouse.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return Response.json({ error: "Ya existe una bodega con ese código" }, { status: 409 });
    return tenantError(error);
  }
}
