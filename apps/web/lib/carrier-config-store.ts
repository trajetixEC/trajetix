export type ZoneKey = "local" | "principal" | "secundario" | "especial" | "oriente";

export type CodTier = {
  minAmount: number;
  maxAmount: number;
  fixedCost?: number;
  percentCost?: number;
};

export type ZoneRateConfig = {
  baseKg: number;
  baseCost: number;
  extraKgCost: number;
};

export type CarrierConfig = {
  active: boolean;
  general: {
    carrierKey: string;
    name: string;
    logoUrl: string;
    baseUrl: string;
    apiUser: string;
    apiPassword: string;
    capabilities: {
      cod: boolean;
      tracking: boolean;
      thermalLabel: boolean;
      pickupOrigin: boolean;
    };
  };
  pickup: {
    days: string[];
    startTime: string;
    endTime: string;
    cutoffTime: string;
    workdaysOnly: boolean;
    settlementCycleDays: number;
  };
  rates: {
    zones: Record<ZoneKey, ZoneRateConfig>;
    codTiers: CodTier[];
    trajetixFreightMarginPercent: number;
    trajetixCodMarginPercent: number;
    fixedSurcharge: number;
  };
  locationMappings: Array<{
    id: string;
    canonicalCity: string;
    laarCityCode: string;
    laarCityName: string;
    zone: ZoneKey;
  }>;
};

export const DEFAULT_LAAR_CONFIG: CarrierConfig = {
  active: true,
  general: {
    carrierKey: "laar",
    name: "LAAR Courier",
    logoUrl: "/brand/laar-logo.png",
    baseUrl: "https://api.laarcourier.com:9747",
    apiUser: "prueba.plaza.api",
    apiPassword: "zhV-AL!]",
    capabilities: {
      cod: true,
      tracking: true,
      thermalLabel: true,
      pickupOrigin: true,
    },
  },
  pickup: {
    days: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"],
    startTime: "09:00",
    endTime: "17:00",
    cutoffTime: "14:00",
    workdaysOnly: true,
    settlementCycleDays: 8,
  },
  rates: {
    zones: {
      local: { baseKg: 5, baseCost: 1.6, extraKgCost: 0.32 },
      principal: { baseKg: 5, baseCost: 2.52, extraKgCost: 0.56 },
      secundario: { baseKg: 5, baseCost: 2.72, extraKgCost: 0.6 },
      especial: { baseKg: 5, baseCost: 3.04, extraKgCost: 0.72 },
      oriente: { baseKg: 5, baseCost: 3.84, extraKgCost: 1.12 },
    },
    codTiers: [
      { minAmount: 1, maxAmount: 50, fixedCost: 2.0 },
      { minAmount: 51, maxAmount: 100, fixedCost: 3.0 },
      { minAmount: 101, maxAmount: 200, percentCost: 3.5 },
      { minAmount: 201, maxAmount: 300, percentCost: 4.5 },
    ],
    trajetixFreightMarginPercent: 15,
    trajetixCodMarginPercent: 10,
    fixedSurcharge: 0.0,
  },
  locationMappings: [
    { id: "1", canonicalCity: "Quito", laarCityCode: "UIO", laarCityName: "Quito D.M.", zone: "local" },
    { id: "2", canonicalCity: "Guayaquil", laarCityCode: "GYE", laarCityName: "Guayaquil", zone: "local" },
    { id: "3", canonicalCity: "Cuenca", laarCityCode: "CUE", laarCityName: "Cuenca", zone: "principal" },
    { id: "4", canonicalCity: "Ambato", laarCityCode: "AMB", laarCityName: "Ambato", zone: "principal" },
    { id: "5", canonicalCity: "Manta", laarCityCode: "MEC", laarCityName: "Manta", zone: "principal" },
    { id: "6", canonicalCity: "Santo Domingo", laarCityCode: "SDO", laarCityName: "Santo Domingo", zone: "principal" },
    { id: "7", canonicalCity: "Machala", laarCityCode: "MCH", laarCityName: "Machala", zone: "principal" },
    { id: "8", canonicalCity: "Loja", laarCityCode: "LOH", laarCityName: "Loja", zone: "secundario" },
    { id: "9", canonicalCity: "Ibarra", laarCityCode: "IBR", laarCityName: "Ibarra", zone: "secundario" },
    { id: "10", canonicalCity: "Tena", laarCityCode: "TNA", laarCityName: "El Tena", zone: "oriente" },
    { id: "11", canonicalCity: "Puyo", laarCityCode: "PUY", laarCityName: "El Puyo", zone: "oriente" },
    { id: "12", canonicalCity: "Macas", laarCityCode: "XMS", laarCityName: "Macas", zone: "oriente" },
    { id: "13", canonicalCity: "Puerto Baquerizo Moreno", laarCityCode: "GPS", laarCityName: "Galápagos", zone: "especial" },
  ],
};

const STORAGE_KEY = "trajetix_carrier_config_laar";
const ZERO_MARGIN_USERS_KEY = "trajetix_zero_margin_users";

export function loadCarrierConfig(carrierKey: string = "laar"): CarrierConfig {
  if (typeof window === "undefined") return DEFAULT_LAAR_CONFIG;
  try {
    const raw =
      localStorage.getItem(`${STORAGE_KEY}_${carrierKey}`) ||
      localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CarrierConfig;
      return {
        ...DEFAULT_LAAR_CONFIG,
        ...parsed,
        rates: {
          ...DEFAULT_LAAR_CONFIG.rates,
          ...(parsed.rates || {}),
          trajetixFreightMarginPercent:
            typeof parsed.rates?.trajetixFreightMarginPercent === "number" &&
            parsed.rates.trajetixFreightMarginPercent > 0
              ? parsed.rates.trajetixFreightMarginPercent
              : 15,
          trajetixCodMarginPercent:
            typeof parsed.rates?.trajetixCodMarginPercent === "number" &&
            parsed.rates.trajetixCodMarginPercent > 0
              ? parsed.rates.trajetixCodMarginPercent
              : 10,
        },
      };
    }
  } catch (err) {
    console.error("Error al cargar configuración de transportadora:", err);
  }
  return DEFAULT_LAAR_CONFIG;
}

export function saveCarrierConfig(config: CarrierConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${STORAGE_KEY}_${config.general.carrierKey}`,
      JSON.stringify(config)
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error("Error al guardar configuración de transportadora:", err);
  }
}

export function getZeroMarginUsers(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ZERO_MARGIN_USERS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item || "").trim().toLowerCase())
          .filter(Boolean);
      }
    }
  } catch (err) {
    console.error("Error al leer usuarios sin margen:", err);
  }
  return [];
}

export function setZeroMarginUser(userEmailOrId: string, enable: boolean): void {
  if (typeof window === "undefined") return;
  const cleanEmail = userEmailOrId.trim().toLowerCase();
  if (!cleanEmail) return;
  try {
    const current = getZeroMarginUsers();
    let updated: string[];
    if (enable) {
      updated = Array.from(new Set([...current, cleanEmail]));
    } else {
      updated = current.filter((item) => item !== cleanEmail && !item.includes(cleanEmail) && !cleanEmail.includes(item));
    }
    localStorage.setItem(ZERO_MARGIN_USERS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Error al guardar permiso sin margen:", err);
  }
}

export function calculateCarrierFreightRate(params: {
  config: CarrierConfig;
  originCity: string;
  destinationCity: string;
  destinationZone?: ZoneKey;
  weightKg: number;
  codAmount: number;
  insuredValue?: number;
  isZeroMarginUser?: boolean;
  isDocument?: boolean;
}) {
  const {
    config,
    originCity,
    destinationCity,
    destinationZone,
    weightKg,
    codAmount,
    insuredValue = 0,
    isZeroMarginUser = false,
    isDocument = false,
  } = params;

  const cleanOrigin = (originCity || "").trim().toLowerCase();
  const cleanDest = (destinationCity || "").trim().toLowerCase();

  // Check if same city or metropolitan area (Local zone)
  const isSameCity =
    cleanOrigin.length > 0 &&
    cleanDest.length > 0 &&
    (cleanOrigin === cleanDest ||
      cleanOrigin.includes(cleanDest) ||
      cleanDest.includes(cleanOrigin));

  const destMapping = config.locationMappings.find(
    (m) =>
      m.canonicalCity.toLowerCase() === cleanDest ||
      cleanDest.includes(m.canonicalCity.toLowerCase())
  );

  let zoneKey: ZoneKey;
  if (isSameCity) {
    zoneKey = "local";
  } else if (destinationZone) {
    zoneKey = destinationZone;
  } else if (destMapping && destMapping.zone !== "local") {
    zoneKey = destMapping.zone;
  } else {
    // Interprovincial default between different cities is principal
    zoneKey = "principal";
  }

  const zoneConfig = config.rates.zones[zoneKey] || config.rates.zones.principal;

  // Base freight cost (LAAR cost)
  const baseKg = isDocument ? 2 : zoneConfig.baseKg;
  let laarFreightCost = zoneConfig.baseCost;
  if (weightKg > baseKg) {
    const extraKg = Math.ceil(weightKg - baseKg);
    laarFreightCost += extraKg * zoneConfig.extraKgCost;
  }

  // COD cost (LAAR cost)
  let laarCodCost = 0;
  if (codAmount > 0) {
    const tier = config.rates.codTiers.find(
      (t) => codAmount >= t.minAmount && codAmount <= t.maxAmount
    );
    if (tier) {
      if (tier.fixedCost !== undefined) laarCodCost = tier.fixedCost;
      else if (tier.percentCost !== undefined) laarCodCost = (codAmount * tier.percentCost) / 100;
    } else {
      // Default tier fallback
      laarCodCost = (codAmount * 4.5) / 100;
    }
  }

  const laarTotalCost = laarFreightCost + laarCodCost + config.rates.fixedSurcharge;

  // Trajetix Profit Margins calculation (Default 15% freight, 10% COD)
  let freightMargin = 0;
  let codMargin = 0;

  const freightMarginPercent =
    typeof config.rates?.trajetixFreightMarginPercent === "number" &&
    config.rates.trajetixFreightMarginPercent > 0
      ? config.rates.trajetixFreightMarginPercent
      : 15;

  const codMarginPercent =
    typeof config.rates?.trajetixCodMarginPercent === "number" &&
    config.rates.trajetixCodMarginPercent > 0
      ? config.rates.trajetixCodMarginPercent
      : 10;

  if (!isZeroMarginUser) {
    freightMargin = Math.round(((laarFreightCost * freightMarginPercent) / 100) * 100) / 100;
    if (laarCodCost > 0) {
      codMargin = Math.round(((laarCodCost * codMarginPercent) / 100) * 100) / 100;
    }
  }

  // Insurance cost charged to client: 1.5% of insured value
  const insuranceCost = insuredValue > 0 ? Math.round(insuredValue * 0.015 * 100) / 100 : 0;

  // Client prices before VAT
  const clientFreightCost = laarFreightCost + freightMargin;
  const clientCodCost = laarCodCost + codMargin;
  const clientInsuranceCost = insuranceCost;

  // Subtotal before VAT = (tarifa base + kg extra + seguro + gestión de recaudo)
  const subtotalClient = Math.round((clientFreightCost + clientCodCost + clientInsuranceCost) * 100) / 100;

  // IVA (15%) = Subtotal × 15%
  const ivaCost = Math.round(subtotalClient * 0.15 * 100) / 100;

  // Total final price to client (Subtotal + IVA 15%)
  const finalPriceToClient = Math.round((subtotalClient + ivaCost) * 100) / 100;

  const trajetixProfitTotal = freightMargin + codMargin;

  return {
    zoneKey,
    zoneName: zoneKey.toUpperCase(),
    laarCityCode: destMapping?.laarCityCode ?? "GEN",
    laarFreightCost,
    laarCodCost,
    laarTotalCost,
    freightMarginPercent: isZeroMarginUser ? 0 : config.rates.trajetixFreightMarginPercent,
    freightMargin,
    codMarginPercent: isZeroMarginUser ? 0 : config.rates.trajetixCodMarginPercent,
    codMargin,
    fixedSurcharge: config.rates.fixedSurcharge || 0,
    insuranceCost,
    insuredValue,
    clientFreightCost,
    clientCodCost,
    clientInsuranceCost,
    subtotalClient,
    ivaRate: 0.15,
    ivaCost,
    trajetixProfitTotal,
    finalPriceToClient,
    isZeroMarginApplied: isZeroMarginUser,
  };
}
