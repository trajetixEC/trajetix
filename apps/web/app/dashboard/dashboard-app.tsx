"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { can, type Permission } from "../../lib/rbac";
import { FulfillmentModule, IntegrationsModule } from "./operations-modules";
import {
  MyShipmentsModule,
  NewShipmentModule,
  TrackingModule,
} from "./shipping-modules";
import { FinanceModule, StoreUsersModule } from "./admin-modules";
import { CarrierConfigModal } from "./carrier-config-modal";
import { ProfileModule } from "./profile-module";
import { ReferralsModule } from "./referrals-module";
import { TopbarWallet } from "./topbar-wallet";

type Product = {
  id: string;
  sku: string;
  name: string;
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
}[] = [
  { label: "Dashboard", icon: "⌂", permissions: ["dashboard:read"], group: "PLATAFORMA" },
  { label: "Nuevo envío", icon: "＋", permissions: ["shipments:create"], group: "PLATAFORMA" },
  { label: "Mis envíos", icon: "▣", permissions: ["shipments:read"], group: "PLATAFORMA" },
  { label: "Tracking", icon: "⌖", permissions: ["shipments:read"], group: "PLATAFORMA" },
  { label: "Clientes", icon: "◎", permissions: ["customers:read"], group: "CLIENTES" },
  { label: "Bodegas", icon: "▤", permissions: ["warehouses:read"], group: "STOCK & BODEGAS" },
  { label: "Inventario", icon: "◇", permissions: ["inventory:read"], group: "STOCK & BODEGAS" },
  {
    label: "Fulfillment",
    icon: "◫",
    permissions: ["picking:read", "packing:read"],
    group: "STOCK & BODEGAS",
  },
  { label: "Finanzas", icon: "$", permissions: ["finance:read"], group: "FINANZAS" },
  { label: "Referidos", icon: "↗", permissions: ["referrals:read"], group: "CRECIMIENTO" },
  { label: "Configuración", icon: "⚙", permissions: ["settings:read"], group: "ADMINISTRACIÓN" },
  {
    label: "Usuarios de tienda",
    icon: "♙",
    permissions: ["members:manage"],
    group: "ADMINISTRACIÓN",
    ownerOnly: true,
  },
  {
    label: "Transportadoras",
    icon: "🚛",
    permissions: ["settings:read"],
    group: "ADMINISTRACIÓN",
    ownerOnly: true,
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
  return ["owner", "propietario"].includes(role.toLowerCase());
}

function canOpenMenuItem(
  item: (typeof menu)[number],
  permissions: readonly string[],
  owner: boolean,
) {
  return (
    (!item.ownerOnly || owner) &&
    item.permissions.some((permission) => can(permissions, permission))
  );
}
const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
});

function applyAppearance(value: "LIGHT" | "DARK" | "SYSTEM") {
  const systemLight = window.matchMedia(
    "(prefers-color-scheme: light)",
  ).matches;
  document.documentElement.dataset.theme =
    value === "SYSTEM" ? (systemLight ? "light" : "dark") : value.toLowerCase();
}

export function DashboardApp({
  user,
}: {
  user: { name: string; role: string; tenant: string; permissions: string[] };
}) {
  const owner = isOwnerRole(user.role);
  const [account, setAccount] = useState({
    name: user.name,
    tenant: user.tenant,
  });
  const [accountMenu, setAccountMenu] = useState(false);
  const [appearance, setAppearance] = useState<"LIGHT" | "DARK" | "SYSTEM">(
    "DARK",
  );
  const [section, setSection] = useState<Section>(
    () =>
      menu.find((item) => canOpenMenuItem(item, user.permissions, owner))
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
  const [isCarriersModalOpen, setIsCarriersModalOpen] = useState(false);

  const loadOperationalData = useCallback(async () => {
    const tasks: Promise<void>[] = [];
    const load = <K extends keyof Store>(key: K, url: string) => {
      tasks.push(
        fetch(url).then(async (response) => {
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
                canOpenMenuItem(item, user.permissions, owner),
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
            />
          )}
          {section === "Inventario" && (
            <Products
              products={store.products}
              query={query}
              onAdjust={setAdjustProduct}
              onCreate={() => setCreateEntity("product")}
            />
          )}
          {section === "Nuevo envío" && (
            <NewShipmentModule
              warehouses={store.warehouses}
              products={store.products}
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
          {section === "Transportadoras" && (
            <div>
              <div className="page-header">
                <div>
                  <span>CONFIGURACIÓN DE PLATAFORMA</span>
                  <h1>Transportadoras de Envío</h1>
                  <p>
                    Administra las empresas de envío disponibles para cotizar en el flujo de "Nuevo envío", parámetros de fletes, recolección, márgenes de ganancia y mapa de localidades.
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
          )}
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
}: {
  products: Product[];
  query: string;
  onAdjust: (product: Product) => void;
  onCreate: () => void;
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
                    <button
                      className="secondary-button compact-button"
                      onClick={() => onAdjust(product)}
                    >
                      Ajustar stock
                    </button>
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
}: {
  warehouses: Warehouse[];
  query: string;
  onCreate: () => void;
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
          <article className="warehouse-card" key={warehouse.id}>
            <span className="warehouse-code">{warehouse.code}</span>
            <h2>{warehouse.name}</h2>
            <p>{warehouse.address}</p>
            <small>
              {warehouse.city} · {warehouse.timezone}
            </small>
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
  const [dropshippingPrice, setDropshippingPrice] = useState("");
  const [suggestedDropshippingPrice, setSuggestedDropshippingPrice] =
    useState("");
  const [suggestedPriceEdited, setSuggestedPriceEdited] = useState(false);
  const titles = {
    product: "Nuevo producto",
    customer: "Nuevo cliente",
    shipment: "Nuevo envío",
    warehouse: "Registrar bodega",
  } as const;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = Object.fromEntries(form.entries());
    if (kind === "product") {
      const optionalNumber = (field: string) => {
        const value = String(payload[field] ?? "").trim();
        if (value) payload[field] = Number(value);
        else delete payload[field];
      };
      payload.cost = Number(payload.cost || 0);
      payload.price = Number(payload.price || 0);
      payload.minimumStock = Number(payload.minimumStock || 0);
      optionalNumber("weightKg");
      optionalNumber("lengthCm");
      optionalNumber("widthCm");
      optionalNumber("heightCm");
      optionalNumber("dropshippingPrice");
      optionalNumber("suggestedDropshippingPrice");
      if (productImage) payload.imageDataUrl = productImage;
      payload.trackSerials = form.has("trackSerials");
      payload.trackLots = form.has("trackLots");
      payload.trackExpiry = form.has("trackExpiry");
    }
    if (kind === "shipment") payload.cod = Number(payload.cod || 0);
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
              <div className="form-row">
                <label>
                  SKU
                  <input name="sku" required autoFocus placeholder="SKU-001" />
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
                Nombre
                <input name="name" required placeholder="Nombre del producto" />
              </label>
              <label>
                Descripción breve <small>(opcional)</small>
                <textarea
                  name="description"
                  maxLength={1000}
                  rows={3}
                  placeholder="Describe brevemente el producto"
                />
              </label>
              <div className="form-row">
                <label>
                  Categoría
                  <input name="category" />
                </label>
                <label>
                  Marca
                  <input name="brand" />
                </label>
              </div>
              <label>
                Imagen del producto <small>(opcional)</small>
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
                {imageError && <small className="field-error">{imageError}</small>}
                {productImage && (
                  <Image
                    className="product-image-preview"
                    src={productImage}
                    alt="Vista previa del producto"
                    width={96}
                    height={96}
                    unoptimized
                  />
                )}
              </label>
              <h3 className="form-section-title">Peso y medidas</h3>
              <div className="form-row form-row-four">
                <label>
                  Peso (kg)
                  <input name="weightKg" type="number" min="0.001" step="0.001" required />
                </label>
                <label>
                  Largo (cm)
                  <input name="lengthCm" type="number" min="0.01" step="0.01" required />
                </label>
                <label>
                  Ancho (cm)
                  <input name="widthCm" type="number" min="0.01" step="0.01" required />
                </label>
                <label>
                  Alto (cm)
                  <input name="heightCm" type="number" min="0.01" step="0.01" required />
                </label>
              </div>
              <h3 className="form-section-title">Precios</h3>
              <div className="form-row">
                <label>
                  Costo (USD)
                  <input name="cost" type="number" min="0" step="0.01" required defaultValue="0" />
                </label>
                <label>
                  Precio de venta al público PVP (USD)
                  <input name="price" type="number" min="0" step="0.01" required defaultValue="0" />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Precio para dropshipping (USD) <small>(opcional)</small>
                  <input
                    name="dropshippingPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={dropshippingPrice}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setDropshippingPrice(value);
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
                  Precio sugerido dropshipping (USD) <small>(opcional)</small>
                  <input
                    name="suggestedDropshippingPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={suggestedDropshippingPrice}
                    onChange={(event) => {
                      setSuggestedPriceEdited(true);
                      setSuggestedDropshippingPrice(event.currentTarget.value);
                    }}
                  />
                  <small className="field-help">
                    Margen estimado del revendedor: USD 5,00.
                  </small>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Código de barras
                  <input name="barcode" />
                </label>
                <label>
                  Stock mínimo
                  <input name="minimumStock" type="number" min="0" step="1" defaultValue="0" />
                </label>
              </div>
              <div className="permission-list">
                <label>
                  <input name="trackSerials" type="checkbox" /> Series
                </label>
                <label>
                  <input name="trackLots" type="checkbox" /> Lotes
                </label>
                <label>
                  <input name="trackExpiry" type="checkbox" /> Caducidad
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
              <div className="form-row">
                <label>
                  Código
                  <input name="code" required autoFocus placeholder="UIO-01" />
                </label>
                <label>
                  Nombre
                  <input
                    name="name"
                    required
                    placeholder="Bodega Quito Norte"
                  />
                </label>
              </div>
              <label>
                Ciudad
                <input name="city" required placeholder="Quito" />
              </label>
              <label>
                Dirección
                <input
                  name="address"
                  required
                  placeholder="Calle, número y referencia"
                />
              </label>
              <label>
                Zona horaria
                <select name="timezone" defaultValue="America/Guayaquil">
                  <option>America/Guayaquil</option>
                  <option>America/Bogota</option>
                  <option>America/Lima</option>
                </select>
              </label>
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
            <button className="primary-button" disabled={saving} type="submit">
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </section>
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
