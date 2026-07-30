export const dynamic = "force-dynamic";

import { z } from "zod";
import { getPrisma } from "../../../../lib/prisma";
import { requirePlatformAdmin, tenantError } from "../../../../lib/tenant";

const carrierInput = z.object({
  tenantId: z.string().uuid(),
  carrierKey: z.enum(["servientrega", "tramaco", "laar", "gintracom", "trajet", "sertod", "coordinadora", "interrapidisimo", "99minutos", "blue_express", "fedex", "ups", "dhl", "correos"]),
  name: z.string().min(2).max(120),
  baseUrl: z.string().url(),
  secretRef: z.string().min(2).max(250),
});

export async function POST(request: Request) {
  try {
    await requirePlatformAdmin();
    const parsed = carrierInput.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Adaptador inválido", details: parsed.error.flatten() }, { status: 400 });
    const integration = await getPrisma().carrierIntegration.upsert({
      where: { tenantId_carrierKey: { tenantId: parsed.data.tenantId, carrierKey: parsed.data.carrierKey } },
      update: { name: parsed.data.name, baseUrl: parsed.data.baseUrl, secretRef: parsed.data.secretRef, active: true },
      create: { ...parsed.data, capabilities: ["quote", "label", "cancel", "tracking", "webhook", "pickup"] },
    });
    return Response.json({ id: integration.id }, { status: 201 });
  } catch (error) { return tenantError(error); }
}
