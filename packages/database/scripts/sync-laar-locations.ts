import { PrismaClient } from "../../../apps/web/generated/client";

const prisma = new PrismaClient();

type LaarApiCity = {
  codigo: number;
  nombre: string;
  trayecto: string;
  provincia: string;
  codigoProvincia: string;
  codigor?: number;
  frecuencia?: string;
  jornada?: string;
};

function trayectoToZone(trayecto: string): string {
  const t = (trayecto || "").toUpperCase().trim();
  switch (t) {
    case "TL":
      return "local";
    case "TP":
      return "principal";
    case "TS":
      return "secundario";
    case "TE":
      return "especial";
    case "TO":
      return "oriente";
    default:
      return "principal";
  }
}

function toTitleCase(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function syncLaarLocations() {
  console.log("🚀 Iniciando sincronización ultra-rápida de localidades...");

  // 1. Autenticación en LAAR
  const loginUrl = "https://api.laarcourier.com:9747/api/Login/authenticate";
  const loginRes = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: process.env.LAAR_API_USER || "prueba.plaza.api",
      password: process.env.LAAR_API_PASSWORD || "zhV-AL!]",
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Error de autenticación LAAR: ${loginRes.status} ${loginRes.statusText}`);
  }

  const loginData = (await loginRes.json()) as { token: string };
  const token = loginData.token;
  console.log("🔑 Token de sesión obtenido de LAAR Courier.");

  // 2. Obtención de catálogo completo de ciudades (729 registros)
  const citiesUrl = "https://api.laarcourier.com:9747/api/Ciudades/v1/ciudades";
  const citiesRes = await fetch(citiesUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!citiesRes.ok) {
    throw new Error(`Error al consultar ciudades LAAR: ${citiesRes.status}`);
  }

  const rawCities = (await citiesRes.json()) as LaarApiCity[];
  console.log(`📦 Se obtuvieron ${rawCities.length} localidades de LAAR.`);

  // 3. Limpieza y preparación de datos para inserción masiva
  const laarData = rawCities.map((city) => ({
    codigo: BigInt(city.codigo),
    nombre: city.nombre.trim(),
    trayecto: city.trayecto ? city.trayecto.trim() : "TP",
    provincia: city.provincia ? city.provincia.trim() : "",
    codigoProvincia: String(city.codigoProvincia || ""),
    codigor: city.codigor ?? null,
    frecuencia: city.frecuencia || null,
    jornada: city.jornada || null,
  }));

  console.log("💾 Insertando en lote la tabla LaarLocation...");
  await prisma.laarLocation.createMany({
    data: laarData,
    skipDuplicates: true,
  });

  // Leer todos los registros insertados para obtener sus IDs
  const savedLaarLocations = await prisma.laarLocation.findMany({
    select: { id: true, codigo: true, nombre: true, provincia: true, trayecto: true },
  });

  console.log(`✅ ${savedLaarLocations.length} registros listos en LaarLocation.`);

  // 4. Inserción masiva en la tabla traductora centralizada (CanonicalLocation)
  const canonicalData = savedLaarLocations.map((loc) => ({
    name: toTitleCase(loc.nombre),
    province: toTitleCase(loc.provincia),
    countryCode: "EC",
    active: true,
    laarLocationId: loc.id,
    laarCode: loc.codigo,
    laarCityName: loc.nombre,
    laarZone: trayectoToZone(loc.trayecto),
  }));

  console.log("🌐 Insertando en lote la tabla traductora CanonicalLocation...");
  await prisma.canonicalLocation.createMany({
    data: canonicalData,
    skipDuplicates: true,
  });

  const totalCanonical = await prisma.canonicalLocation.count();
  console.log(`🎉 ¡Sincronización completada exitosamente! ${totalCanonical} localidades centralizadas activas.`);
}

syncLaarLocations()
  .catch((err) => {
    console.error("❌ Error en la sincronización de localidades:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
