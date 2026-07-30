UPDATE "Role"
SET "permissions" = ARRAY(
  SELECT DISTINCT permission
  FROM unnest("permissions" || ARRAY[
    'dashboard:read','orders:read','orders:create','orders:update','orders:cancel',
    'inventory:read','inventory:adjust','inventory:transfer',
    'products:read','products:create','products:update','products:archive',
    'shipments:read','shipments:create','shipments:update',
    'customers:read','customers:create','customers:update',
    'warehouses:read','warehouses:create','warehouses:update',
    'stores:read','stores:create','stores:update',
    'picking:read','picking:update','packing:read','packing:update',
    'delivery:read','delivery:update','suppliers:read','suppliers:update',
    'branding:read','branding:update','domains:manage',
    'settings:read','settings:update','members:invite','members:manage','roles:manage'
  ]::TEXT[]) AS permission
)
WHERE "systemKey" IN ('owner', 'admin_empresa');
