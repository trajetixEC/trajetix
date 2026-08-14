export const dynamic = "force-dynamic";

import { z } from "zod";
import { getPrisma } from "../../../lib/prisma";
import { requireTenant, tenantError } from "../../../lib/tenant";
import {
  createCarrierLabel,
  quoteRequestHash,
  verifyQuote,
} from "../../../lib/integrations/carrier-gateway";
import { createLaarShipment } from "../../../lib/integrations/laar-client";

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
    // 1. EL PAGADOR SIEMPRE SALE DE LA SESIÓN AUTENTICADA (JWToken)
    const { tenantId, userId } = await requireTenant("shipments:create");
    const user = await getPrisma().user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

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

    // 2. VERIFICACIÓN CRIPTOGRÁFICA Y RECÁLCULO SERVIDOR DE LA COTIZACIÓN (HMAC Signature)
    let quote;
    try {
      quote = verifyQuote(data.quoteToken);
    } catch (error) {
      return Response.json(
        {
          error: error instanceof Error ? error.message : "Cotización inválida o manipulada",
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

    // 3. SECUENCIA RIGUROSA: VERIFICAR Y DEBITAR FLETE PARA TODOS LOS ENVÍOS (COD Y PREPAGO)
    const freightCostMinor = BigInt(quote.amountMinor);

    // Ensure wallet exists
    await getPrisma().wallet.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });

    // Atomic debit: Ensures balance >= freight cost strictly before calling external carrier API
    const debitResult = await getPrisma().wallet.updateMany({
      where: { tenantId, balanceMinor: { gte: freightCostMinor } },
      data: { balanceMinor: { decrement: freightCostMinor } },
    });

    if (debitResult.count !== 1) {
      const wallet = await getPrisma().wallet.findUnique({ where: { tenantId }, select: { balanceMinor: true } });
      const available = Number(wallet?.balanceMinor ?? 0) / 100;
      const required = quote.amountMinor / 100;
      return Response.json(
        {
          error: `Saldo insuficiente en tu billetera ($${available.toFixed(2)}). El costo del flete para esta guía es de $${required.toFixed(2)}. Por favor realiza una recarga de saldo en la sección Finanzas para poder generar la guía.`,
          availableBalance: available,
          requiredAmount: required,
        },
        { status: 402 }
      );
    }

    // 4. GENERAR GUÍA CON LA TRANSPORTADORA (LAAR COURIER)
    let label;
    try {
      label = await createLaarShipment({
        reference: data.reference || `TRJ${Date.now()}`,
        origin: {
          name: data.senderName,
          phone: data.senderPhone,
          city: data.originCity,
          line1: data.originAddress,
          email: user?.email ?? undefined,
        },
        destination: {
          name: data.recipientName,
          phone: data.recipientPhone,
          city: data.destinationCity,
          line1: data.destinationAddress,
          ...(data.destinationReference ? { reference: data.destinationReference } : {}),
        },
        parcels: data.packages.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          weightKg: item.weightKg,
          declaredValueMinor: Math.round(item.declaredValue * 100),
        })),
        codMinor: Math.round(data.cod * 100),
      });
    } catch (error) {
      // 5. REEMBOLSO AUTOMÁTICO SI LA TRANSPORTADORA FALLA (Automatic Balance Rollback)
      await getPrisma().wallet.update({
        where: { tenantId },
        data: { balanceMinor: { increment: freightCostMinor } },
      });

      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "La transportadora no pudo generar la guía. Se ha reembolsado el costo del flete a tu billetera.",
        },
        { status: 502 }
      );
    }

    // 6. PERSISTENCIA EN BASE DE DATOS Y REGISTRO TRANSACCIONAL AUDITABLE
    const shipment = await getPrisma().$transaction(async (tx) => {
      const initialStatus = label.pickupCode ? "PICKUP_SCHEDULED" : "LABEL_CREATED";
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
          codMinor: BigInt(Math.round(data.cod * 100)),
          labelUrl: label.labelUrl ?? null,
          status: initialStatus,
          metadata: {
            reference: data.reference ?? "",
            source: "dashboard",
            integrationId: integration.id,
            externalQuoteId: quote.externalQuoteId ?? null,
            productItems: data.productItems ?? [],
            pickupCode: label.pickupCode ?? null,
          },
        },
      });

      // Record tracking event
      await tx.shipmentTrackingEvent.create({
        data: {
          tenantId,
          shipmentId: created.id,
          carrierCode: quote.carrierKey,
          status: initialStatus,
          description: label.pickupCode
            ? `Guía creada por ${quote.carrier} y recolección agendada automáticamente (Cód: ${label.pickupCode})`
            : `Guía creada por ${quote.carrier}`,
          occurredAt: new Date(),
        },
      });

      // Record wallet transaction for freight cost debit with audit trail
      const currentWallet = await tx.wallet.findUnique({
        where: { tenantId },
        select: { balanceMinor: true },
      });
      const balanceAfter = Number(currentWallet?.balanceMinor ?? 0);
      const balanceBefore = balanceAfter + Number(freightCostMinor);

      await tx.walletTransaction.create({
        data: {
          tenantId,
          type: "DEBIT",
          amountMinor: -freightCostMinor,
          balanceBeforeMinor: BigInt(balanceBefore),
          balanceAfterMinor: BigInt(balanceAfter),
          description: `Pago de flete para guía ${created.trackingNumber} (${data.cod > 0 ? "Contra-entrega" : "Prepago"})`,
          referenceType: "SHIPMENT",
          referenceId: created.id,
        },
      });

      // Referral commissions
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
