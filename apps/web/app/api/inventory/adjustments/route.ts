import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPrisma } from "../../../../lib/prisma";
import { requireTenant, tenantError } from "../../../../lib/tenant";

const adjustmentInput = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
  quantity: z.number().finite().min(-1_000_000).max(1_000_000).refine((value) => value !== 0),
  reason: z.string().trim().min(2).max(100).default("Ajuste manual"),
});

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenant("inventory:adjust");
    const parsed = adjustmentInput.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Ajuste inválido", details: parsed.error.flatten() }, { status: 400 });
    const prisma = getPrisma();
    await prisma.$transaction(async (transaction) => {
      const product = await transaction.product.findFirst({ where: { id: parsed.data.productId, tenantId }, select: { id: true } });
      if (!product) throw new Error("PRODUCT_NOT_FOUND");
      const warehouse = parsed.data.warehouseId
        ? await transaction.warehouse.findFirst({ where: { id: parsed.data.warehouseId, tenantId, active: true } })
        : await transaction.warehouse.upsert({
          where: { tenantId_code: { tenantId, code: "DEFAULT" } },
          update: {},
          create: { tenantId, code: "DEFAULT", name: "Bodega principal", timezone: "America/Guayaquil", address: {} },
        });
      if (!warehouse) throw new Error("WAREHOUSE_NOT_FOUND");
      const current = await transaction.inventoryBalance.findUnique({ where: { tenantId_warehouseId_productId: { tenantId, warehouseId: warehouse.id, productId: product.id } } });
      const nextOnHand = Number(current?.onHand ?? 0) + parsed.data.quantity;
      if (nextOnHand < 0) throw new Error("NEGATIVE_STOCK");
      await transaction.inventoryBalance.upsert({
        where: { tenantId_warehouseId_productId: { tenantId, warehouseId: warehouse.id, productId: product.id } },
        update: { onHand: { increment: parsed.data.quantity }, version: { increment: 1 } },
        create: { tenantId, warehouseId: warehouse.id, productId: product.id, onHand: parsed.data.quantity },
      });
      await transaction.inventoryMovement.create({ data: { tenantId, warehouseId: warehouse.id, productId: product.id, type: "ADJUSTMENT", quantity: parsed.data.quantity, referenceType: "MANUAL", referenceId: parsed.data.reason, idempotencyKey: randomUUID() } });
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") return Response.json({ error: "Producto no encontrado" }, { status: 404 });
    if (error instanceof Error && error.message === "WAREHOUSE_NOT_FOUND") return Response.json({ error: "Bodega no encontrada" }, { status: 404 });
    if (error instanceof Error && error.message === "NEGATIVE_STOCK") return Response.json({ error: "El inventario no puede quedar negativo" }, { status: 409 });
    return tenantError(error);
  }
}
