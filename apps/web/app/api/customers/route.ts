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
  address: z.string().trim().max(300).optional(),
  reference: z.string().trim().max(300).optional(),
  isDefault: z.boolean().optional(),
});

export async function GET() {
  try {
    const { tenantId } = await requireTenant("customers:read");
    const customers = await getPrisma().customer.findMany({ where: { tenantId }, orderBy: { updatedAt: "desc" }, take: 250 });
    return Response.json(customers.map((customer) => {
      const metadata = (customer.metadata as { city?: string; isDefault?: boolean }) || {};
      const addresses = (customer.addresses as Array<{ line1?: string; reference?: string }>) || [];
      return {
        id: customer.id,
        name: customer.name,
        email: customer.email ?? "",
        phone: customer.phone ?? "",
        city: metadata.city ?? "",
        address: addresses[0]?.line1 ?? "",
        reference: addresses[0]?.reference ?? "",
        isDefault: metadata.isDefault ?? false,
        orders: 0,
        spent: 0,
      };
    }));
  } catch (error) { return tenantError(error); }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenant("customers:create");
    const parsed = customerInput.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Cliente inválido", details: parsed.error.flatten() }, { status: 400 });
    const customer = await getPrisma().customer.create({
      data: {
        tenantId,
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        taxId: parsed.data.taxId || null,
        addresses: parsed.data.address ? [{ line1: parsed.data.address, reference: parsed.data.reference || "" }] : [],
        metadata: {
          city: parsed.data.city || "",
          isDefault: parsed.data.isDefault ?? false,
        },
      },
    });
    return Response.json({ id: customer.id }, { status: 201 });
  } catch (error) { return tenantError(error); }
}
