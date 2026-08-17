export const dynamic = "force-dynamic";

import { z } from "zod";
import { ShipmentStatus } from "../../../generated/client";
import { getPrisma } from "../../../lib/prisma";
import { requireTenant, tenantError } from "../../../lib/tenant";
import {
  verifyQuote,
} from "../../../lib/integrations/carrier-gateway";
import { createLaarShipment } from "../../../lib/integrations/laar-client";

import {
  calculateCarrierFreightRate,
  DEFAULT_LAAR_CONFIG,
  getZeroMarginUsers,
} from "../../../lib/carrier-config-store";

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
  insuredValue: z.number().min(0).max(1000000).optional().default(0),
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

    // 3. SECUENCIA RIGUROSA: VERIFICAR Y DEBITAR FLETE CON REGLAS DE CORTESÍA COD Y BILLETERA
    const freightCostMinor = BigInt(quote.amountMinor);

    // Ensure wallet exists
    const currentWallet = await getPrisma().wallet.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });

    const isCodShipment = typeof data.cod === "number" && data.cod > 0;
    const availableBalanceMinor = currentWallet.balanceMinor ?? 0n;
    const hasSufficientBalance = availableBalanceMinor >= freightCostMinor;

    if (!hasSufficientBalance) {
      // Regla A: Si NO es una guía COD (es prepago / sin recaudo), exige saldo suficiente obligatoriamente
      if (!isCodShipment) {
        const available = Number(availableBalanceMinor) / 100;
        const required = quote.amountMinor / 100;
        return Response.json(
          {
            error: `Saldo insuficiente en tu billetera ($${available.toFixed(2)}). Las guías sin recaudo (prepago) requieren saldo disponible de $${required.toFixed(2)}. Por favor realiza una recarga en la sección Finanzas.`,
            availableBalance: available,
            requiredAmount: required,
          },
          { status: 402 }
        );
      }

      // Regla B: Mecanismo de Cortesía para Guías COD cuando no hay saldo suficiente
      // B.1: Si acumula 3 o más devoluciones (RETURNED) en guías COD, bloquea la creación hasta saldar deuda
      const returnedCodCount = await getPrisma().shipment.count({
        where: {
          tenantId,
          codMinor: { gt: 0n },
          status: ShipmentStatus.RETURNED,
        },
      });

      const currentDebt = Math.abs(Number(availableBalanceMinor) / 100);

      if (returnedCodCount >= 3) {
        return Response.json(
          {
            error: `Acceso a guías COD suspendido: Has acumulado ${returnedCodCount} devoluciones en envíos con recaudo sin saldo disponible. Debes saldar la deuda de tu billetera ($${currentDebt.toFixed(2)}) realizando una recarga en la sección Finanzas para poder seguir creando guías COD.`,
            debtAmount: currentDebt,
            returnedCodCount,
          },
          { status: 402 }
        );
      }

      // B.2: Permite máximo 5 guías COD de cortesía sin saldo disponible (en tránsito / activas / en deuda)
      const courtesyCodCount = await getPrisma().shipment.count({
        where: {
          tenantId,
          codMinor: { gt: 0n },
          status: { notIn: [ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED] },
        },
      });

      if (courtesyCodCount >= 5) {
        return Response.json(
          {
            error: `Límite de cortesía alcanzado: Has creado ${courtesyCodCount} guías COD de cortesía sin saldo disponible. Para continuar generando envíos, debes saldar la deuda acumulada de tu billetera ($${currentDebt.toFixed(2)}) realizando una recarga en la sección Finanzas.`,
            debtAmount: currentDebt,
            courtesyCodCount,
          },
          { status: 402 }
        );
      }

      // Si pasa las dos reglas de cortesía, decrementa el saldo de la billetera (entrando en saldo negativo/deuda)
      await getPrisma().wallet.update({
        where: { tenantId },
        data: { balanceMinor: { decrement: freightCostMinor } },
      });
    } else {
      // Saldo suficiente: decremento de billetera
      await getPrisma().wallet.update({
        where: { tenantId },
        data: { balanceMinor: { decrement: freightCostMinor } },
      });
    }

    // Fetch tenant Store Name (Organización) for origin sender name
    const tenant = await getPrisma().tenant.findUnique({
      where: { id: tenantId },
      select: { displayName: true, legalName: true },
    });

    const storeSenderName =
      (tenant?.displayName && tenant.displayName.trim() !== "" && tenant.displayName !== "Mi organización")
        ? tenant.displayName.trim()
        : (tenant?.legalName && tenant.legalName.trim() !== "" ? tenant.legalName.trim() : data.senderName);

    // 4. GENERAR GUÍA CON LA TRANSPORTADORA (LAAR COURIER)
    let label;
    try {
      label = await createLaarShipment({
        reference: data.reference || `TRJ${Date.now()}`,
        origin: {
          name: storeSenderName,
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
      const weightTotal = data.packages.reduce(
        (sum, p) => sum + p.weightKg * p.quantity,
        0
      );
      const zeroMarginUsers = getZeroMarginUsers();
      const userIdent = (user?.email || "").trim().toLowerCase();
      const isZeroMarginUser = Boolean(
        userIdent &&
          zeroMarginUsers.some((u) => {
            const cleanU = u.trim().toLowerCase();
            return cleanU && userIdent === cleanU;
          })
      );

      const breakdown = calculateCarrierFreightRate({
        config: DEFAULT_LAAR_CONFIG,
        originCity: data.originCity,
        destinationCity: data.destinationCity,
        weightKg: weightTotal,
        codAmount: data.cod,
        insuredValue: data.insuredValue,
        isZeroMarginUser,
      });

      const created = await tx.shipment.create({
        data: {
          tenantId,
          carrier: quote.carrier,
          service: quote.service,
          trackingNumber: label.trackingNumber.trim(),
          origin: {
            name: storeSenderName,
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
            insuredValue: data.insuredValue ?? 0,
            isZeroMarginApplied: breakdown.isZeroMarginApplied,
            monetizationMode: breakdown.isZeroMarginApplied ? "ZERO_MARGIN_EXEMPT" : "STANDARD_MARGIN",
            monetizationStatusLabel: breakdown.isZeroMarginApplied ? "Exento (0% Ganancia Trajetix)" : "Con Ganancia Estándar",
            costBreakdown: {
              zoneKey: breakdown.zoneKey,
              zoneName: breakdown.zoneName,
              laarCityCode: breakdown.laarCityCode,
              laarFreightCost: breakdown.laarFreightCost,
              laarCodCost: breakdown.laarCodCost,
              laarTotalCost: breakdown.laarTotalCost,
              freightMarginPercent: breakdown.freightMarginPercent,
              freightMargin: breakdown.freightMargin,
              codMarginPercent: breakdown.codMarginPercent,
              codMargin: breakdown.codMargin,
              fixedSurcharge: breakdown.fixedSurcharge,
              insuranceCost: breakdown.insuranceCost,
              insuredValue: breakdown.insuredValue,
              clientFreightCost: breakdown.clientFreightCost,
              clientCodCost: breakdown.clientCodCost,
              clientInsuranceCost: breakdown.clientInsuranceCost,
              subtotalClient: breakdown.subtotalClient,
              ivaRate: breakdown.ivaRate,
              ivaCost: breakdown.ivaCost,
              trajetixProfitTotal: breakdown.trajetixProfitTotal,
              finalPriceToClient: breakdown.finalPriceToClient,
              isZeroMarginApplied: breakdown.isZeroMarginApplied,
              monetizationMode: breakdown.isZeroMarginApplied ? "ZERO_MARGIN_EXEMPT" : "STANDARD_MARGIN",
              monetizationStatusLabel: breakdown.isZeroMarginApplied ? "Exento (0% Ganancia Trajetix)" : "Con Ganancia Estándar",
            },
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
          amountMinor: freightCostMinor,
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
