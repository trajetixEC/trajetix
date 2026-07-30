ALTER TABLE "User"
  ADD COLUMN "phone" VARCHAR(40),
  ADD COLUMN "lastLoginAt" TIMESTAMPTZ(6);

ALTER TABLE "Membership"
  ADD COLUMN "permissionOverrides" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "usePermissionOverrides" BOOLEAN NOT NULL DEFAULT false;
