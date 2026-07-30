import { z } from "zod";
import { getPrisma } from "../../../lib/prisma";
import { requireTenant, tenantError } from "../../../lib/tenant";
import {
  createCarrierLabel,
  quoteRequestHash,
  verifyQuote,
} from "../../../lib/integrations/carrier-gateway";

const packageInput = z.object({
  productId: z.string().uuid().optional(),
  description: z.string().trim().min(2).max(500),
  quantity: z.number().int().min(1).max(10000),
  weightKg: z.number().positive().max(1000),
  lengthCm: z.number().positive().max(500).optional(),
  widthCm: z.number().positive().max(500).optional(),
  heightCm: z.number().positive().max(500).optional(),
  declaredValue: z.number().min(0).max(1000000).default(0),
});

const shipmentInput = z.object({
  senderName: z.string().trim().min(2).max(200),
  senderPhone: z.string().trim().min(5).max(40),
  originCity: z.string().trim().min(2).max(100),
  originAddress: z.string().trim().min(4).max(500),
  warehouseId: z.string().uuid().optional(),
  recipientName: z.string().trim().min(2).max(200),
  recipientPhone: z.string().trim().min(5).max(40),
  destinationCity: z.string().trim().min(2).max(100),
  destinationAddress: z.string().trim().min(4).max(500),
  destinationReference: z.string().trim().max(300).optional(),
  packages: z.array(packageInput).min(1).max(100),
  productItems: z
    .array(
      z.object({
        productId: z.string().uuid(),
        sku: z.string().max(100),
        name: z.string().max(200),
        quantity: z.number().int().positive(),
        unitPrice: z.number().min(0),
      }),
    )
    .max(100)
    .optional(),
  reference: z.string().trim().max(100).optional(),
  cod: z.number().min(0).max(1000000).default(0),
  quoteToken: z.string().min(20),
});

export async function GET() {
  try {
    const { tenantId } = await requireTenant("shipments:read");
    const shipments = await getPrisma().shipment.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 250,
    });

    return Response.json(
      shipments.map((shipment) => ({
        id: shipment.id,
        orderId:
          (shipment.metadata as { reference?: string }).reference ??
          shipment.orderId ??
          "Sin referencia",
        carrier: shipment.carrier,
        service: shipment.service ?? "Estándar",
        tracking: shipment.trackingNumber ?? "Pendiente",
        status: shipment.status,
        eta: "Por calcular",
        sender: shipment.origin,
        recipient: shipment.recipient,
        address: shipment.address,
        packages: shipment.packages,
        cod: Number(shipment.codMinor ?? 0) / 100,
        quoted: Number(shipment.quotedMinor ?? 0) / 100,
        labelUrl: shipment.labelUrl,
        createdAt: shipment.createdAt,
      })),
    );
  } catch (error) {
    return tenantError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenant("shipments:create");
    const parsed = shipmentInput.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Envío inválido", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    if (data.warehouseId) {
      const warehouse = await getPrisma().warehouse.findFirst({
        where: { id: data.warehouseId, tenantId, active: true },
        select: { id: true },
      });
      if (!warehouse)
        return Response.json(
          { error: "Bodega de origen no encontrada" },
          { status: 404 },
        );
    }

    if (data.productItems?.length) {
      const productIds = [
        ...new Set(data.productItems.map((item) => item.productId)),
      ];
      const productCount = await getPrisma().product.count({
        where: { tenantId, id: { in: productIds } },
      });
      if (productCount !== productIds.length) {
        return Response.json(
          { error: "Uno de los productos no pertenece a esta empresa" },
          { status: 400 },
        );
      }
    }

    let quote;
    try {
      quote = verifyQuote(data.quoteToken);
    } catch (error) {
      return Response.json(
        {
          error: error instanceof Error ? error.message : "Cotización inválida",
        },
        { status: 400 },
      );
    }
    if (quote.tenantId !== tenantId) {
      return Response.json(
        { error: "La cotización no pertenece a esta empresa" },
        { status: 403 },
      );
    }

    const integration = await getPrisma().carrierIntegration.findFirst({
      where: {
        id: quote.integrationId,
        tenantId,
        active: true,
        capabilities: { has: "label" },
      },
    });
    if (!integration) {
      return Response.json(
        { error: "La transportadora ya no está disponible para generar guías" },
        { status: 409 },
      );
    }

    const carrierRequest = {
      origin: {
        name: data.senderName,
        phone: data.senderPhone,
        country: "EC" as const,
        city: data.originCity,
        line1: data.originAddress,
      },
      destination: {
        name: data.recipientName,
        phone: data.recipientPhone,
        country: "EC" as const,
        city: data.destinationCity,
        line1: data.destinationAddress,
        ...(data.destinationReference
          ? { reference: data.destinationReference }
          : {}),
      },
      parcels: data.packages.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        weightKg: item.weightKg,
        ...(item.lengthCm ? { lengthCm: item.lengthCm } : {}),
        ...(item.widthCm ? { widthCm: item.widthCm } : {}),
        ...(item.heightCm ? { heightCm: item.heightCm } : {}),
        declaredValueMinor: Math.round(item.declaredValue * 100),
      })),
      codMinor: Math.round(data.cod * 100),
    };

    if (quote.requestHash !== quoteRequestHash(carrierRequest)) {
      return Response.json(
        { error: "Los datos del envío cambiaron; recalcula la tarifa" },
        { status: 409 },
      );
    }

    let label;
    try {
      label = await createCarrierLabel(integration, {
        ...carrierRequest,
        reference: data.reference || `Trajetix-${Date.now()}`,
        service: quote.service,
        ...(quote.externalQuoteId
          ? { externalQuoteId: quote.externalQuoteId }
          : {}),
      });
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "La transportadora no pudo generar la guía",
        },
        { status: 502 },
      );
    }
    if (!label.trackingNumber?.trim()) {
      return Response.json(
        { error: "La transportadora no devolvió un número de guía" },
        { status: 502 },
      );
    }

    const shipment = await getPrisma().$transaction(async (tx) => {
      const created = await tx.shipment.create({
        data: {
          tenantId,
          carrier: quote.carrier,
          service: quote.service,
          trackingNumber: label.trackingNumber.trim(),
          origin: {
            name: data.senderName,
            phone: data.senderPhone,
            city: data.originCity,
            line1: data.originAddress,
            warehouseId: data.warehouseId ?? null,
          },
          recipient: { name: data.recipientName, phone: data.recipientPhone },
          address: {
            city: data.destinationCity,
            line1: data.destinationAddress,
            reference: data.destinationReference ?? "",
          },
          packages: data.packages,
          quotedMinor: BigInt(quote.amountMinor),
          currency: quote.currency,
          codMinor: BigInt(carrierRequest.codMinor),
          labelUrl: label.labelUrl ?? null,
          status: "LABEL_CREATED",
          metadata: {
            reference: data.reference ?? "",
            source: "dashboard",
            integrationId: integration.id,
            externalQuoteId: quote.externalQuoteId ?? null,
            productItems: data.productItems ?? [],
          },
        },
      });

      await tx.shipmentTrackingEvent.create({
        data: {
          tenantId,
          shipmentId: created.id,
          carrierCode: quote.carrierKey,
          status: "LABEL_CREATED",
          description: `Guía creada por ${quote.carrier}`,
          occurredAt: new Date(),
        },
      });

      const attribution = await tx.referralAttribution.findUnique({
        where: { referredTenantId: tenantId },
        select: {
          id: true,
          profile: {
            select: { tenantId: true, commissionMinor: true, active: true },
          },
        },
      });
      if (
        attribution?.profile.active &&
        attribution.profile.tenantId !== tenantId
      ) {
        const amountMinor = attribution.profile.commissionMinor;
        await tx.referralCommission.create({
          data: {
            attributionId: attribution.id,
            shipmentId: created.id,
            beneficiaryTenantId: attribution.profile.tenantId,
            amountMinor,
          },
        });
        await tx.wallet.upsert({
          where: { tenantId: attribution.profile.tenantId },
          update: { balanceMinor: { increment: BigInt(amountMinor) } },
          create: {
            tenantId: attribution.profile.tenantId,
            balanceMinor: BigInt(amountMinor),
            currency: "USD",
          },
        });
        await tx.walletTransaction.create({
          data: {
            tenantId: attribution.profile.tenantId,
            type: "CREDIT",
            amountMinor: BigInt(amountMinor),
            description: "Comisión por envío de la red de referidos",
            referenceType: "REFERRAL_SHIPMENT",
            referenceId: created.id,
          },
        });
      }

      return created;
    });

    return Response.json(
      {
        id: shipment.id,
        tracking: shipment.trackingNumber,
        status: shipment.status,
        labelUrl: shipment.labelUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    return tenantError(error);
  }
}
