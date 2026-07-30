import { z } from "zod";
import { getPrisma } from "../../../../lib/prisma";
import { requireTenant, tenantError } from "../../../../lib/tenant";
import {
  quoteRequestHash,
  requestCarrierQuotes,
  signQuote,
} from "../../../../lib/integrations/carrier-gateway";

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
});

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenant("shipments:create");
    const parsed = input.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: "Datos insuficientes para cotizar" },
        { status: 400 },
      );
    const integrations = await getPrisma().carrierIntegration.findMany({
      where: {
        tenantId,
        active: true,
        capabilities: { hasEvery: ["quote", "label"] },
      },
    });
    if (!integrations.length)
      return Response.json(
        {
          error:
            "Trajetix aún no ha configurado transportadoras para esta empresa",
          quotes: [],
        },
        { status: 409 },
      );
    const requestHash = quoteRequestHash(parsed.data);
    const settled = await Promise.allSettled(
      integrations.map(async (integration) => {
        const result = await requestCarrierQuotes(integration, parsed.data);
        return result.quotes.map((quote) => ({
          carrier: integration.name,
          carrierKey: integration.carrierKey,
          service: quote.service,
          amount: quote.amountMinor / 100,
          currency: quote.currency ?? "USD",
          estimatedDays: quote.estimatedDays,
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
      }),
    );
    const quotes = settled
      .flatMap((result) =>
        result.status === "fulfilled" ? result.value : ([] as never[]),
      )
      .sort((a, b) => a.amount - b.amount);
    const errors = settled.flatMap((result) =>
      result.status === "rejected"
        ? [
            result.reason instanceof Error
              ? result.reason.message
              : "Error de transportadora",
          ]
        : [],
    );
    if (!quotes.length)
      return Response.json(
        {
          error: errors[0] ?? "Ninguna transportadora devolvió tarifas",
          quotes: [],
          errors,
        },
        { status: 502 },
      );
    return Response.json({ quotes, errors });
  } catch (error) {
    return tenantError(error);
  }
}
