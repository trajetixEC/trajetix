export const dynamic = "force-dynamic";

import { z } from "zod";
import { getPrisma } from "../../../lib/prisma";
import { requireTenant, tenantError } from "../../../lib/tenant";

const customerInput = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  taxId: z.string().trim().max(40).optional(),
  city: z.string().trim().max(100).optional(),
});

export async function GET() {
  try {
    const { tenantId } = await requireTenant("customers:read");
    const customers = await getPrisma().customer.findMany({ where: { tenantId }, orderBy: { updatedAt: "desc" }, take: 250 });
    return Response.json(customers.map((customer) => ({ id: customer.id, name: customer.name, email: customer.email ?? "", phone: customer.phone, city: (customer.metadata as { city?: string }).city ?? "", orders: 0, spent: 0 })));
  } catch (error) { return tenantError(error); }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenant("customers:create");
    const parsed = customerInput.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Cliente inválido", details: parsed.error.flatten() }, { status: 400 });
    const customer = await getPrisma().customer.create({ data: { tenantId, name: parsed.data.name, email: parsed.data.email || null, phone: parsed.data.phone || null, taxId: parsed.data.taxId || null, metadata: { city: parsed.data.city || "" } } });
    return Response.json({ id: customer.id }, { status: 201 });
  } catch (error) { return tenantError(error); }
}
