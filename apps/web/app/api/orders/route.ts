import { z } from "zod";
import { getPrisma } from "../../../lib/prisma";
import { requireTenant, tenantError } from "../../../lib/tenant";

const statusToUi = {
  DRAFT: "Pendiente",
  PENDING: "Pendiente",
  CONFIRMED: "Preparando",
  ALLOCATED: "Preparando",
  PICKING: "Preparando",
  PACKED: "Preparando",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  RETURNED: "Cancelado",
} as const;
const uiToStatus = {
  Pendiente: "PENDING",
  Preparando: "PICKING",
  Enviado: "SHIPPED",
  Entregado: "DELIVERED",
  Cancelado: "CANCELLED",
} as const;
const createInput = z.object({
  customer: z.string().trim().min(2).max(200),
  city: z.string().trim().min(2).max(100),
  total: z.number().positive().max(1000000),
  items: z.number().int().min(1).max(10000),
});
const updateInput = z.object({
  id: z.string().uuid(),
  status: z.enum([
    "Pendiente",
    "Preparando",
    "Enviado",
    "Entregado",
    "Cancelado",
  ]),
});

function serialize(order: {
  id: string;
  number: bigint;
  status: keyof typeof statusToUi;
  customer: unknown;
  shippingAddress: unknown;
  totalMinor: bigint;
  createdAt: Date;
}) {
  const customer = order.customer as { name?: string; itemCount?: number };
  const address = order.shippingAddress as { city?: string };
  return {
    id: order.id,
    number: `TJX-${order.number}`,
    customer: customer.name ?? "Sin cliente",
    city: address.city ?? "",
    total: Number(order.totalMinor) / 100,
    status: statusToUi[order.status],
    date: order.createdAt.toISOString(),
    items: customer.itemCount ?? 0,
  };
}

export async function GET() {
  try {
    const { tenantId } = await requireTenant("orders:read");
    const orders = await getPrisma().order.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
    return Response.json(orders.map(serialize));
  } catch (error) {
    return tenantError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenant("orders:create");
    const parsed = createInput.safeParse(await request.json());
    if (!parsed.success)
      return Response.json({ error: "Pedido inválido" }, { status: 400 });
    const totalMinor = BigInt(Math.round(parsed.data.total * 100));
    const order = await getPrisma().order.create({
      data: {
        tenantId,
        number: BigInt(Date.now()),
        channel: "dashboard",
        status: "PENDING",
        customer: { name: parsed.data.customer, itemCount: parsed.data.items },
        shippingAddress: { city: parsed.data.city },
        currency: "USD",
        subtotalMinor: totalMinor,
        totalMinor,
      },
    });
    return Response.json(serialize(order), { status: 201 });
  } catch (error) {
    return tenantError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { tenantId } = await requireTenant("orders:update");
    const parsed = updateInput.safeParse(await request.json());
    if (!parsed.success)
      return Response.json({ error: "Estado inválido" }, { status: 400 });
    const existing = await getPrisma().order.findFirst({
      where: { id: parsed.data.id, tenantId },
      select: { id: true },
    });
    if (!existing)
      return Response.json({ error: "Pedido no encontrado" }, { status: 404 });
    await getPrisma().order.update({
      where: { id: existing.id },
      data: { status: uiToStatus[parsed.data.status] },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return tenantError(error);
  }
}
