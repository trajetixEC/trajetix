export const MODULE_PERMISSIONS = {
  dashboard: ["dashboard:read"],
  orders: ["orders:read", "orders:create", "orders:update", "orders:cancel"],
  inventory: ["inventory:read", "inventory:adjust", "inventory:transfer"],
  products: [
    "products:read",
    "products:create",
    "products:update",
    "products:archive",
  ],
  shipments: ["shipments:read", "shipments:create", "shipments:update"],
  customers: ["customers:read", "customers:create", "customers:update"],
  warehouses: ["warehouses:read", "warehouses:create", "warehouses:update"],
  stores: ["stores:read", "stores:create", "stores:update"],
  picking: ["picking:read", "picking:update"],
  packing: ["packing:read", "packing:update"],
  delivery: ["delivery:read", "delivery:update"],
  suppliers: ["suppliers:read", "suppliers:update"],
  branding: ["branding:read", "branding:update", "domains:manage"],
  finance: ["finance:read", "finance:manage"],
  referrals: ["referrals:read", "referrals:manage"],
  settings: [
    "settings:read",
    "settings:update",
    "members:invite",
    "members:manage",
    "roles:manage",
  ],
} as const;

export type Permission =
  (typeof MODULE_PERMISSIONS)[keyof typeof MODULE_PERMISSIONS][number];

export const SYSTEM_ROLES: Record<string, readonly Permission[]> = {
  owner: Object.values(MODULE_PERMISSIONS).flat(),
  admin_empresa: Object.values(MODULE_PERMISSIONS)
    .flat()
    .filter(
      (permission) =>
        !["members:invite", "members:manage", "roles:manage"].includes(
          permission,
        ),
    ),
  gerente: Object.values(MODULE_PERMISSIONS)
    .flat()
    .filter(
      (permission) => !["roles:manage", "domains:manage"].includes(permission),
    ),
  supervisor: [
    "referrals:read",
    "referrals:manage",
    "dashboard:read",
    "orders:read",
    "orders:update",
    "inventory:read",
    "inventory:adjust",
    "products:read",
    "shipments:read",
    "shipments:update",
    "customers:read",
    "warehouses:read",
    "picking:read",
    "picking:update",
    "packing:read",
    "packing:update",
  ],
  bodega: [
    "referrals:read",
    "referrals:manage",
    "inventory:read",
    "inventory:adjust",
    "products:read",
    "products:create",
    "products:update",
    "warehouses:read",
    "warehouses:create",
    "warehouses:update",
  ],
  picking: [
    "referrals:read",
    "referrals:manage",
    "dashboard:read",
    "orders:read",
    "inventory:read",
    "products:read",
    "warehouses:read",
    "picking:read",
    "picking:update",
  ],
  packing: [
    "referrals:read",
    "referrals:manage",
    "dashboard:read",
    "orders:read",
    "products:read",
    "packing:read",
    "packing:update",
    "shipments:read",
  ],
  courier: [
    "referrals:read",
    "referrals:manage",
    "dashboard:read",
    "orders:read",
    "shipments:read",
    "delivery:read",
    "delivery:update",
  ],
  transportista: [
    "referrals:read",
    "referrals:manage",
    "dashboard:read",
    "orders:read",
    "shipments:read",
    "shipments:update",
    "delivery:read",
    "delivery:update",
  ],
  vendedor: [
    "referrals:read",
    "referrals:manage",
    "dashboard:read",
    "shipments:read",
    "shipments:create",
  ],
  finanzas: [
    "referrals:read",
    "referrals:manage",
    "finance:read",
    "finance:manage",
  ],
  cliente: [
    "referrals:read",
    "referrals:manage",
    "dashboard:read",
    "orders:read",
    "products:read",
  ],
  dropshipper: [
    "referrals:read",
    "referrals:manage",
    "dashboard:read",
    "orders:read",
    "orders:create",
    "products:read",
    "inventory:read",
    "shipments:read",
    "customers:read",
    "stores:read",
  ],
  proveedor: [
    "referrals:read",
    "referrals:manage",
    "dashboard:read",
    "products:read",
    "inventory:read",
    "suppliers:read",
    "suppliers:update",
  ],
  operador_logistico: [
    "referrals:read",
    "referrals:manage",
    "dashboard:read",
    "orders:read",
    "orders:update",
    "inventory:read",
    "inventory:adjust",
    "inventory:transfer",
    "products:read",
    "shipments:read",
    "shipments:create",
    "shipments:update",
    "warehouses:read",
    "picking:read",
    "picking:update",
    "packing:read",
    "packing:update",
    "delivery:read",
    "delivery:update",
  ],
};

export const SYSTEM_ROLE_LABELS: Record<keyof typeof SYSTEM_ROLES, string> = {
  owner: "Propietario",
  admin_empresa: "Admin Empresa",
  gerente: "Gerente",
  supervisor: "Supervisor",
  bodega: "Bodeguero",
  picking: "Picking",
  packing: "Packing",
  courier: "Courier",
  transportista: "Transportista",
  vendedor: "Vendedor",
  finanzas: "Finanzas",
  cliente: "Cliente",
  dropshipper: "Dropshipper",
  proveedor: "Proveedor",
  operador_logistico: "Operador Logístico",
};

export const TEAM_PROFILE_KEYS = ["vendedor", "bodega", "finanzas"] as const;
export type TeamProfileKey = (typeof TEAM_PROFILE_KEYS)[number];

export function isTeamProfile(
  value: string | null | undefined,
): value is TeamProfileKey {
  return TEAM_PROFILE_KEYS.includes(value as TeamProfileKey);
}

export function can(
  permissions: readonly string[] | undefined,
  permission: Permission,
) {
  return permissions?.includes(permission) ?? false;
}

export function canAccessModule(
  permissions: readonly string[] | undefined,
  module: keyof typeof MODULE_PERMISSIONS,
) {
  return MODULE_PERMISSIONS[module].some((permission) =>
    can(permissions, permission),
  );
}
