export type CommerceProduct = { externalId: string; sku: string; name: string; priceMinor: number; stock?: number; payload?: unknown };
export type CommerceOrder = { externalId: string; currency: string; totalMinor: number; customer: unknown; address: unknown; items: Array<{ sku: string; quantity: number; unitPriceMinor: number }> };

export interface EcommerceAdapter {
  readonly provider: "shopify" | "api";
  listProducts(cursor?: string): Promise<{ products: CommerceProduct[]; cursor?: string }>;
  listOrders(cursor?: string): Promise<{ orders: CommerceOrder[]; cursor?: string }>;
  pushInventory(items: Array<{ sku: string; available: number }>): Promise<void>;
  registerWebhooks(baseUrl: string): Promise<void>;
  verifyWebhook(headers: Headers, rawBody: string): Promise<boolean>;
}

export const commerceEvents = ["product.created", "product.updated", "inventory.updated", "order.created", "order.updated", "shipment.updated"] as const;
