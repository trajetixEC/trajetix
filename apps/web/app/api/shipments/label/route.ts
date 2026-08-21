export const dynamic = "force-dynamic";

import zlib from "zlib";
import { getPrisma } from "../../../../lib/prisma";
import { getLaarAuthToken } from "../../../../lib/integrations/laar-client";

function patchLaarPdfOrigin(
  pdfBuffer: Buffer,
  origin: { name?: string; address?: string; city?: string; phone?: string }
): Buffer {
  try {
    const name = (origin.name || "").trim();
    const address = (origin.address || "").trim();
    const city = (origin.city || "").trim();
    const phone = (origin.phone || "").trim();

    if (!name && !address) return pdfBuffer;

    const pdfStr = pdfBuffer.toString("latin1");
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;

    const patchedStr = pdfStr.replace(streamRegex, (match, streamData) => {
      try {
        let decompressed = zlib.inflateSync(Buffer.from(streamData, "latin1")).toString("latin1");
        if (
          decompressed.includes("PLAZA TOALA") ||
          decompressed.includes("MARTHA DE ROLDOS")
        ) {
          if (name) {
            decompressed = decompressed
              .replace(/PLAZA TOALA VICTORIA STEPHANIE\s*-\s*92529/g, name)
              .replace(/PLAZA TOALA VICTORIA STEPHANIE/g, name)
              .replace(/PLAZA TOALA VICTORIA/g, name)
              .replace(/PLAZA TOALA/g, name);
          }
          if (address) {
            decompressed = decompressed
              .replace(/CDLA MARTHA DE ROLDOS,\s*MZN 215 V7\s*\.\.\./g, address)
              .replace(/CDLA MARTHA DE ROLDOS,\s*MZN 215 V7/g, address)
              .replace(/CDLA MARTHA DE ROLDOS/g, address);
          }
          if (phone) {
            decompressed = decompressed
              .replace(/TEL:\s*098\s*293\s*8397/g, `TEL: ${phone}`)
              .replace(/098\s*293\s*8397/g, phone);
          }
          if (city) {
            decompressed = decompressed.replace(
              /\(REMITENTE:\)Tj[\s\S]*?\((?:GUAYAQUIL|QUITO|CUENCA)\)Tj/i,
              (headerMatch) => headerMatch.replace(/\((?:GUAYAQUIL|QUITO|CUENCA)\)Tj/i, `(${city.toUpperCase()})Tj`)
            );
          }

          const recompressed = zlib.deflateSync(Buffer.from(decompressed, "latin1")).toString("latin1");
          return `stream\r\n${recompressed}\r\nendstream`;
        }
      } catch {
        if (
          streamData.includes("PLAZA TOALA") ||
          streamData.includes("MARTHA DE ROLDOS")
        ) {
          let replaced = streamData;
          if (name) {
            replaced = replaced
              .replace(/PLAZA TOALA VICTORIA STEPHANIE\s*-\s*92529/g, name)
              .replace(/PLAZA TOALA VICTORIA STEPHANIE/g, name)
              .replace(/PLAZA TOALA VICTORIA/g, name)
              .replace(/PLAZA TOALA/g, name);
          }
          if (address) {
            replaced = replaced
              .replace(/CDLA MARTHA DE ROLDOS,\s*MZN 215 V7\s*\.\.\./g, address)
              .replace(/CDLA MARTHA DE ROLDOS,\s*MZN 215 V7/g, address)
              .replace(/CDLA MARTHA DE ROLDOS/g, address);
          }
          if (phone) {
            replaced = replaced
              .replace(/TEL:\s*098\s*293\s*8397/g, `TEL: ${phone}`)
              .replace(/098\s*293\s*8397/g, phone);
          }
          return `stream\r\n${replaced}\r\nendstream`;
        }
      }
      return match;
    }
    );

    return Buffer.from(patchedStr, "latin1");
  } catch (err) {
    console.error("Error al reemplazar remitente y dirección en PDF de LAAR:", err);
    return pdfBuffer;
  }
}

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
      include: {
        tenant: { select: { displayName: true, legalName: true } },
      },
    });

    if (!shipment) {
      return new Response("Guía de envío no encontrada en la base de datos", { status: 404 });
    }

    const trackingNumber = shipment.trackingNumber;
    if (!trackingNumber) {
      return new Response("Número de guía no asignado", { status: 400 });
    }

    const origin = (shipment.origin as { name?: string; line1?: string; city?: string; phone?: string }) || {};

    const storeSenderName =
      origin.name ||
      shipment.tenant?.displayName ||
      shipment.tenant?.legalName ||
      "Tienda";

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

    const rawBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    const patchedBuffer = patchLaarPdfOrigin(rawBuffer, {
      name: storeSenderName,
      address: origin.line1 || "",
      city: origin.city || "",
      phone: origin.phone || "",
    });

    return new Response(new Uint8Array(patchedBuffer), {
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
