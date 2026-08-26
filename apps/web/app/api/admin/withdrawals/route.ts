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

    const withdrawals = await getPrisma().withdrawal.findMany({
      take: 200,
      orderBy: { createdAt: "desc" },
      include: {
        tenant: { select: { displayName: true, legalName: true } },
        requestedBy: { select: { name: true, email: true } },
        bankAccount: {
          select: {
            bankName: true,
            accountType: true,
            accountLast4: true,
            holderName: true,
            holderId: true,
          },
        },
      },
    });

    return Response.json({
      withdrawals: withdrawals.map((item) => ({
        id: item.id,
        tenantId: item.tenantId,
        tenantName: item.tenant.displayName || item.tenant.legalName || "Tienda",
        requestedBy: item.requestedBy.name || item.requestedBy.email || "Usuario",
        requestedByEmail: item.requestedBy.email,
        amount: Number(item.amountMinor) / 100,
        bankName: item.bankAccount.bankName,
        accountType: item.bankAccount.accountType,
        accountLast4: item.bankAccount.accountLast4,
        holderName: item.bankAccount.holderName,
        holderId: item.bankAccount.holderId,
        receiptUrl: item.receiptUrl,
        status: item.status,
        note: item.note,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error al obtener retiros globales:", error);
    return Response.json({ error: "Error al consultar retiros globales" }, { status: 500 });
  }
}
