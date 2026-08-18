"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { can, type Permission } from "../../lib/rbac";
import { FulfillmentModule, IntegrationsModule } from "./operations-modules";
import {
  CustomerShipmentsModule,
  MyShipmentsModule,
  NewShipmentModule,
  TrackingModule,
} from "./shipping-modules";
import { FinanceModule, StoreUsersModule } from "./admin-modules";
import { CarrierConfigModal } from "./carrier-config-modal";
import { ProfileModule } from "./profile-module";
import { ReferralsModule } from "./referrals-module";
import { TopbarWallet } from "./topbar-wallet";
import { GoogleMapPicker } from "./google-map-picker";
import { CitySelect } from "./city-select";
import { Pencil, Trash2, AlertTriangle, X, Loader2, AlertCircle } from "lucide-react";

type Product = {
  id: string;
  sku: string;
  name: string;
  brand?: string | null;
  description?: string;
  imageUrl?: string | null;
  stock: number;
  price: number;
  cost?: number;
  dropshippingPrice?: number | null;
  suggestedDropshippingPrice?: number | null;
  weightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  category: string;
  minimum: number;
  stockByWarehouse?: Array<{
    warehouseId: string;
    warehouse: string;
    code: string;
    stock: number;
  }>;
};
type Shipment = {
  id: string;
  orderId: string;
  carrier: string;
  service?: string;
  tracking: string;
  status: string;
  eta: string;
  sender?: { name?: string; city?: string };
  recipient?: { name?: string; phone?: string };
  address?: { city?: string; line1?: string };
  packages?: Array<{
    description?: string;
    quantity?: number;
    weightKg?: number;
  }>;
  cod?: number;
  createdAt?: string;
};
type Customer = {
  id: string;
  name: string;
  email: string;
  orders: number;
  spent: number;
  city: string;
};
type Warehouse = {
  id: string;
  code: string;
  name: string;
  city: string;
  address: string;
  phone?: string;
  latitude?: number | null | undefined;
  longitude?: number | null | undefined;
  timezone: string;
  products: number;
  stock: number;
};
type Store = {
  products: Product[];
  shipments: Shipment[];
  customers: Customer[];
  warehouses: Warehouse[];
};
type Section =
  | "Dashboard"
  | "Nuevo envío"
  | "Mis envíos"
  | "Envíos Clientes"
  | "Tracking"
  | "Clientes"
  | "Bodegas"
  | "Inventario"
  | "Fulfillment"
  | "Finanzas"
  | "Referidos"
  | "Configuración"
  | "Usuarios de tienda"
  | "Transportadoras"
  | "Integraciones"
  | "Mi perfil";

const emptyStore: Store = {
  products: [],
  shipments: [],
  customers: [],
  warehouses: [],
};

const menu: {
  label: Section;
  icon: string;
  permissions: Permission[];
  group: "PLATAFORMA" | "CLIENTES" | "STOCK & BODEGAS" | "FINANZAS" | "CRECIMIENTO" | "ADMINISTRACIÓN";
  ownerOnly?: boolean;
  superAdminOnly?: boolean;
}[] = [
  { label: "Dashboard", icon: "⌂", permissions: ["dashboard:read"], group: "PLATAFORMA" },
  { label: "Nuevo envío", icon: "＋", permissions: ["shipments:create"], group: "PLATAFORMA" },
  { label: "Mis envíos", icon: "▣", permissions: ["shipments:read"], group: "PLATAFORMA" },
  {
    label: "Envíos Clientes",
    icon: "📦",
    permissions: ["shipments:read"],
    group: "PLATAFORMA",
    superAdminOnly: true,
  },
  { label: "Tracking", icon: "⌖", permissions: ["shipments:read"], group: "PLATAFORMA" },
  { label: "Bodegas", icon: "▤", permissions: ["warehouses:read"], group: "STOCK & BODEGAS" },
  { label: "Inventario", icon: "◇", permissions: ["inventory:read"], group: "STOCK & BODEGAS" },
  { label: "Finanzas", icon: "$", permissions: ["finance:read"], group: "FINANZAS" },
  { label: "Referidos", icon: "↗", permissions: ["referrals:read"], group: "CRECIMIENTO" },
  {
    label: "Usuarios de tienda",
    icon: "♙",
    permissions: ["members:manage"],
    group: "ADMINISTRACIÓN",
    superAdminOnly: true,
  },
  {
    label: "Transportadoras",
    icon: "🚛",
    permissions: ["settings:read"],
    group: "ADMINISTRACIÓN",
    superAdminOnly: true,
  },
  { label: "Integraciones", icon: "⌘", permissions: ["settings:read"], group: "ADMINISTRACIÓN" },
];

const menuGroups = [
  "PLATAFORMA",
  "CLIENTES",
  "STOCK & BODEGAS",
  "FINANZAS",
  "CRECIMIENTO",
  "ADMINISTRACIÓN",
] as const;

function isOwnerRole(role: string) {
  const r = role.toLowerCase();
  return r.includes("owner") || r.includes("propietario") || r.includes("super");
}

function isSuperAdminRole(role: string) {
  const r = role.toLowerCase();
  return r.includes("superadmin") || r.includes("super");
}

function canOpenMenuItem(
  item: (typeof menu)[number],
  permissions: readonly string[],
  owner: boolean,
  superAdmin: boolean,
) {
  if (item.superAdminOnly && !superAdmin) return false;
  if (item.ownerOnly && !owner && !superAdmin) return false;
  return item.permissions.some((permission) => can(permissions, permission));
}
const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
});

function applyAppearance(value: "LIGHT" | "DARK" | "SYSTEM") {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("trajetix-appearance", value);
  } catch {}

  const systemLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  const isLight = value === "LIGHT" || (value === "SYSTEM" && systemLight);

  document.documentElement.dataset.theme = isLight ? "light" : "dark";
  if (isLight) {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
  } else {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  }
}

export function DashboardApp({
  user,
}: {
  user: { name: string; email?: string; role: string; tenant: string; permissions: string[] };
}) {
  const owner = isOwnerRole(user.role);
  const superAdmin = isSuperAdminRole(user.role);
  const [account, setAccount] = useState({
    name: user.name,
    tenant: user.tenant,
  });
  const [accountMenu, setAccountMenu] = useState(false);
  const [appearance, setAppearance] = useState<"LIGHT" | "DARK" | "SYSTEM">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("trajetix-appearance");
      if (saved === "LIGHT" || saved === "DARK" || saved === "SYSTEM") return saved;
    }
    return "LIGHT";
  });
  const [section, setSection] = useState<Section>(
    () =>
      menu.find((item) => canOpenMenuItem(item, user.permissions, owner, superAdmin))
        ?.label ?? "Dashboard",
  );
  const [store, setStore] = useState<Store>(emptyStore);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [createEntity, setCreateEntity] = useState<
    "product" | "customer" | "shipment" | "warehouse" | null
  >(null);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [deletingWarehouse, setDeletingWarehouse] = useState<Warehouse | null>(null);
  const [isCarriersModalOpen, setIsCarriersModalOpen] = useState(false);

  const editProduct = async (id: string, payload: Record<string, unknown>) => {
    const response = await fetch(`/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setNotice(body.error ?? "No se pudo actualizar el producto");
      return false;
    }
    await loadOperationalData();
    setNotice("Producto actualizado exitosamente");
    return true;
  };

  const editWarehouse = async (id: string, payload: Record<string, unknown>) => {
    const response = await fetch(`/api/warehouses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setNotice(body.error ?? "No se pudo actualizar la bodega");
      return false;
    }
    const updatedWarehouseData = await response.json().catch(() => null);
    if (updatedWarehouseData) {
      const addr = (updatedWarehouseData.address as { city?: string; line1?: string; latitude?: number; longitude?: number; lat?: number; lng?: number }) || {};
      const lat = typeof addr.latitude === "number" && !isNaN(addr.latitude) && addr.latitude !== 0 ? addr.latitude : (typeof addr.lat === "number" && !isNaN(addr.lat) && addr.lat !== 0 ? addr.lat : (typeof payload.latitude === "number" && !isNaN(payload.latitude) && payload.latitude !== 0 ? payload.latitude : null));
      const lng = typeof addr.longitude === "number" && !isNaN(addr.longitude) && addr.longitude !== 0 ? addr.longitude : (typeof addr.lng === "number" && !isNaN(addr.lng) && addr.lng !== 0 ? addr.lng : (typeof payload.longitude === "number" && !isNaN(payload.longitude) && payload.longitude !== 0 ? payload.longitude : null));

      setStore((current) => ({
        ...current,
        warehouses: current.warehouses.map((w) =>
          w.id === id
            ? {
                ...w,
                name: String(payload.name || w.name),
                city: addr.city || String(payload.city || w.city),
                address: addr.line1 || String(payload.address || w.address),
                latitude: lat ?? w.latitude,
                longitude: lng ?? w.longitude,
              }
            : w,
        ),
      }));
    }
    await loadOperationalData();
    setNotice("Bodega actualizada exitosamente");
    return true;
  };

  const deleteWarehouse = async (id: string) => {
    const response = await fetch(`/api/warehouses/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setNotice(body.error ?? "No se pudo desactivar la bodega");
      return false;
    }
    await loadOperationalData();
    setNotice("Bodega desactivada correctamente");
    return true;
  };

  const loadOperationalData = useCallback(async () => {
    const tasks: Promise<void>[] = [];
    const load = <K extends keyof Store>(key: K, url: string) => {
      const cacheBusterUrl = `${url}${url.includes("?") ? "&" : "?"}_t=${Date.now()}`;
      tasks.push(
        fetch(cacheBusterUrl, { cache: "no-store", headers: { "Cache-Control": "no-cache" } }).then(async (response) => {
          if (!response.ok) return;
          const value = (await response.json()) as Store[K];
          setStore((current) => ({ ...current, [key]: value }));
        }),
      );
    };
    if (can(user.permissions, "products:read"))
      load("products", "/api/products");
    if (can(user.permissions, "customers:read"))
      load("customers", "/api/customers");
    if (can(user.permissions, "shipments:read"))
      load("shipments", "/api/shipments");
    if (can(user.permissions, "warehouses:read"))
      load("warehouses", "/api/warehouses");
    await Promise.all(tasks);
  }, [user.permissions]);
  useEffect(() => {
    void loadOperationalData();
  }, [loadOperationalData]);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    const stored = window.localStorage.getItem("trajetix-appearance");
    const initial =
      stored === "LIGHT" || stored === "DARK" || stored === "SYSTEM"
        ? stored
        : "DARK";
    setAppearance(initial);
    applyAppearance(initial);
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onSystemChange = () => {
      if (window.localStorage.getItem("trajetix-appearance") === "SYSTEM")
        applyAppearance("SYSTEM");
    };
    media.addEventListener("change", onSystemChange);
    void fetch("/api/account/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          profile: {
            user?: { appearance?: "LIGHT" | "DARK" | "SYSTEM" };
          } | null,
        ) => {
          const saved = profile?.user?.appearance;
          if (!saved) return;
          setAppearance(saved);
          window.localStorage.setItem("trajetix-appearance", saved);
          applyAppearance(saved);
        },
      )
      .catch(() => undefined);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  const changeAppearance = async (value: "LIGHT" | "DARK" | "SYSTEM") => {
    setAppearance(value);
    window.localStorage.setItem("trajetix-appearance", value);
    applyAppearance(value);
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "appearance", appearance: value }),
    });
    if (!response.ok) setNotice("No se pudo guardar la apariencia");
  };

  const navigate = (next: Section) => {
    setSection(next);
    setQuery("");
    setMobileNav(false);
  };
  const lowStock = store.products.filter(
    (product) => product.stock <= product.minimum,
  );
  const adjustStock = async (
    productId: string,
    warehouseId: string,
    quantity: number,
    reason: string,
  ) => {
    const response = await fetch("/api/inventory/adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, warehouseId, quantity, reason }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setNotice(body.error ?? "No se pudo ajustar el inventario");
      return;
    }
    await loadOperationalData();
    setAdjustProduct(null);
    setNotice("Inventario actualizado");
  };
  const createOperationalEntity = async (
    kind: "product" | "customer" | "shipment" | "warehouse",
    payload: Record<string, unknown>,
  ) => {
    const endpoint =
      kind === "product"
        ? "products"
        : kind === "customer"
          ? "customers"
          : kind === "shipment"
            ? "shipments"
            : "warehouses";
    const response = await fetch(`/api/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setNotice(body.error ?? "No se pudo guardar");
      return;
    }
    await loadOperationalData();
    setCreateEntity(null);
    setNotice(
      kind === "product"
        ? "Producto creado"
        : kind === "customer"
          ? "Cliente creado"
          : kind === "shipment"
            ? "Envío creado"
            : "Bodega creada",
    );
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
        <Link className="app-logo" href="/">
          <Image
            src="/brand/trajetix-logo.png"
            alt="TrajetixERP"
            width={620}
            height={248}
          />
        </Link>
        <div className="workspace">
          <span className="workspace-avatar">
            {account.tenant.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>{account.tenant}</strong>
            <small>Espacio seguro</small>
          </div>
          <b>⌄</b>
        </div>
        <nav aria-label="Navegación principal">
          {menuGroups.map((group) => {
            const items = menu.filter(
              (item) =>
                item.group === group &&
                canOpenMenuItem(item, user.permissions, owner, superAdmin),
            );
            if (items.length === 0) return null;
            return (
              <div className="nav-group" key={group}>
                <span className="nav-group-label">{group}</span>
                {items.map((item) => (
                  <button
                    className={section === item.label ? "active" : ""}
                    key={item.label}
                    onClick={() => navigate(item.label)}
                  >
                    <i>{item.icon}</i>
                    {item.label}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-help">
          <span>?</span>
          <div>
            <strong>Centro de ayuda</strong>
            <small>Guías y soporte</small>
          </div>
        </div>
        <div className="user account-user">
          <span>
            {account.name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <button
            className="account-trigger"
            type="button"
            aria-expanded={accountMenu}
            onClick={() => setAccountMenu((open) => !open)}
          >
            <strong>{account.name}</strong>
            <small>{user.role}</small>
          </button>
          <button
            className="account-chevron"
            type="button"
            aria-label="Abrir menú de cuenta"
            onClick={() => setAccountMenu((open) => !open)}
          >
            {accountMenu ? "⌄" : "⌃"}
          </button>
          {accountMenu && (
            <div className="account-menu">
              <div className="account-menu-heading">
                <b>{account.name}</b>
                <small>{user.role}</small>
              </div>
              <div className="appearance-row">
                <span>Apariencia</span>
                <div role="group" aria-label="Apariencia">
                  <button
                    className={appearance === "LIGHT" ? "active" : ""}
                    type="button"
                    title="Claro"
                    onClick={() => void changeAppearance("LIGHT")}
                  >
                    ☀
                  </button>
                  <button
                    className={appearance === "DARK" ? "active" : ""}
                    type="button"
                    title="Oscuro"
                    onClick={() => void changeAppearance("DARK")}
                  >
                    ☾
                  </button>
                  <button
                    className={appearance === "SYSTEM" ? "active" : ""}
                    type="button"
                    title="Sistema"
                    onClick={() => void changeAppearance("SYSTEM")}
                  >
                    ▣
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSection("Mi perfil");
                  setAccountMenu(false);
                }}
              >
                ◎ Mi perfil
              </button>
              <button
                className="account-logout"
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                ↪ Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </aside>
      {mobileNav && (
        <button
          aria-label="Cerrar menú"
          className="nav-backdrop"
          onClick={() => setMobileNav(false)}
        />
      )}
      <main className="app-main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav(true)}>
            ☰
          </button>
          <div className="search">
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar guías, destinatarios o productos..."
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="topbar-actions">
            {can(user.permissions, "finance:read") && (
              <TopbarWallet onOpen={() => navigate("Finanzas")} />
            )}
            <button className="icon-button" aria-label="Notificaciones">
              ♢<i></i>
            </button>
            {can(user.permissions, "shipments:create") && (
              <button
                className="primary-button"
                onClick={() => setSection("Nuevo envío")}
              >
                ＋ Nuevo envío
              </button>
            )}
          </div>
        </header>
        <div className="content">
          {section === "Dashboard" && (
            <Overview
              userName={account.name}
              lowStock={lowStock}
              onNavigate={navigate}
            />
          )}
          {section === "Bodegas" && (
            <Warehouses
              warehouses={store.warehouses}
              query={query}
              onCreate={() => setCreateEntity("warehouse")}
              onEdit={(warehouse) => setEditingWarehouse(warehouse)}
              onDelete={(warehouse) => setDeletingWarehouse(warehouse)}
            />
          )}
          {section === "Inventario" && (
            <Products
              products={store.products}
              query={query}
              onAdjust={setAdjustProduct}
              onCreate={() => setCreateEntity("product")}
              onEdit={setEditingProduct}
            />
          )}
          {section === "Nuevo envío" && (
            <NewShipmentModule
              user={user}
              warehouses={store.warehouses}
              products={store.products}
              onNavigateToWarehouses={(warehouseId?: string) => {
                setSection("Bodegas");
                if (warehouseId) {
                  const targetW = store.warehouses.find((w) => w.id === warehouseId);
                  if (targetW) setEditingWarehouse(targetW);
                }
              }}
              onCreated={async () => {
                await loadOperationalData();
                setSection("Mis envíos");
                setNotice("Envío creado correctamente");
              }}
            />
          )}
          {section === "Mis envíos" && (
            <MyShipmentsModule
              shipments={store.shipments}
              query={query}
              onNew={() => setSection("Nuevo envío")}
            />
          )}
          {section === "Envíos Clientes" && <CustomerShipmentsModule />}
          {section === "Tracking" && <TrackingModule />}
          {section === "Fulfillment" && (
            <FulfillmentModule
              products={store.products}
              shipments={store.shipments}
            />
          )}
          {section === "Finanzas" && <FinanceModule />}
          {section === "Referidos" && <ReferralsModule />}
          {section === "Clientes" && (
            <Customers
              customers={store.customers}
              query={query}
              onCreate={() => setCreateEntity("customer")}
            />
          )}
          {section === "Configuración" && (
            <Settings
              tenantName={account.tenant}
              permissions={user.permissions}
            />
          )}
          {section === "Usuarios de tienda" && <StoreUsersModule />}
          {section === "Transportadoras" && superAdmin ? (
            <div>
              <div className="page-header">
                <div>
                  <span>CONFIGURACIÓN DE PLATAFORMA</span>
                  <h1>Transportadoras de Envío</h1>
                  <p>
                    Administra las empresas de envío disponibles para cotizar en el flujo de &quot;Nuevo envío&quot;, parámetros de fletes, recolección, márgenes de ganancia y mapa de localidades.
                  </p>
                </div>
              </div>
              <section className="panel" style={{ padding: "1.5rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
                  <div className="shipping-card" style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "1.25rem", background: "var(--card-bg)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                      <span className="zone-tag local" style={{ fontSize: "0.8rem", padding: "4px 8px" }}>LAAR COURIER</span>
                      <span style={{ color: "#10b981", fontWeight: 600, fontSize: "0.85rem" }}>🟢 Configurada</span>
                    </div>
                    <h3 style={{ margin: "0 0 0.5rem 0" }}>LAAR Courier Express</h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                      Servicios de courier nacional, recaudo COD, etiquetado PDF y rastreo en tiempo real (Ecuador).
                    </p>
                    <button
                      type="button"
                      className="primary-button"
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={() => setIsCarriersModalOpen(true)}
                    >
                      ⚙ Configurar Parámetros & 4 Tabs
                    </button>
                  </div>

                  <div className="shipping-card" style={{ border: "1px dashed var(--border)", borderRadius: "10px", padding: "1.25rem", background: "var(--card-bg)", opacity: 0.7 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                      <span className="zone-tag principal" style={{ fontSize: "0.8rem", padding: "4px 8px" }}>SERVIENTREGA</span>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>⚪ Próximamente</span>
                    </div>
                    <h3 style={{ margin: "0 0 0.5rem 0" }}>Servientrega Ecuador</h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                      Integración canónica de la API de Servientrega para logística nacional.
                    </p>
                    <button type="button" className="secondary-button" disabled style={{ width: "100%", justifyContent: "center" }}>
                      🔒 Próxima fase
                    </button>
                  </div>

                  <div className="shipping-card" style={{ border: "1px dashed var(--border)", borderRadius: "10px", padding: "1.25rem", background: "var(--card-bg)", opacity: 0.7 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                      <span className="zone-tag especial" style={{ fontSize: "0.8rem", padding: "4px 8px" }}>URBANO</span>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>⚪ Próximamente</span>
                    </div>
                    <h3 style={{ margin: "0 0 0.5rem 0" }}>Urbano Express</h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                      Envíos urbanos e interprovinciales con integración de tracking.
                    </p>
                    <button type="button" className="secondary-button" disabled style={{ width: "100%", justifyContent: "center" }}>
                      🔒 Próxima fase
                    </button>
                  </div>
                </div>
              </section>
              <CarrierConfigModal
                isOpen={isCarriersModalOpen}
                onClose={() => setIsCarriersModalOpen(false)}
              />
            </div>
          ) : section === "Transportadoras" ? (
            <div className="panel" style={{ padding: "3rem", textAlign: "center" }}>
              <h2 style={{ color: "#dc2626", margin: "0 0 0.5rem 0" }}>🔒 Acceso Denegado</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                Solo los administradores de la plataforma (SuperAdmin) tienen acceso a la configuración de transportadoras.
              </p>
            </div>
          ) : null}
          {section === "Integraciones" && <IntegrationsModule />}
          {section === "Mi perfil" && (
            <ProfileModule
              onUpdated={(name, tenant) => setAccount({ name, tenant })}
            />
          )}
        </div>
      </main>
      {createEntity && (
        <EntityModal
          kind={createEntity}
          onClose={() => setCreateEntity(null)}
          onCreate={createOperationalEntity}
        />
      )}
      {adjustProduct && (
        <InventoryAdjustmentModal
          product={adjustProduct}
          warehouses={store.warehouses}
          onClose={() => setAdjustProduct(null)}
          onSubmit={adjustStock}
        />
      )}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={editProduct}
        />
      )}
      {editingWarehouse && (
        <EditWarehouseModal
          warehouse={editingWarehouse}
          onClose={() => setEditingWarehouse(null)}
          onSave={editWarehouse}
        />
      )}
      {deletingWarehouse && (
        <div className="modal-backdrop" onClick={() => setDeletingWarehouse(null)}>
          <div
            className="modal-card max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-red-600 font-bold text-lg mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span>¿Desactivar Bodega?</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              ¿Estás seguro de desactivar la bodega{" "}
              <strong className="text-slate-900 dark:text-slate-100">
                {deletingWarehouse.name} ({deletingWarehouse.code})
              </strong>
              ? La bodega no se eliminará permanentemente de la base de datos, pero quedará desactivada y ya no se mostrará en el sistema ni para nuevos despachos.
            </p>
            <div className="modal-actions flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDeletingWarehouse(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm"
                onClick={async () => {
                  const ok = await deleteWarehouse(deletingWarehouse.id);
                  if (ok) setDeletingWarehouse(null);
                }}
              >
                Sí, Desactivar
              </button>
            </div>
          </div>
        </div>
      )}
      {notice && (
        <div className="toast">
          <span>✓</span>
          {notice}
        </div>
      )}
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {action}
    </div>
  );
}
type DashboardRange = "today" | "week" | "month" | "custom";
type DashboardData = {
  range: { from: string; to: string };
  summary: {
    totalShipments: number;
    inTransit: number;
    freight: number;
    cod: number;
    wallet: number;
    currency: string;
    deliveryRate: number;
    lowStock: number;
  };
  days: Array<{ date: string; shipments: number; freight: number }>;
  byCarrier: Array<{ carrier: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  recent: Array<{
    id: string;
    tracking: string;
    carrier: string;
    service: string;
    status: string;
    recipient: string;
    city: string;
    freight: number;
    createdAt: string;
  }>;
};
const emptyDashboard: DashboardData = {
  range: { from: "", to: "" },
  summary: {
    totalShipments: 0,
    inTransit: 0,
    freight: 0,
    cod: 0,
    wallet: 0,
    currency: "USD",
    deliveryRate: 0,
    lowStock: 0,
  },
  days: [],
  byCarrier: [],
  byStatus: [],
  recent: [],
};
const statusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  QUOTED: "Cotizado",
  LABEL_CREATED: "Guía creada",
  PICKUP_SCHEDULED: "Recolección",
  IN_TRANSIT: "En tránsito",
  OUT_FOR_DELIVERY: "En reparto",
  DELIVERED: "Entregado",
  EXCEPTION: "Novedad",
  CANCELLED: "Cancelado",
  RETURNED: "Devuelto",
};

function Overview({
  userName,
  lowStock,
  onNavigate,
}: {
  userName: string;
  lowStock: Product[];
  onNavigate: (section: Section) => void;
}) {
  const [range, setRange] = useState<DashboardRange>("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<DashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (range === "custom" && (!customFrom || !customTo)) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ range });
    if (range === "custom") {
      params.set("from", customFrom);
      params.set("to", customTo);
    }
    setLoading(true);
    fetch(`/api/dashboard?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.ok && !controller.signal.aborted)
          setData((await response.json()) as DashboardData);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          console.error(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [range, customFrom, customTo]);
  const now = new Date();
  const localHour = Number(
    new Intl.DateTimeFormat("es-EC", {
      timeZone: "America/Guayaquil",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  const greeting =
    localHour < 12
      ? "Buenos días"
      : localHour < 19
        ? "Buenas tardes"
        : "Buenas noches";
  const firstName = userName.trim().split(/\s+/)[0] || "Usuario";
  const dateLabel = new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(now)
    .toLocaleUpperCase("es-EC");
  const maxDaily = Math.max(...data.days.map((item) => item.shipments), 1);
  function downloadReport() {
    const rows = [
      ["Fecha", "Envíos", "Flete"],
      ...data.days.map((item) => [
        item.date,
        String(item.shipments),
        item.freight.toFixed(2),
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `reporte-trajetix-${data.range.from}-${data.range.to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  return (
    <>
      <PageHeader
        eyebrow={dateLabel}
        title={`${greeting}, ${firstName}`}
        copy="Este es el pulso real de tu operación."
        action={
          <button className="secondary-button" onClick={downloadReport}>
            ⇩ Descargar reporte
          </button>
        }
      />
      <div className="dashboard-periods">
        <button
          className={range === "today" ? "active" : ""}
          onClick={() => setRange("today")}
        >
          Hoy
        </button>
        <button
          className={range === "week" ? "active" : ""}
          onClick={() => setRange("week")}
        >
          Esta semana
        </button>
        <button
          className={range === "month" ? "active" : ""}
          onClick={() => setRange("month")}
        >
          Este mes
        </button>
        <button
          className={range === "custom" ? "active" : ""}
          onClick={() => setRange("custom")}
        >
          Personalizado
        </button>
        {range === "custom" && (
          <div className="custom-period">
            <input
              aria-label="Fecha inicial"
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
            />
            <span>—</span>
            <input
              aria-label="Fecha final"
              type="date"
              min={customFrom}
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
            />
          </div>
        )}
        <span>
          {data.range.from && `${data.range.from} — ${data.range.to}`}
        </span>
      </div>
      <section className={`metrics ${loading ? "is-loading" : ""}`}>
        <RealMetric
          icon="package"
          label="Total envíos"
          value={String(data.summary.totalShipments)}
          note="Creados en el período"
        />
        <RealMetric
          icon="truck"
          label="En tránsito"
          value={String(data.summary.inTransit)}
          note="Incluye entregas en reparto"
        />
        <RealMetric
          icon="currency"
          label="Flete cobrado"
          value={money.format(data.summary.freight)}
          note={`Recaudo COD: ${money.format(data.summary.cod)}`}
        />
        <RealMetric
          icon="wallet"
          label="Saldo disponible"
          value={money.format(data.summary.wallet)}
          note="Billetera de esta empresa"
        />
      </section>
      <section className="dashboard-grid real-dashboard-grid">
        <div className="panel activity-panel">
          <PanelTitle
            title="Envíos por día"
            copy="Actividad real del período seleccionado"
          />
          <div className="activity-chart">
            {data.days.map((item) => (
              <div key={item.date}>
                <span
                  style={{
                    height: `${Math.max(4, (item.shipments / maxDaily) * 100)}%`,
                  }}
                  title={`${item.shipments} envíos`}
                >
                  <i>{item.shipments || ""}</i>
                </span>
                <small>
                  {new Intl.DateTimeFormat("es-EC", {
                    day: "2-digit",
                    month: "short",
                    timeZone: "UTC",
                  }).format(new Date(`${item.date}T12:00:00Z`))}
                </small>
              </div>
            ))}
          </div>
          {data.days.length === 0 && (
            <div className="empty compact-empty">
              <p>Selecciona un rango para consultar la actividad.</p>
            </div>
          )}
        </div>
        <div className="panel carrier-panel">
          <PanelTitle
            title="Por transportadora"
            copy="Distribución de envíos"
          />
          <div className="carrier-bars">
            {data.byCarrier.map((item) => (
              <div key={item.carrier}>
                <span>
                  <b>{item.carrier}</b>
                  <em>{item.count}</em>
                </span>
                <i>
                  <b
                    style={{
                      width: `${(item.count / Math.max(data.summary.totalShipments, 1)) * 100}%`,
                    }}
                  />
                </i>
              </div>
            ))}
            {data.byCarrier.length === 0 && (
              <div className="empty compact-empty">
                <p>Aún no hay envíos en este período.</p>
              </div>
            )}
          </div>
        </div>
        <div className="panel recent-shipments">
          <PanelTitle
            title="Envíos recientes"
            copy={`Últimos ${data.recent.length} del período`}
            action="Ver envíos"
            onClick={() => onNavigate("Mis envíos")}
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Guía</th>
                  <th>Destinatario</th>
                  <th>Courier</th>
                  <th>Estado</th>
                  <th>Flete</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <code>{item.tracking}</code>
                    </td>
                    <td>
                      <strong>{item.recipient}</strong>
                      <small>{item.city}</small>
                    </td>
                    <td>
                      {item.carrier}
                      <small>{item.service}</small>
                    </td>
                    <td>
                      <span className="status">
                        <i />
                        {statusLabels[item.status] ?? item.status}
                      </span>
                    </td>
                    <td>{money.format(item.freight)}</td>
                    <td>
                      {new Date(item.createdAt).toLocaleDateString("es-EC", {
                        timeZone: "America/Guayaquil",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.recent.length === 0 && (
              <div className="empty compact-empty">
                <p>Los envíos que cree esta empresa aparecerán aquí.</p>
              </div>
            )}
          </div>
        </div>
        <div className="panel">
          <PanelTitle
            title="Inventario y entregas"
            copy="Indicadores operativos reales"
          />
          <div className="delivery-stats">
            <div>
              <strong>{lowStock.length}</strong>
              <span>Stock bajo</span>
            </div>
            <div>
              <strong>{data.summary.deliveryRate}%</strong>
              <span>Tasa de entrega</span>
            </div>
            <div>
              <strong>{data.byStatus.length}</strong>
              <span>Estados activos</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function RealMetric({
  icon,
  label,
  value,
  note,
}: {
  icon: "package" | "truck" | "currency" | "wallet";
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="metric real-metric">
      <span>{label}</span>
      <div>
        <strong>{value}</strong>
        <MetricIcon type={icon} />
      </div>
      <small>{note}</small>
    </article>
  );
}

function MetricIcon({
  type,
}: {
  type: "package" | "truck" | "currency" | "wallet";
}) {
  return (
    <span className={`metric-icon metric-icon-${type}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        {type === "package" && (
          <>
            <path d="m4 7.5 8-4 8 4-8 4-8-4Z" />
            <path d="M4 7.5v9l8 4 8-4v-9M12 11.5v9" />
          </>
        )}
        {type === "truck" && (
          <>
            <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z" />
            <circle cx="7" cy="18" r="2" />
            <circle cx="18" cy="18" r="2" />
          </>
        )}
        {type === "currency" && (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M15.5 8.5c-.8-.7-1.9-1-3.1-1-1.8 0-3 .9-3 2.2 0 3.4 6.1 1.7 6.1 5 0 1.4-1.3 2.3-3.2 2.3-1.5 0-2.8-.5-3.7-1.4M12 5.5v13" />
          </>
        )}
        {type === "wallet" && (
          <>
            <path d="M4 6.5h14a2 2 0 0 1 2 2v9H4a2 2 0 0 1-2-2v-11a2 2 0 0 0 2 2Zm0 0 12-3v3" />
            <path d="M15 11h6v4h-6a2 2 0 0 1 0-4Z" />
          </>
        )}
      </svg>
    </span>
  );
}
function PanelTitle({
  title,
  copy,
  action,
  onClick,
}: {
  title: string;
  copy: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="panel-title">
      <div>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      {action && <button onClick={onClick}>{action} →</button>}
    </div>
  );
}

function Products({
  products,
  query,
  onAdjust,
  onCreate,
  onEdit,
}: {
  products: Product[];
  query: string;
  onAdjust: (product: Product) => void;
  onCreate: () => void;
  onEdit: (product: Product) => void;
}) {
  const filtered = products.filter((product) =>
    `${product.name} ${product.sku} ${product.category}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="CONTROL DE EXISTENCIAS"
        title="Inventario"
        copy="Consulta productos, stock total y existencias por bodega. Registra entradas o salidas con trazabilidad."
        action={
          <button className="primary-button" onClick={onCreate}>
            ＋ Nuevo producto
          </button>
        }
      />
      <section className="summary-strip">
        <div>
          <span>Productos</span>
          <strong>{products.length}</strong>
        </div>
        <div>
          <span>Unidades disponibles</span>
          <strong>{products.reduce((sum, p) => sum + p.stock, 0)}</strong>
        </div>
        <div>
          <span>Stock bajo</span>
          <strong className="danger-text">
            {products.filter((p) => p.stock <= p.minimum).length}
          </strong>
        </div>
      </section>
      <div className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>SKU</th>
                <th>Stock total</th>
                <th>Stock por bodega</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="product-cell">
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          width={44}
                          height={44}
                          unoptimized
                        />
                      ) : (
                        <span className="product-placeholder">◇</span>
                      )}
                      <div>
                        <strong>{product.name}</strong>
                        <small>{product.category || "Sin categoría"}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <code>{product.sku}</code>
                  </td>
                  <td>
                    <strong>{product.stock} uds.</strong>
                  </td>
                  <td>
                    <div className="warehouse-stock">
                      {product.stockByWarehouse
                        ?.filter((item) => item.stock !== 0)
                        .map((item) => (
                          <span key={item.warehouseId}>
                            {item.warehouse}: <b>{item.stock}</b>
                          </span>
                        ))}
                      {!product.stockByWarehouse?.some(
                        (item) => item.stock !== 0,
                      ) && <small>Sin existencias</small>}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="secondary-button compact-button flex items-center gap-1.5"
                        onClick={() => onEdit(product)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        onClick={() => onAdjust(product)}
                      >
                        Ajustar stock
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <Empty
              title="No hay productos"
              copy="Crea un producto para comenzar a controlar el inventario."
            />
          )}
        </div>
      </div>
    </>
  );
}
function Warehouses({
  warehouses,
  query,
  onCreate,
  onEdit,
  onDelete,
}: {
  warehouses: Warehouse[];
  query: string;
  onCreate: () => void;
  onEdit: (warehouse: Warehouse) => void;
  onDelete: (warehouse: Warehouse) => void;
}) {
  const filtered = warehouses.filter((warehouse) =>
    `${warehouse.name} ${warehouse.code} ${warehouse.city}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="RED LOGÍSTICA"
        title="Bodegas"
        copy="Registra y administra las bodegas de esta empresa cliente."
        action={
          <button className="primary-button" onClick={onCreate}>
            ＋ Registrar bodega
          </button>
        }
      />
      <section className="summary-strip">
        <div>
          <span>Bodegas activas</span>
          <strong>{warehouses.length}</strong>
        </div>
        <div>
          <span>Productos almacenados</span>
          <strong>
            {warehouses.reduce((sum, warehouse) => sum + warehouse.products, 0)}
          </strong>
        </div>
        <div>
          <span>Stock total</span>
          <strong>
            {warehouses.reduce((sum, warehouse) => sum + warehouse.stock, 0)}
          </strong>
        </div>
      </section>
      <div className="warehouse-grid">
        {filtered.map((warehouse) => (
          <article className="warehouse-card relative group" key={warehouse.id}>
            <div className="flex items-center justify-between mb-2">
              <span className="warehouse-code">{warehouse.code}</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  title="Editar bodega"
                  aria-label="Editar bodega"
                  onClick={() => onEdit(warehouse)}
                  className="p-1.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 bg-slate-100 hover:bg-blue-50 dark:bg-slate-800/80 dark:hover:bg-blue-950/60 rounded-lg border border-slate-200 dark:border-slate-700/80 transition-colors shadow-sm"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Desactivar bodega"
                  aria-label="Desactivar bodega"
                  onClick={() => onDelete(warehouse)}
                  className="p-1.5 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 bg-slate-100 hover:bg-red-50 dark:bg-slate-800/80 dark:hover:bg-red-950/60 rounded-lg border border-slate-200 dark:border-slate-700/80 transition-colors shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <h2>{warehouse.name}</h2>
            <p>{warehouse.address}</p>
            <small>{warehouse.city} {warehouse.phone ? `· 📞 ${warehouse.phone}` : ""}</small>
            <div>
              <span>
                <b>{warehouse.products}</b> productos
              </span>
              <span>
                <b>{warehouse.stock}</b> unidades
              </span>
            </div>
          </article>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="panel">
          <Empty
            title="No hay bodegas registradas"
            copy="Registra la primera bodega de este cliente para asignarle inventario."
          />
        </div>
      )}
    </>
  );
}

function EditWarehouseModal({
  warehouse,
  onClose,
  onSave,
}: {
  warehouse: Warehouse;
  onClose: () => void;
  onSave: (id: string, payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [city, setCity] = useState(warehouse.city || "");
  const [address, setAddress] = useState(warehouse.address || "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = Object.fromEntries(form.entries());
    const latVal = Number(payload.latitude);
    const lngVal = Number(payload.longitude);
    if (!isNaN(latVal) && latVal !== 0) payload.latitude = latVal;
    else delete payload.latitude;
    if (!isNaN(lngVal) && lngVal !== 0) payload.longitude = lngVal;
    else delete payload.longitude;
    setSaving(true);
    try {
      const ok = await onSave(warehouse.id, payload);
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Editar Bodega: <span className="font-mono text-red-500">{warehouse.code}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="mb-3 block text-xs font-semibold text-slate-700 dark:text-slate-200">
            Nombre de la Bodega <span className="text-red-500">*</span>
            <input
              name="name"
              required
              autoFocus
              defaultValue={warehouse.name}
              placeholder="ej. Bodega Quito Norte"
            />
          </label>

          <div className="mb-3">
            <CitySelect
              label="Ciudad / Cantón"
              value={city}
              onChange={(cityName) => setCity(cityName)}
              showBadges={false}
              required={true}
              name="city"
              placeholder="Busca y selecciona la ciudad de la bodega..."
            />
          </div>

          <label className="mb-3 block text-xs font-semibold text-slate-700 dark:text-slate-200">
            Dirección Exacta <span className="text-red-500">*</span>
            <input
              name="address"
              required
              defaultValue={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Calle, número y referencia"
            />
          </label>

          <label className="mb-3 block text-xs font-semibold text-slate-700 dark:text-slate-200">
            Teléfono / WhatsApp de la Bodega <span className="text-red-500">*</span>
            <input
              name="phone"
              required
              minLength={5}
              defaultValue={warehouse.phone || ""}
              placeholder="Ej. 0991234567"
              className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-red-500/20 focus:border-red-500 mt-1"
            />
          </label>

          <GoogleMapPicker
            address={address}
            city={city}
            initialLat={warehouse.latitude}
            initialLng={warehouse.longitude}
          />

          <div className="modal-actions mt-4 flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
function Customers({
  customers,
  query,
  onCreate,
}: {
  customers: Customer[];
  query: string;
  onCreate: () => void;
}) {
  const filtered = customers.filter((c) =>
    `${c.name} ${c.email} ${c.city}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="RELACIONES COMERCIALES"
        title="Clientes"
        copy="Conoce el historial y valor de cada relación comercial."
        action={
          <button className="primary-button" onClick={onCreate}>
            ＋ Nuevo cliente
          </button>
        }
      />
      <div className="customer-grid">
        {filtered.map((customer) => (
          <article className="customer-card" key={customer.id}>
            <span className="customer-avatar">
              {customer.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </span>
            <h2>{customer.name}</h2>
            <p>{customer.email}</p>
            <small>{customer.city}</small>
            <div>
              <span>
                <b>{customer.orders}</b> pedidos
              </span>
              <span>
                <b>{money.format(customer.spent)}</b> valor total
              </span>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
function Settings({
  permissions,
  tenantName,
}: {
  permissions: string[];
  tenantName: string;
}) {
  const [twoFactor, setTwoFactor] = useState<{
    secret: string;
    uri: string;
  } | null>(null);
  const [twoFactorMessage, setTwoFactorMessage] = useState("");
  async function setup2fa() {
    const response = await fetch("/api/account/2fa/setup", { method: "POST" });
    if (response.ok)
      setTwoFactor((await response.json()) as { secret: string; uri: string });
  }
  async function verify2fa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/account/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: form.get("token") }),
    });
    setTwoFactorMessage(
      response.ok ? "2FA activado correctamente" : "El código no es válido",
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRACIÓN"
        title="Configuración"
        copy="Personaliza tu organización, seguridad y equipo."
      />
      <div className="settings-grid">
        <section className="panel settings-card">
          <h2>Organización</h2>
          <label>
            Nombre comercial
            <input defaultValue={tenantName} />
          </label>
          <label>
            País
            <select defaultValue="EC">
              <option value="EC">Ecuador</option>
              <option value="CO">Colombia</option>
              <option value="PE">Perú</option>
            </select>
          </label>
          <label>
            Zona horaria
            <select defaultValue="America/Guayaquil">
              <option>America/Guayaquil</option>
              <option>America/Bogota</option>
              <option>America/Lima</option>
            </select>
          </label>
          <button className="primary-button">Guardar cambios</button>
        </section>
        <section className="panel settings-card security-card">
          <h2>Autenticación de dos factores</h2>
          <p>
            Protege tu cuenta con códigos temporales desde tu aplicación
            autenticadora.
          </p>
          {!twoFactor ? (
            <button className="secondary-button" onClick={setup2fa}>
              Configurar 2FA
            </button>
          ) : (
            <>
              <div className="secret-box">
                <small>Clave para tu autenticador</small>
                <code>{twoFactor.secret}</code>
                <a href={twoFactor.uri}>Abrir aplicación compatible</a>
              </div>
              <form onSubmit={verify2fa}>
                <label>
                  Código de 6 dígitos
                  <input
                    name="token"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    required
                    placeholder="000000"
                  />
                </label>
                <button className="primary-button">Confirmar 2FA</button>
              </form>
            </>
          )}
          {twoFactorMessage && (
            <p className="settings-message">{twoFactorMessage}</p>
          )}
        </section>
        <section className="panel settings-card">
          <h2>Permisos efectivos</h2>
          <div className="permission-list">
            {permissions.map((permission) => (
              <code key={permission}>{permission}</code>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
function Empty({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty">
      <span>⌕</span>
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
  );
}
function EntityModal({
  kind,
  onClose,
  onCreate,
}: {
  kind: "product" | "customer" | "shipment" | "warehouse";
  onClose: () => void;
  onCreate: (
    kind: "product" | "customer" | "shipment" | "warehouse",
    payload: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [productImage, setProductImage] = useState<string | undefined>();
  const [imageError, setImageError] = useState("");
  const [costVal, setCostVal] = useState("0");
  const [priceVal, setPriceVal] = useState("0");
  const [dropshippingPrice, setDropshippingPrice] = useState("");
  const [suggestedDropshippingPrice, setSuggestedDropshippingPrice] =
    useState("");
  const [suggestedPriceEdited, setSuggestedPriceEdited] = useState(false);
  const [productFormError, setProductFormError] = useState("");
  const [warehouseCity, setWarehouseCity] = useState("Quito");
  const [warehouseAddress, setWarehouseAddress] = useState("");
  const titles = {
    product: "Nuevo producto",
    customer: "Nuevo cliente",
    shipment: "Nuevo envío",
    warehouse: "Registrar bodega",
  } as const;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProductFormError("");
    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = Object.fromEntries(form.entries());
    if (kind === "product") {
      const sku = String(payload.sku || "").trim();
      const name = String(payload.name || "").trim();
      const costNum = Number(payload.cost || 0);
      const priceNum = Number(payload.price || 0);
      const dropPriceVal = String(payload.dropshippingPrice ?? "").trim();
      const sugDropPriceVal = String(payload.suggestedDropshippingPrice ?? "").trim();
      const dropPriceNum = dropPriceVal !== "" ? Number(dropPriceVal) : null;
      const sugDropPriceNum = sugDropPriceVal !== "" ? Number(sugDropPriceVal) : null;

      const weightNum = Number(payload.weightKg || 0);
      const lengthNum = Number(payload.lengthCm || 0);
      const widthNum = Number(payload.widthCm || 0);
      const heightNum = Number(payload.heightCm || 0);

      if (!sku) {
        setProductFormError("Ingresa un código SKU para identificar el producto.");
        return;
      }
      if (!name) {
        setProductFormError("Ingresa el nombre completo del producto.");
        return;
      }
      if (weightNum <= 0) {
        setProductFormError("El peso del paquete debe ser mayor a 0 kg.");
        return;
      }
      if (lengthNum <= 0 || widthNum <= 0 || heightNum <= 0) {
        setProductFormError("Las dimensiones del paquete (largo, ancho y alto) deben ser mayores a 0 cm.");
        return;
      }
      if (priceNum < costNum) {
        setProductFormError(`El precio de venta al público PVP ($${priceNum.toFixed(2)}) no puede ser menor al costo de adquisición ($${costNum.toFixed(2)}).`);
        return;
      }
      if (dropPriceNum !== null && dropPriceNum < costNum) {
        setProductFormError(`El precio para dropshipping ($${dropPriceNum.toFixed(2)}) no puede ser menor al costo de adquisición ($${costNum.toFixed(2)}).`);
        return;
      }
      if (dropPriceNum !== null && sugDropPriceNum !== null && dropPriceNum > sugDropPriceNum) {
        setProductFormError(`El precio para dropshipping ($${dropPriceNum.toFixed(2)}) no puede ser mayor al precio sugerido dropshipping ($${sugDropPriceNum.toFixed(2)}).`);
        return;
      }

      const optionalNumber = (field: string) => {
        const value = String(payload[field] ?? "").trim();
        if (value) payload[field] = Number(value);
        else delete payload[field];
      };
      payload.cost = costNum;
      payload.price = priceNum;
      payload.minimumStock = Number(payload.minimumStock || 0);
      optionalNumber("weightKg");
      optionalNumber("lengthCm");
      optionalNumber("widthCm");
      optionalNumber("heightCm");
      optionalNumber("dropshippingPrice");
      optionalNumber("suggestedDropshippingPrice");
      if (productImage) payload.imageDataUrl = productImage;
    }
    if (kind === "shipment") payload.cod = Number(payload.cod || 0);
    if (kind === "warehouse") {
      const latVal = Number(payload.latitude);
      const lngVal = Number(payload.longitude);
      if (!isNaN(latVal) && latVal !== 0) payload.latitude = latVal;
      else delete payload.latitude;
      if (!isNaN(lngVal) && lngVal !== 0) payload.longitude = lngVal;
      else delete payload.longitude;
      if (!payload.timezone) payload.timezone = "America/Guayaquil";
      if (!payload.code || !String(payload.code).trim()) {
        const cityPrefix = String(payload.city || "BOD")
          .slice(0, 3)
          .toUpperCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        payload.code = `${cityPrefix}-${Math.floor(100 + Math.random() * 900)}`;
      }
    }
    setSaving(true);
    try {
      await onCreate(kind, payload);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entity-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" aria-label="Cerrar" onClick={onClose}>
          ×
        </button>
        <span className="eyebrow">OPERACIÓN SEGURA</span>
        <h2 id="entity-title">{titles[kind]}</h2>
        <p>La información quedará aislada dentro de esta empresa.</p>
        <form onSubmit={submit}>
          {kind === "product" && (
            <>
              {productFormError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="font-medium leading-relaxed">{productFormError}</span>
                </div>
              )}
              <div className="form-row">
                <label>
                  SKU <span className="text-red-500">*</span>
                  <input name="sku" required autoFocus placeholder="ej. PROD-001" />
                </label>
                <label>
                  Tipo
                  <select name="type" defaultValue="SIMPLE">
                    <option value="SIMPLE">Simple</option>
                    <option value="VARIABLE">Variable</option>
                    <option value="DIGITAL">Digital</option>
                    <option value="KIT">Kit</option>
                    <option value="BUNDLE">Bundle</option>
                  </select>
                </label>
              </div>
              <label>
                Nombre del Producto <span className="text-red-500">*</span>
                <input name="name" required placeholder="ej. Camiseta Polo Algodón" />
              </label>
              <label>
                Descripción breve <small>(opcional)</small>
                <textarea
                  name="description"
                  maxLength={1000}
                  rows={3}
                  placeholder="Describe brevemente las características principales del producto"
                />
              </label>
              <div className="form-row">
                <label>
                  Categoría
                  <input name="category" placeholder="ej. Ropa, Calzado..." />
                </label>
                <label>
                  Marca
                  <input name="brand" placeholder="ej. Nike, Generic..." />
                </label>
              </div>
              <label>
                Imagen del producto <small>(máx. 2MB - .webp)</small>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    setImageError("");
                    setProductImage(undefined);
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) {
                      setImageError("La imagen no puede superar 2 MB.");
                      event.currentTarget.value = "";
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => setProductImage(String(reader.result));
                    reader.onerror = () =>
                      setImageError("No se pudo leer la imagen.");
                    reader.readAsDataURL(file);
                  }}
                />
                {imageError && <small className="field-error text-red-500 text-xs mt-1 block">{imageError}</small>}
                {productImage && (
                  <Image
                    className="product-image-preview mt-2 rounded-lg border border-slate-200 dark:border-slate-800"
                    src={productImage}
                    alt="Vista previa del producto"
                    width={96}
                    height={96}
                    unoptimized
                  />
                )}
              </label>

              <h3 className="form-section-title text-xs font-bold uppercase tracking-wider text-slate-500 mt-4 mb-2">Peso y Medidas del Paquete</h3>
              <div className="form-row form-row-four">
                <label>
                  Peso (kg) <span className="text-red-500">*</span>
                  <input name="weightKg" type="number" min="0.001" step="0.001" required placeholder="0.5" />
                </label>
                <label>
                  Largo (cm) <span className="text-red-500">*</span>
                  <input name="lengthCm" type="number" min="0.01" step="0.01" required placeholder="10" />
                </label>
                <label>
                  Ancho (cm) <span className="text-red-500">*</span>
                  <input name="widthCm" type="number" min="0.01" step="0.01" required placeholder="10" />
                </label>
                <label>
                  Alto (cm) <span className="text-red-500">*</span>
                  <input name="heightCm" type="number" min="0.01" step="0.01" required placeholder="5" />
                </label>
              </div>

              <h3 className="form-section-title text-xs font-bold uppercase tracking-wider text-slate-500 mt-4 mb-2">Precios y Márgenes</h3>
              <div className="form-row">
                <label>
                  Costo de Adquisición (USD) <span className="text-red-500">*</span>
                  <input
                    name="cost"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={costVal}
                    onChange={(e) => setCostVal(e.target.value)}
                  />
                </label>
                <label>
                  Precio Venta al Público PVP (USD) <span className="text-red-500">*</span>
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={priceVal}
                    onChange={(e) => setPriceVal(e.target.value)}
                  />
                  {Number(priceVal) > 0 && (
                    <small className="field-help font-medium text-emerald-600 dark:text-emerald-400 mt-1 block">
                      Ganancia estimada: +${(Number(priceVal) - Number(costVal)).toFixed(2)} ({Number(priceVal) > 0 ? (((Number(priceVal) - Number(costVal)) / Number(priceVal)) * 100).toFixed(1) : 0}% margen)
                    </small>
                  )}
                </label>
              </div>

              <div className="form-row">
                <label>
                  Precio para Dropshipping (USD) <small>(opcional)</small>
                  <input
                    name="dropshippingPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={dropshippingPrice}
                    placeholder="Precio al revendedor"
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setDropshippingPrice(value);
                      setProductFormError("");
                      if (!suggestedPriceEdited) {
                        const amount = Number(value);
                        setSuggestedDropshippingPrice(
                          value && Number.isFinite(amount)
                            ? (amount + 5).toFixed(2)
                            : "",
                        );
                      }
                    }}
                  />
                </label>
                <label>
                  Precio Sugerido Dropshipping (USD) <small>(opcional)</small>
                  <input
                    name="suggestedDropshippingPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={suggestedDropshippingPrice}
                    placeholder="PVP sugerido al cliente final"
                    onChange={(event) => {
                      setSuggestedPriceEdited(true);
                      setSuggestedDropshippingPrice(event.currentTarget.value);
                      setProductFormError("");
                    }}
                  />
                  {dropshippingPrice !== "" && suggestedDropshippingPrice !== "" && (
                    <small
                      className={`field-help font-medium mt-1 block ${
                        Number(dropshippingPrice) > Number(suggestedDropshippingPrice)
                          ? "text-red-500"
                          : "text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {Number(dropshippingPrice) > Number(suggestedDropshippingPrice)
                        ? "⚠️ El precio para dropshipping supera al sugerido"
                        : `Ganancia revendedor: +$${(Number(suggestedDropshippingPrice) - Number(dropshippingPrice)).toFixed(2)}`}
                    </small>
                  )}
                </label>
              </div>

              <div className="form-row">
                <label>
                  Stock Mínimo
                  <input name="minimumStock" type="number" min="0" step="1" defaultValue="0" />
                  <small className="field-help text-slate-400 mt-1 block">Alerta cuando el inventario caiga de este número.</small>
                </label>
              </div>
            </>
          )}
          {kind === "customer" && (
            <>
              <label>
                Nombre completo
                <input name="name" required autoFocus />
              </label>
              <div className="form-row">
                <label>
                  Correo
                  <input name="email" type="email" />
                </label>
                <label>
                  Teléfono
                  <input name="phone" />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Identificación fiscal
                  <input name="taxId" />
                </label>
                <label>
                  Ciudad
                  <input name="city" />
                </label>
              </div>
            </>
          )}
          {kind === "shipment" && (
            <>
              <div className="form-row">
                <label>
                  Transportadora
                  <select name="carrier" defaultValue="Servientrega" autoFocus>
                    {[
                      "Servientrega",
                      "Tramaco",
                      "LaarCourier",
                      "Sertod",
                      "Coordinadora",
                      "Interrapidísimo",
                      "99Minutos",
                      "Blue Express",
                      "FedEx",
                      "UPS",
                      "DHL",
                      "Correos",
                    ].map((carrier) => (
                      <option key={carrier}>{carrier}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Número de guía
                  <input name="trackingNumber" />
                </label>
              </div>
              <label>
                Destinatario
                <input name="recipientName" required />
              </label>
              <div className="form-row">
                <label>
                  Teléfono
                  <input name="phone" />
                </label>
                <label>
                  Ciudad
                  <input name="city" required />
                </label>
              </div>
              <label>
                Dirección
                <input name="address" required />
              </label>
              <label>
                Contra entrega (COD)
                <input
                  name="cod"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                />
              </label>
            </>
          )}
          {kind === "warehouse" && (
            <>
              <label className="mb-3 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Nombre de la Bodega <span className="text-red-500">*</span>
                <input
                  name="name"
                  required
                  autoFocus
                  placeholder="ej. Bodega Quito Norte, Matriz Guayaquil..."
                />
              </label>

              <div className="mb-3">
                <CitySelect
                  label="Ciudad / Cantón"
                  value={warehouseCity}
                  onChange={(cityName) => setWarehouseCity(cityName)}
                  showBadges={false}
                  required={true}
                  name="city"
                  placeholder="Busca y selecciona la ciudad de la bodega..."
                />
              </div>

              <label className="mb-3 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Dirección Exacta <span className="text-red-500">*</span>
                <input
                  name="address"
                  required
                  placeholder="Calle, número y referencia"
                  value={warehouseAddress}
                  onChange={(e) => setWarehouseAddress(e.target.value)}
                />
              </label>

              <label className="mb-3 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Teléfono / WhatsApp de la Bodega <span className="text-red-500">*</span>
                <input
                  name="phone"
                  required
                  minLength={5}
                  placeholder="Ej. 0991234567"
                  className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-red-500/20 focus:border-red-500 mt-1"
                />
              </label>

              {/* OFFICIAL GOOGLE MAPS COMPONENT */}
              <GoogleMapPicker address={warehouseAddress} city={warehouseCity} />
            </>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button className="primary-button flex items-center gap-2 justify-center" disabled={saving} type="submit">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function EditProductModal({
  product,
  onClose,
  onSave,
}: {
  product: Product;
  onClose: () => void;
  onSave: (id: string, payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false);
  const [productImage, setProductImage] = useState<string | undefined>(
    product.imageUrl ?? undefined,
  );
  const [imageError, setImageError] = useState("");
  const [costVal, setCostVal] = useState(String(product.cost ?? 0));
  const [priceVal, setPriceVal] = useState(String(product.price ?? 0));
  const [dropshippingPrice, setDropshippingPrice] = useState(
    product.dropshippingPrice != null ? String(product.dropshippingPrice) : "",
  );
  const [suggestedDropshippingPrice, setSuggestedDropshippingPrice] = useState(
    product.suggestedDropshippingPrice != null
      ? String(product.suggestedDropshippingPrice)
      : "",
  );
  const [suggestedPriceEdited, setSuggestedPriceEdited] = useState(false);
  const [productFormError, setProductFormError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProductFormError("");
    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = Object.fromEntries(form.entries());

    const sku = String(payload.sku || "").trim();
    const name = String(payload.name || "").trim();
    const costNum = Number(payload.cost || 0);
    const priceNum = Number(payload.price || 0);
    const dropPriceVal = String(payload.dropshippingPrice ?? "").trim();
    const sugDropPriceVal = String(payload.suggestedDropshippingPrice ?? "").trim();
    const dropPriceNum = dropPriceVal !== "" ? Number(dropPriceVal) : null;
    const sugDropPriceNum = sugDropPriceVal !== "" ? Number(sugDropPriceVal) : null;

    const weightNum = Number(payload.weightKg || 0);
    const lengthNum = Number(payload.lengthCm || 0);
    const widthNum = Number(payload.widthCm || 0);
    const heightNum = Number(payload.heightCm || 0);

    if (!sku) {
      setProductFormError("Ingresa un código SKU para identificar el producto.");
      return;
    }
    if (!name) {
      setProductFormError("Ingresa el nombre completo del producto.");
      return;
    }
    if (weightNum <= 0) {
      setProductFormError("El peso del paquete debe ser mayor a 0 kg.");
      return;
    }
    if (lengthNum <= 0 || widthNum <= 0 || heightNum <= 0) {
      setProductFormError("Las dimensiones del paquete (largo, ancho y alto) deben ser mayores a 0 cm.");
      return;
    }
    if (priceNum < costNum) {
      setProductFormError(`El precio de venta al público PVP ($${priceNum.toFixed(2)}) no puede ser menor al costo de adquisición ($${costNum.toFixed(2)}).`);
      return;
    }
    if (dropPriceNum !== null && dropPriceNum < costNum) {
      setProductFormError(`El precio para dropshipping ($${dropPriceNum.toFixed(2)}) no puede ser menor al costo de adquisición ($${costNum.toFixed(2)}).`);
      return;
    }
    if (dropPriceNum !== null && sugDropPriceNum !== null && dropPriceNum > sugDropPriceNum) {
      setProductFormError(`El precio para dropshipping ($${dropPriceNum.toFixed(2)}) no puede ser mayor al precio sugerido dropshipping ($${sugDropPriceNum.toFixed(2)}).`);
      return;
    }

    const optionalNumber = (field: string) => {
      const value = String(payload[field] ?? "").trim();
      if (value) payload[field] = Number(value);
      else payload[field] = null;
    };
    payload.cost = costNum;
    payload.price = priceNum;
    payload.minimumStock = Number(payload.minimumStock || 0);
    optionalNumber("weightKg");
    optionalNumber("lengthCm");
    optionalNumber("widthCm");
    optionalNumber("heightCm");
    optionalNumber("dropshippingPrice");
    optionalNumber("suggestedDropshippingPrice");
    if (productImage && productImage !== product.imageUrl) {
      payload.imageDataUrl = productImage;
    }

    setSaving(true);
    try {
      const success = await onSave(product.id, payload);
      if (success) onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card-wide max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="font-bold text-base text-slate-900 dark:text-white">Editar Producto</h2>
            <p className="text-xs text-slate-500">Modifica los detalles, precios y especificaciones del producto</p>
          </div>
          <button type="button" className="close-button" onClick={onClose}>✕</button>
        </header>

        <form onSubmit={(e) => void submit(e)} className="modal-form space-y-4 pt-4">
          {productFormError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{productFormError}</span>
            </div>
          )}

          <div className="form-row">
            <label>
              SKU (Código Único) <span className="text-red-500">*</span>
              <input name="sku" defaultValue={product.sku} required placeholder="ej. PROD-001" />
            </label>
            <label>
              Nombre del producto <span className="text-red-500">*</span>
              <input name="name" defaultValue={product.name} required placeholder="ej. Camiseta Polo Algodón" />
            </label>
          </div>

          <div className="form-row">
            <label>
              Categoría
              <input name="category" defaultValue={product.category || ""} placeholder="ej. Ropa, Electrónica..." />
            </label>
            <label>
              Marca
              <input name="brand" defaultValue={product.brand || ""} placeholder="ej. Nike, Generic..." />
            </label>
          </div>

          <label>
            Descripción
            <textarea name="description" defaultValue={product.description || ""} rows={2} placeholder="Descripción del producto..." className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900" />
          </label>

          <label>
            Imagen del producto <small>(máx. 2MB - .webp)</small>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                setImageError("");
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                  setImageError("La imagen no puede superar 2 MB.");
                  event.currentTarget.value = "";
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => setProductImage(String(reader.result));
                reader.onerror = () => setImageError("No se pudo leer la imagen.");
                reader.readAsDataURL(file);
              }}
            />
            {imageError && <small className="field-error text-red-500 text-xs mt-1 block">{imageError}</small>}
            {productImage && (
              <Image
                className="product-image-preview mt-2 rounded-lg border border-slate-200 dark:border-slate-800"
                src={productImage}
                alt="Vista previa del producto"
                width={96}
                height={96}
                unoptimized
              />
            )}
          </label>

          <h3 className="form-section-title text-xs font-bold uppercase tracking-wider text-slate-500 mt-4 mb-2">Peso y Medidas del Paquete</h3>
          <div className="form-row form-row-four">
            <label>
              Peso (kg) <span className="text-red-500">*</span>
              <input name="weightKg" type="number" min="0.001" step="0.001" defaultValue={product.weightKg ?? 1} required placeholder="0.5" />
            </label>
            <label>
              Largo (cm) <span className="text-red-500">*</span>
              <input name="lengthCm" type="number" min="0.01" step="0.01" defaultValue={product.lengthCm ?? 15} required placeholder="10" />
            </label>
            <label>
              Ancho (cm) <span className="text-red-500">*</span>
              <input name="widthCm" type="number" min="0.01" step="0.01" defaultValue={product.widthCm ?? 15} required placeholder="10" />
            </label>
            <label>
              Alto (cm) <span className="text-red-500">*</span>
              <input name="heightCm" type="number" min="0.01" step="0.01" defaultValue={product.heightCm ?? 15} required placeholder="5" />
            </label>
          </div>

          <h3 className="form-section-title text-xs font-bold uppercase tracking-wider text-slate-500 mt-4 mb-2">Precios y Márgenes</h3>
          <div className="form-row">
            <label>
              Costo de Adquisición (USD) <span className="text-red-500">*</span>
              <input
                name="cost"
                type="number"
                min="0"
                step="0.01"
                required
                value={costVal}
                onChange={(e) => setCostVal(e.target.value)}
              />
            </label>
            <label>
              Precio Venta al Público PVP (USD) <span className="text-red-500">*</span>
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                required
                value={priceVal}
                onChange={(e) => setPriceVal(e.target.value)}
              />
              {Number(priceVal) > 0 && (
                <small className="field-help font-medium text-emerald-600 dark:text-emerald-400 mt-1 block">
                  Ganancia estimada: +${(Number(priceVal) - Number(costVal)).toFixed(2)} ({Number(priceVal) > 0 ? (((Number(priceVal) - Number(costVal)) / Number(priceVal)) * 100).toFixed(1) : 0}% margen)
                </small>
              )}
            </label>
          </div>

          <div className="form-row">
            <label>
              Precio para Dropshipping (USD) <small>(opcional)</small>
              <input
                name="dropshippingPrice"
                type="number"
                min="0"
                step="0.01"
                value={dropshippingPrice}
                placeholder="Precio al revendedor"
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDropshippingPrice(value);
                  setProductFormError("");
                  if (!suggestedPriceEdited) {
                    const amount = Number(value);
                    setSuggestedDropshippingPrice(
                      value && Number.isFinite(amount)
                        ? (amount + 5).toFixed(2)
                        : "",
                    );
                  }
                }}
              />
            </label>
            <label>
              Precio Sugerido Dropshipping (USD) <small>(opcional)</small>
              <input
                name="suggestedDropshippingPrice"
                type="number"
                min="0"
                step="0.01"
                value={suggestedDropshippingPrice}
                placeholder="PVP sugerido revendedor"
                onChange={(event) => {
                  setSuggestedPriceEdited(true);
                  setSuggestedDropshippingPrice(event.currentTarget.value);
                }}
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Stock Mínimo de Alerta
              <input name="minimumStock" type="number" min="0" defaultValue={product.minimum ?? 0} />
            </label>
          </div>

          <div className="modal-actions flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="primary-button flex items-center gap-2 justify-center" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                "Guardar cambios"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InventoryAdjustmentModal({
  product,
  warehouses,
  onClose,
  onSubmit,
}: {
  product: Product;
  warehouses: Warehouse[];
  onClose: () => void;
  onSubmit: (
    productId: string,
    warehouseId: string,
    quantity: number,
    reason: string,
  ) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await onSubmit(
        product.id,
        String(form.get("warehouseId")),
        Number(form.get("quantity")),
        String(form.get("reason")),
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjustment-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" aria-label="Cerrar" onClick={onClose}>
          ×
        </button>
        <span className="eyebrow">MOVIMIENTO DE INVENTARIO</span>
        <h2 id="adjustment-title">Ajustar stock</h2>
        <p>
          {product.name} · {product.sku}. Usa una cantidad positiva para agregar
          stock o negativa para descontarlo.
        </p>
        {warehouses.length === 0 ? (
          <>
            <div className="empty compact-empty">
              <h3>Primero registra una bodega</h3>
              <p>Los movimientos de inventario necesitan una ubicación.</p>
            </div>
            <div className="modal-actions">
              <button className="secondary-button" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <label>
              Bodega
              <select name="warehouseId" required autoFocus>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cantidad
              <input
                name="quantity"
                type="number"
                step="1"
                required
                placeholder="Ej. 25"
              />
            </label>
            <label>
              Motivo
              <input
                name="reason"
                required
                defaultValue="Ingreso de mercadería"
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                className="primary-button"
                disabled={saving}
                type="submit"
              >
                {saving ? "Guardando…" : "Aplicar ajuste"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
