import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  quoteRequestHash,
  signQuote,
  verifyQuote,
  type QuoteRequest,
} from "./carrier-gateway";

const previousSecret = process.env.AUTH_SECRET;

const request: QuoteRequest = {
  origin: {
    name: "Bodega Norte",
    phone: "0999999999",
    country: "EC",
    city: "Quito",
    line1: "Av. Principal 123",
  },
  destination: {
    name: "Cliente",
    phone: "0988888888",
    country: "EC",
    city: "Guayaquil",
    line1: "Calle Secundaria 45",
  },
  parcels: [
    {
      description: "Producto",
      quantity: 1,
      weightKg: 2,
      declaredValueMinor: 2500,
    },
  ],
  codMinor: 2500,
};

describe("cotizaciones firmadas", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-that-is-long-enough";
  });
  afterEach(() => {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  });

  it("verifica la cotización y detecta cambios en el envío", () => {
    const requestHash = quoteRequestHash(request);
    const token = signQuote({
      tenantId: "tenant",
      integrationId: "integration",
      carrier: "Carrier",
      carrierKey: "carrier",
      service: "Estándar",
      amountMinor: 500,
      currency: "USD",
      requestHash,
      expiresAt: Date.now() + 60_000,
    });
    expect(verifyQuote(token).requestHash).toBe(requestHash);
    expect(quoteRequestHash({ ...request, codMinor: 0 })).not.toBe(requestHash);
    expect(() => verifyQuote(`${token.slice(0, -1)}x`)).toThrow();
  });

  it("rechaza una cotización vencida", () => {
    const token = signQuote({
      tenantId: "tenant",
      integrationId: "integration",
      carrier: "Carrier",
      carrierKey: "carrier",
      service: "Estándar",
      amountMinor: 500,
      currency: "USD",
      requestHash: quoteRequestHash(request),
      expiresAt: Date.now() - 1,
    });
    expect(() => verifyQuote(token)).toThrow("expiró");
  });
});
