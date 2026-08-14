export const dynamic = "force-dynamic";

import { getPrisma } from "../../../../lib/prisma";
import { auth } from "../../../../auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify user has SUPER_ADMIN platform role
    const user = await getPrisma().user.findUnique({
      where: { id: session.user.id },
      select: { platformRole: true },
    });

    if (user?.platformRole !== "SUPER_ADMIN") {
      return Response.json({ error: "Acceso denegado. Se requieren permisos de SuperAdmin." }, { status: 403 });
    }

    // Fetch ALL shipments across all tenants
    const shipments = await getPrisma().shipment.findMany({
      take: 500,
      orderBy: { createdAt: "desc" },
      include: {
        tenant: {
          select: {
            id: true,
            displayName: true,
            legalName: true,
          },
        },
      },
    });

    const formatted = shipments.map((item: (typeof shipments)[number]) => {
      const packages = (item.packages as any[]) || [];
      const recipient = (item.recipient as any) || {};
      const address = (item.address as any) || {};

      return {
        id: item.id,
        orderId: item.orderId ?? item.id.slice(0, 8),
        tracking: item.trackingNumber ?? item.id.slice(0, 8),
        carrier: item.carrier,
        service: item.service,
        status: item.status,
        labelUrl: item.labelUrl,
        quoted: Number(item.quotedMinor ?? 0) / 100,
        cod: Number(item.codMinor ?? 0) / 100,
        createdAt: item.createdAt.toISOString(),
        tenantName: item.tenant?.displayName || item.tenant?.legalName || "Tienda Desconocida",
        recipient: {
          name: recipient.name || "Sin nombre",
          phone: recipient.phone || "",
        },
        sender: {
          name: (item.origin as any)?.name || "",
          city: (item.origin as any)?.city || "",
        },
        address: {
          city: address.city || "",
          line1: address.line1 || "",
        },
        packages: packages.map((pkg: any) => ({
          description: pkg.description || "Paquete",
          quantity: pkg.quantity || 1,
          weightKg: pkg.weightKg || 0,
          declaredValue: pkg.declaredValueMinor ? pkg.declaredValueMinor / 100 : 0,
        })),
      };
    });

    return Response.json({ shipments: formatted });
  } catch (error) {
    console.error("Error al obtener envíos de clientes para SuperAdmin:", error);
    return Response.json({ error: "Error al consultar los envíos de la plataforma" }, { status: 500 });
  }
}
