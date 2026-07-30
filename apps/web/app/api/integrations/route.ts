export const dynamic = "force-dynamic";

import { z } from "zod";
import { getPrisma } from "../../../lib/prisma";
import { requireTenant, tenantError } from "../../../lib/tenant";

const ecommerceInput = z.object({ kind: z.literal("ecommerce"), provider: z.enum(["shopify", "api"]), name: z.string().min(2).max(120), shopDomain: z.string().min(2).max(253), secretRef: z.string().max(250).optional() });

export async function GET() {
  try {
    const { tenantId } = await requireTenant("settings:read");
    const prisma = getPrisma();
    const [ecommerce, carriers, webhooks] = await Promise.all([
      prisma.ecommerceIntegration.findMany({ where: { tenantId }, select: { id: true, provider: true, name: true, shopDomain: true, active: true, lastSyncAt: true } }),
      prisma.carrierIntegration.findMany({ where: { tenantId }, select: { id: true, carrierKey: true, name: true, baseUrl: true, capabilities: true, active: true } }),
      prisma.webhookEndpoint.findMany({ where: { tenantId }, select: { id: true, url: true, events: true, active: true, createdAt: true } }),
    ]);
    return Response.json({ ecommerce, carriers, webhooks });
  } catch (error) { return tenantError(error); }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenant("settings:update");
    const parsed = ecommerceInput.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Integración inválida", details: parsed.error.flatten() }, { status: 400 });
    const prisma = getPrisma();
    const integration = await prisma.ecommerceIntegration.upsert({
        where: { tenantId_provider_shopDomain: { tenantId, provider: parsed.data.provider, shopDomain: parsed.data.shopDomain } },
        update: { name: parsed.data.name, secretRef: parsed.data.secretRef || null, active: true },
        create: { tenantId, provider: parsed.data.provider, name: parsed.data.name, shopDomain: parsed.data.shopDomain, secretRef: parsed.data.secretRef || null },
    });
    return Response.json({ id: integration.id }, { status: 201 });
  } catch (error) { return tenantError(error); }
}
