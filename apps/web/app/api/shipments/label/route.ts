export const dynamic = "force-dynamic";

import { getPrisma } from "../../../../lib/prisma";
import { getLaarAuthToken } from "../../../../lib/integrations/laar-client";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const tracking = url.searchParams.get("tracking");

    if (!id && !tracking) {
      return new Response("Falta el ID o número de guía", { status: 400 });
    }

    const shipment = await getPrisma().shipment.findFirst({
      where: id ? { id } : { trackingNumber: tracking! },
    });

    if (!shipment) {
      return new Response("Guía de envío no encontrada en la base de datos", { status: 404 });
    }

    const trackingNumber = shipment.trackingNumber;
    if (!trackingNumber) {
      return new Response("Número de guía no asignado", { status: 400 });
    }

    // 1. Authenticate with LAAR Courier API
    const token = await getLaarAuthToken();

    // 2. Fetch REAL official PDF directly from LAAR Courier API
    const pdfResponse = await fetch(
      `https://api.laarcourier.com:9747/api/Pdfs/v3/etiqueta/descargar?guia=${encodeURIComponent(trackingNumber)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!pdfResponse.ok) {
      return new Response(
        `La guía ${trackingNumber} fue creada previamente en modo local. Por favor crea un "Nuevo Envío" para solicitar la guía real en tiempo real a los servidores de LAAR Courier.`,
        { status: 404 }
      );
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Guia-LAAR-${trackingNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error al obtener la guía oficial de LAAR Courier:", error);
    return new Response(
      `Error al procesar la guía PDF de LAAR Courier: ${error instanceof Error ? error.message : "Error desconocido"}`,
      { status: 500 }
    );
  }
}
