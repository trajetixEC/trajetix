CREATE TYPE "WalletTransactionType" AS ENUM ('CREDIT','DEBIT','HOLD','RELEASE');
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING','APPROVED','PROCESSING','PAID','REJECTED','CANCELLED');

CREATE TABLE "ShipmentTrackingEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "tenantId" UUID NOT NULL, "shipmentId" UUID NOT NULL,
  "carrierCode" VARCHAR(80) NOT NULL, "status" VARCHAR(80) NOT NULL, "description" VARCHAR(300) NOT NULL,
  "location" VARCHAR(160), "occurredAt" TIMESTAMPTZ(6) NOT NULL, "raw" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ShipmentTrackingEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ShipmentTrackingEvent_tenantId_shipmentId_occurredAt_idx" ON "ShipmentTrackingEvent"("tenantId","shipmentId","occurredAt");
ALTER TABLE "ShipmentTrackingEvent" ADD CONSTRAINT "ShipmentTrackingEvent_tenantId_shipmentId_fkey" FOREIGN KEY ("tenantId","shipmentId") REFERENCES "Shipment"("tenantId","id") ON DELETE CASCADE;

CREATE TABLE "Wallet" (
  "tenantId" UUID NOT NULL, "balanceMinor" BIGINT NOT NULL DEFAULT 0, "currency" CHAR(3) NOT NULL DEFAULT 'USD',
  "updatedAt" TIMESTAMPTZ(6) NOT NULL, CONSTRAINT "Wallet_pkey" PRIMARY KEY ("tenantId")
);
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;

CREATE TABLE "WalletTransaction" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "tenantId" UUID NOT NULL, "type" "WalletTransactionType" NOT NULL,
  "amountMinor" BIGINT NOT NULL, "description" VARCHAR(250) NOT NULL, "referenceType" VARCHAR(50), "referenceId" VARCHAR(100),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WalletTransaction_tenantId_createdAt_idx" ON "WalletTransaction"("tenantId","createdAt");
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Wallet"("tenantId") ON DELETE CASCADE;

CREATE TABLE "BankAccount" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "tenantId" UUID NOT NULL, "bankCode" VARCHAR(40) NOT NULL,
  "bankName" VARCHAR(140) NOT NULL, "accountType" VARCHAR(30) NOT NULL, "accountLast4" CHAR(4) NOT NULL,
  "accountCipher" TEXT NOT NULL, "holderName" VARCHAR(180) NOT NULL, "holderId" VARCHAR(30) NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BankAccount_tenantId_id_key" ON "BankAccount"("tenantId","id");
CREATE INDEX "BankAccount_tenantId_active_idx" ON "BankAccount"("tenantId","active");
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;

CREATE TABLE "Withdrawal" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "tenantId" UUID NOT NULL, "bankAccountId" UUID NOT NULL,
  "requestedById" UUID NOT NULL, "amountMinor" BIGINT NOT NULL, "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
  "note" VARCHAR(250), "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Withdrawal_tenantId_status_createdAt_idx" ON "Withdrawal"("tenantId","status","createdAt");
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_tenantId_bankAccountId_fkey" FOREIGN KEY ("tenantId","bankAccountId") REFERENCES "BankAccount"("tenantId","id") ON DELETE RESTRICT;
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT;
