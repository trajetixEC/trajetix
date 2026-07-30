import { z } from "zod";
import { getPrisma } from "../../../lib/prisma";
import { requireTenant, tenantError } from "../../../lib/tenant";

const productInput = z.object({
  sku: z.string().trim().min(1).max(100),
  name: z.string().trim().min(2).max(250),
  type: z.enum(["SIMPLE", "VARIABLE", "DIGITAL", "KIT", "BUNDLE"]).default("SIMPLE"),
  barcode: z.string().trim().max(100).optional(),
  category: z.string().trim().max(120).optional(),
  brand: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  imageDataUrl: z.string().max(2_800_000).regex(/^data:image\/(jpeg|png|webp);base64,/).optional(),
  weightKg: z.number().positive().max(100_000).optional(),
  lengthCm: z.number().positive().max(100_000).optional(),
  widthCm: z.number().positive().max(100_000).optional(),
  heightCm: z.number().positive().max(100_000).optional(),
  cost: z.number().min(0).default(0),
  price: z.number().min(0).default(0),
  dropshippingPrice: z.number().min(0).optional(),
  suggestedDropshippingPrice: z.number().min(0).optional(),
  minimumStock: z.number().min(0).default(0),
  trackSerials: z.boolean().default(false),
  trackLots: z.boolean().default(false),
  trackExpiry: z.boolean().default(false),
});

function imageFromMedia(media: unknown) {
  if (!Array.isArray(media)) return null;
  const image = media.find((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as { type?: unknown; url?: unknown };
    return candidate.type === "image" && typeof candidate.url === "string";
  }) as { url?: string } | undefined;
  return image?.url ?? null;
}

export async function GET() {
  try {
    const { tenantId } = await requireTenant("products:read");
    const products = await getPrisma().product.findMany({ where: { tenantId }, include: { balances: { include: { warehouse: { select: { id: true, name: true, code: true } } } } }, orderBy: { updatedAt: "desc" }, take: 250 });
    return Response.json(products.map((product) => ({
      id: product.id, sku: product.sku, name: product.name, type: product.type,
      barcode: product.barcode, category: product.category, brand: product.brand,
      description: product.description, imageUrl: imageFromMedia(product.media),
      weightKg: product.weightKg === null ? null : Number(product.weightKg),
      lengthCm: product.lengthCm === null ? null : Number(product.lengthCm),
      widthCm: product.widthCm === null ? null : Number(product.widthCm),
      heightCm: product.heightCm === null ? null : Number(product.heightCm),
      cost: Number(product.costMinor) / 100, price: Number(product.priceMinor) / 100,
      dropshippingPrice: product.dropshippingPriceMinor === null ? null : Number(product.dropshippingPriceMinor) / 100,
      suggestedDropshippingPrice: product.suggestedDropshippingPriceMinor === null ? null : Number(product.suggestedDropshippingPriceMinor) / 100,
      minimum: Number(product.minimumStock),
      stock: product.balances.reduce((sum, balance) => sum + Number(balance.onHand) - Number(balance.reserved), 0),
      stockByWarehouse: product.balances.map((balance) => ({ warehouseId: balance.warehouseId, warehouse: balance.warehouse.name, code: balance.warehouse.code, stock: Number(balance.onHand) - Number(balance.reserved) })),
    })));
  } catch (error) { return tenantError(error); }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenant("products:create");
    const parsed = productInput.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Producto inválido", details: parsed.error.flatten() }, { status: 400 });
    const product = await getPrisma().product.create({ data: {
      tenantId, sku: parsed.data.sku, name: parsed.data.name, type: parsed.data.type,
      barcode: parsed.data.barcode || null, category: parsed.data.category || null,
      brand: parsed.data.brand || null, description: parsed.data.description || null,
      media: parsed.data.imageDataUrl ? [{ type: "image", url: parsed.data.imageDataUrl }] : [],
      weightKg: parsed.data.weightKg ?? null, lengthCm: parsed.data.lengthCm ?? null,
      widthCm: parsed.data.widthCm ?? null, heightCm: parsed.data.heightCm ?? null,
      costMinor: BigInt(Math.round(parsed.data.cost * 100)),
      priceMinor: BigInt(Math.round(parsed.data.price * 100)),
      dropshippingPriceMinor: parsed.data.dropshippingPrice === undefined ? null : BigInt(Math.round(parsed.data.dropshippingPrice * 100)),
      suggestedDropshippingPriceMinor: parsed.data.suggestedDropshippingPrice === undefined ? null : BigInt(Math.round(parsed.data.suggestedDropshippingPrice * 100)),
      minimumStock: parsed.data.minimumStock, trackSerials: parsed.data.trackSerials,
      trackLots: parsed.data.trackLots, trackExpiry: parsed.data.trackExpiry, status: "ACTIVE",
    }});
    return Response.json({ id: product.id }, { status: 201 });
  } catch (error) { return tenantError(error); }
}
