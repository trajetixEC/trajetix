"use client";

import { FormEvent, useEffect, useState } from "react";

type ProductSummary = { id: string; name: string; sku: string; stock: number; minimum: number };
type ShipmentSummary = { id: string; orderId: string; carrier: string; tracking: string; status: string };
type IntegrationData = {
  ecommerce: Array<{ id: string; provider: string; name: string; shopDomain: string | null; active: boolean }>;
  carriers: Array<{ id: string; carrierKey: string; name: string; baseUrl: string | null; capabilities: string[]; active: boolean }>;
  webhooks: Array<{ id: string; url: string; events: string[]; active: boolean }>;
};

const emptyIntegrations: IntegrationData = { ecommerce: [], carriers: [], webhooks: [] };
const carriers = [
  ["servientrega", "Servientrega"], ["tramaco", "Tramaco"], ["laar", "LaarCourier"], ["sertod", "Sertod"],
  ["coordinadora", "Coordinadora"], ["interrapidisimo", "Interrapidísimo"], ["99minutos", "99Minutos"],
  ["blue_express", "Blue Express"], ["fedex", "FedEx"], ["ups", "UPS"], ["dhl", "DHL"], ["correos", "Correos"],
] as const;

function ModuleHeader({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div className="page-header"><div><span>{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div></div>;
}

function useIntegrations() {
  const [data, setData] = useState<IntegrationData>(emptyIntegrations);
  const [message, setMessage] = useState("");
  async function load() { const response = await fetch("/api/integrations"); if (response.ok) setData(await response.json() as IntegrationData); }
  useEffect(() => { void load(); }, []);
  async function save(payload: Record<string, unknown>) {
    const response = await fetch("/api/integrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setMessage(response.ok ? "Integración guardada correctamente" : body.error ?? "No se pudo guardar");
    if (response.ok) await load();
    return response.ok;
  }
  return { data, message, setMessage, save, load };
}

export function IntegrationsModule() {
  const { data, message, setMessage, save, load } = useIntegrations();
  const [webhookSecret, setWebhookSecret] = useState("");
  async function connectShopify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    const ok = await save({ kind: "ecommerce", provider: "shopify", name: form.get("name"), shopDomain: form.get("shopDomain"), secretRef: form.get("secretRef") });
    if (ok) formElement.reset();
  }
  async function createWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    const response = await fetch("/api/webhooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: form.get("url"), events: ["product.updated", "inventory.updated", "order.created", "shipment.updated"] }) });
    const body = await response.json().catch(() => ({})) as { error?: string; secret?: string };
    setMessage(response.ok ? "Webhook creado. Guarda el secreto mostrado." : body.error ?? "No se pudo crear el webhook");
    if (response.ok) { setWebhookSecret(body.secret ?? ""); formElement.reset(); await load(); }
  }
  return <><ModuleHeader eyebrow="CANALES Y API" title="Integraciones Ecommerce" copy="Conecta Shopify, consume la API abierta y registra webhooks firmados por empresa." />
    {message && <p className="module-notice">{message}<button onClick={() => setMessage("")}>×</button></p>}
    <div className="operations-grid">
      <section className="panel operation-card"><div className="operation-icon">S</div><h2>Shopify</h2><p>Sincroniza productos, inventario, pedidos y estados de fulfillment.</p><form onSubmit={connectShopify}><label>Nombre de la tienda<input name="name" required placeholder="Tienda principal" /></label><label>Dominio Shopify<input name="shopDomain" required placeholder="mitienda.myshopify.com" /></label><label>Referencia del secreto<input name="secretRef" placeholder="SHOPIFY_ACCESS_TOKEN" /></label><button className="primary-button">Conectar Shopify</button></form></section>
      <section className="panel operation-card"><div className="operation-icon">API</div><h2>API abierta</h2><p>Acceso REST tenant-scoped para productos, clientes, envíos, bodegas e inventario.</p><div className="api-list"><code>GET /api/products</code><code>GET /api/warehouses</code><code>POST /api/inventory/adjustments</code><code>POST /api/shipments</code></div><a className="secondary-button operation-link" href="/api/openapi" target="_blank" rel="noreferrer">Ver especificación OpenAPI</a></section>
      <section className="panel operation-card"><div className="operation-icon">↗</div><h2>Webhooks firmados</h2><p>Notifica cambios de productos, stock, pedidos y tracking usando un secreto único.</p><form onSubmit={createWebhook}><label>URL HTTPS<input name="url" required type="url" placeholder="https://cliente.com/webhooks/trajetix" /></label><button className="primary-button">Crear webhook</button></form>{webhookSecret && <div className="secret-box"><small>Se muestra una sola vez</small><code>{webhookSecret}</code></div>}</section>
    </div>
    <section className="panel integration-status"><h2>Conexiones configuradas</h2><div className="integration-list">{data.ecommerce.map(item => <span key={item.id}><b>{item.name}</b><small>{item.provider} · {item.shopDomain}</small><em>Activa</em></span>)}{data.webhooks.map(item => <span key={item.id}><b>Webhook</b><small>{item.url}</small><em>Firmado</em></span>)}{data.ecommerce.length + data.webhooks.length === 0 && <p>Aún no hay conexiones configuradas.</p>}</div></section>
  </>;
}

export function FulfillmentModule({ products, shipments }: { products: ProductSummary[]; shipments: ShipmentSummary[] }) {
  const stages = [
    ["Recepción", "Ingreso, validación y ubicación"], ["Picking", "Olas, prioridad y asignación"], ["Packing", "Empaque y control de contenido"],
    ["Packing inteligente", "Reglas de caja y peso"], ["Etiquetas", "Guías y documentos"], ["Despacho", "Manifiesto y entrega a carrier"],
    ["Cross Docking", "Flujo sin almacenamiento"], ["Restock", "Devolución a disponibilidad"], ["Control de calidad", "Incidencias y aprobación"],
  ];
  return <><ModuleHeader eyebrow="CENTRO DE OPERACIONES" title="Fulfillment" copy="Recepción, picking, packing, despacho y control de calidad desde un único flujo." /><section className="summary-strip"><div><span>Productos con stock bajo</span><strong>{products.filter(product => product.stock <= product.minimum).length}</strong></div><div><span>Órdenes en preparación</span><strong>{shipments.filter(shipment => ["DRAFT","LABEL_CREATED"].includes(shipment.status)).length}</strong></div><div><span>En tránsito</span><strong>{shipments.filter(shipment => shipment.status === "IN_TRANSIT").length}</strong></div></section><div className="workflow-grid">{stages.map(([title, copy], index) => <article className="workflow-card" key={title}><span>{String(index + 1).padStart(2, "0")}</span><h2>{title}</h2><p>{copy}</p><em>Operativo</em></article>)}</div><section className="panel capability-panel"><h2>Inventario operativo</h2><div className="capability-tags">{["Tiempo real","Multi bodega","Transferencias","Ajustes","Conteo","Kardex","Alertas","Stock mínimo","Reposición"].map(item => <span key={item}>✓ {item}</span>)}</div></section></>;
}

export function LogisticsModule({ shipments }: { shipments: ShipmentSummary[] }) {
  const { data, message, setMessage, save } = useIntegrations();
  async function connectCarrier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); const carrierKey = String(form.get("carrierKey")); const label = carriers.find(([key]) => key === carrierKey)?.[1] ?? carrierKey;
    const ok = await save({ kind: "carrier", carrierKey, name: label, baseUrl: form.get("baseUrl") || undefined, secretRef: form.get("secretRef") || undefined });
    if (ok) formElement.reset();
  }
  return <><ModuleHeader eyebrow="SHIPSTATION PARA LATAM" title="Logística y Transportadoras" copy="Cotización, guías, tracking, recolecciones, última milla y optimización de rutas." />
    {message && <p className="module-notice">{message}<button onClick={() => setMessage("")}>×</button></p>}
    <section className="summary-strip"><div><span>Transportadoras configuradas</span><strong>{data.carriers.length}</strong></div><div><span>Envíos gestionados</span><strong>{shipments.length}</strong></div><div><span>Entregados</span><strong>{shipments.filter(shipment => shipment.status === "DELIVERED").length}</strong></div></section>
    <div className="logistics-layout"><section className="panel operation-card"><h2>Conectar transportadora</h2><form onSubmit={connectCarrier}><label>Transportadora<select name="carrierKey" required defaultValue="servientrega">{carriers.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>URL base de la API<input name="baseUrl" type="url" placeholder="https://api.transportadora.com" /></label><label>Referencia de credencial<input name="secretRef" placeholder="SERVIENTREGA_API_KEY" /></label><button className="primary-button">Guardar adaptador</button></form></section><section className="panel carrier-catalog"><h2>Adaptadores disponibles</h2><div>{carriers.map(([key,label]) => { const active = data.carriers.some(item => item.carrierKey === key); return <span key={key}><b>{label}</b><em className={active ? "is-active" : ""}>{active ? "Configurada" : "Disponible"}</em></span>; })}</div></section></div>
    <section className="panel capability-panel"><h2>Capacidades de cada adaptador</h2><div className="capability-tags">{["Cotización","Crear guía","Cancelar guía","Tracking","Estados","Webhook","Recolección","Documentación","COD","Prueba de entrega","Firma","Foto","GPS en tiempo real"].map(item => <span key={item}>✓ {item}</span>)}</div></section>
    <div className="operations-grid routing-grid"><section className="panel operation-card"><h2>Motor de enrutamiento</h2><p>Optimización por distancia, tiempo, costo, capacidad y prioridad.</p><div className="capability-tags"><span>Google Maps</span><span>Mapbox</span><span>OpenStreetMap</span></div></section><section className="panel operation-card"><h2>Flota</h2><p>Rutas, vehículos, choferes, capacidad y asignación de entregas.</p><div className="capability-tags"><span>Vehículos</span><span>Choferes</span><span>Entregas</span></div></section><section className="panel operation-card"><h2>Tracking en tiempo real</h2><p>Estados normalizados, ubicación GPS, evidencia de entrega y alertas.</p><div className="capability-tags"><span>Firma</span><span>Foto</span><span>GPS</span></div></section></div>
  </>;
}
