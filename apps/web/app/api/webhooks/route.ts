import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { getPrisma } from "../../../lib/prisma";
import { requireTenant, tenantError } from "../../../lib/tenant";

const webhookInput = z.object({
  url: z.string().url().refine((url) => url.startsWith("https://"), "Debe usar HTTPS"),
  events: z.array(z.enum(["product.created", "product.updated", "inventory.updated", "order.created", "order.updated", "shipment.updated"])).min(1),
});

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenant("settings:update");
    const parsed = webhookInput.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Webhook inválido", details: parsed.error.flatten() }, { status: 400 });
    const secret = `whsec_${randomBytes(24).toString("base64url")}`;
    const webhook = await getPrisma().webhookEndpoint.create({ data: { tenantId, url: parsed.data.url, events: parsed.data.events, secretHash: createHash("sha256").update(secret).digest("hex") } });
    return Response.json({ id: webhook.id, secret }, { status: 201 });
  } catch (error) { return tenantError(error); }
}
