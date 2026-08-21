export const dynamic = "force-dynamic";

import { z } from "zod";
import { getPrisma } from "../../../../lib/prisma";
import { requireTenant, tenantError } from "../../../../lib/tenant";

const postSchema = z.object({
  shipmentIds: z.array(z.string().uuid()).min(1),
  manifestId: z.string().optional(),
});

type PackageItem = {
  quantity?: number;
  weightKg?: number;
};

type ManifestItem = {
  id: string;
  orderId: string;
  carrier: string;
  service: string | null;
  tracking: string;
  status: string;
  recipient: Record<string, unknown>;
  address: Record<string, unknown>;
  origin: Record<string, unknown>;
  packages: PackageItem[];
  cod: number;
  createdAt: string;
  metadata: Record<string, unknown>;
};

type ManifestGroup = {
  manifestId: string;
  createdAt: string;
  shipments: ManifestItem[];
  carriers: string[];
  totalPackages: number;
  totalWeight: number;
  totalCod: number;
};

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenant("shipments:create");
    const body = await request.json();
    const parsed = postSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Datos de manifiesto inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { shipmentIds } = parsed.data;
    const generatedManifestId = parsed.data.manifestId || `MAN-${Math.floor(100000 + Math.random() * 900000)}`;
    const nowIso = new Date().toISOString();

    const shipments = await getPrisma().shipment.findMany({
      where: {
        tenantId,
        id: { in: shipmentIds },
      },
    });

    if (shipments.length === 0) {
      return Response.json({ error: "No se encontraron envíos para el manifiesto" }, { status: 404 });
    }

    // Check if any shipment already has a manifest assigned or is in invalid status
    const ineligibleStatuses = ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"];
    for (const shipment of shipments) {
      const meta = (shipment.metadata as Record<string, unknown>) || {};
      if (meta.manifestId) {
        return Response.json(
          { error: `El envío ${shipment.trackingNumber || shipment.id} ya pertenece al Manifiesto #${String(meta.manifestId)}` },
          { status: 400 }
        );
      }
      if (ineligibleStatuses.includes(String(shipment.status).toUpperCase())) {
        return Response.json(
          { error: `El envío ${shipment.trackingNumber || shipment.id} está en estado "${shipment.status}" y no puede despacharse` },
          { status: 400 }
        );
      }
    }

    // Update each shipment with manifest metadata
    await getPrisma().$transaction(
      shipments.map((shipment) => {
        const currentMeta = (shipment.metadata as Record<string, unknown>) || {};
        const updatedMeta = {
          ...currentMeta,
          manifestId: generatedManifestId,
          manifestCreatedAt: nowIso,
        };

        return getPrisma().shipment.update({
          where: { id: shipment.id },
          data: {
            metadata: updatedMeta,
          },
        });
      })
    );

    return Response.json({
      ok: true,
      manifestId: generatedManifestId,
      manifestCreatedAt: nowIso,
      updatedCount: shipments.length,
    });
  } catch (error) {
    return tenantError(error);
  }
}

export async function GET() {
  try {
    const { tenantId } = await requireTenant("shipments:read");

    const shipments = await getPrisma().shipment.findMany({
      where: {
        tenantId,
      },
      orderBy: { createdAt: "desc" },
    });

    // Group shipments by manifestId from metadata
    const manifestsMap = new Map<string, ManifestGroup>();

    for (const s of shipments) {
      const meta = (s.metadata as Record<string, unknown>) || {};
      const mId = typeof meta.manifestId === "string" ? meta.manifestId : null;
      if (!mId) continue;

      const packages = Array.isArray(s.packages) ? (s.packages as PackageItem[]) : [];
      const weight = packages.reduce((sum: number, p) => sum + (Number(p.weightKg) || 0) * (Number(p.quantity) || 1), 0);
      const pkgsCount = packages.reduce((sum: number, p) => sum + (Number(p.quantity) || 1), 0);
      const codVal = s.codMinor ? Number(s.codMinor) / 100 : 0;

      if (!manifestsMap.has(mId)) {
        manifestsMap.set(mId, {
          manifestId: mId,
          createdAt: typeof meta.manifestCreatedAt === "string" ? meta.manifestCreatedAt : s.createdAt.toISOString(),
          shipments: [],
          carriers: [],
          totalPackages: 0,
          totalWeight: 0,
          totalCod: 0,
        });
      }

      const m = manifestsMap.get(mId)!;
      m.shipments.push({
        id: s.id,
        orderId: s.orderId || s.id.slice(0, 8),
        carrier: s.carrier,
        service: s.service,
        tracking: s.trackingNumber || "",
        status: s.status,
        recipient: (s.recipient as Record<string, unknown>) || {},
        address: (s.address as Record<string, unknown>) || {},
        origin: (s.origin as Record<string, unknown>) || {},
        packages,
        cod: codVal,
        createdAt: s.createdAt.toISOString(),
        metadata: meta,
      });
      if (s.carrier && !m.carriers.includes(s.carrier)) {
        m.carriers.push(s.carrier);
      }
      m.totalPackages += pkgsCount;
      m.totalWeight += weight;
      m.totalCod += codVal;
    }

    const manifestsList = Array.from(manifestsMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return Response.json({
      manifests: manifestsList,
    });
  } catch (error) {
    return tenantError(error);
  }
}
