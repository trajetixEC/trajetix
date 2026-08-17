export const dynamic = "force-dynamic";

import { z } from "zod";
import { getPrisma } from "../../../../lib/prisma";
import { requireTenant, tenantError } from "../../../../lib/tenant";

const productUpdateInput = z.object({
  sku: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(2).max(250).optional(),
  type: z.enum(["SIMPLE", "VARIABLE", "DIGITAL", "KIT", "BUNDLE"]).optional(),
  barcode: z.string().trim().max(100).nullable().optional(),
  category: z.string().trim().max(120).nullable().optional(),
  brand: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  imageDataUrl: z.string().max(2_800_000).regex(/^data:image\/(jpeg|png|webp);base64,/).optional(),
  weightKg: z.number().positive().max(100_000).nullable().optional(),
  lengthCm: z.number().positive().max(100_000).nullable().optional(),
  widthCm: z.number().positive().max(100_000).nullable().optional(),
  heightCm: z.number().positive().max(100_000).nullable().optional(),
  cost: z.number().min(0).optional(),
  price: z.number().min(0).optional(),
  dropshippingPrice: z.number().min(0).nullable().optional(),
  suggestedDropshippingPrice: z.number().min(0).nullable().optional(),
  minimumStock: z.number().min(0).optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await requireTenant("products:create");
    const { id } = await params;

    const existing = await getPrisma().product.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!existing) {
      return Response.json(
        { error: "Producto no encontrado" },
        { status: 404 },
      );
    }

    const json = await request.json();
    const parsed = productUpdateInput.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Datos del producto inválidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.barcode !== undefined) updateData.barcode = data.barcode;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.brand !== undefined) updateData.brand = data.brand;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.imageDataUrl !== undefined) {
      updateData.media = [{ type: "image", url: data.imageDataUrl }];
    }
    if (data.weightKg !== undefined) updateData.weightKg = data.weightKg;
    if (data.lengthCm !== undefined) updateData.lengthCm = data.lengthCm;
    if (data.widthCm !== undefined) updateData.widthCm = data.widthCm;
    if (data.heightCm !== undefined) updateData.heightCm = data.heightCm;
    if (data.cost !== undefined) {
      updateData.costMinor = BigInt(Math.round(data.cost * 100));
    }
    if (data.price !== undefined) {
      updateData.priceMinor = BigInt(Math.round(data.price * 100));
    }
    if (data.dropshippingPrice !== undefined) {
      updateData.dropshippingPriceMinor =
        data.dropshippingPrice === null
          ? null
          : BigInt(Math.round(data.dropshippingPrice * 100));
    }
    if (data.suggestedDropshippingPrice !== undefined) {
      updateData.suggestedDropshippingPriceMinor =
        data.suggestedDropshippingPrice === null
          ? null
          : BigInt(Math.round(data.suggestedDropshippingPrice * 100));
    }
    if (data.minimumStock !== undefined) {
      updateData.minimumStock = data.minimumStock;
    }

    const updated = await getPrisma().product.update({
      where: { id: existing.id },
      data: updateData,
    });

    return Response.json({ id: updated.id, success: true });
  } catch (error) {
    return tenantError(error);
  }
}
