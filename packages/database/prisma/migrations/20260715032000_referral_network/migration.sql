CREATE TABLE "ReferralProfile" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "commissionMinor" INTEGER NOT NULL DEFAULT 10,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "ReferralProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralAttribution" (
    "id" UUID NOT NULL,
    "referralProfileId" UUID NOT NULL,
    "referredTenantId" UUID NOT NULL,
    "joinedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralCommission" (
    "id" UUID NOT NULL,
    "attributionId" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "beneficiaryTenantId" UUID NOT NULL,
    "amountMinor" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralCommission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralProfile_code_key" ON "ReferralProfile"("code");
CREATE UNIQUE INDEX "ReferralProfile_tenantId_userId_key" ON "ReferralProfile"("tenantId", "userId");
CREATE INDEX "ReferralProfile_tenantId_active_idx" ON "ReferralProfile"("tenantId", "active");
CREATE UNIQUE INDEX "ReferralAttribution_referredTenantId_key" ON "ReferralAttribution"("referredTenantId");
CREATE INDEX "ReferralAttribution_referralProfileId_joinedAt_idx" ON "ReferralAttribution"("referralProfileId", "joinedAt");
CREATE UNIQUE INDEX "ReferralCommission_shipmentId_key" ON "ReferralCommission"("shipmentId");
CREATE INDEX "ReferralCommission_attributionId_createdAt_idx" ON "ReferralCommission"("attributionId", "createdAt");
CREATE INDEX "ReferralCommission_beneficiaryTenantId_createdAt_idx" ON "ReferralCommission"("beneficiaryTenantId", "createdAt");

ALTER TABLE "ReferralProfile" ADD CONSTRAINT "ReferralProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralProfile" ADD CONSTRAINT "ReferralProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referralProfileId_fkey" FOREIGN KEY ("referralProfileId") REFERENCES "ReferralProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referredTenantId_fkey" FOREIGN KEY ("referredTenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "ReferralAttribution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_beneficiaryTenantId_fkey" FOREIGN KEY ("beneficiaryTenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
