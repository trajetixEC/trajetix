export const dynamic = "force-dynamic";

import { getPrisma } from "../../../../lib/prisma";
import { auth } from "../../../../auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify SuperAdmin platform role
    const user = await getPrisma().user.findUnique({
      where: { id: session.user.id },
      select: { platformRole: true },
    });

    if (user?.platformRole !== "SUPER_ADMIN") {
      return Response.json(
        { error: "Acceso denegado. Se requieren permisos de SuperAdmin." },
        { status: 403 }
      );
    }

    const recharges = await getPrisma().walletRecharge.findMany({
      take: 200,
      orderBy: { createdAt: "desc" },
      include: {
        tenant: { select: { displayName: true, legalName: true } },
        requestedBy: { select: { name: true, email: true } },
        approvedBy: { select: { name: true, email: true } },
      },
    });

    return Response.json({
      recharges: recharges.map((item) => ({
        id: item.id,
        tenantId: item.tenantId,
        tenantName: item.tenant.displayName || item.tenant.legalName || "Tienda",
        requestedBy: item.requestedBy.name || item.requestedBy.email,
        amount: Number(item.amountMinor) / 100,
        bankName: item.bankName,
        referenceNumber: item.referenceNumber,
        receiptUrl: item.receiptUrl,
        status: item.status,
        note: item.note,
        createdAt: item.createdAt,
        approvedBy: item.approvedBy?.name || item.approvedBy?.email || null,
        approvedAt: item.approvedAt,
      })),
    });
  } catch (error) {
    console.error("Error al obtener recargas para SuperAdmin:", error);
    return Response.json({ error: "Error al consultar recargas globales" }, { status: 500 });
  }
}
