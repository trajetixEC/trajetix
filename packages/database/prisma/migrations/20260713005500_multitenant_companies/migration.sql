CREATE TYPE "PlatformRole" AS ENUM ('USER', 'SUPER_ADMIN');
CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'VERIFIED', 'ACTIVE', 'FAILED');

ALTER TABLE "User" ADD COLUMN "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER';

CREATE TABLE "Customer" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "code" VARCHAR(80),
  "email" VARCHAR(320),
  "name" VARCHAR(200) NOT NULL,
  "phone" VARCHAR(40),
  "taxId" VARCHAR(40),
  "addresses" JSONB NOT NULL DEFAULT '[]',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE TABLE "Store" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "channel" VARCHAR(60),
  "externalId" VARCHAR(150),
  "url" TEXT,
  "settings" JSONB NOT NULL DEFAULT '{}',
  "credentials" JSONB,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "Store_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Store_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE TABLE "TenantBranding" (
  "tenantId" UUID NOT NULL,
  "logoUrl" TEXT,
  "iconUrl" TEXT,
  "primaryColor" VARCHAR(20) NOT NULL DEFAULT '#ff365d',
  "secondaryColor" VARCHAR(20) NOT NULL DEFAULT '#111111',
  "emailFromName" VARCHAR(120),
  "supportEmail" VARCHAR(320),
  "customCss" TEXT,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "TenantBranding_pkey" PRIMARY KEY ("tenantId"),
  CONSTRAINT "TenantBranding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE TABLE "TenantDomain" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "hostname" VARCHAR(253) NOT NULL,
  "status" "DomainStatus" NOT NULL DEFAULT 'PENDING',
  "verificationToken" VARCHAR(120) NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "TenantDomain_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantDomain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE TABLE "TenantConfiguration" (
  "tenantId" UUID NOT NULL,
  "locale" VARCHAR(20) NOT NULL DEFAULT 'es-EC',
  "orderPrefix" VARCHAR(20),
  "invoicePrefix" VARCHAR(20),
  "features" JSONB NOT NULL DEFAULT '{}',
  "notifications" JSONB NOT NULL DEFAULT '{}',
  "integrations" JSONB NOT NULL DEFAULT '{}',
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "TenantConfiguration_pkey" PRIMARY KEY ("tenantId"),
  CONSTRAINT "TenantConfiguration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "Warehouse_tenantId_id_key" ON "Warehouse"("tenantId", "id");
CREATE UNIQUE INDEX "Product_tenantId_id_key" ON "Product"("tenantId", "id");
CREATE UNIQUE INDEX "Order_tenantId_id_key" ON "Order"("tenantId", "id");
CREATE UNIQUE INDEX "Customer_tenantId_code_key" ON "Customer"("tenantId", "code");
CREATE UNIQUE INDEX "Customer_tenantId_email_key" ON "Customer"("tenantId", "email");
CREATE UNIQUE INDEX "Customer_tenantId_id_key" ON "Customer"("tenantId", "id");
CREATE INDEX "Customer_tenantId_active_name_idx" ON "Customer"("tenantId", "active", "name");
CREATE UNIQUE INDEX "Store_tenantId_code_key" ON "Store"("tenantId", "code");
CREATE UNIQUE INDEX "Store_tenantId_channel_externalId_key" ON "Store"("tenantId", "channel", "externalId");
CREATE UNIQUE INDEX "Store_tenantId_id_key" ON "Store"("tenantId", "id");
CREATE INDEX "Store_tenantId_active_idx" ON "Store"("tenantId", "active");
CREATE UNIQUE INDEX "TenantDomain_hostname_key" ON "TenantDomain"("hostname");
CREATE UNIQUE INDEX "TenantDomain_verificationToken_key" ON "TenantDomain"("verificationToken");
CREATE UNIQUE INDEX "TenantDomain_tenantId_id_key" ON "TenantDomain"("tenantId", "id");
CREATE INDEX "TenantDomain_tenantId_status_idx" ON "TenantDomain"("tenantId", "status");

INSERT INTO "TenantBranding" ("tenantId", "updatedAt")
SELECT "id", CURRENT_TIMESTAMP FROM "Tenant" ON CONFLICT DO NOTHING;
INSERT INTO "TenantConfiguration" ("tenantId", "updatedAt")
SELECT "id", CURRENT_TIMESTAMP FROM "Tenant" ON CONFLICT DO NOTHING;

WITH system_roles("systemKey", "name", "permissions") AS (
  VALUES
    ('admin_empresa', 'Admin Empresa', ARRAY['dashboard:read','orders:read','orders:create','orders:update','orders:cancel','inventory:read','inventory:adjust','inventory:transfer','products:read','products:create','products:update','products:archive','shipments:read','shipments:create','shipments:update','customers:read','customers:create','customers:update','warehouses:read','warehouses:create','warehouses:update','stores:read','stores:create','stores:update','picking:read','picking:update','packing:read','packing:update','delivery:read','delivery:update','suppliers:read','suppliers:update','branding:read','branding:update','domains:manage','settings:read','settings:update','members:invite','members:manage','roles:manage']::TEXT[]),
    ('gerente', 'Gerente', ARRAY['dashboard:read','orders:read','orders:create','orders:update','orders:cancel','inventory:read','inventory:adjust','inventory:transfer','products:read','products:create','products:update','shipments:read','shipments:create','shipments:update','customers:read','customers:create','customers:update','warehouses:read','stores:read','picking:read','packing:read','delivery:read','suppliers:read','branding:read','settings:read','settings:update','members:invite','members:manage']::TEXT[]),
    ('supervisor', 'Supervisor', ARRAY['dashboard:read','orders:read','orders:update','inventory:read','inventory:adjust','products:read','shipments:read','shipments:update','customers:read','warehouses:read','picking:read','picking:update','packing:read','packing:update']::TEXT[]),
    ('bodega', 'Bodega', ARRAY['dashboard:read','inventory:read','inventory:adjust','inventory:transfer','products:read','warehouses:read','picking:read','packing:read']::TEXT[]),
    ('picking', 'Picking', ARRAY['dashboard:read','orders:read','inventory:read','products:read','warehouses:read','picking:read','picking:update']::TEXT[]),
    ('packing', 'Packing', ARRAY['dashboard:read','orders:read','products:read','packing:read','packing:update','shipments:read']::TEXT[]),
    ('courier', 'Courier', ARRAY['dashboard:read','orders:read','shipments:read','delivery:read','delivery:update']::TEXT[]),
    ('transportista', 'Transportista', ARRAY['dashboard:read','orders:read','shipments:read','shipments:update','delivery:read','delivery:update']::TEXT[]),
    ('vendedor', 'Vendedor', ARRAY['dashboard:read','orders:read','orders:create','orders:update','products:read','customers:read','customers:create','customers:update','stores:read']::TEXT[]),
    ('cliente', 'Cliente', ARRAY['dashboard:read','orders:read','products:read']::TEXT[]),
    ('dropshipper', 'Dropshipper', ARRAY['dashboard:read','orders:read','orders:create','products:read','inventory:read','shipments:read','customers:read','stores:read']::TEXT[]),
    ('proveedor', 'Proveedor', ARRAY['dashboard:read','products:read','inventory:read','suppliers:read','suppliers:update']::TEXT[]),
    ('operador_logistico', 'Operador Logístico', ARRAY['dashboard:read','orders:read','orders:update','inventory:read','inventory:adjust','inventory:transfer','products:read','shipments:read','shipments:create','shipments:update','warehouses:read','picking:read','picking:update','packing:read','packing:update','delivery:read','delivery:update']::TEXT[])
)
INSERT INTO "Role" ("id", "tenantId", "name", "permissions", "systemKey")
SELECT gen_random_uuid(), t."id", r."name", r."permissions", r."systemKey"
FROM "Tenant" t CROSS JOIN system_roles r
WHERE NOT EXISTS (
  SELECT 1 FROM "Role" existing
  WHERE existing."tenantId" = t."id" AND existing."systemKey" = r."systemKey"
);
