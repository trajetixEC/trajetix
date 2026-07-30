CREATE TYPE "ProductType" AS ENUM ('SIMPLE', 'VARIABLE', 'DIGITAL', 'KIT', 'BUNDLE');
CREATE TYPE "ShipmentStatus" AS ENUM ('DRAFT', 'QUOTED', 'LABEL_CREATED', 'PICKUP_SCHEDULED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION', 'CANCELLED', 'RETURNED');

ALTER TABLE "Product"
  ADD COLUMN "type" "ProductType" NOT NULL DEFAULT 'SIMPLE',
  ADD COLUMN "barcode" VARCHAR(100),
  ADD COLUMN "qrCode" VARCHAR(250),
  ADD COLUMN "category" VARCHAR(120),
  ADD COLUMN "brand" VARCHAR(120),
  ADD COLUMN "priceMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "minimumStock" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "reorderPoint" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "trackSerials" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "trackLots" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "trackExpiry" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "media" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE "Shipment" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "orderId" UUID,
  "carrier" VARCHAR(100) NOT NULL,
  "service" VARCHAR(100),
  "trackingNumber" VARCHAR(150),
  "status" "ShipmentStatus" NOT NULL DEFAULT 'DRAFT',
  "recipient" JSONB NOT NULL,
  "address" JSONB NOT NULL,
  "packages" JSONB NOT NULL DEFAULT '[]',
  "quotedMinor" BIGINT,
  "currency" CHAR(3) NOT NULL DEFAULT 'USD',
  "codMinor" BIGINT,
  "labelUrl" TEXT,
  "proofSignature" TEXT,
  "proofPhotoUrl" TEXT,
  "proofLatitude" DECIMAL(10,7),
  "proofLongitude" DECIMAL(10,7),
  "deliveredAt" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Shipment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "Shipment_tenantId_orderId_fkey" FOREIGN KEY ("tenantId", "orderId") REFERENCES "Order"("tenantId", "id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "Shipment_tenantId_trackingNumber_key" ON "Shipment"("tenantId", "trackingNumber");
CREATE UNIQUE INDEX "Shipment_tenantId_id_key" ON "Shipment"("tenantId", "id");
CREATE INDEX "Shipment_tenantId_status_createdAt_idx" ON "Shipment"("tenantId", "status", "createdAt");

CREATE TABLE "EcommerceIntegration" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "provider" VARCHAR(60) NOT NULL,
  "name" VARCHAR(120) NOT NULL, "shopDomain" VARCHAR(253), "secretRef" VARCHAR(250),
  "settings" JSONB NOT NULL DEFAULT '{}', "active" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncAt" TIMESTAMPTZ(6), "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "EcommerceIntegration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EcommerceIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "EcommerceIntegration_tenantId_provider_shopDomain_key" ON "EcommerceIntegration"("tenantId", "provider", "shopDomain");
CREATE INDEX "EcommerceIntegration_tenantId_active_idx" ON "EcommerceIntegration"("tenantId", "active");

CREATE TABLE "CarrierIntegration" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "carrierKey" VARCHAR(80) NOT NULL,
  "name" VARCHAR(120) NOT NULL, "secretRef" VARCHAR(250), "baseUrl" TEXT,
  "settings" JSONB NOT NULL DEFAULT '{}', "capabilities" TEXT[] NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "CarrierIntegration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CarrierIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "CarrierIntegration_tenantId_carrierKey_key" ON "CarrierIntegration"("tenantId", "carrierKey");

CREATE TABLE "WebhookEndpoint" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "url" TEXT NOT NULL,
  "events" TEXT[] NOT NULL, "secretHash" VARCHAR(128) NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebhookEndpoint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);
CREATE INDEX "WebhookEndpoint_tenantId_active_idx" ON "WebhookEndpoint"("tenantId", "active");
