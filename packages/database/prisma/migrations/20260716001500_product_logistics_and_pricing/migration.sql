ALTER TABLE "Product"
  ADD COLUMN "costMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "dropshippingPriceMinor" BIGINT,
  ADD COLUMN "suggestedDropshippingPriceMinor" BIGINT,
  ADD COLUMN "weightKg" DECIMAL(10,3),
  ADD COLUMN "lengthCm" DECIMAL(10,2),
  ADD COLUMN "widthCm" DECIMAL(10,2),
  ADD COLUMN "heightCm" DECIMAL(10,2);
