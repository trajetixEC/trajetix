/**
 * Official LAAR Courier API Integration Module
 * Credentials:
 *   User: prueba.plaza.api
 *   Password: zhV-AL!]
 *   Base URL: https://api.laarcourier.com:9747
 */

import { getPrisma } from "../prisma";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function resolveLaarCityCode(cityName: string): Promise<string> {
  if (!cityName) return "201001001001";

  const cleanName = cityName.trim();
  try {
    const loc = await getPrisma().canonicalLocation.findFirst({
      where: {
        active: true,
        OR: [
          { name: { equals: cleanName, mode: "insensitive" } },
          { laarCityName: { equals: cleanName, mode: "insensitive" } },
          { name: { contains: cleanName, mode: "insensitive" } },
        ],
      },
      select: { laarCode: true },
    });

    if (loc?.laarCode) {
      return String(loc.laarCode);
    }
  } catch (err) {
    console.error("Error resolviendo código de ciudad LAAR para:", cityName, err);
  }

  // Fallback map for common Ecuadorian cities if DB lookup fails
  const lower = cleanName.toLowerCase();
  if (lower.includes("guayaquil")) return "201001002001";
  if (lower.includes("salinas")) return "201001002004";
  if (lower.includes("cuenca")) return "201001001001";
  if (lower.includes("manta")) return "20100101901";
  if (lower.includes("ambato")) return "20100101801";
  if (lower.includes("machala")) return "20100100701";
  if (lower.includes("portoviejo")) return "20100101901";
  if (lower.includes("loja")) return "20100101101";
  if (lower.includes("ibarra")) return "20100101001";

  return "201001001001";
}

export async function getLaarAuthToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const username = process.env.LAAR_API_USER || "plaza.toala.api";
  const password = process.env.LAAR_API_PASSWORD || "O4CO)nFX";

  const response = await fetch("https://api.laarcourier.com:9747/api/Login/authenticate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Error al autenticar con LAAR Courier API (${response.status})`);
  }

  const data = (await response.json()) as { token?: string };
  if (!data.token) {
    throw new Error("LAAR Courier API no devolvió token de autenticación");
  }

  cachedToken = {
    token: data.token,
    expiresAt: Date.now() + 3600_000,
  };

  return data.token;
}

export type LaarShipmentInput = {
  reference?: string | undefined;
  origin: {
    name: string;
    phone: string;
    city: string;
    line1: string;
    email?: string | undefined;
    reference?: string | undefined;
  };
  destination: {
    name: string;
    phone: string;
    city: string;
    line1: string;
    reference?: string | undefined;
    email?: string | undefined;
  };
  parcels: Array<{
    description: string;
    quantity: number;
    weightKg: number;
    declaredValueMinor: number;
  }>;
  codMinor: number;
};

export type LaarShipmentResult = {
  trackingNumber: string;
  labelUrl: string;
  pickupCode?: string | undefined;
  raw?: unknown;
};

// Default city code mapping for LAAR Courier
const LAAR_CITY_CODES: Record<string, string> = {
  quito: "201001001001",
  guayaquil: "20100101901",
  ambato: "20100101901",
  cuenca: "201001001001",
  manta: "20100101901",
};

export async function createLaarShipment(
  input: LaarShipmentInput
): Promise<LaarShipmentResult> {
  const token = await getLaarAuthToken();

  const totalWeight = input.parcels.reduce((sum, p) => sum + p.weightKg * p.quantity, 0);
  const totalPieces = input.parcels.reduce((sum, p) => sum + p.quantity, 0);
  const declaredValue = input.parcels.reduce((sum, p) => sum + p.declaredValueMinor / 100, 0);
  const codAmount = input.codMinor / 100;
  const isCod = codAmount > 0;

  const originCityCode = await resolveLaarCityCode(input.origin.city);
  const destCityCode = await resolveLaarCityCode(input.destination.city);

  const uniqueGuiaRef = input.reference || `TRJ${Date.now()}`;

  const payload = {
    origen: {
      identificacionO: "1791705726001",
      ciudadO: originCityCode,
      nombreO: input.origin.name || "Remitente",
      direccion: input.origin.line1 || "Dirección de Origen",
      referencia: "",
      numeroCasa: "",
      postal: "",
      telefono: input.origin.phone || "0999999999",
      celular: input.origin.phone || "0999999999",
    },
    destino: {
      identificacionD: "9999999999",
      ciudadD: destCityCode,
      nombreD: input.destination.name || "Destinatario",
      direccion: input.destination.line1 || "Dirección de Destino",
      referencia: input.destination.reference || "",
      numeroCasa: "",
      postal: "",
      telefono: input.destination.phone || "0999999999",
      celular: input.destination.phone || "0999999999",
      categoria: "B",
      latitud: "-0.180653",
      longitud: "-78.467838",
    },
    numeroGuia: uniqueGuiaRef,
    tipoServicio: "201202002002013",
    noPiezas: totalPieces > 0 ? totalPieces : 1,
    peso: totalWeight > 0 ? totalWeight : 1.0,
    valorDeclarado: declaredValue > 0 ? declaredValue : 1.0,
    contiene: input.parcels[0]?.description || "PAQUETE",
    tamanio: "MEDIANO",
    cod: isCod,
    costoflete: 0,
    costoproducto: isCod ? codAmount : 0,
    tipocobro: isCod ? 1 : 0,
    comentario: input.origin.name ? `Tienda: ${input.origin.name}` : "Despacho Trajetix ERP",
    fechaPedido: "",
    retorno: {
      tipoServicio: "",
      noPiezas: 0,
      peso: 0,
      contiene: "",
      comentario: "",
      tamanio: "",
    },
    extras: {
      campo1: input.origin.name || "",
      campo2: "Trajetix ERP",
      campo3: "",
    },
  };

  const endpoint = isCod
    ? "https://api.laarcourier.com:9747/api/Guias/v1/guias/destinatario?isRetorno=false"
    : "https://api.laarcourier.com:9747/api/Guias/v1/guias/contado?isRetorno=false";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LAAR Courier API rechazó la creación (${response.status}): ${errText}`);
  }

  const result = (await response.json()) as {
    guia?: string;
    url?: string;
    message?: string;
  };

  if (!result.guia) {
    throw new Error(result.message || "LAAR Courier API no devolvió un número de guía válido");
  }

  // Schedule pickup automatically with LAAR Courier
  let pickupCode: string | undefined;
  try {
    const pickupRes = await scheduleLaarPickup({
      guias: [result.guia],
      cantidad: totalPieces > 0 ? totalPieces : 1,
      comentario: input.parcels[0]?.description || "PAQUETE ERP",
      remitente: {
        nombreCompleto: input.origin.name,
        calle1: input.origin.line1,
        telefono: input.origin.phone,
        celular: input.origin.phone,
        ciudad: input.origin.city,
        referencia: input.origin.reference || "Bodega de Origen",
        correo: input.origin.email || "contacto@tienda.com",
      },
    });

    if (pickupRes?.isSuccess && pickupRes?.objetoADeserializar?.g31_Id) {
      pickupCode = pickupRes.objetoADeserializar.g31_Id;
    }
  } catch (pickupErr) {
    console.warn("Aviso al agendar recolección automática en LAAR:", pickupErr);
  }

  return {
    trackingNumber: result.guia,
    labelUrl: result.url || `https://api.laarcourier.com:9747/api/Pdfs/v3/etiqueta/descargar?guia=${result.guia}`,
    pickupCode,
    raw: result,
  };
}

export async function fetchLaarTracking(guiaNumber: string) {
  const token = await getLaarAuthToken();

  const response = await fetch(`https://api.laarcourier.com:9746/guias/v4/${encodeURIComponent(guiaNumber)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data;
}

export async function cancelLaarShipment(guiaNumber: string) {
  const token = await getLaarAuthToken();

  const response = await fetch(
    `https://api.laarcourier.com:9747/api/Guias/v1/anular/${encodeURIComponent(guiaNumber)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error al anular guía en LAAR Courier (${response.status}): ${errText}`);
  }

  return (await response.json()) as { guia?: string; menssage?: string };
}

export type LaarNoveltyInput = {
  guia: string;
  destino: {
    ciudad?: string;
    nombre?: string;
    cedula?: string;
    callePrincipal: string;
    numeracion: string;
    calleSecundaria: string;
    referencia: string;
    telefono: string;
    celular: string;
    observacion?: string;
    correo?: string;
  };
  autorizado: {
    isDevolucion: boolean;
    nombre: string;
    observacion: string;
  };
};

export async function resolveLaarNovelty(input: LaarNoveltyInput) {
  const token = await getLaarAuthToken();

  const payload = {
    guia: input.guia,
    destino: {
      ciudad: input.destino.ciudad || "201001001001",
      nombre: input.destino.nombre || "DESTINATARIO",
      cedula: input.destino.cedula || "",
      callePrincipal: input.destino.callePrincipal,
      numeracion: input.destino.numeracion || "SN",
      calleSecundaria: input.destino.calleSecundaria,
      referencia: input.destino.referencia,
      telefono: input.destino.telefono,
      celular: input.destino.celular || input.destino.telefono,
      observacion: input.destino.observacion || "",
      correo: input.destino.correo || "",
    },
    autorizado: {
      isDevolucion: input.autorizado.isDevolucion,
      nombre: input.autorizado.nombre,
      observacion: input.autorizado.observacion,
    },
  };

  const response = await fetch("https://api.laarcourier.com:9747/api/Guias/v1/guias/novedad", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const errText = await response.text();
    console.warn(`Aviso de respuesta API LAAR novedad (${response.status}):`, errText);
  }

  return (await response.json().catch(() => null)) as {
    codigo?: number;
    titulo?: string;
    mensaje?: string;
    tipo?: string;
  } | null;
}

export type ScheduleLaarPickupInput = {
  guias: string[];
  tipoServicio?: string;
  cantidad?: number;
  comentario?: string;
  tipoHorario?: number;
  remitente: {
    id?: number | null;
    nombreCompleto: string;
    cedula?: string;
    calle1: string;
    nCalle?: string;
    calle2?: string;
    telefono: string;
    celular?: string;
    ciudad: string;
    referencia?: string;
    correo: string;
  };
  fechaRecoleccionPlanificada?: string;
};

export async function scheduleLaarPickup(input: ScheduleLaarPickupInput) {
  const token = await getLaarAuthToken();

  const todayStr = new Date().toISOString().slice(0, 10);
  const payload = {
    nroGuia: input.guias,
    tipoServicio: input.tipoServicio || "201202002002013",
    cantidad: input.cantidad || input.guias.length,
    comentario: (input.comentario || "Despacho ERP Trajetix").slice(0, 200),
    tipoHorario: input.tipoHorario || 1,
    remitente: {
      id: input.remitente.id ?? null,
      nombreCompleto: input.remitente.nombreCompleto || "Remitente Trajetix",
      cedula: input.remitente.cedula || "1316668522001",
      calle1: input.remitente.calle1 || "Dirección de Origen",
      nCalle: input.remitente.nCalle || "SN",
      calle2: input.remitente.calle2 || "Intersección",
      telefono: input.remitente.telefono || "0999999999",
      celular: input.remitente.celular || input.remitente.telefono || "0999999999",
      codigoPostal: null,
      ciudad: (input.remitente.ciudad || "QUITO").toUpperCase(),
      referencia: input.remitente.referencia || "Bodega de Origen",
      correo: input.remitente.correo || "contacto@trajetix.com",
    },
    fechaRecoleccionPlanificada: input.fechaRecoleccionPlanificada || todayStr,
  };

  const response = await fetch("https://api.laarcourier.com:9747/api/Recoleccion/AgendarRecoleccion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const errText = await response.text();
    console.warn(`Aviso de agendamiento de recolección en LAAR (${response.status}):`, errText);
    return null;
  }

  const data = await response.json();
  return data as {
    isSuccess: boolean;
    message?: string | null;
    objetoADeserializar?: {
      existe: boolean;
      g31_Id: string;
    } | null;
  };
}

