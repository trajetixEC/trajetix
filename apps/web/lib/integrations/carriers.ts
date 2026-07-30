export type CarrierKey = "servientrega" | "tramaco" | "laar" | "gintracom" | "trajet" | "sertod" | "coordinadora" | "interrapidisimo" | "99minutos" | "blue_express" | "fedex" | "ups" | "dhl" | "correos";
export type ShipmentAddress = { name: string; phone?: string; country: string; city: string; postalCode?: string; line1: string };
export type Parcel = { weightKg: number; lengthCm?: number; widthCm?: number; heightCm?: number; declaredValueMinor?: number };
export type CarrierQuote = { service: string; amountMinor: number; currency: string; estimatedDays?: number };
export type CarrierLabel = { trackingNumber: string; labelUrl?: string; raw?: unknown };
export type TrackingEvent = { code: string; description: string; occurredAt: string; location?: string };

export interface CarrierAdapter {
  readonly key: CarrierKey;
  quote(input: { origin: ShipmentAddress; destination: ShipmentAddress; parcels: Parcel[] }): Promise<CarrierQuote[]>;
  createLabel(input: { reference: string; origin: ShipmentAddress; destination: ShipmentAddress; parcels: Parcel[]; service: string; codMinor?: number }): Promise<CarrierLabel>;
  cancelLabel(trackingNumber: string): Promise<void>;
  track(trackingNumber: string): Promise<TrackingEvent[]>;
  schedulePickup(input: { date: string; address: ShipmentAddress; trackingNumbers: string[] }): Promise<{ confirmation: string }>;
  verifyWebhook(headers: Headers, body: string): Promise<boolean>;
  normalizeWebhook(body: unknown): TrackingEvent[];
}

export class CarrierRegistry {
  private adapters = new Map<CarrierKey, CarrierAdapter>();
  register(adapter: CarrierAdapter) { this.adapters.set(adapter.key, adapter); return this; }
  get(key: CarrierKey) { const adapter = this.adapters.get(key); if (!adapter) throw new Error(`Transportadora no configurada: ${key}`); return adapter; }
  available() { return [...this.adapters.keys()]; }
}
