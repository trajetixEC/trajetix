ALTER TABLE "InventoryBalance" DROP CONSTRAINT "InventoryBalance_warehouseId_fkey";
ALTER TABLE "InventoryBalance" DROP CONSTRAINT "InventoryBalance_productId_fkey";
ALTER TABLE "InventoryMovement" DROP CONSTRAINT "InventoryMovement_warehouseId_fkey";
ALTER TABLE "InventoryMovement" DROP CONSTRAINT "InventoryMovement_productId_fkey";
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_productId_fkey";

ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_tenantId_warehouseId_fkey"
  FOREIGN KEY ("tenantId", "warehouseId") REFERENCES "Warehouse"("tenantId", "id") ON DELETE RESTRICT;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_tenantId_productId_fkey"
  FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenantId_warehouseId_fkey"
  FOREIGN KEY ("tenantId", "warehouseId") REFERENCES "Warehouse"("tenantId", "id") ON DELETE RESTRICT;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenantId_productId_fkey"
  FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_tenantId_orderId_fkey"
  FOREIGN KEY ("tenantId", "orderId") REFERENCES "Order"("tenantId", "id") ON DELETE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_tenantId_productId_fkey"
  FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT;
