export const dynamic = "force-dynamic";

import { z } from "zod";
import { getPrisma } from "../../../../lib/prisma";
import { requireTenant, tenantError } from "../../../../lib/tenant";

const rechargeInput = z.object({
  amount: z.number().min(1, "El monto mínimo de recarga es $1.00").max(100000),
  bankName: z.string().trim().min(2, "Ingresa el banco de origen"),
  referenceNumber: z.string().trim().min(2, "Ingresa el número de comprobante o referencia"),
  receiptUrl: z.string().min(2, "Debes adjuntar el comprobante o captura de pantalla"),
  note: z.string().trim().max(250).optional(),
});

export async function GET() {
  try {
    const { tenantId } = await requireTenant("finance:read");
    const recharges = await getPrisma().walletRecharge.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return Response.json({
      recharges: recharges.map((item) => ({
        id: item.id,
        amount: Number(item.amountMinor) / 100,
        bankName: item.bankName,
        referenceNumber: item.referenceNumber,
        receiptUrl: item.receiptUrl,
        status: item.status,
        note: item.note,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    return tenantError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId, userId } = await requireTenant("finance:manage");
    const json = await request.json();
    const parsed = rechargeInput.safeParse(json);

    if (!parsed.success) {
      return Response.json(
        { error: "Datos de recarga inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const amountMinor = BigInt(Math.round(data.amount * 100));

    const recharge = await getPrisma().walletRecharge.create({
      data: {
        tenantId,
        requestedById: userId,
        amountMinor,
        bankName: data.bankName,
        referenceNumber: data.referenceNumber,
        receiptUrl: data.receiptUrl,
        note: data.note || null,
      },
    });

    return Response.json(
      {
        id: recharge.id,
        amount: Number(recharge.amountMinor) / 100,
        status: recharge.status,
        message: "Solicitud de recarga enviada con éxito. Será revisada por la administración.",
      },
      { status: 201 }
    );
  } catch (error) {
    return tenantError(error);
  }
}
