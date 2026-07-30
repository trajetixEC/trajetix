"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { CarrierConfigModal } from "./carrier-config-modal";
import {
  calculateCarrierFreightRate,
  getZeroMarginUsers,
  loadCarrierConfig,
} from "../../lib/carrier-config-store";

type Warehouse = {
  id: string;
  code: string;
  name: string;
  city: string;
  address: string;
};
type Product = {
  id: string;
  sku: string;
  name: string;
  stock: number;
  price: number;
};
type Recipient = {
  id: string;
  name: string;
  phone: string;
  city: string;
  address: string;
  reference: string;
};
type Quote = {
  carrier: string;
  carrierKey: string;
  service: string;
  amount: number;
  currency: string;
  estimatedDays?: number;
  token: string;
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
    declaredValue?: number;
  }>;
  cod?: number;
  quoted?: number;
  labelUrl?: string | null;
  createdAt?: string;
};

type Draft = {
  originMode: "warehouse" | "quick";
  warehouseId: string;
  senderName: string;
  senderPhone: string;
  originCity: string;
  originAddress: string;
  recipientId: string;
  recipientName: string;
  recipientPhone: string;
  destinationCity: string;
  destinationAddress: string;
  destinationReference: string;
  productMode: "inventory" | "generic";
  genericDescription: string;
  packageQuantity: number;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  genericSalePrice: number;
  paymentMode: "COD" | "NO_COD";
  cod: number;
  reference: string;
};

type SelectedItem = { quantity: number; unitPrice: number };

const newDraft = (): Draft => ({
  originMode: "warehouse",
  warehouseId: "",
  senderName: "",
  senderPhone: "",
  originCity: "",
  originAddress: "",
  recipientId: "",
  recipientName: "",
  recipientPhone: "",
  destinationCity: "",
  destinationAddress: "",
  destinationReference: "",
  productMode: "inventory",
  genericDescription: "Paquete genérico",
  packageQuantity: 1,
  weightKg: 1,
  lengthCm: 10,
  widthCm: 10,
  heightCm: 10,
  genericSalePrice: 0,
  paymentMode: "NO_COD",
  cod: 0,
  reference: "",
});

function ShippingHeader({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="page-header">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
    </div>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function NewShipmentModule({
  warehouses: initialWarehouses,
  products: initialProducts,
  onCreated,
}: {
  warehouses: Warehouse[];
  products: Product[];
  onCreated: () => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(newDraft);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [selectedItems, setSelectedItems] = useState<
    Record<string, SelectedItem>
  >({});
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuoteToken, setSelectedQuoteToken] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isCarrierModalOpen, setIsCarrierModalOpen] = useState(false);
  const [success, setSuccess] = useState<{
    tracking: string;
    labelUrl?: string | null;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/shipping/options", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as {
          recipients?: Recipient[];
          warehouses?: Warehouse[];
          products?: Product[];
        };
        setRecipients(body.recipients ?? []);
        setWarehouses(body.warehouses ?? initialWarehouses);
        setProducts(body.products ?? initialProducts);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [initialProducts, initialWarehouses]);

  const productLines = useMemo(
    () =>
      products.flatMap((product) => {
        const selected = selectedItems[product.id];
        return selected?.quantity ? [{ ...product, ...selected }] : [];
      }),
    [products, selectedItems],
  );
  const saleTotal =
    draft.productMode === "inventory"
      ? productLines.reduce(
          (total, item) => total + item.quantity * item.unitPrice,
          0,
        )
      : draft.packageQuantity * draft.genericSalePrice;
  const selectedQuote = quotes.find(
    (quote) => quote.token === selectedQuoteToken,
  );

  function update<K extends keyof Draft>(name: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [name]: value }));
    if (step <= 3) {
      setQuotes([]);
      setSelectedQuoteToken("");
    }
  }

  function selectOriginMode(mode: Draft["originMode"]) {
    setDraft((current) => ({
      ...current,
      originMode: mode,
      warehouseId: "",
      senderName: "",
      senderPhone: "",
      originCity: "",
      originAddress: "",
    }));
    setQuotes([]);
    setSelectedQuoteToken("");
  }

  function chooseWarehouse(id: string) {
    const warehouse = warehouses.find((item) => item.id === id);
    setDraft((current) => ({
      ...current,
      warehouseId: id,
      senderName: warehouse?.name ?? "",
      originCity: warehouse?.city ?? "",
      originAddress: warehouse?.address ?? "",
    }));
    setQuotes([]);
    setSelectedQuoteToken("");
  }

  function chooseRecipient(id: string) {
    const recipient = recipients.find((item) => item.id === id);
    setDraft((current) => ({
      ...current,
      recipientId: id,
      recipientName: recipient?.name ?? "",
      recipientPhone: recipient?.phone ?? "",
      destinationCity: recipient?.city ?? "",
      destinationAddress: recipient?.address ?? "",
      destinationReference: recipient?.reference ?? "",
    }));
    setQuotes([]);
    setSelectedQuoteToken("");
  }

  function changeProduct(product: Product, delta: number) {
    setSelectedItems((current) => {
      const existing = current[product.id] ?? {
        quantity: 0,
        unitPrice: product.price,
      };
      const quantity = Math.max(
        0,
        Math.min(product.stock, existing.quantity + delta),
      );
      if (!quantity) {
        const next = { ...current };
        delete next[product.id];
        return next;
      }
      return { ...current, [product.id]: { ...existing, quantity } };
    });
    setQuotes([]);
    setSelectedQuoteToken("");
  }

  function changeUnitPrice(productId: string, unitPrice: number) {
    setSelectedItems((current) => {
      const selected = current[productId];
      if (!selected) return current;
      return {
        ...current,
        [productId]: { ...selected, unitPrice: Math.max(0, unitPrice) },
      };
    });
    setQuotes([]);
    setSelectedQuoteToken("");
  }

  function parcels() {
    return [
      {
        description:
          draft.productMode === "inventory"
            ? productLines
                .map((item) => `${item.quantity} × ${item.name}`)
                .join(", ")
            : draft.genericDescription,
        quantity: draft.productMode === "generic" ? draft.packageQuantity : 1,
        weightKg: draft.weightKg,
        lengthCm: draft.lengthCm,
        widthCm: draft.widthCm,
        heightCm: draft.heightCm,
        declaredValueMinor: Math.round(saleTotal * 100),
      },
    ];
  }

  function quotePayload() {
    return {
      origin: {
        name: draft.senderName,
        phone: draft.senderPhone,
        country: "EC" as const,
        city: draft.originCity,
        line1: draft.originAddress,
      },
      destination: {
        name: draft.recipientName,
        phone: draft.recipientPhone,
        country: "EC" as const,
        city: draft.destinationCity,
        line1: draft.destinationAddress,
        reference: draft.destinationReference,
      },
      parcels: parcels(),
      codMinor: draft.paymentMode === "COD" ? Math.round(draft.cod * 100) : 0,
    };
  }

  function validationMessage(targetStep = step) {
    if (
      targetStep === 1 &&
      (!draft.senderName ||
        !draft.senderPhone ||
        !draft.originCity ||
        !draft.originAddress ||
        !draft.recipientName ||
        !draft.recipientPhone ||
        !draft.destinationCity ||
        !draft.destinationAddress)
    )
      return "Completa los datos obligatorios de remitente y destinatario";
    if (
      targetStep === 1 &&
      draft.originMode === "warehouse" &&
      !draft.warehouseId
    )
      return "Selecciona una bodega o usa Envío rápido";
    if (
      targetStep === 2 &&
      draft.productMode === "inventory" &&
      productLines.length === 0
    )
      return "Selecciona al menos un producto del inventario";
    if (
      targetStep === 2 &&
      draft.productMode === "generic" &&
      (!draft.genericDescription || draft.packageQuantity < 1)
    )
      return "Completa la información del paquete genérico";
    if (
      targetStep === 2 &&
      (draft.weightKg <= 0 ||
        draft.lengthCm <= 0 ||
        draft.widthCm <= 0 ||
        draft.heightCm <= 0)
    )
      return "Completa el peso y las dimensiones del paquete";
    if (targetStep === 3 && !selectedQuoteToken)
      return "Recalcula las tarifas y selecciona una opción de envío";
    return "";
  }

  function next() {
    const message = validationMessage();
    if (message) return setError(message);
    setError("");
    setStep((current) => Math.min(4, current + 1));
  }

  async function calculateQuotes() {
    const previousError = validationMessage(2);
    if (previousError) return setError(previousError);
    if (draft.paymentMode === "COD" && draft.cod <= 0)
      return setError("Ingresa el valor que se cobrará al cliente");
    setQuoting(true);
    setError("");
    setQuotes([]);
    setSelectedQuoteToken("");
    try {
      // Cargar configuración parametrizada de transportadoras
      const laarConfig = loadCarrierConfig("laar");
      const zeroMarginUsers = getZeroMarginUsers();
      const isZeroMargin =
        zeroMarginUsers.includes(draft.senderName) ||
        zeroMarginUsers.includes(draft.recipientName);

      const computed = calculateCarrierFreightRate({
        config: laarConfig,
        originCity: draft.originCity,
        destinationCity: draft.destinationCity,
        weightKg: draft.weightKg,
        codAmount: draft.paymentMode === "COD" ? draft.cod : 0,
        isZeroMarginUser: isZeroMargin,
      });

      const calculatedQuotes: Quote[] = [];

      if (laarConfig.active) {
        calculatedQuotes.push({
          carrier: laarConfig.general.name,
          carrierKey: "laar",
          service: isZeroMargin
            ? "⚡ Servicio Express (0% Ganancia - Precio Costo)"
            : "Servicio Express Nacional (LAAR)",
          amount: Number(computed.finalPriceToClient.toFixed(2)),
          currency: "USD",
          estimatedDays: computed.zoneKey === "local" ? 1 : computed.zoneKey === "oriente" ? 3 : 2,
          token: `laar-${Date.now()}-${computed.finalPriceToClient.toFixed(2)}`,
        });
      }

      setQuotes(calculatedQuotes);
      if (calculatedQuotes.length === 0) {
        setError("La transportadora LAAR Courier está desactivada o no está disponible.");
      }
    } catch (err: any) {
      setError(err?.message || "No fue posible calcular las tarifas de envío");
    } finally {
      setQuoting(false);
    }
  }

  async function submit() {
    if (!selectedQuote) return setError("Selecciona una tarifa vigente");
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: draft.senderName,
          senderPhone: draft.senderPhone,
          originCity: draft.originCity,
          originAddress: draft.originAddress,
          warehouseId: draft.warehouseId || undefined,
          recipientName: draft.recipientName,
          recipientPhone: draft.recipientPhone,
          destinationCity: draft.destinationCity,
          destinationAddress: draft.destinationAddress,
          destinationReference: draft.destinationReference,
          packages: parcels().map((item) => ({
            ...item,
            declaredValue: item.declaredValueMinor / 100,
            declaredValueMinor: undefined,
          })),
          productItems: productLines.map((item) => ({
            productId: item.id,
            sku: item.sku,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          reference: draft.reference,
          cod: draft.paymentMode === "COD" ? draft.cod : 0,
          quoteToken: selectedQuote.token,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        tracking?: string;
        labelUrl?: string | null;
      };
      if (!response.ok)
        return setError(body.error ?? "No se pudo generar la guía");
      setSuccess({
        tracking: body.tracking ?? "",
        labelUrl: body.labelUrl ?? null,
      });
      await onCreated();
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setStep(1);
    setDraft(newDraft());
    setSelectedItems({});
    setQuotes([]);
    setSelectedQuoteToken("");
    setSuccess(null);
    setError("");
  }

  return (
    <>
      <ShippingHeader
        eyebrow="ENVÍOS"
        title="Nuevo envío"
        copy={`Paso ${step} de 4 — ${["Origen y destino", "Productos", "Transportadora", "Resumen"][step - 1]}`}
      />
      <div className="shipment-steps">
        {["Origen y Destino", "Productos", "Transportadora", "Resumen"].map(
          (label, index) => (
            <span className={step >= index + 1 ? "active" : ""} key={label}>
              <b>{step > index + 1 ? "✓" : index + 1}</b>
              {label}
            </span>
          ),
        )}
      </div>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      {step === 1 && (
        <div className="address-grid">
          <section className="panel shipping-card">
            <h2>Remitente (Origen)</h2>
            <div className="choice-row">
              <button
                type="button"
                className={draft.originMode === "warehouse" ? "active" : ""}
                onClick={() => selectOriginMode("warehouse")}
              >
                <b>Mis bodegas</b>
                <small>Despacha desde una bodega registrada</small>
              </button>
              <button
                type="button"
                className={draft.originMode === "quick" ? "active" : ""}
                onClick={() => selectOriginMode("quick")}
              >
                <b>Envío rápido</b>
                <small>Registra el remitente manualmente</small>
              </button>
            </div>
            {draft.originMode === "warehouse" && (
              <label>
                Bodega registrada *
                <select
                  value={draft.warehouseId}
                  onChange={(event) => chooseWarehouse(event.target.value)}
                >
                  <option value="">Seleccionar bodega…</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} · {warehouse.city}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {draft.originMode === "warehouse" && warehouses.length === 0 && (
              <p className="selection-note">
                Esta empresa todavía no tiene bodegas. Registra una en Bodegas o
                usa Envío rápido.
              </p>
            )}
            <div className="form-row">
              <label>
                Nombre / empresa *
                <input
                  value={draft.senderName}
                  onChange={(event) => update("senderName", event.target.value)}
                />
              </label>
              <label>
                Teléfono / WhatsApp *
                <input
                  value={draft.senderPhone}
                  onChange={(event) =>
                    update("senderPhone", event.target.value)
                  }
                />
              </label>
            </div>
            <label>
              Ciudad / Cantón *
              <input
                value={draft.originCity}
                onChange={(event) => update("originCity", event.target.value)}
              />
            </label>
            <label>
              Dirección exacta *
              <input
                value={draft.originAddress}
                onChange={(event) =>
                  update("originAddress", event.target.value)
                }
              />
            </label>
          </section>
          <section className="panel shipping-card">
            <h2>Destinatario</h2>
            <label>
              Destinatarios anteriores
              <select
                value={draft.recipientId}
                onChange={(event) => chooseRecipient(event.target.value)}
              >
                <option value="">＋ Agregar nuevo destinatario</option>
                {recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.name} · {recipient.phone}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Nombre y apellido *
                <input
                  value={draft.recipientName}
                  onChange={(event) =>
                    update("recipientName", event.target.value)
                  }
                />
              </label>
              <label>
                Teléfono / WhatsApp *
                <input
                  value={draft.recipientPhone}
                  onChange={(event) =>
                    update("recipientPhone", event.target.value)
                  }
                />
              </label>
            </div>
            <label>
              Ciudad / Cantón *
              <input
                value={draft.destinationCity}
                onChange={(event) =>
                  update("destinationCity", event.target.value)
                }
              />
            </label>
            <label>
              Dirección exacta *
              <input
                value={draft.destinationAddress}
                onChange={(event) =>
                  update("destinationAddress", event.target.value)
                }
              />
            </label>
            <label>
              Referencia
              <input
                value={draft.destinationReference}
                onChange={(event) =>
                  update("destinationReference", event.target.value)
                }
              />
            </label>
          </section>
        </div>
      )}

      {step === 2 && (
        <div className="product-step-grid">
          <section className="panel shipping-card">
            <div className="mode-tabs">
              <button
                type="button"
                className={draft.productMode === "inventory" ? "active" : ""}
                onClick={() => update("productMode", "inventory")}
              >
                Mi inventario
              </button>
              <button
                type="button"
                className={draft.productMode === "generic" ? "active" : ""}
                onClick={() => update("productMode", "generic")}
              >
                Paquete genérico
              </button>
            </div>
            {draft.productMode === "inventory" ? (
              <div className="product-picker">
                {products.map((product) => {
                  const line = selectedItems[product.id];
                  return (
                    <div className="product-pick-row" key={product.id}>
                      <span>
                        <b>{product.name}</b>
                        <small>
                          SKU {product.sku} · Stock {product.stock} ·{" "}
                          {money(product.price)}
                        </small>
                      </span>
                      <div>
                        <button
                          type="button"
                          onClick={() => changeProduct(product, -1)}
                        >
                          −
                        </button>
                        <b>{line?.quantity ?? 0}</b>
                        <button
                          type="button"
                          onClick={() => changeProduct(product, 1)}
                          disabled={(line?.quantity ?? 0) >= product.stock}
                        >
                          ＋
                        </button>
                      </div>
                    </div>
                  );
                })}
                {products.length === 0 && (
                  <p className="selection-note">
                    Esta empresa aún no tiene productos. Regístralos en
                    Inventario o usa Paquete genérico.
                  </p>
                )}
              </div>
            ) : (
              <>
                <label>
                  Contenido del paquete *
                  <input
                    value={draft.genericDescription}
                    onChange={(event) =>
                      update("genericDescription", event.target.value)
                    }
                    placeholder="Ropa, calzado, electrónicos…"
                  />
                </label>
                <div className="form-row">
                  <label>
                    Cantidad de paquetes *
                    <input
                      type="number"
                      min="1"
                      value={draft.packageQuantity}
                      onChange={(event) =>
                        update("packageQuantity", Number(event.target.value))
                      }
                    />
                  </label>
                  <label>
                    Precio de venta por paquete
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.genericSalePrice}
                      onChange={(event) =>
                        update("genericSalePrice", Number(event.target.value))
                      }
                    />
                  </label>
                </div>
              </>
            )}
            <h3 className="section-label">
              Información del paquete para cotizar
            </h3>
            <div className="form-row">
              <label>
                Peso (kg) *
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={draft.weightKg}
                  onChange={(event) =>
                    update("weightKg", Number(event.target.value))
                  }
                />
              </label>
              <label>
                Largo (cm) *
                <input
                  type="number"
                  min="1"
                  value={draft.lengthCm}
                  onChange={(event) =>
                    update("lengthCm", Number(event.target.value))
                  }
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Ancho (cm) *
                <input
                  type="number"
                  min="1"
                  value={draft.widthCm}
                  onChange={(event) =>
                    update("widthCm", Number(event.target.value))
                  }
                />
              </label>
              <label>
                Alto (cm) *
                <input
                  type="number"
                  min="1"
                  value={draft.heightCm}
                  onChange={(event) =>
                    update("heightCm", Number(event.target.value))
                  }
                />
              </label>
            </div>
          </section>
          <aside className="panel shipping-card sticky-summary">
            <h2>Resumen del envío</h2>
            {productLines.map((item) => (
              <div className="summary-product" key={item.id}>
                <span>
                  <b>{item.name}</b>
                  <small>{item.quantity} unidad(es)</small>
                </span>
                <label>
                  Precio de venta
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(event) =>
                      changeUnitPrice(item.id, Number(event.target.value))
                    }
                  />
                </label>
              </div>
            ))}
            {draft.productMode === "generic" && (
              <p>
                {draft.packageQuantity} × {draft.genericDescription}
              </p>
            )}
            <div className="summary-total">
              <span>Productos</span>
              <b>
                {draft.productMode === "inventory"
                  ? productLines.reduce(
                      (total, item) => total + item.quantity,
                      0,
                    )
                  : draft.packageQuantity}
              </b>
              <span>Valor de venta</span>
              <b>{money(saleTotal)}</b>
            </div>
          </aside>
        </div>
      )}

      {step === 3 && (
        <div className="carrier-layout">
          <section className="panel shipping-card carrier-parameters">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0 }}>Parámetros</h2>
              <button
                type="button"
                className="secondary-button"
                style={{ padding: "6px 12px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}
                onClick={() => setIsCarrierModalOpen(true)}
              >
                ⚙ Configurar transportadoras
              </button>
            </div>
            <span className="section-label">Modalidad de cobro</span>
            <div className="mode-tabs">
              <button
                type="button"
                className={draft.paymentMode === "COD" ? "active" : ""}
                onClick={() => {
                  update("paymentMode", "COD");
                  if (!draft.cod) update("cod", saleTotal);
                }}
              >
                Con Recaudo (COD)
              </button>
              <button
                type="button"
                className={draft.paymentMode === "NO_COD" ? "active" : ""}
                onClick={() => update("paymentMode", "NO_COD")}
              >
                Sin Recaudo
              </button>
            </div>
            {draft.paymentMode === "COD" && (
              <label>
                Valor a cobrar al cliente *
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={draft.cod}
                  onChange={(event) =>
                    update("cod", Number(event.target.value))
                  }
                />
              </label>
            )}
            <label>
              Valor declarado para el seguro
              <input readOnly value={saleTotal.toFixed(2)} />
            </label>
            <button
              type="button"
              className="primary-button full-button"
              disabled={quoting}
              onClick={() => void calculateQuotes()}
            >
              {quoting ? "Consultando APIs…" : "↻ Recalcular tarifas"}
            </button>
            <p className="selection-note">
              Origen: {draft.originCity}
              <br />
              Destino: {draft.destinationCity}
              <br />
              Peso: {draft.weightKg.toFixed(2)} kg
            </p>
          </section>
          <section className="carrier-results">
            <h2>Opciones de envío</h2>
            {quotes.length === 0 ? (
              <div className="quote-empty">
                <b>
                  {quoting
                    ? "Consultando transportadoras…"
                    : "Recalcula para ver tarifas reales"}
                </b>
                <small>
                  Sólo aparecen servicios devueltos por APIs configuradas por
                  Trajetix.
                </small>
              </div>
            ) : (
              quotes.map((quote) => (
                <button
                  type="button"
                  className={`quote-card ${selectedQuoteToken === quote.token ? "active" : ""}`}
                  key={quote.token}
                  onClick={() => setSelectedQuoteToken(quote.token)}
                >
                  <span>
                    <b>{quote.carrier}</b>
                    <small>
                      {quote.service}
                      {quote.estimatedDays
                        ? ` · ${quote.estimatedDays} día(s)`
                        : ""}
                    </small>
                  </span>
                  <strong>{money(quote.amount)}</strong>
                </button>
              ))
            )}
          </section>
        </div>
      )}

      {step === 4 && (
        <div className="final-summary-grid">
          <section className="panel shipping-card">
            <h2>Resumen del envío</h2>
            <div className="summary-total">
              <span>Transportadora</span>
              <b>{selectedQuote?.carrier}</b>
              <span>Servicio</span>
              <b>{selectedQuote?.service}</b>
              <span>Productos / paquetes</span>
              <b>
                {draft.productMode === "inventory"
                  ? productLines.reduce(
                      (total, item) => total + item.quantity,
                      0,
                    )
                  : draft.packageQuantity}
              </b>
              <span>Peso total</span>
              <b>{draft.weightKg.toFixed(2)} kg</b>
              <span>Modalidad</span>
              <b>
                {draft.paymentMode === "COD"
                  ? `Con Recaudo · ${money(draft.cod)}`
                  : "Sin Recaudo"}
              </b>
              <span>Flete</span>
              <b>{money(selectedQuote?.amount ?? 0)}</b>
              {draft.paymentMode === "COD" && (
                <>
                  <span>Valor estimado a recibir</span>
                  <b className="accent-total">
                    {money(
                      Math.max(0, draft.cod - (selectedQuote?.amount ?? 0)),
                    )}
                  </b>
                </>
              )}
            </div>
            <label>
              Referencia interna
              <input
                value={draft.reference}
                onChange={(event) => update("reference", event.target.value)}
                placeholder="Pedido, factura o referencia"
              />
            </label>
          </section>
          <section className="panel shipping-card">
            <h2>Datos del envío</h2>
            <div className="shipment-summary">
              <span>
                <small>Remitente</small>
                <b>{draft.senderName}</b>
                <em>
                  {draft.senderPhone}
                  <br />
                  {draft.originCity} · {draft.originAddress}
                </em>
              </span>
              <span>
                <small>Destinatario</small>
                <b>{draft.recipientName}</b>
                <em>
                  {draft.recipientPhone}
                  <br />
                  {draft.destinationCity} · {draft.destinationAddress}
                </em>
              </span>
            </div>
            {productLines.map((item) => (
              <div className="line-summary" key={item.id}>
                <span>
                  {item.name} × {item.quantity}
                </span>
                <b>{money(item.unitPrice * item.quantity)}</b>
              </div>
            ))}
            {draft.productMode === "generic" && (
              <div className="line-summary">
                <span>
                  {draft.genericDescription} × {draft.packageQuantity}
                </span>
                <b>{money(saleTotal)}</b>
              </div>
            )}
          </section>
        </div>
      )}

      {success && (
        <div className="shipment-success" role="status">
          <span>✓</span>
          <div>
            <b>Guía generada correctamente</b>
            <strong>{success.tracking}</strong>
            {success.labelUrl && (
              <a href={success.labelUrl} target="_blank" rel="noreferrer">
                Abrir etiqueta
              </a>
            )}
          </div>
          <button type="button" className="secondary-button" onClick={reset}>
            Crear otro envío
          </button>
        </div>
      )}
      {!success && (
        <div className="wizard-actions">
          {step > 1 && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setError("");
                setStep((current) => current - 1);
              }}
            >
              Atrás
            </button>
          )}
          {step < 4 ? (
            <button type="button" className="primary-button" onClick={next}>
              Siguiente: {["Productos", "Transportadora", "Resumen"][step - 1]}
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              disabled={saving}
              onClick={() => void submit()}
            >
              {saving ? "Generando guía…" : "Confirmar y generar guía"}
            </button>
          )}
        </div>
      )}
      <CarrierConfigModal
        isOpen={isCarrierModalOpen}
        onClose={() => setIsCarrierModalOpen(false)}
        onSaved={() => void calculateQuotes()}
      />
    </>
  );
}

type ShipmentFilters = {
  search: string;
  carrier: string;
  status: string;
  city: string;
  guide: string;
  from: string;
  to: string;
};

const shipmentStatusNames: Record<string, string> = {
  DRAFT: "Borrador",
  QUOTED: "Cotizado",
  LABEL_CREATED: "Guía generada",
  PICKUP_SCHEDULED: "Recolección programada",
  IN_TRANSIT: "En tránsito",
  OUT_FOR_DELIVERY: "En reparto",
  DELIVERED: "Entregado",
  EXCEPTION: "Con novedad",
  CANCELLED: "Cancelado",
  RETURNED: "Devuelto",
};

function shipmentStatusLabel(status: string) {
  return shipmentStatusNames[status.toUpperCase()] ?? status.replaceAll("_", " ");
}

function shipmentStatusClass(status: string) {
  return status.toLowerCase().replaceAll("_", "-");
}

function shipmentWeight(shipment: Shipment) {
  return (shipment.packages ?? []).reduce(
    (total, item) => total + (item.weightKg ?? 0) * (item.quantity ?? 1),
    0,
  );
}

function shipmentValue(shipment: Shipment) {
  const declared = (shipment.packages ?? []).reduce(
    (total, item) => total + (item.declaredValue ?? 0) * (item.quantity ?? 1),
    0,
  );
  return declared || shipment.cod || 0;
}

function hasGeneratedGuide(shipment: Shipment) {
  return Boolean(
    shipment.tracking &&
      !["pendiente", "pending", "sin guía"].includes(
        shipment.tracking.toLowerCase(),
      ),
  );
}

export function MyShipmentsModule({
  shipments,
  query,
  onNew,
}: {
  shipments: Shipment[];
  query: string;
  onNew: () => void;
}) {
  const [filters, setFilters] = useState<ShipmentFilters>({
    search: "",
    carrier: "ALL",
    status: "ALL",
    city: "ALL",
    guide: "ALL",
    from: "",
    to: "",
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  const carriers = useMemo(
    () => [...new Set(shipments.map((item) => item.carrier).filter(Boolean))].sort(),
    [shipments],
  );
  const statuses = useMemo(
    () => [...new Set(shipments.map((item) => item.status).filter(Boolean))].sort(),
    [shipments],
  );
  const cities = useMemo(
    () =>
      [...new Set(shipments.map((item) => item.address?.city).filter(Boolean))]
        .sort() as string[],
    [shipments],
  );

  const filtered = useMemo(() => {
    const term = `${query} ${filters.search}`.trim().toLowerCase();
    return shipments.filter((item) => {
      const generated = hasGeneratedGuide(item);
      const createdDate = item.createdAt?.slice(0, 10) ?? "";
      const searchable = [
        item.orderId,
        item.tracking,
        item.carrier,
        item.service,
        item.recipient?.name,
        item.recipient?.phone,
        item.address?.city,
        item.address?.line1,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        (!term || searchable.includes(term)) &&
        (filters.carrier === "ALL" || item.carrier === filters.carrier) &&
        (filters.status === "ALL" || item.status === filters.status) &&
        (filters.city === "ALL" || item.address?.city === filters.city) &&
        (filters.guide === "ALL" ||
          (filters.guide === "GENERATED" ? generated : !generated)) &&
        (!filters.from || (createdDate && createdDate >= filters.from)) &&
        (!filters.to || (createdDate && createdDate <= filters.to))
      );
    });
  }, [filters, query, shipments]);

  const updateFilter = (key: keyof ShipmentFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const clearFilters = () =>
    setFilters({
      search: "",
      carrier: "ALL",
      status: "ALL",
      city: "ALL",
      guide: "ALL",
      from: "",
      to: "",
    });

  return (
    <>
      <div className="page-header shipments-page-header">
        <div>
          <span>OPERACIÓN LOGÍSTICA</span>
          <h1>Mis envíos</h1>
          <p>Gestiona y rastrea todos tus despachos.</p>
        </div>
        <button className="primary-button" onClick={onNew}>
          ＋ Nuevo envío
        </button>
      </div>

      <section className="panel shipment-filter-panel" aria-label="Filtros de envíos">
        <div className="shipment-filter-grid">
          <label className="shipment-search-filter">
            Guía, código o destinatario
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Buscar guía, referencia, teléfono o destinatario..."
            />
          </label>
          <label>
            Transportadora
            <select
              value={filters.carrier}
              onChange={(event) => updateFilter("carrier", event.target.value)}
            >
              <option value="ALL">Todas</option>
              {carriers.map((carrier) => (
                <option key={carrier} value={carrier}>
                  {carrier}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              <option value="ALL">Todos los estados</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {shipmentStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ciudad destino
            <select
              value={filters.city}
              onChange={(event) => updateFilter("city", event.target.value)}
            >
              <option value="ALL">Todas las ciudades</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>
          <label>
            Desde
            <input
              type="date"
              value={filters.from}
              onChange={(event) => updateFilter("from", event.target.value)}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={filters.to}
              onChange={(event) => updateFilter("to", event.target.value)}
            />
          </label>
          <label>
            Generación de guía
            <select
              value={filters.guide}
              onChange={(event) => updateFilter("guide", event.target.value)}
            >
              <option value="ALL">Todas</option>
              <option value="GENERATED">Generada</option>
              <option value="PENDING">Pendiente</option>
            </select>
          </label>
        </div>
        <div className="shipment-filter-footer">
          <strong>{filtered.length} despachos encontrados</strong>
          <button className="secondary-button" type="button" onClick={clearFilters}>
            Limpiar filtros
          </button>
        </div>
      </section>

      <section className="panel table-panel shipment-management-panel">
        <div className="table-scroll">
          <table className="shipment-management-table">
            <thead>
              <tr>
                <th>Guía / referencia</th>
                <th>Courier</th>
                <th>Destinatario</th>
                <th>Peso / valor</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Generación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const generated = hasGeneratedGuide(item);
                const weight = shipmentWeight(item);
                return (
                  <Fragment key={item.id}>
                    <tr>
                      <td>
                        <strong className="shipment-guide">
                          {generated ? item.tracking : item.orderId}
                        </strong>
                        <small>{item.orderId}</small>
                      </td>
                      <td>
                        <strong>{item.carrier || "Por asignar"}</strong>
                        <small>{item.service || "Servicio por confirmar"}</small>
                      </td>
                      <td>
                        <strong>{item.recipient?.name ?? "Sin destinatario"}</strong>
                        <small>
                          {[item.address?.city, item.address?.line1]
                            .filter(Boolean)
                            .join(" · ") || "Sin dirección"}
                        </small>
                      </td>
                      <td>
                        <strong>{weight.toFixed(2)} kg</strong>
                        <small>{money(shipmentValue(item))}</small>
                        {(item.cod ?? 0) > 0 && <em className="cod-badge">COD</em>}
                      </td>
                      <td>
                        <strong>
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleDateString("es-EC")
                            : "—"}
                        </strong>
                        <small>
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleTimeString("es-EC", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </small>
                      </td>
                      <td>
                        <span
                          className={`shipment-status shipment-status-${shipmentStatusClass(item.status)}`}
                        >
                          {shipmentStatusLabel(item.status)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`guide-status ${generated ? "generated" : "pending"}`}
                        >
                          {generated ? "✓ Generada" : "Pendiente"}
                        </span>
                      </td>
                      <td>
                        <div className="shipment-row-actions">
                          <button
                            type="button"
                            onClick={() =>
                              setExpanded((current) =>
                                current === item.id ? null : item.id,
                              )
                            }
                            title="Ver detalle"
                          >
                            {expanded === item.id ? "Cerrar" : "Detalle"}
                          </button>
                          {generated && (
                            <a
                              href={`/tracking?guia=${encodeURIComponent(item.tracking)}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Rastrear envío"
                            >
                              Rastrear
                            </a>
                          )}
                          {item.labelUrl && (
                            <a
                              href={item.labelUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Descargar guía"
                            >
                              Guía
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded === item.id && (
                      <tr className="shipment-detail-row">
                        <td colSpan={8}>
                          <div className="shipment-detail-grid">
                            <span>
                              <small>Remitente</small>
                              <strong>{item.sender?.name || "No registrado"}</strong>
                              <em>{item.sender?.city || ""}</em>
                            </span>
                            <span>
                              <small>Destinatario</small>
                              <strong>{item.recipient?.name || "No registrado"}</strong>
                              <em>{item.recipient?.phone || ""}</em>
                            </span>
                            <span>
                              <small>Destino</small>
                              <strong>{item.address?.city || "No registrado"}</strong>
                              <em>{item.address?.line1 || ""}</em>
                            </span>
                            <span>
                              <small>Valores</small>
                              <strong>Flete {money(item.quoted ?? 0)}</strong>
                              <em>Recaudo {money(item.cod ?? 0)}</em>
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="empty shipment-empty">
              <span>▣</span>
              <h3>No hay despachos para mostrar</h3>
              <p>
                Ajusta los filtros o crea un nuevo envío para comenzar a gestionarlo aquí.
              </p>
              {shipments.length === 0 && (
                <button className="primary-button" onClick={onNew}>
                  ＋ Crear primer envío
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
export function TrackingModule() {
  const [tracking, setTracking] = useState("");
  const [result, setResult] = useState<{
    guide: string;
    carrier: string;
    service?: string;
    status: string;
    destination: string;
    events: Array<{
      status: string;
      description: string;
      location?: string | null;
      occurredAt: string;
    }>;
  } | null>(null);
  const [message, setMessage] = useState("");
  async function search() {
    if (tracking.trim().length < 3) return;
    const response = await fetch(
      `/api/tracking/${encodeURIComponent(tracking.trim())}`,
    );
    const body = (await response.json()) as typeof result & { error?: string };
    if (response.ok) {
      setResult(body);
      setMessage("");
    } else {
      setResult(null);
      setMessage(body?.error ?? "No encontramos esa guía");
    }
  }
  const shareUrl = result
    ? `/tracking?guia=${encodeURIComponent(result.guide)}`
    : "";
  return (
    <>
      <ShippingHeader
        eyebrow="SEGUIMIENTO MULTITRANSPORTADORA"
        title="Tracking"
        copy="Consulta el estado e historial sincronizado de cualquier transportadora integrada."
      />
      <section className="panel tracking-card">
        <label>
          Número de guía o referencia
          <div className="tracking-search">
            <input
              value={tracking}
              onChange={(event) => setTracking(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void search();
              }}
              placeholder="Servientrega, LaarCourier, Gintracom, Trajet…"
              autoFocus
            />
            <button className="primary-button" onClick={() => void search()}>
              Consultar
            </button>
          </div>
        </label>
        {message && <p className="selection-note">{message}</p>}
        {result && (
          <>
            <div className="tracking-result">
              <span className="operation-icon">✓</span>
              <div>
                <small>
                  {result.carrier} · {result.service}
                </small>
                <h2>{result.guide}</h2>
                <p>Destino: {result.destination}</p>
              </div>
              <b>{result.status}</b>
            </div>
            <div className="tracking-timeline dashboard-timeline">
              {result.events.map((item, index) => (
                <div key={`${item.occurredAt}-${index}`}>
                  <i></i>
                  <span>
                    <b>{item.description}</b>
                    <small>
                      {item.location ? `${item.location} · ` : ""}
                      {new Date(item.occurredAt).toLocaleString("es-EC")}
                    </small>
                  </span>
                </div>
              ))}
            </div>
            <div className="share-tracking">
              <input readOnly value={shareUrl} />
              <button
                className="secondary-button"
                onClick={() =>
                  void navigator.clipboard.writeText(
                    `${window.location.origin}${shareUrl}`,
                  )
                }
              >
                Copiar enlace público
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
