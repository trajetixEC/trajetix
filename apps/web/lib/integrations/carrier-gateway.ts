import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type GatewayParcel = {
  description: string;
  quantity: number;
  weightKg: number;
  lengthCm?: number | undefined;
  widthCm?: number | undefined;
  heightCm?: number | undefined;
  declaredValueMinor: number;
};
export type GatewayAddress = {
  name: string;
  phone: string;
  country: "EC";
  city: string;
  line1: string;
  reference?: string | undefined;
};
export type QuoteTokenPayload = {
  tenantId: string;
  integrationId: string;
  carrier: string;
  carrierKey: string;
  service: string;
  amountMinor: number;
  currency: string;
  requestHash: string;
  externalQuoteId?: string | undefined;
  expiresAt: number;
};

export type QuoteRequest = {
  origin: GatewayAddress;
  destination: GatewayAddress;
  parcels: GatewayParcel[];
  codMinor: number;
};

export function quoteRequestHash(input: QuoteRequest) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function signingSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET no está configurado");
  return secret;
}

export function signQuote(payload: QuoteTokenPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", signingSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyQuote(token: string) {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) throw new Error("Cotización inválida");
  const expected = createHmac("sha256", signingSecret())
    .update(encoded)
    .digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  )
    throw new Error("Cotización alterada");
  const payload = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as QuoteTokenPayload;
  if (payload.expiresAt < Date.now())
    throw new Error("La cotización expiró; recalcula la tarifa");
  return payload;
}

function credential(secretRef: string | null) {
  if (!secretRef)
    throw new Error("La transportadora no tiene credencial configurada");
  const value = process.env[secretRef];
  if (!value) throw new Error(`Falta la credencial segura ${secretRef}`);
  return value;
}

async function gatewayRequest<T>(
  baseUrl: string | null,
  secretRef: string | null,
  path: string,
  body: unknown,
): Promise<T> {
  if (!baseUrl)
    throw new Error("La transportadora no tiene URL de API configurada");
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${credential(secretRef)}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  const result = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
  };
  if (!response.ok)
    throw new Error(
      result.error ??
        result.message ??
        `La transportadora respondió ${response.status}`,
    );
  return result;
}

export async function requestCarrierQuotes(
  integration: { baseUrl: string | null; secretRef: string | null },
  input: QuoteRequest,
) {
  return gatewayRequest<{
    quotes: Array<{
      service: string;
      amountMinor: number;
      currency?: string;
      estimatedDays?: number;
      externalQuoteId?: string;
    }>;
  }>(integration.baseUrl, integration.secretRef, "/quote", input);
}

export async function createCarrierLabel(
  integration: { baseUrl: string | null; secretRef: string | null },
  input: {
    reference: string;
    origin: GatewayAddress;
    destination: GatewayAddress;
    parcels: GatewayParcel[];
    service: string;
    codMinor: number;
    externalQuoteId?: string;
  },
) {
  return gatewayRequest<{
    trackingNumber: string;
    labelUrl?: string;
    raw?: unknown;
  }>(integration.baseUrl, integration.secretRef, "/label", input);
}
