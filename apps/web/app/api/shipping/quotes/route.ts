export const dynamic = "force-dynamic";

import { z } from "zod";
import { getPrisma } from "../../../../lib/prisma";
import { requireTenant, tenantError } from "../../../../lib/tenant";
import {
  quoteRequestHash,
  requestCarrierQuotes,
  signQuote,
} from "../../../../lib/integrations/carrier-gateway";
import {
  calculateCarrierFreightRate,
  DEFAULT_LAAR_CONFIG,
  getZeroMarginUsers,
} from "../../../../lib/carrier-config-store";

const address = z.object({
  name: z.string().min(2),
  phone: z.string().min(5),
  country: z.literal("EC"),
  city: z.string().min(2),
  line1: z.string().min(4),
  reference: z
    .string()
    .optional()
    .transform((value) => value || undefined),
});
const parcel = z.object({
  description: z.string().min(2),
  quantity: z.number().int().positive(),
  weightKg: z.number().positive(),
  lengthCm: z.number().positive().optional(),
  widthCm: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
  declaredValueMinor: z.number().int().min(0),
});
const input = z.object({
  origin: address,
  destination: address,
  parcels: z.array(parcel).min(1).max(100),
  codMinor: z.number().int().min(0),
  insuredValue: z.number().min(0).optional().default(0),
  insuredValueMinor: z.number().int().min(0).optional().default(0),
});

export async function POST(request: Request) {
  try {
    const { tenantId, userId } = await requireTenant("shipments:create");
    const user = await getPrisma().user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Datos insuficientes para cotizar" },
        { status: 400 }
      );
    }

    let integrations = await getPrisma().carrierIntegration.findMany({
      where: {
        tenantId,
        active: true,
        capabilities: { hasEvery: ["quote", "label"] },
      },
    });

    if (!integrations.length) {
      // Auto-provision default LAAR Courier integration for this tenant
      const defaultLaar = await getPrisma().carrierIntegration.upsert({
        where: { tenantId_carrierKey: { tenantId, carrierKey: "laar" } },
        update: { active: true },
        create: {
          tenantId,
          carrierKey: "laar",
          name: "LAAR Courier",
          baseUrl: "https://api.laarcourier.com",
          secretRef: "LAAR_API_KEY",
          capabilities: ["quote", "label", "cancel", "tracking", "webhook", "pickup"],
          active: true,
        },
      });
      integrations = [defaultLaar];
    }

    const requestHash = quoteRequestHash(parsed.data);
    const settled = await Promise.allSettled(
      integrations.map(async (integration) => {
        try {
          const result = await requestCarrierQuotes(integration, parsed.data);
          return result.quotes.map((quote) => ({
            carrier: integration.name,
            carrierKey: integration.carrierKey,
            service: quote.service,
            amount: quote.amountMinor / 100,
            currency: quote.currency ?? "USD",
            estimatedDays: quote.estimatedDays ?? 1,
            token: signQuote({
              tenantId,
              integrationId: integration.id,
              carrier: integration.name,
              carrierKey: integration.carrierKey,
              service: quote.service,
              amountMinor: quote.amountMinor,
              currency: quote.currency ?? "USD",
              requestHash,
              externalQuoteId: quote.externalQuoteId,
              expiresAt: Date.now() + 15 * 60_000,
            }),
          }));
        } catch {
          const zeroMarginUsers = getZeroMarginUsers();
          const userIdent = (user?.email || "").trim().toLowerCase();
          const isZeroMarginUser = Boolean(
            userIdent &&
              zeroMarginUsers.some((u) => {
                const cleanU = u.trim().toLowerCase();
                return cleanU && userIdent === cleanU;
              })
          );

          const weightTotal = parsed.data.parcels.reduce(
            (sum, p) => sum + p.weightKg * p.quantity,
            0
          );
          const breakdown = calculateCarrierFreightRate({
            config: DEFAULT_LAAR_CONFIG,
            originCity: parsed.data.origin.city,
            destinationCity: parsed.data.destination.city,
            weightKg: weightTotal,
            codAmount: parsed.data.codMinor / 100,
            insuredValue: parsed.data.insuredValue || (parsed.data.insuredValueMinor ? parsed.data.insuredValueMinor / 100 : 0),
            isZeroMarginUser,
          });

          const amountMinor = Math.round(breakdown.finalPriceToClient * 100);
          const serviceName = "Entrega Estándar Puerta a Puerta";

          return [
            {
              carrier: integration.name,
              carrierKey: integration.carrierKey,
              service: serviceName,
              amount: breakdown.finalPriceToClient,
              currency: "USD",
              estimatedDays: 1,
              token: signQuote({
                tenantId,
                integrationId: integration.id,
                carrier: integration.name,
                carrierKey: integration.carrierKey,
                service: serviceName,
                amountMinor,
                currency: "USD",
                requestHash,
                expiresAt: Date.now() + 15 * 60_000,
              }),
            },
          ];
        }
      })
    );

    const quotes = settled
      .flatMap((result) =>
        result.status === "fulfilled" ? result.value : []
      )
      .sort((a, b) => a.amount - b.amount);

    return Response.json({ quotes });
  } catch (error) {
    return tenantError(error);
  }
}
