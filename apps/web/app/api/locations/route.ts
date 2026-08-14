export const dynamic = "force-dynamic";

import { getPrisma } from "../../../lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim().toLowerCase();

    const locations = await getPrisma().canonicalLocation.findMany({
      where: {
        active: true,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { province: { contains: query, mode: "insensitive" } },
                { laarCityName: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        province: true,
        laarCode: true,
        laarCityName: true,
        laarZone: true,
      },
      orderBy: [{ province: "asc" }, { name: "asc" }],
      take: 800,
    });

    const formatted = locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      province: loc.province,
      displayLabel: `${loc.name}, ${loc.province}`,
      laarCode: loc.laarCode ? String(loc.laarCode) : null,
      laarCityName: loc.laarCityName,
      laarZone: loc.laarZone,
    }));

    return Response.json({ locations: formatted });
  } catch (error) {
    console.error("Error al consultar localidades:", error);
    return Response.json({ error: "Error al obtener catálogo de localidades" }, { status: 500 });
  }
}
