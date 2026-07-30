export const dynamic = "force-dynamic";

import { z } from "zod";
import { getPrisma } from "../../../lib/prisma";
import { requireTenant, tenantError } from "../../../lib/tenant";

const queryInput = z.object({
  range: z.enum(["today", "week", "month", "custom"]).default("week"),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

function ecuadorDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function startOfEcuadorDay(value: string) {
  return new Date(`${value}T05:00:00.000Z`);
}
function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function resolveRange(input: z.infer<typeof queryInput>) {
  const today = ecuadorDate();
  const todayStart = startOfEcuadorDay(today);
  if (input.range === "today")
    return { from: todayStart, to: addDays(todayStart, 1) };
  if (input.range === "custom" && input.from && input.to) {
    const from = startOfEcuadorDay(input.from);
    const to = addDays(startOfEcuadorDay(input.to), 1);
    if (from < to && addDays(from, 366) >= to) return { from, to };
  }
  if (input.range === "month") {
    const from = startOfEcuadorDay(`${today.slice(0, 7)}-01`);
    const nextMonth = new Date(from);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    return { from, to: nextMonth };
  }
  const weekday = new Date(`${today}T12:00:00.000Z`).getUTCDay();
  const from = addDays(todayStart, -(weekday === 0 ? 6 : weekday - 1));
  return { from, to: addDays(from, 7) };
}

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTenant("dashboard:read");
    const url = new URL(request.url);
    const parsed = queryInput.safeParse({
      range: url.searchParams.get("range") ?? "week",
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    if (!parsed.success)
      return Response.json(
        { error: "Rango de fechas inválido" },
        { status: 400 },
      );
    const { from, to } = resolveRange(parsed.data);
    const prisma = getPrisma();
    const [shipments, wallet, products] = await Promise.all([
      prisma.shipment.findMany({
        where: { tenantId, createdAt: { gte: from, lt: to } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          trackingNumber: true,
          carrier: true,
          service: true,
          status: true,
          recipient: true,
          address: true,
          codMinor: true,
          quotedMinor: true,
          createdAt: true,
        },
      }),
      prisma.wallet.findUnique({
        where: { tenantId },
        select: { balanceMinor: true, currency: true },
      }),
      prisma.product.findMany({
        where: { tenantId, status: { not: "ARCHIVED" } },
        select: {
          minimumStock: true,
          balances: { select: { onHand: true, reserved: true } },
        },
      }),
    ]);
    const lowStock = products.filter(
      (product) =>
        product.balances.reduce(
          (sum, balance) =>
            sum + Number(balance.onHand) - Number(balance.reserved),
          0,
        ) <= Number(product.minimumStock),
    ).length;
    const delivered = shipments.filter(
      (item) => item.status === "DELIVERED",
    ).length;
    const completed = shipments.filter((item) =>
      ["DELIVERED", "RETURNED", "CANCELLED", "EXCEPTION"].includes(item.status),
    ).length;
    const byDay = new Map<
      string,
      { shipments: number; freightMinor: number }
    >();
    const byCarrier = new Map<string, number>();
    const byStatus = new Map<string, number>();
    for (const shipment of shipments) {
      const day = ecuadorDate(shipment.createdAt);
      const dayValue = byDay.get(day) ?? { shipments: 0, freightMinor: 0 };
      dayValue.shipments += 1;
      dayValue.freightMinor += Number(shipment.quotedMinor ?? 0);
      byDay.set(day, dayValue);
      byCarrier.set(
        shipment.carrier,
        (byCarrier.get(shipment.carrier) ?? 0) + 1,
      );
      byStatus.set(shipment.status, (byStatus.get(shipment.status) ?? 0) + 1);
    }
    const days: Array<{ date: string; shipments: number; freight: number }> =
      [];
    for (let day = new Date(from); day < to; day = addDays(day, 1)) {
      const key = ymd(day);
      const value = byDay.get(key);
      days.push({
        date: key,
        shipments: value?.shipments ?? 0,
        freight: Number(value?.freightMinor ?? 0) / 100,
      });
    }
    return Response.json({
      range: { from: ymd(from), to: ymd(addDays(to, -1)) },
      summary: {
        totalShipments: shipments.length,
        inTransit: shipments.filter((item) =>
          ["IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(item.status),
        ).length,
        freight:
          shipments.reduce(
            (sum, item) => sum + Number(item.quotedMinor ?? 0),
            0,
          ) / 100,
        cod:
          shipments
            .filter((item) => item.status === "DELIVERED")
            .reduce((sum, item) => sum + Number(item.codMinor ?? 0), 0) / 100,
        wallet: Number(wallet?.balanceMinor ?? 0) / 100,
        currency: wallet?.currency ?? "USD",
        deliveryRate: completed
          ? Math.round((delivered / completed) * 1000) / 10
          : 0,
        lowStock,
      },
      days,
      byCarrier: [...byCarrier.entries()]
        .map(([carrier, count]) => ({ carrier, count }))
        .sort((a, b) => b.count - a.count),
      byStatus: [...byStatus.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      recent: shipments.slice(0, 8).map((item) => ({
        id: item.id,
        tracking: item.trackingNumber ?? "Pendiente",
        carrier: item.carrier,
        service: item.service ?? "Estándar",
        status: item.status,
        recipient:
          (item.recipient as { name?: string }).name ?? "Sin destinatario",
        city: (item.address as { city?: string }).city ?? "",
        freight: Number(item.quotedMinor ?? 0) / 100,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    return tenantError(error);
  }
}
