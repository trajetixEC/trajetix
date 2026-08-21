"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  User,
  Building2,
  Package,
  Truck,
  ShieldCheck,
  CheckCircle2,
  Calculator,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  ChevronRight,
  RefreshCw,
  Plus,
  Minus,
  Check,
  Receipt,
  DollarSign,
  Store,
  SlidersHorizontal,
  FileText,
  MoreVertical,
  Loader2,
  Ban,
  Eye,
  EyeOff,
  Star,
  X,
  Printer,
} from "lucide-react";
import { CarrierConfigModal } from "./carrier-config-modal";
import { CitySelect } from "./city-select";
import {
  calculateCarrierFreightRate,
  getZeroMarginUsers,
  loadCarrierConfig,
} from "../../lib/carrier-config-store";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "../../components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../../components/ui/dropdown-menu";

type Warehouse = {
  id: string;
  code: string;
  name: string;
  city: string;
  address: string;
  phone?: string;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  stock: number;
  price: number;
  imageUrl?: string | null;
  weightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
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
  genericSalePrice: number;

  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;

  paymentMode: "COD" | "NO_COD";
  cod: number;
  insuredValue: number;
  reference: string;
};

type AdminBreakdown = ReturnType<typeof calculateCarrierFreightRate>;

type SelectedItem = {
  quantity: number;
  unitPrice: number;
};

function money(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function newDraft(): Draft {
  return {
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
    genericDescription: "",
    packageQuantity: 1,
    genericSalePrice: 0,

    weightKg: 1,
    lengthCm: 15,
    widthCm: 15,
    heightCm: 15,

    paymentMode: "COD",
    cod: 0,
    insuredValue: 0,
    reference: "",
  };
}

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
    <div className="mb-6">
      <span className="text-[11px] font-bold tracking-widest text-red-600 dark:text-red-400 uppercase">
        {eyebrow}
      </span>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-0.5">
        {title}
      </h1>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{copy}</p>
    </div>
  );
}

export function NewShipmentModule({
  user,
  warehouses: initialWarehouses,
  products: initialProducts,
  onNavigateToWarehouses,
  onCreated,
}: {
  user?: { name: string; email?: string; role: string; tenant: string; permissions: string[] };
  warehouses: Warehouse[];
  products: Product[];
  onNavigateToWarehouses?: (warehouseId?: string) => void;
  onCreated: () => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(newDraft);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [selectedItems, setSelectedItems] = useState<Record<string, SelectedItem>>({});
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuoteToken, setSelectedQuoteToken] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isCarrierModalOpen, setIsCarrierModalOpen] = useState(false);
  const [adminBreakdown, setAdminBreakdown] = useState<AdminBreakdown | null>(null);
  const [success, setSuccess] = useState<{
    tracking: string;
    labelUrl?: string | null;
  } | null>(null);
  const [savingRecipient, setSavingRecipient] = useState(false);
  const [recipientSavedNotice, setRecipientSavedNotice] = useState(false);

  async function handleSaveDefaultRecipient() {
    if (!draft.recipientName || draft.recipientName.trim().length < 2) {
      setError("Por favor ingresa el nombre y apellido del destinatario antes de guardarlo.");
      if (typeof window !== "undefined") window.scrollTo({ top: 120, behavior: "smooth" });
      return;
    }
    if (!draft.recipientPhone || draft.recipientPhone.trim().length < 5) {
      setError("Por favor ingresa el teléfono del destinatario antes de guardarlo.");
      if (typeof window !== "undefined") window.scrollTo({ top: 120, behavior: "smooth" });
      return;
    }
    if (!draft.destinationCity) {
      setError("Por favor selecciona una ciudad de destino válida del listado oficial de cobertura LAAR.");
      if (typeof window !== "undefined") window.scrollTo({ top: 120, behavior: "smooth" });
      return;
    }
    if (!draft.destinationAddress || draft.destinationAddress.trim().length < 4) {
      setError("Por favor ingresa la dirección exacta de destino antes de guardar el destinatario.");
      if (typeof window !== "undefined") window.scrollTo({ top: 120, behavior: "smooth" });
      return;
    }

    setError("");
    setSavingRecipient(true);
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.recipientName,
          phone: draft.recipientPhone || "",
          city: draft.destinationCity,
          address: draft.destinationAddress,
          reference: draft.destinationReference || "",
          isDefault: true,
        }),
      });
      if (response.ok) {
        const body = (await response.json()) as { id: string };
        const newRec: Recipient = {
          id: body.id,
          name: draft.recipientName,
          phone: draft.recipientPhone || "",
          city: draft.destinationCity,
          address: draft.destinationAddress,
          reference: draft.destinationReference || "",
        };
        setRecipients((prev) => {
          const exists = prev.some((item) => item.phone && item.phone === newRec.phone);
          if (exists) {
            return prev.map((item) => (item.phone === newRec.phone ? newRec : item));
          }
          return [newRec, ...prev];
        });
        update("recipientId", newRec.id);
        if (typeof window !== "undefined") {
          localStorage.setItem("trajetix_default_recipient", JSON.stringify(newRec));
        }
        setRecipientSavedNotice(true);
        setTimeout(() => setRecipientSavedNotice(false), 3500);
      } else {
        const errBody = (await response.json().catch(() => ({}))) as { error?: string };
        setError(errBody.error || "No se pudo guardar el destinatario predeterminado.");
      }
    } catch (e) {
      console.error("Error al guardar destinatario:", e);
      setError("Ocurrió un error al guardar el destinatario.");
    } finally {
      setSavingRecipient(false);
    }
  }

  // Check if current user is system superadmin / platform admin
  const isAdmin = useMemo(() => {
    if (!user) return false;
    const r = (user.role || "").toLowerCase();
    return r.includes("superadmin") || r.includes("super");
  }, [user]);

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
        const loadedW = body.warehouses ?? initialWarehouses;
        setWarehouses(loadedW);
        setProducts(body.products ?? initialProducts);
        if (loadedW.length > 0 && loadedW[0]) {
          const first = loadedW[0];
          setDraft((current) => {
            if (current.originMode === "warehouse" && !current.senderName) {
              const storeName = user?.tenant || first.name || "";
              return {
                ...current,
                warehouseId: current.warehouseId || first.id,
                senderName: storeName,
                senderPhone: current.senderPhone || (first as { phone?: string })?.phone || (user as { phone?: string })?.phone || "",
                originCity: current.originCity || first.city,
                originAddress: current.originAddress || first.address,
              };
            }
            return current;
          });
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [initialProducts, initialWarehouses, user?.tenant]);

  const productLines = useMemo(
    () =>
      products.flatMap((product) => {
        const selected = selectedItems[product.id];
        return selected?.quantity ? [{ ...product, ...selected }] : [];
      }),
    [products, selectedItems]
  );

  const saleTotal =
    draft.productMode === "inventory"
      ? productLines.reduce(
          (total, item) => total + item.quantity * item.unitPrice,
          0
        )
      : draft.packageQuantity * draft.genericSalePrice;

  useEffect(() => {
    if (draft.productMode === "inventory" && productLines.length > 0) {
      const totalWeight = productLines.reduce(
        (sum, p) => sum + (p.weightKg && p.weightKg > 0 ? p.weightKg : 1) * p.quantity,
        0
      );
      const validL = productLines.map((p) => p.lengthCm).filter((v): v is number => typeof v === "number" && v > 0);
      const validW = productLines.map((p) => p.widthCm).filter((v): v is number => typeof v === "number" && v > 0);
      const validH = productLines.map((p) => p.heightCm).filter((v): v is number => typeof v === "number" && v > 0);

      const maxL = validL.length > 0 ? Math.max(...validL) : 15;
      const maxW = validW.length > 0 ? Math.max(...validW) : 15;
      const maxH = validH.length > 0 ? Math.max(...validH) : 15;

      setDraft((current) => ({
        ...current,
        weightKg: Number(totalWeight.toFixed(2)),
        lengthCm: maxL,
        widthCm: maxW,
        heightCm: maxH,
      }));
    }
  }, [draft.productMode, productLines]);

  const isCodEdited = useRef(false);

  useEffect(() => {
    if (saleTotal > 0) {
      setDraft((current) => {
        if (current.paymentMode === "COD" && (!isCodEdited.current || current.cod === 0)) {
          return { ...current, cod: saleTotal };
        }
        return current;
      });
    }
  }, [saleTotal]);

  const selectedQuote = quotes.find((quote) => quote.token === selectedQuoteToken);

  function update<K extends keyof Draft>(name: K, value: Draft[K]) {
    if (name === "cod") {
      isCodEdited.current = true;
    }
    setDraft((current) => ({ ...current, [name]: value }));
    if (step <= 3) {
      setQuotes([]);
      setSelectedQuoteToken("");
      setAdminBreakdown(null);
    }
  }

  function selectOriginMode(mode: Draft["originMode"]) {
    const firstW = mode === "warehouse" ? warehouses[0] : null;
    const phone = (firstW as { phone?: string })?.phone || (user as { phone?: string })?.phone || "";
    const storeName = user?.tenant || firstW?.name || "";
    setDraft((current) => ({
      ...current,
      originMode: mode,
      warehouseId: firstW?.id ?? "",
      senderName: storeName,
      senderPhone: mode === "warehouse" ? phone : "",
      originCity: firstW?.city ?? "",
      originAddress: firstW?.address ?? "",
    }));
    setQuotes([]);
    setSelectedQuoteToken("");
    setAdminBreakdown(null);
  }

  function chooseWarehouse(id: string) {
    const warehouse = warehouses.find((item) => item.id === id);
    const phone = (warehouse as { phone?: string })?.phone || (user as { phone?: string })?.phone || "";
    const storeName = (user?.tenant && user.tenant !== "Mi organización" ? user.tenant : "") || user?.tenant || warehouse?.name || "";
    setDraft((current) => ({
      ...current,
      warehouseId: id,
      senderName: storeName,
      senderPhone: phone,
      originCity: warehouse?.city ?? "",
      originAddress: warehouse?.address ?? "",
    }));
    setQuotes([]);
    setSelectedQuoteToken("");
    setAdminBreakdown(null);
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
    setAdminBreakdown(null);
  }

  function changeProduct(product: Product, delta: number) {
    setSelectedItems((current) => {
      const existing = current[product.id] ?? {
        quantity: 0,
        unitPrice: product.price,
      };
      const quantity = Math.max(
        0,
        Math.min(product.stock, existing.quantity + delta)
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
    setAdminBreakdown(null);
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
    setAdminBreakdown(null);
  }

  function parcels() {
    const declaredVal =
      typeof draft.insuredValue === "number" && draft.insuredValue > 0
        ? draft.insuredValue
        : saleTotal;

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
        declaredValueMinor: Math.round(declaredVal * 100),
      },
    ];
  }

  function validationMessage(targetStep = step) {
    if (targetStep === 1) {
      if (draft.originMode === "warehouse" && !draft.warehouseId) {
        return "Por favor selecciona una bodega registrada de origen.";
      }
      if (!draft.senderName || draft.senderName.trim().length < 2) {
        return "Por favor ingresa el nombre o empresa del remitente (origen).";
      }
      if (!draft.senderPhone || draft.senderPhone.trim().length < 5) {
        if (draft.originMode === "warehouse") {
          return "La bodega seleccionada no tiene un número de teléfono/WhatsApp configurado. Por favor haz clic en 'Configurar teléfono en Bodegas' para agregarlo.";
        }
        return "Por favor ingresa un número de teléfono/WhatsApp válido para el remitente.";
      }
      if (!draft.originCity) {
        return "Por favor selecciona una ciudad de origen válida del listado desplegable de cobertura.";
      }
      if (!draft.originAddress || draft.originAddress.trim().length < 4) {
        return "Por favor ingresa la dirección exacta de origen.";
      }
      if (!draft.recipientName || draft.recipientName.trim().length < 2) {
        return "Por favor ingresa el nombre y apellido del destinatario.";
      }
      if (!draft.recipientPhone || draft.recipientPhone.trim().length < 5) {
        return "Por favor ingresa un número de teléfono/WhatsApp válido para el destinatario.";
      }
      if (!draft.destinationCity) {
        return "Por favor selecciona una ciudad de destino válida del listado desplegable de cobertura.";
      }
      if (!draft.destinationAddress || draft.destinationAddress.trim().length < 4) {
        return "Por favor ingresa la dirección exacta de destino.";
      }
    }
    if (targetStep === 2) {
      if (draft.productMode === "inventory" && productLines.length === 0) {
        return "Selecciona al menos un producto del inventario para enviar.";
      }
      if (draft.productMode === "generic" && (!draft.genericDescription || draft.packageQuantity < 1)) {
        return "Completa la descripción y cantidad del paquete genérico.";
      }
      if (
        draft.weightKg <= 0 ||
        draft.lengthCm <= 0 ||
        draft.widthCm <= 0 ||
        draft.heightCm <= 0
      ) {
        return "Ingresa el peso (kg) y las dimensiones (cm) válidas del paquete.";
      }
    }
    if (targetStep === 3 && !selectedQuoteToken) {
      return "Selecciona una opción de transportadora para continuar al resumen.";
    }
    return "";
  }

  function next() {
    const errorMsg = validationMessage(step);
    if (errorMsg) {
      setError(errorMsg);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 120, behavior: "smooth" });
      }
      return;
    }
    setError("");
    setStep((s) => Math.min(4, s + 1));
  }

  function back() {
    setError("");
    setStep((s) => Math.max(1, s - 1));
  }

  async function calculateQuotes() {
    const errorMsg = validationMessage(2);
    if (errorMsg) return setError(errorMsg);
    setError("");
    setQuoting(true);

    try {
      // Calculate rate breakdown for LAAR Courier
      const laarConfig = loadCarrierConfig("laar");
      const zeroMarginUsers = getZeroMarginUsers();
      const currentUserIdentifier = (user?.email || user?.name || "").trim().toLowerCase();
      const isZeroMargin = Boolean(
        currentUserIdentifier &&
          zeroMarginUsers.some((u) => {
            const cleanU = u.trim().toLowerCase();
            return cleanU && currentUserIdentifier === cleanU;
          })
      );

      const breakdown = calculateCarrierFreightRate({
        config: laarConfig,
        originCity: draft.originCity,
        destinationCity: draft.destinationCity,
        weightKg: draft.weightKg,
        codAmount: draft.paymentMode === "COD" ? draft.cod : 0,
        insuredValue: draft.insuredValue || 0,
        isZeroMarginUser: isZeroMargin,
      });

      setAdminBreakdown(breakdown);

      const response = await fetch("/api/shipping/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: {
            name: draft.senderName || "Remitente",
            phone: draft.senderPhone || "0999999999",
            country: "EC",
            city: draft.originCity,
            line1: draft.originAddress || "Dirección de Origen",
          },
          destination: {
            name: draft.recipientName || "Destinatario",
            phone: draft.recipientPhone || "0999999999",
            country: "EC",
            city: draft.destinationCity,
            line1: draft.destinationAddress || "Dirección de Destino",
            reference: draft.destinationReference || undefined,
          },
          parcels: parcels(),
          codMinor: draft.paymentMode === "COD" ? Math.round(draft.cod * 100) : 0,
          insuredValue: draft.insuredValue || 0,
        }),
      });

      if (!response.ok) {
        // Fallback live calculation if API route unavailable
        const laarQuote: Quote = {
          carrier: "LAAR Courier",
          carrierKey: "laar",
          service: "Entrega Estándar Puerta a Puerta",
          amount: breakdown.finalPriceToClient,
          currency: "USD",
          estimatedDays: 1,
          token: `laar-${Date.now()}`,
        };
        setQuotes([laarQuote]);
        setSelectedQuoteToken(laarQuote.token);
        return;
      }

      const body = (await response.json()) as { quotes?: Quote[] };
      const fetchedQuotes = body.quotes ?? [];

      if (fetchedQuotes.length > 0 && fetchedQuotes[0]) {
        setQuotes(fetchedQuotes);
        setSelectedQuoteToken(fetchedQuotes[0].token);
      } else {
        const laarQuote: Quote = {
          carrier: "LAAR Courier",
          carrierKey: "laar",
          service: "Entrega Estándar Puerta a Puerta",
          amount: breakdown.finalPriceToClient,
          currency: "USD",
          estimatedDays: 1,
          token: `laar-${Date.now()}`,
        };
        setQuotes([laarQuote]);
        setSelectedQuoteToken(laarQuote.token);
      }
    } catch (err) {
      console.error("Error al calcular cotizaciones:", err);
      setError("No se pudo obtener cotización de las transportadoras.");
    } finally {
      setQuoting(false);
    }
  }

  async function submit() {
    const errorMsg = validationMessage(3);
    if (errorMsg) return setError(errorMsg);
    if (!selectedQuote) return setError("Selecciona una opción de envío");
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originMode: draft.originMode,
          warehouseId: draft.warehouseId || undefined,
          senderName: draft.senderName,
          senderPhone: draft.senderPhone,
          originCity: draft.originCity,
          originAddress: draft.originAddress,
          recipientId: draft.recipientId || undefined,
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
          insuredValue: draft.insuredValue || 0,
          quoteToken: selectedQuote.token,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        tracking?: string;
        labelUrl?: string | null;
      };

      if (!response.ok) return setError(body.error ?? "No se pudo generar la guía");

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
    setAdminBreakdown(null);
    setSuccess(null);
    setError("");
  }

  return (
    <div className="max-w-6xl mx-auto">
      <ShippingHeader
        eyebrow="Operaciones Trajetix"
        title="Nuevo Envío"
        copy={`Paso ${step} de 4 — ${["Origen y destino", "Productos y Paquetes", "Transportadora y Costos", "Resumen y Confirmación"][step - 1]}`}
      />

      {/* Step Indicator Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex items-center justify-between">
          {["Origen y Destino", "Productos y Paquetes", "Transportadora", "Resumen"].map(
            (label, index) => {
              const stepNum = index + 1;
              const isCompleted = step > stepNum;
              const isActive = step === stepNum;
              return (
                <div key={label} className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      isCompleted
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                        : isActive
                        ? "bg-red-600 text-white shadow-md shadow-red-500/20 ring-4 ring-red-500/10"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : stepNum}
                  </div>
                  <span
                    className={`text-xs font-medium hidden sm:inline ${
                      isActive
                        ? "text-slate-900 dark:text-white font-semibold"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {label}
                  </span>
                  {index < 3 && (
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-700 hidden md:inline ml-2" />
                  )}
                </div>
              );
            }
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 dark:bg-red-950/50 border border-red-500/30 rounded-xl text-red-700 dark:text-red-300 text-xs font-bold flex items-center justify-between gap-3 shadow-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError("")}
            className="p-1 hover:bg-red-500/20 rounded-md transition-colors text-red-600 dark:text-red-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SUCCESS MODAL / BANNER */}
      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-8 text-center my-6 shadow-xl">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-emerald-900 dark:text-emerald-200 mb-1">
            ¡Guía Generada Exitosamente!
          </h2>
          <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-4">
            Número de rastreo asignado: <strong className="font-mono text-base">{success.tracking}</strong>
          </p>
          <div className="flex items-center justify-center gap-3">
            {(success.labelUrl || success.tracking) && (
              <a
                href={
                  success.labelUrl && !success.labelUrl.includes("laarcourier.com")
                    ? success.labelUrl
                    : `/api/shipments/label?tracking=${encodeURIComponent(success.tracking)}`
                }
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-md"
              >
                <FileText className="w-4 h-4" />
                Imprimir / Ver Guía PDF
              </a>
            )}
            <button
              type="button"
              onClick={reset}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold px-5 py-2.5 rounded-lg text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Crear Otro Envío
            </button>
          </div>
        </div>
      )}

      {/* STEP 1: ORIGEN Y DESTINO */}
      {!success && step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Remitente (Origen) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Store className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Remitente (Origen)
              </h2>
            </div>

            {/* Mode selection radio cards */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  draft.originMode === "warehouse"
                    ? "border-red-500 bg-red-50/50 dark:bg-red-950/20 text-slate-900 dark:text-white ring-2 ring-red-500/20"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                }`}
                onClick={() => selectOriginMode("warehouse")}
              >
                <b className="block text-xs font-bold mb-0.5">Mis Bodegas</b>
                <span className="block text-[11px] opacity-75">Despacha desde tu bodega</span>
              </button>

              <button
                type="button"
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  draft.originMode === "quick"
                    ? "border-red-500 bg-red-50/50 dark:bg-red-950/20 text-slate-900 dark:text-white ring-2 ring-red-500/20"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                }`}
                onClick={() => selectOriginMode("quick")}
              >
                <b className="block text-xs font-bold mb-0.5">Envío Rápido</b>
                <span className="block text-[11px] opacity-75">Origen manual directo</span>
              </button>
            </div>

            {draft.originMode === "warehouse" ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                    Bodega Registrada *
                  </label>
                  <select
                    value={draft.warehouseId}
                    onChange={(e) => chooseWarehouse(e.target.value)}
                    className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  >
                    <option value="">Seleccionar bodega registrada...</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        🏢 {w.name} ({w.code}) — {w.city}
                      </option>
                    ))}
                  </select>
                </div>

                {/* READ-ONLY WAREHOUSE DETAILS (NO EDITABLE INPUTS) */}
                {draft.warehouseId && draft.originCity ? (
                  <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-2">
                    <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-emerald-800/60 pb-2">
                      <div className="font-bold text-sm text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>{draft.senderName || "Bodega Registrada"}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-md uppercase">
                        Datos Cargados
                      </span>
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-300 space-y-2 pt-1">
                      <div>📍 <strong>Ciudad Origen:</strong> {draft.originCity}</div>
                      <div>🗺️ <strong>Dirección Exacta:</strong> {draft.originAddress}</div>
                      
                      {draft.senderPhone && draft.senderPhone.trim().length >= 5 ? (
                        <div className="pt-2 border-t border-emerald-200/40 dark:border-emerald-800/40 flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-medium">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                          <span><strong>Teléfono de Bodega:</strong> {draft.senderPhone}</span>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/60 space-y-2">
                          <div className="p-2.5 bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/20 rounded-lg flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <p className="font-semibold">Esta bodega no tiene un número de teléfono/WhatsApp configurado.</p>
                              <p className="text-[11px] opacity-90">Debes registrar el teléfono de la bodega en la pestaña de Bodegas para poder realizar envíos con esta ubicación.</p>
                            </div>
                          </div>
                          {onNavigateToWarehouses && (
                            <button
                              type="button"
                              onClick={() => onNavigateToWarehouses(draft.warehouseId)}
                              className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                            >
                              <span>⚙️ Configurar teléfono en Bodegas</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                    Selecciona una bodega registrada para cargar automáticamente su ciudad y dirección.
                  </p>
                )}
              </div>
            ) : (
              /* ENVÍO RÁPIDO: EDITABLE INPUT FIELDS */
              <>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                      Nombre / Empresa *
                    </label>
                    <input
                      type="text"
                      value={draft.senderName}
                      onChange={(e) => update("senderName", e.target.value)}
                      className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                      Teléfono / WhatsApp *
                    </label>
                    <input
                      type="text"
                      value={draft.senderPhone}
                      onChange={(e) => update("senderPhone", e.target.value)}
                      className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    />
                  </div>
                </div>

                <CitySelect
                  label="Ciudad / Cantón Origen"
                  value={draft.originCity}
                  onChange={(cityName) => update("originCity", cityName)}
                />

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                    Dirección Exacta *
                  </label>
                  <input
                    type="text"
                    value={draft.originAddress}
                    onChange={(e) => update("originAddress", e.target.value)}
                    placeholder="Av. 6 de Diciembre y Eloy Alfaro N34..."
                    className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                </div>
              </>
            )}

            {/* REMITENTE ORIGIN PICKUP COVERAGE DETECTOR */}
            {draft.originCity && (
              <div className="mt-3 p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/40 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300">
                    Cobertura de recolección en origen detectada: <strong className="text-slate-900 dark:text-white font-semibold">{draft.originCity}</strong>
                  </span>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold rounded-md uppercase tracking-wider flex-shrink-0">
                  ✓ Cobertura LAAR
                </span>
              </div>
            )}
          </div>

          {/* Destinatario */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Destinatario
              </h2>
            </div>

            {recipients.length > 0 && (
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Destinatarios Anteriores
                </label>
                <select
                  value={draft.recipientId}
                  onChange={(e) => chooseRecipient(e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                >
                  <option value="">＋ Agregar nuevo destinatario</option>
                  {recipients.map((r) => (
                    <option key={r.id} value={r.id}>
                      👤 {r.name} — {r.phone} ({r.city})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Nombre y Apellido *
                </label>
                <input
                  type="text"
                  value={draft.recipientName}
                  onChange={(e) => update("recipientName", e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Teléfono / WhatsApp *
                </label>
                <input
                  type="text"
                  value={draft.recipientPhone}
                  onChange={(e) => update("recipientPhone", e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>
            </div>

            <CitySelect
              label="Ciudad / Cantón Destino"
              value={draft.destinationCity}
              onChange={(cityName) => update("destinationCity", cityName)}
            />

            <div className="mb-3">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                Dirección Exacta *
              </label>
              <input
                type="text"
                value={draft.destinationAddress}
                onChange={(e) => update("destinationAddress", e.target.value)}
                placeholder="Calle Los Alisos y 10 de Agosto..."
                className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                Referencia de Entrega
              </label>
              <input
                type="text"
                value={draft.destinationReference}
                onChange={(e) => update("destinationReference", e.target.value)}
                placeholder="Frente a la farmacia, casa color blanco..."
                className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>

            {/* BOTÓN SOFISTICADO: GUARDAR DESTINATARIO PREDETERMINADO */}
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <button
                type="button"
                disabled={savingRecipient}
                onClick={() => void handleSaveDefaultRecipient()}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm active:scale-95"
              >
                {savingRecipient ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                    <span>Guardando destinatario...</span>
                  </>
                ) : recipientSavedNotice ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">¡Guardado como predeterminado!</span>
                  </>
                ) : (
                  <>
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    <span>⭐ Guardar como predeterminado</span>
                  </>
                )}
              </button>

              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Se guardará para accesos rápidos en futuros envíos
              </span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: PRODUCTOS Y PAQUETES */}
      {!success && step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Contenido del Paquete
              </h2>
            </div>

            {/* Mode selection tabs */}
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl mb-4">
              <button
                type="button"
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  draft.productMode === "inventory"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
                }`}
                onClick={() => update("productMode", "inventory")}
              >
                Mi Inventario
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  draft.productMode === "generic"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
                }`}
                onClick={() => update("productMode", "generic")}
              >
                Paquete Genérico
              </button>
            </div>

            {draft.productMode === "inventory" ? (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {products.map((p) => {
                  const line = selectedItems[p.id];
                  const qty = line?.quantity ?? 0;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-xl gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center border border-slate-200/80 dark:border-slate-700/60">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{p.name}</div>
                            {p.stock <= 0 && (
                              <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-md flex-shrink-0">
                                Stock 0
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-wrap mt-0.5">
                            <span>SKU: {p.sku}</span>
                            <span>·</span>
                            <span className={p.stock <= 0 ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
                              Stock: {p.stock} un.
                            </span>
                            <span>·</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{money(p.price)}</span>
                            <span>·</span>
                            <span className="text-slate-400 dark:text-slate-500 font-mono">
                              {p.weightKg ?? 1}kg ({p.lengthCm ?? 15}×{p.widthCm ?? 15}×{p.heightCm ?? 15}cm)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => changeProduct(p, -1)}
                          className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-bold text-sm text-slate-900 dark:text-white">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => changeProduct(p, 1)}
                          disabled={qty >= p.stock}
                          className="w-7 h-7 rounded-lg bg-red-600 text-white font-bold flex items-center justify-center hover:bg-red-700 transition-colors disabled:opacity-40"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                    Descripción del Contenido *
                  </label>
                  <input
                    type="text"
                    value={draft.genericDescription}
                    onChange={(e) => update("genericDescription", e.target.value)}
                    placeholder="Ropa, calzado, electrónicos..."
                    className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                      Cantidad de Paquetes *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={draft.packageQuantity}
                      onChange={(e) => update("packageQuantity", Number(e.target.value))}
                      className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                      Precio de Venta Unitario
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.genericSalePrice}
                      onChange={(e) => update("genericSalePrice", Number(e.target.value))}
                      className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {draft.productMode === "generic" && (
              <>
                <hr className="my-5 border-slate-200 dark:border-slate-800" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
                  Dimensiones y Peso del Bulto
                </h3>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">
                      Peso (kg) *
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={draft.weightKg}
                      onChange={(e) => update("weightKg", Number(e.target.value))}
                      className="w-full p-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">
                      Largo (cm) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={draft.lengthCm}
                      onChange={(e) => update("lengthCm", Number(e.target.value))}
                      className="w-full p-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">
                      Ancho (cm) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={draft.widthCm}
                      onChange={(e) => update("widthCm", Number(e.target.value))}
                      className="w-full p-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">
                      Alto (cm) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={draft.heightCm}
                      onChange={(e) => update("heightCm", Number(e.target.value))}
                      className="w-full p-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Summary Sidebar */}
          <div className="bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-6 h-fit shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
              Resumen de Productos
            </h3>

            {productLines.map((item) => (
              <div key={item.id} className="flex justify-between items-center py-2 border-b border-slate-200/60 dark:border-slate-800 text-xs">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</span>
                  <div className="text-[11px] text-slate-500">{item.quantity} ud.</div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">
                    {money(item.quantity * item.unitPrice)}
                  </span>
                </div>
              </div>
            ))}

            <div className="mt-4 pt-3 border-t border-slate-300 dark:border-slate-700 flex justify-between items-center text-sm font-bold text-slate-900 dark:text-white">
              <span>Total Venta Declara:</span>
              <span className="text-red-600 dark:text-red-400 font-mono text-base">{money(saleTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: TRANSPORTADORAS Y DESGLOSE ADMIN */}
      {!success && step === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Parámetros de cobro */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-red-600" />
                <span>Modalidad</span>
              </h2>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsCarrierModalOpen(true)}
                  className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                >
                  ⚙ Tarifas Trajetix
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                className={`py-2.5 px-3 rounded-lg border text-xs font-bold transition-all ${
                  draft.paymentMode === "COD"
                    ? "border-red-500 bg-red-50/50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600"
                }`}
                onClick={() => {
                  update("paymentMode", "COD");
                  if (!draft.cod || !isCodEdited.current) update("cod", saleTotal);
                }}
              >
                Con Recaudo
              </button>

              <button
                type="button"
                className={`py-2.5 px-3 rounded-lg border text-xs font-bold transition-all ${
                  draft.paymentMode === "NO_COD"
                    ? "border-red-500 bg-red-50/50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600"
                }`}
                onClick={() => {
                  update("paymentMode", "NO_COD");
                  update("cod", 0);
                }}
              >
                Sin Recaudo
              </button>
            </div>

            {draft.paymentMode === "COD" && (
              <>
                <div className="mb-3">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                    Valor Recaudo a Cobrar al Cliente *
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={draft.cod}
                      onChange={(e) => update("cod", Number(e.target.value))}
                      style={{ paddingLeft: "2.5rem" }}
                      className="w-full !pl-10 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                    />
                  </div>
                </div>

                {/* AVISO SUTIL Y PROFESIONAL DE POLÍTICA DE DEVOLUCIÓN */}
                <div className="mb-3 p-2.5 bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/20 rounded-lg flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Política de Retorno:</strong> En caso de que la entrega no sea efectuada (devolución), se debitará automáticamente de tu billetera el flete de retorno equivalente al valor del flete original.
                  </span>
                </div>
              </>
            )}

            {/* SEGURO DE ENVÍO */}
            <div className="mb-4 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Monto a Asegurar / Valor Declarado (1.5% - Opcional)
                </label>
                <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400">
                  {(draft.insuredValue || 0) > 0 ? money((draft.insuredValue || 0) * 0.015) : "$0.00"}
                </span>
              </div>

              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.insuredValue || ""}
                  placeholder="0.00 (Sin seguro)"
                  onChange={(e) => {
                    const raw = e.target.value;
                    const val = raw === "" ? 0 : Number(raw);
                    update("insuredValue", isNaN(val) || val < 0 ? 0 : val);
                  }}
                  style={{ paddingLeft: "2.5rem" }}
                  className="w-full !pl-10 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                />
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                {(draft.insuredValue || 0) > 0
                  ? `Costo del seguro: 1.5% del valor declarado (${money((draft.insuredValue || 0) * 0.015)}).`
                  : "Si se deja en $0.00 o vacío, el envío no incluirá seguro."}
              </p>
            </div>

            <button
              type="button"
              disabled={quoting}
              onClick={() => void calculateQuotes()}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2"
            >
              {quoting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Cotizando con LAAR Courier...</span>
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" />
                  <span>Recalcular Tarifas</span>
                </>
              )}
            </button>

            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs space-y-1 text-slate-600 dark:text-slate-400">
              <div><strong>Origen:</strong> {draft.originCity || "No seleccionado"}</div>
              <div><strong>Destino:</strong> {draft.destinationCity || "No seleccionado"}</div>
              <div><strong>Peso:</strong> {draft.weightKg.toFixed(2)} kg</div>
            </div>
          </div>

          {/* Opciones de Envío & Desglose Admin */}
          <div className="lg:col-span-2 space-y-4">
            {/* Direct Carrier Quote Selection */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Truck className="w-5 h-5 text-red-600" />
                <span>Opciones de Cotización Disponibles</span>
              </h2>

              {quotes.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/60 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <Calculator className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Haz clic en &quot;Recalcular Tarifas&quot; para obtener cotizaciones
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {quotes.map((q) => {
                    const isSelected = selectedQuoteToken === q.token;
                    const clientFreight = adminBreakdown
                      ? adminBreakdown.clientFreightCost
                      : q.amount;
                    const clientCod = adminBreakdown
                      ? adminBreakdown.clientCodCost
                      : 0;
                    const insuranceCost = adminBreakdown?.clientInsuranceCost ?? 0;
                    const subtotalClient = adminBreakdown?.subtotalClient ?? (clientFreight + clientCod + insuranceCost);
                    const ivaCost = adminBreakdown?.ivaCost ?? (subtotalClient * 0.15);
                    const displayAmount = adminBreakdown ? adminBreakdown.finalPriceToClient : q.amount;

                    return (
                      <div
                        key={q.token}
                        onClick={() => setSelectedQuoteToken(q.token)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all space-y-3 ${
                          isSelected
                            ? "border-red-500 bg-red-50/40 dark:bg-red-950/20 shadow-md ring-2 ring-red-500/20"
                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                              isSelected ? "bg-red-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                            }`}>
                              <Truck className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                <span>{q.carrier}</span>
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {q.service} {q.estimatedDays ? `· Entrega estimada: ${q.estimatedDays} día(s)` : ""}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                              {money(displayAmount)}
                            </div>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                              Precio Final Facturado (con IVA)
                            </span>
                          </div>
                        </div>

                        {/* Desglose de Flete, COD, Seguro e IVA 15% (Minimalista) */}
                        <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-4 flex-wrap">
                            <div>
                              <span>Flete: </span>
                              <span className="font-mono font-medium text-slate-900 dark:text-slate-200">
                                {money(clientFreight)}
                              </span>
                            </div>

                            {draft.paymentMode === "COD" && clientCod > 0 && (
                              <div>
                                <span>Comisión COD: </span>
                                <span className="font-mono font-medium text-slate-900 dark:text-slate-200">
                                  {money(clientCod)}
                                </span>
                              </div>
                            )}

                            {insuranceCost > 0 && (
                              <div>
                                <span>Seguro: </span>
                                <span className="font-mono font-medium text-slate-900 dark:text-slate-200">
                                  {money(insuranceCost)}
                                </span>
                              </div>
                            )}

                            <div>
                              <span>IVA (15%): </span>
                              <span className="font-mono font-medium text-slate-900 dark:text-slate-200">
                                {money(ivaCost)}
                              </span>
                            </div>
                          </div>

                          <div className="text-right font-mono font-bold text-slate-900 dark:text-white">
                            {money(displayAmount)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ADMIN COST BREAKDOWN PANEL (VISTA ADMINISTRADOR) */}
            {isAdmin && adminBreakdown && (
              <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Desglose de Costos & Márgenes (Vista Administrador)
                    </h3>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 rounded-md text-[10px] font-mono font-bold uppercase">
                    Zona LAAR: {adminBreakdown.zoneName}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Cost paid to LAAR */}
                  <div className="bg-slate-50/80 dark:bg-slate-950/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Pago a LAAR Courier</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>Flete Base LAAR:</span>
                        <span className="font-mono">{money(adminBreakdown.laarFreightCost)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>Comisión COD LAAR:</span>
                        <span className="font-mono">{money(adminBreakdown.laarCodCost)}</span>
                      </div>
                      <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 flex justify-between font-bold text-slate-900 dark:text-white">
                        <span>Costo Directo LAAR:</span>
                        <span className="font-mono text-blue-600 dark:text-blue-400">{money(adminBreakdown.laarTotalCost)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Profit earned by Trajetix */}
                  <div className="bg-slate-50/80 dark:bg-slate-950/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Ganancia Trajetix</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>Margen Flete:</span>
                        <span className="font-mono">+{money(adminBreakdown.freightMargin)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>Margen COD:</span>
                        <span className="font-mono">+{money(adminBreakdown.codMargin)}</span>
                      </div>
                      {adminBreakdown.insuranceCost > 0 && (
                        <div className="flex justify-between text-slate-600 dark:text-slate-300">
                          <span>Seguro (1.5%):</span>
                          <span className="font-mono">+{money(adminBreakdown.insuranceCost)}</span>
                        </div>
                      )}
                      <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 flex justify-between font-bold text-emerald-600 dark:text-emerald-400">
                        <span>Ganancia Neta ERP:</span>
                        <span className="font-mono">+{money(adminBreakdown.trajetixProfitTotal)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Final Price charged to merchant */}
                  <div className="bg-slate-50/80 dark:bg-slate-950/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                      <span>Cobro Final Cliente</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Subtotal (Flete + COD + Seguro):</span>
                        <span className="font-mono">{money(adminBreakdown.subtotalClient)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>+ IVA (15%):</span>
                        <span className="font-mono">+{money(adminBreakdown.ivaCost)}</span>
                      </div>
                      <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 flex justify-between font-bold text-slate-900 dark:text-white text-sm">
                        <span>Cobro Total (con IVA):</span>
                        <span className="font-mono text-red-600 dark:text-red-400">{money(adminBreakdown.finalPriceToClient)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 4: RESUMEN Y CONFIRMACIÓN */}
      {!success && step === 4 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Remitente Summary */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                1. Origen / Remitente
              </h3>
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                {draft.senderName} ({draft.senderPhone})
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                📍 {draft.originCity} — {draft.originAddress}
              </div>
            </div>

            {/* Destinatario Summary */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                2. Destino / Destinatario
              </h3>
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                {draft.recipientName} ({draft.recipientPhone})
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                📍 {draft.destinationCity} — {draft.destinationAddress}
              </div>
            </div>

            {/* Products Summary */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                3. Paquete y Productos
              </h3>
              <div className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                {draft.productMode === "inventory"
                  ? productLines.map((l) => `${l.quantity}x ${l.name}`).join(", ")
                  : draft.genericDescription}
              </div>
              <div className="text-xs text-slate-500">
                Peso: {draft.weightKg} kg · Valor Declarado: {money(saleTotal)}
              </div>

              {/* ESTIMADO A RECIBIR EN LIQUIDACIÓN */}
              {draft.paymentMode === "COD" && (draft.cod || 0) > 0 && (
                <div className="mt-3 pt-3 border-t border-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-950/50 -mx-5 -mb-5 p-4 rounded-b-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Liquidación Estimada en Billetera:
                    </span>
                    <span className="font-mono text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                      {money(Math.max(0, (draft.cod || 0) - (selectedQuote?.amount ?? adminBreakdown?.finalPriceToClient ?? 0)))}
                    </span>
                  </div>

                  <div className="text-[11px] space-y-0.5 text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span>Recaudo Total COD al Cliente:</span>
                      <span className="font-mono font-semibold">{money(draft.cod)}</span>
                    </div>
                    <div className="flex justify-between text-rose-600 dark:text-rose-400">
                      <span>- Total Flete a Debitar:</span>
                      <span className="font-mono font-semibold">-{money(selectedQuote?.amount ?? adminBreakdown?.finalPriceToClient ?? 0)}</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400/90 font-medium italic pt-1 border-t border-emerald-500/20">
                    ⚡ <strong>Abono Automático:</strong> Al cambiar la guía a estado <strong>Entregado</strong>, el dinero del recaudo se acreditará automáticamente a tu billetera como un movimiento de ingreso.
                  </div>
                </div>
              )}
            </div>

            {/* Carrier Summary */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                4. Transportadora Seleccionada
              </h3>
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                {selectedQuote?.carrier} — {selectedQuote?.service}
              </div>
              <div className="space-y-1.5 text-xs pt-2 border-t border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Flete Base:</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-slate-200">
                    {money(adminBreakdown ? adminBreakdown.clientFreightCost : (selectedQuote?.amount ?? 0))}
                  </span>
                </div>
                {draft.paymentMode === "COD" && (
                  <div className="flex justify-between">
                    <span>Comisión COD (Recaudo {money(draft.cod)}):</span>
                    <span className="font-mono font-medium text-slate-900 dark:text-slate-200">
                      {money(adminBreakdown ? adminBreakdown.clientCodCost : 0)}
                    </span>
                  </div>
                )}
                {(draft.insuredValue || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Seguro (1.5% de {money(draft.insuredValue)}):</span>
                    <span className="font-mono font-medium text-slate-900 dark:text-slate-200">
                      {money(adminBreakdown ? adminBreakdown.clientInsuranceCost : draft.insuredValue * 0.015)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                  <span>Subtotal:</span>
                  <span className="font-mono">
                    {money(adminBreakdown ? adminBreakdown.subtotalClient : 0)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>IVA (15%):</span>
                  <span className="font-mono">
                    {money(adminBreakdown ? adminBreakdown.ivaCost : 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 text-xs font-bold border-t border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
                  <span>Total Flete a Debitar (con IVA):</span>
                  <span className="font-mono text-base text-red-600 dark:text-red-400">
                    {money(selectedQuote?.amount ?? adminBreakdown?.finalPriceToClient ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="w-full py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-xl shadow-red-500/25 transition-all flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Generando Guía Oficial con LAAR Courier...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Confirmar y Crear Guía de Envío</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Navigation Buttons */}
      {!success && (
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            disabled={step === 1 || saving}
            onClick={back}
            className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            ← Paso Anterior
          </button>

          {step < 4 && (
            <button
              type="button"
              onClick={next}
              className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>Siguiente Paso</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Modal de Tarifas si se requiere */}
      <CarrierConfigModal
        isOpen={isCarrierModalOpen}
        onClose={() => setIsCarrierModalOpen(false)}
      />
    </div>
  );
}

type Shipment = {
  id: string;
  orderId: string;
  carrier: string;
  service?: string;
  tracking: string;
  status: string;
  eta: string;
  sender?: { name?: string; city?: string };
  origin?: { name?: string; phone?: string; city?: string; line1?: string; warehouseId?: string | null };
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
  trackingEvents?: Array<{
    status: string;
    description?: string;
    location?: string;
    occurredAt?: string;
    raw?: unknown;
  }>;
  metadata?: {
    manifestId?: string | null;
    manifestCreatedAt?: string | null;
    [key: string]: unknown;
  };
};

type ShipmentFilters = {
  search: string;
  carrier: string;
  status: string;
  city: string;
  guide: string;
  from: string;
  to: string;
};

type ManifestHistoryItem = {
  manifestId: string;
  createdAt: string;
  shipments: Shipment[];
  carriers: string[];
  totalPackages: number;
  totalWeight: number;
  totalCod: number;
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

function isShipmentSelectableForManifest(shipment: Shipment) {
  if (shipment.metadata?.manifestId) return false;
  const ineligible = ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"];
  if (ineligible.includes((shipment.status || "").toUpperCase())) return false;
  return true;
}

function DispatchFloatingIsland({
  selectedCount,
  totalPackages,
  totalCod,
  isGenerating,
  onGenerate,
  onClear,
}: {
  selectedCount: number;
  totalPackages: number;
  totalCod: number;
  isGenerating: boolean;
  onGenerate: () => void;
  onClear: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md text-white border border-slate-700/80 rounded-2xl shadow-2xl px-5 py-3.5 flex items-center gap-5 md:gap-8 font-sans max-w-xl w-[92vw] md:w-auto justify-between transition-all animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 font-bold text-sm">
          {selectedCount}
        </div>
        <div className="text-xs space-y-0.5">
          <p className="font-bold text-white text-sm leading-none">
            {selectedCount} {selectedCount === 1 ? "envío seleccionado" : "envíos seleccionados"}
          </p>
          <p className="text-slate-400 text-[11px]">
            {totalPackages} {totalPackages === 1 ? "paquete" : "paquetes"} · Recaudo COD:{" "}
            <strong className="text-emerald-400 font-bold">{money(totalCod)}</strong>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-slate-400 hover:text-white transition-colors underline hidden sm:inline"
        >
          Desmarcar
        </button>
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          <span>Generar Relación</span>
        </button>
      </div>
    </div>
  );
}

function DispatchHistoryModal({
  onClose,
  onViewManifest,
}: {
  onClose: () => void;
  onViewManifest: (shipments: Shipment[]) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [manifests, setManifests] = useState<ManifestHistoryItem[]>([]);

  useEffect(() => {
    fetch("/api/shipments/manifests")
      .then((res) => res.json())
      .then((data) => {
        setManifests(data.manifests || []);
      })
      .catch((err) => console.error("Error al cargar historial de manifiestos:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/90">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Historial de Relaciones de Despacho
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-red-600" />
              <p className="text-xs">Cargando manifiestos anteriores...</p>
            </div>
          ) : manifests.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <p className="text-2xl">📜</p>
              <p className="font-semibold text-sm">No se han generado relaciones de despacho aún</p>
              <p className="text-xs opacity-75">
                Selecciona las guías elegibles en &quot;Mis envíos&quot; y genera tu primera relación de despacho.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {manifests.map((m) => (
                <div
                  key={m.manifestId}
                  className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm font-mono text-red-600 dark:text-red-400">
                        {m.manifestId}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px] font-bold">
                        {m.carriers.join(", ") || "LAAR Courier"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      📅 {new Date(m.createdAt).toLocaleString("es-EC")} · 📦 {m.shipments.length} guías ({m.totalPackages} paquetes) · COD: <strong className="text-emerald-600 dark:text-emerald-400">{money(m.totalCod)}</strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onViewManifest(m.shipments);
                    }}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Ver / Imprimir</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DispatchManifestModal({
  shipments,
  user,
  warehouses,
  onClose,
}: {
  shipments: Shipment[];
  user?: { name?: string; email?: string; role?: string; tenant?: string; permissions?: string[] } | undefined;
  warehouses?: Warehouse[] | undefined;
  onClose: () => void;
}) {
  const merchantName = user?.tenant && user.tenant !== "Mi organización" ? user.tenant : "Trajetix Logistics";
  const nowStr = new Date().toLocaleString("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const manifestId = useMemo(
    () => `MAN-${Math.floor(100000 + Math.random() * 900000)}`,
    [],
  );

  const totalShipments = shipments.length;
  const totalPackages = shipments.reduce(
    (sum, s) =>
      sum +
      (s.packages ?? []).reduce((pSum, p) => pSum + (p.quantity ?? 1), 0),
    0,
  );
  const totalWeight = shipments.reduce((sum, s) => sum + shipmentWeight(s), 0);
  const totalCod = shipments.reduce((sum, s) => sum + (s.cod ?? 0), 0);

  const originSample = shipments[0]?.origin;
  const primaryWarehouse = warehouses && warehouses.length > 0 ? warehouses[0] : null;
  const originName = originSample?.name || merchantName;
  const originCity = originSample?.city || primaryWarehouse?.city || "";
  const originAddress = originSample?.line1 || primaryWarehouse?.address || "";
  const originPhone = originSample?.phone || primaryWarehouse?.phone || "";

  const carriers = [...new Set(shipments.map((s) => s.carrier).filter(Boolean))];
  const carrierText = carriers.length > 0 ? carriers.join(", ") : "LAAR Courier / Operador Logístico";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto font-sans">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #dispatch-manifest-print-area, #dispatch-manifest-print-area * {
            visibility: visible !important;
          }
          #dispatch-manifest-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: #0f172a !important;
            padding: 12mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
        <div className="no-print p-4 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Relación de Despacho ({totalShipments} envíos)
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl shadow transition-colors flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Imprimir / Guardar PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 md:p-8 overflow-y-auto space-y-6 bg-white text-slate-900" id="dispatch-manifest-print-area">
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div>
              <span className="text-[11px] font-extrabold tracking-widest text-red-600 uppercase">
                TRAJETIX LOGISTICS ERP · N° {manifestId}
              </span>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                RELACIÓN DE DESPACHO / MANIFIESTO DE CARGA
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Documento oficial de entrega física y transferencia de custodia entre el Remitente y el Courier.
              </p>
            </div>
            <div className="text-right text-xs space-y-1 text-slate-700">
              <div><strong>Fecha / Hora:</strong> {nowStr}</div>
              <div><strong>Transportadora:</strong> <span className="font-bold text-red-600">{carrierText}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div>
              <span className="font-bold text-slate-500 text-[10px] uppercase block mb-1">DATOS DEL REMITENTE / COMERCIO</span>
              <p className="font-bold text-slate-900 text-sm">{originName}</p>
              <p className="text-slate-600">📍 <strong>Origen:</strong> {originCity} — {originAddress}</p>
              {originPhone && <p className="text-slate-600">📞 <strong>Teléfono:</strong> {originPhone}</p>}
            </div>
            <div>
              <span className="font-bold text-slate-500 text-[10px] uppercase block mb-1">RESUMEN DEL DESPACHO</span>
              <div className="grid grid-cols-2 gap-2 text-slate-700 pt-1">
                <div>📦 <strong>Total Paquetes:</strong> {totalPackages}</div>
                <div>⚖️ <strong>Peso Total:</strong> {totalWeight.toFixed(2)} kg</div>
                <div>🏷️ <strong>Total Guías:</strong> {totalShipments}</div>
                <div>💰 <strong>Recaudo COD:</strong> <span className="font-bold text-emerald-700">{money(totalCod)}</span></div>
              </div>
            </div>
          </div>

          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10px]">
                  <th className="p-2 text-center border-r border-slate-200 w-8">#</th>
                  <th className="p-2 border-r border-slate-200">Guía / Tracking</th>
                  <th className="p-2 border-r border-slate-200">Referencia</th>
                  <th className="p-2 border-r border-slate-200">Destinatario</th>
                  <th className="p-2 border-r border-slate-200">Ciudad Destino</th>
                  <th className="p-2 border-r border-slate-200">Contenido / Prod.</th>
                  <th className="p-2 text-center border-r border-slate-200">Peso (kg)</th>
                  <th className="p-2 text-right border-r border-slate-200">Cobro COD ($)</th>
                  <th className="p-2 text-center w-12">Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {shipments.map((item, idx) => {
                  const contentDesc =
                    item.packages?.map((p) => `${p.quantity || 1}x ${p.description || "Paquete"}`).join(", ") ||
                    "Mercadería";
                  const isCod = (item.cod ?? 0) > 0;
                  return (
                    <tr key={item.id} className={idx % 2 === 1 ? "bg-slate-50/60" : "bg-white"}>
                      <td className="p-2 text-center font-bold text-slate-500 border-r border-slate-200">{idx + 1}</td>
                      <td className="p-2 font-extrabold text-slate-900 border-r border-slate-200 tracking-wide font-mono">
                        {item.tracking || item.orderId}
                      </td>
                      <td className="p-2 text-slate-600 border-r border-slate-200">{item.orderId}</td>
                      <td className="p-2 border-r border-slate-200">
                        <strong className="block text-slate-900">{item.recipient?.name || "Sin nombre"}</strong>
                        <span className="text-[10px] text-slate-500">{item.recipient?.phone || ""}</span>
                      </td>
                      <td className="p-2 font-medium border-r border-slate-200">{item.address?.city || "—"}</td>
                      <td className="p-2 text-slate-600 border-r border-slate-200 max-w-[150px] truncate" title={contentDesc}>
                        {contentDesc}
                      </td>
                      <td className="p-2 text-center border-r border-slate-200">{shipmentWeight(item).toFixed(2)}</td>
                      <td className="p-2 text-right border-r border-slate-200">
                        {isCod ? (
                          <strong className="text-emerald-700 font-bold">{money(item.cod!)}</strong>
                        ) : (
                          <span className="text-slate-400">$0.00</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <div className="w-4 h-4 border border-slate-400 rounded mx-auto"></div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-900">
                  <td colSpan={6} className="p-2.5 text-right border-r border-slate-300 uppercase text-[10px]">
                    Totales Generales ({totalShipments} guías)
                  </td>
                  <td className="p-2.5 text-center border-r border-slate-300">{totalWeight.toFixed(2)} kg</td>
                  <td className="p-2.5 text-right border-r border-slate-300 text-emerald-800 font-black">{money(totalCod)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg text-[11px] text-amber-900 leading-snug">
            <strong>Declaración de Transferencia y Custodia:</strong> El transportista / courier autoriza la firma de este documento declarando recibir de conformidad los paquetes detallados en este manifiesto en buen estado, cerrados y rotulados. Ambas partes acuerdan que este registro físico constituye constancia irrevocable del retiro de la paquetería.
          </div>

          <div className="grid grid-cols-2 gap-8 pt-4">
            <div className="border border-slate-300 rounded-xl p-4 space-y-3 bg-slate-50/30">
              <div className="border-b border-slate-200 pb-2">
                <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider">
                  1. ENTREGADO POR (REMITENTE / TIENDA)
                </h4>
                <p className="text-[10px] text-slate-500">Firma del encargado que entrega la mercadería</p>
              </div>

              <div className="space-y-2 text-xs pt-1">
                <div className="flex items-center gap-1 text-slate-700">
                  <span className="w-28 text-slate-500 font-medium">Nombre Completo:</span>
                  <span className="border-b border-slate-300 flex-1 font-semibold text-slate-900">{originName}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-700">
                  <span className="w-28 text-slate-500 font-medium">Cédula / RUC:</span>
                  <span className="border-b border-slate-300 flex-1">___________________________</span>
                </div>
                <div className="flex items-center gap-1 text-slate-700">
                  <span className="w-28 text-slate-500 font-medium">Hora de Entrega:</span>
                  <span className="border-b border-slate-300 flex-1">___________________________</span>
                </div>
              </div>

              <div className="pt-8 text-center">
                <div className="border-t border-slate-400 w-3/4 mx-auto pt-1 text-slate-700 text-xs font-bold">
                  Firma del Cliente / Despachador
                </div>
              </div>
            </div>

            <div className="border border-slate-300 rounded-xl p-4 space-y-3 bg-slate-50/30">
              <div className="border-b border-slate-200 pb-2">
                <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-red-600">
                  2. RECIBIDO POR (TRANSPORTISTA / COURIER)
                </h4>
                <p className="text-[10px] text-slate-500">Firma del conductor o repartidor que retira</p>
              </div>

              <div className="space-y-2 text-xs pt-1">
                <div className="flex items-center gap-1 text-slate-700">
                  <span className="w-28 text-slate-500 font-medium">Transportadora:</span>
                  <span className="border-b border-slate-300 flex-1 font-bold text-red-700">{carrierText}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-700">
                  <span className="w-28 text-slate-500 font-medium">Nombre Chofer:</span>
                  <span className="border-b border-slate-300 flex-1">___________________________</span>
                </div>
                <div className="flex items-center gap-1 text-slate-700">
                  <span className="w-28 text-slate-500 font-medium">Cédula / Placa:</span>
                  <span className="border-b border-slate-300 flex-1">___________________________</span>
                </div>
                <div className="flex items-center gap-1 text-slate-700">
                  <span className="w-28 text-slate-500 font-medium">Hora de Retiro:</span>
                  <span className="border-b border-slate-300 flex-1">___________________________</span>
                </div>
              </div>

              <div className="pt-6 text-center">
                <div className="border-t border-slate-400 w-3/4 mx-auto pt-1 text-slate-700 text-xs font-bold">
                  Firma y Sello del Transportista
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MyShipmentsModule({
  shipments,
  query,
  onNew,
  onRefresh,
  user,
  warehouses,
}: {
  shipments: Shipment[];
  query: string;
  onNew: () => void;
  onRefresh?: () => void;
  user?: { name?: string; email?: string; role?: string; tenant?: string; permissions?: string[] } | undefined;
  warehouses?: Warehouse[] | undefined;
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
  const [cancelingShipment, setCancelingShipment] = useState<Shipment | null>(null);
  const [resolvingNoveltyShipment, setResolvingNoveltyShipment] = useState<Shipment | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showManifestModal, setShowManifestModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isGeneratingManifest, setIsGeneratingManifest] = useState(false);
  const [activeManifestShipments, setActiveManifestShipments] = useState<Shipment[] | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);

  async function handleSyncNow() {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/cron/sync-shipments?secret=trajetix-cron-secret-2026");
      if (res.ok) {
        if (onRefresh) onRefresh();
        else window.location.reload();
      }
    } catch (err) {
      console.error("Error al sincronizar guías en vivo:", err);
    } finally {
      setIsSyncing(false);
    }
  }

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

  const selectableFiltered = useMemo(
    () => filtered.filter(isShipmentSelectableForManifest),
    [filtered],
  );

  const isAllSelectableChecked = useMemo(() => {
    if (selectableFiltered.length === 0) return false;
    return selectableFiltered.every((item) => selectedIds.includes(item.id));
  }, [selectableFiltered, selectedIds]);

  const toggleSelectAll = () => {
    if (isAllSelectableChecked) {
      setSelectedIds((prev) => prev.filter((id) => !selectableFiltered.some((item) => item.id === id)));
    } else {
      const newIds = new Set([...selectedIds, ...selectableFiltered.map((item) => item.id)]);
      setSelectedIds(Array.from(newIds));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectedShipments = useMemo(
    () => shipments.filter((s) => selectedIds.includes(s.id)),
    [shipments, selectedIds],
  );

  const floatingPackagesCount = useMemo(
    () =>
      selectedShipments.reduce(
        (sum, s) =>
          sum + (s.packages ?? []).reduce((pSum, p) => pSum + (p.quantity ?? 1), 0),
        0,
      ),
    [selectedShipments],
  );

  const floatingTotalCod = useMemo(
    () => selectedShipments.reduce((sum, s) => sum + (s.cod ?? 0), 0),
    [selectedShipments],
  );

  async function handleGenerateManifest(targetShipments?: Shipment[]) {
    const target = targetShipments || selectedShipments;
    if (target.length === 0) return;

    setIsGeneratingManifest(true);
    try {
      const res = await fetch("/api/shipments/manifests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentIds: target.map((s) => s.id) }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "No se pudo registrar la relación de despacho");
        setIsGeneratingManifest(false);
        return;
      }

      const manifestId = data.manifestId;
      const manifestCreatedAt = data.manifestCreatedAt;

      const updatedTarget = target.map((s) => ({
        ...s,
        metadata: {
          ...(s.metadata || {}),
          manifestId,
          manifestCreatedAt,
        },
      }));

      if (onRefresh) onRefresh();

      setActiveManifestShipments(updatedTarget);
      setSelectedIds((prev) => prev.filter((id) => !target.some((t) => t.id === id)));
    } catch (err) {
      console.error("Error generating manifest:", err);
      alert("Ocurrió un error al generar la relación de despacho.");
    } finally {
      setIsGeneratingManifest(false);
    }
  }

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
        <div className="flex items-center gap-2">
          <button
            className="secondary-button flex items-center gap-1.5 font-medium"
            type="button"
            onClick={() => setShowHistoryModal(true)}
            title="Ver relaciones de despacho anteriores y reimprimir"
          >
            <Receipt className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            <span>Historial de Despachos</span>
          </button>
          <button className="primary-button" onClick={onNew}>
            ＋ Nuevo envío
          </button>
        </div>
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
        <div className="shipment-filter-footer flex items-center justify-between flex-wrap gap-2">
          <strong>{filtered.length} despachos encontrados</strong>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="secondary-button flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              type="button"
              onClick={() => {
                if (selectedIds.length > 0) {
                  void handleGenerateManifest();
                } else if (selectableFiltered.length > 0) {
                  void handleGenerateManifest(selectableFiltered);
                } else {
                  alert("No hay guías elegibles seleccionadas ni filtradas para generar una relación de despacho.");
                }
              }}
              disabled={filtered.length === 0 || isGeneratingManifest}
              title="Generar e imprimir Relación de Despacho (Manifiesto con firmas) para el courier"
            >
              {isGeneratingManifest ? (
                <Loader2 className="w-4 h-4 animate-spin text-red-600" />
              ) : (
                <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
              )}
              <span>Relación de Despacho {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}</span>
            </button>

            <button
              className="secondary-button flex items-center gap-1.5 font-medium"
              type="button"
              onClick={handleSyncNow}
              disabled={isSyncing}
              title="Sincronizar en vivo el estado actual de todas las guías con las transportadoras"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-amber-500" : ""}`} />
              {isSyncing ? "Sincronizando..." : "Sincronizar Estados"}
            </button>
            <button className="secondary-button" type="button" onClick={clearFilters}>
              Limpiar filtros
            </button>
          </div>
        </div>
      </section>

      <section className="panel table-panel shipment-management-panel">
        <div className="w-full overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelectableChecked}
                    onChange={toggleSelectAll}
                    disabled={selectableFiltered.length === 0}
                    className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Seleccionar / deseleccionar todos los despachos elegibles"
                  />
                </TableHead>
                <TableHead>Guía / referencia</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Destinatario</TableHead>
                <TableHead>Peso / valor</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const generated = hasGeneratedGuide(item);
                const weight = shipmentWeight(item);
                const isSelected = selectedIds.includes(item.id);
                const isSelectable = isShipmentSelectableForManifest(item);
                const manifestCode = item.metadata?.manifestId;

                return (
                  <Fragment key={item.id}>
                    <TableRow className={isSelected ? "bg-red-50/40 dark:bg-red-950/20" : ""}>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!isSelectable}
                          onChange={() => toggleSelectOne(item.id)}
                          className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title={
                            manifestCode
                              ? `Ya pertenece al Manifiesto #${manifestCode}`
                              : !isSelectable
                              ? `No elegible para despacho (Estado: ${item.status})`
                              : "Seleccionar para relación de despacho"
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <strong className="shipment-guide font-bold text-slate-900 dark:text-slate-100">
                            {generated ? item.tracking : item.orderId}
                          </strong>
                          {manifestCode && (
                            <span
                              className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px] font-bold border border-slate-200 dark:border-slate-700"
                              title={`Manifiesto asignado #${manifestCode}`}
                            >
                              📄 {manifestCode}
                            </span>
                          )}
                        </div>
                        <small className="text-slate-500 block text-[11px]">{item.orderId}</small>
                      </TableCell>
                      <TableCell>
                        <strong className="block text-slate-900 dark:text-slate-100">{item.carrier || "Por asignar"}</strong>
                        <small className="text-slate-500 block text-[11px]">{item.service || "Servicio por confirmar"}</small>
                      </TableCell>
                      <TableCell>
                        <strong className="block text-slate-900 dark:text-slate-100">{item.recipient?.name ?? "Sin destinatario"}</strong>
                        <small className="text-slate-500 block text-[11px]">
                          {[item.address?.city, item.address?.line1]
                            .filter(Boolean)
                            .join(" · ") || "Sin dirección"}
                        </small>
                      </TableCell>
                      <TableCell>
                        <strong className="block text-slate-900 dark:text-slate-100">{weight.toFixed(2)} kg</strong>
                        <small className="text-slate-500 block text-[11px]">{money(shipmentValue(item))}</small>
                        {(item.cod ?? 0) > 0 && <em className="cod-badge">COD</em>}
                      </TableCell>
                      <TableCell>
                        <strong className="block text-slate-900 dark:text-slate-100">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleDateString("es-EC")
                            : "—"}
                        </strong>
                        <small className="text-slate-500 block text-[11px]">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleTimeString("es-EC", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </small>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`shipment-status shipment-status-${shipmentStatusClass(item.status)}`}
                          >
                            {shipmentStatusLabel(item.status)}
                          </span>
                          {item.status === "EXCEPTION" && (
                            <button
                              type="button"
                              onClick={() => setResolvingNoveltyShipment(item)}
                              className="px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[0.65rem] font-bold inline-flex items-center gap-1 transition-colors animate-pulse"
                            >
                              <AlertCircle className="w-3 h-3 text-amber-400" />
                              Resolver Novedad
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors inline-flex items-center gap-1 border border-slate-200 dark:border-slate-800"
                              title="Opciones de acción"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 font-sans">
                            {(item.labelUrl || item.tracking) && (
                              <DropdownMenuItem asChild>
                                <a
                                  href={
                                    item.labelUrl && !item.labelUrl.includes("laarcourier.com")
                                      ? item.labelUrl
                                      : `/api/shipments/label?id=${item.id}&tracking=${encodeURIComponent(item.tracking)}`
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200 cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                                  <span>Ver / Imprimir Guía</span>
                                </a>
                              </DropdownMenuItem>
                            )}

                            {generated && (
                              <DropdownMenuItem asChild>
                                <a
                                  href={`/tracking?guia=${encodeURIComponent(item.tracking)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200 cursor-pointer"
                                >
                                  <Truck className="w-3.5 h-3.5 text-emerald-500" />
                                  <span>Rastrear Envío</span>
                                </a>
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuItem
                              onClick={() => setExpanded((current) => (current === item.id ? null : item.id))}
                              className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-400" />
                              <span>{expanded === item.id ? "Ocultar Detalle" : "Ver Detalle"}</span>
                            </DropdownMenuItem>

                            {item.status === "EXCEPTION" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setResolvingNoveltyShipment(item)}
                                  className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400 font-semibold cursor-pointer"
                                >
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Resolver Novedad</span>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {expanded === item.id && (
                      <TableRow className="bg-slate-50/80 dark:bg-slate-900/80">
                        <TableCell colSpan={8}>
                          <div className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div>
                              <small className="text-slate-500 block uppercase font-bold text-[10px]">Remitente</small>
                              <strong className="text-slate-900 dark:text-slate-100 block font-semibold">{item.sender?.name || item.origin?.name || "No registrado"}</strong>
                              <em className="text-slate-500 not-italic block">{item.sender?.city || item.origin?.city || ""}</em>
                            </div>
                            <div>
                              <small className="text-slate-500 block uppercase font-bold text-[10px]">Destinatario</small>
                              <strong className="text-slate-900 dark:text-slate-100 block font-semibold">{item.recipient?.name || "No registrado"}</strong>
                              <em className="text-slate-500 not-italic block">{item.recipient?.phone || ""}</em>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
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

      {/* Floating Action Island for selected shipments */}
      {selectedIds.length > 0 && (
        <DispatchFloatingIsland
          selectedCount={selectedIds.length}
          totalPackages={floatingPackagesCount}
          totalCod={floatingTotalCod}
          isGenerating={isGeneratingManifest}
          onGenerate={() => void handleGenerateManifest()}
          onClear={() => setSelectedIds([])}
        />
      )}

      {/* Manifest History Modal */}
      {showHistoryModal && (
        <DispatchHistoryModal
          onClose={() => setShowHistoryModal(false)}
          onViewManifest={(manifestShipments) => {
            setActiveManifestShipments(manifestShipments);
          }}
        />
      )}

      {/* Active Manifest Modal (for printing) */}
      {(activeManifestShipments || showManifestModal) && (
        <DispatchManifestModal
          shipments={
            activeManifestShipments ||
            (selectedIds.length > 0
              ? shipments.filter((s) => selectedIds.includes(s.id))
              : selectableFiltered)
          }
          user={user}
          warehouses={warehouses}
          onClose={() => {
            setActiveManifestShipments(null);
            setShowManifestModal(false);
          }}
        />
      )}

      {cancelingShipment && (
        <CancelShipmentModal
          shipment={cancelingShipment}
          onClose={() => setCancelingShipment(null)}
          onSuccess={() => {
            window.location.reload();
          }}
        />
      )}

      {resolvingNoveltyShipment && (
        <ResolveNoveltyModal
          shipment={resolvingNoveltyShipment}
          onClose={() => setResolvingNoveltyShipment(null)}
          onSuccess={() => {
            if (onRefresh) onRefresh();
            else window.location.reload();
          }}
        />
      )}
    </>
  );
}

function ResolveNoveltyModal({
  shipment,
  onClose,
  onSuccess,
}: {
  shipment: Shipment;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const address = (shipment.address as Record<string, unknown>) || {};
  const recipient = (shipment.recipient as Record<string, unknown>) || {};

  const [action, setAction] = useState<"RETRY_DELIVERY" | "RETURN_TO_SENDER">("RETRY_DELIVERY");
  const [callePrincipal, setCallePrincipal] = useState((address.line1 as string) || "");
  const [numeracion, setNumeracion] = useState("");
  const [calleSecundaria, setCalleSecundaria] = useState((address.line2 as string) || "");
  const [referencia, setReferencia] = useState((address.reference as string) || "");
  const [telefono, setTelefono] = useState((recipient.phone as string) || "");
  const [observacion, setObservacion] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [noveltyDetail, setNoveltyDetail] = useState<{
    title: string;
    description?: string;
    date?: string;
    location?: string;
  } | null>(null);
  const [loadingNovelty, setLoadingNovelty] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // 1. Try extracting from local trackingEvents first
    const events = shipment.trackingEvents || [];
    for (const event of events) {
      const raw = event.raw as any;
      if (raw?.novedades && Array.isArray(raw.novedades) && raw.novedades.length > 0) {
        const nov = raw.novedades[raw.novedades.length - 1];
        if (nov) {
          setNoveltyDetail({
            title: nov.nombreTipoNovedad || nov.tipoNovedad || "Excepción en Entrega",
            description: nov.observacion || nov.nombreDetalleNovedad || "",
            date: nov.fechaNovedad ? new Date(nov.fechaNovedad).toLocaleString("es-EC") : "",
            location: nov.regionalNovedad || event.location || "",
          });
          break;
        }
      }
      if (raw?.imagenes && Array.isArray(raw.imagenes) && raw.imagenes.length > 0) {
        const img = raw.imagenes.find((i: any) => i.novedad);
        if (img) {
          setNoveltyDetail({
            title: img.novedad || "Con Novedad",
            description: `Reportado por transportista (${img.tipo || "Distribución"})`,
            date: img.fecha || "",
            location: event.location || "",
          });
          break;
        }
      }
    }

    // 2. Fetch live tracking data for freshest courier novelty status
    if (shipment.tracking) {
      fetch(`/api/tracking/${encodeURIComponent(shipment.tracking)}`)
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted) return;
          const laarNovs = data?.laarData?.novedades;
          if (Array.isArray(laarNovs) && laarNovs.length > 0) {
            const nov = laarNovs[laarNovs.length - 1];
            if (nov) {
              setNoveltyDetail({
                title: nov.nombreTipoNovedad || nov.nombre || "Novedad en la Entrega",
                description: nov.observacion || nov.nombreDetalleNovedad || "",
                date: nov.fechaNovedad || nov.fecha || "",
                location: nov.regionalNovedad || data?.laarData?.ciudadDestino || "",
              });
            }
          } else if (data?.laarData?.imagenes && Array.isArray(data.laarData.imagenes)) {
            const img = data.laarData.imagenes.find((i: any) => i.novedad);
            if (img) {
              setNoveltyDetail({
                title: img.novedad || "Con Novedad",
                description: `Registrado en distribución`,
                date: img.fecha || "",
                location: data?.laarData?.ciudadDestino || "",
              });
            }
          }
        })
        .catch((err) => console.error("Error consultando novedad en vivo:", err))
        .finally(() => {
          if (isMounted) setLoadingNovelty(false);
        });
    } else {
      setLoadingNovelty(false);
    }

    return () => {
      isMounted = false;
    };
  }, [shipment]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!observacion.trim()) {
      return setError("Por favor ingresa una indicación u observación para la transportadora");
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/shipments/resolve-novelty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: shipment.id,
          action,
          callePrincipal,
          numeracion,
          calleSecundaria,
          referencia,
          telefono,
          observacion,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo resolver la novedad");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al procesar la solución de la novedad");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal max-w-xl w-full" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <span className="eyebrow text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-bold">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          GESTIÓN DE NOVEDAD LAAR COURIER
        </span>
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-1">Solucionar Novedad de Guía</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 mb-3">
          Guía: <strong className="font-mono text-slate-900 dark:text-white font-bold">{shipment.tracking || shipment.id}</strong> · Destinatario: <strong className="text-slate-900 dark:text-slate-100 font-bold">{(recipient.name as string) || "Cliente"}</strong>
        </p>

        {/* Dynamic Novelty Details Banner */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 mb-4">
          <div className="flex items-center gap-2 font-bold text-xs text-amber-700 dark:text-amber-400 mb-1.5 uppercase tracking-wide">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span>Novedad Reportada por el Repartidor (LAAR Courier):</span>
          </div>
          {loadingNovelty ? (
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 py-1 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Consultando motivo de la novedad con la transportadora...</span>
            </div>
          ) : noveltyDetail ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <strong className="text-sm font-black text-amber-900 dark:text-amber-100 uppercase tracking-wide">
                  ⚠️ {noveltyDetail.title}
                </strong>
                {noveltyDetail.date && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold">
                    {noveltyDetail.date}
                  </span>
                )}
              </div>
              {noveltyDetail.description && (
                <p className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                  {noveltyDetail.description}
                </p>
              )}
              {noveltyDetail.location && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  📍 Ubicación: {noveltyDetail.location}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-amber-900 dark:text-amber-200 font-semibold italic">
              El transportista indicó una novedad o inconveniente durante la visita de entrega.
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">Acción Requerida *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAction("RETRY_DELIVERY")}
                className={`p-3.5 rounded-xl border text-left text-xs transition-all ${
                  action === "RETRY_DELIVERY"
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold shadow-sm ring-2 ring-amber-500/20"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-2 text-sm mb-1 font-bold text-amber-700 dark:text-amber-400">
                  <Truck className="w-4 h-4 text-amber-500" />
                  Reintentar Entrega
                </div>
                <p className="text-[0.725rem] font-normal text-slate-600 dark:text-slate-400 leading-tight">
                  Actualiza o confirma dirección y solicita nueva visita del courier.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAction("RETURN_TO_SENDER")}
                className={`p-3.5 rounded-xl border text-left text-xs transition-all ${
                  action === "RETURN_TO_SENDER"
                    ? "border-red-500 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 font-bold shadow-sm ring-2 ring-red-500/20"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-2 text-sm mb-1 font-bold text-red-700 dark:text-red-400">
                  <Ban className="w-4 h-4 text-red-500" />
                  Solicitar Devolución
                </div>
                <p className="text-[0.725rem] font-normal text-slate-600 dark:text-slate-400 leading-tight">
                  Ordena el retorno del paquete al remitente o bodega de origen.
                </p>
              </button>
            </div>
          </div>

          {action === "RETRY_DELIVERY" && (
            <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2">
                Datos de Destino Corregidos / Confirmados
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Calle Principal *
                  <input
                    type="text"
                    required
                    value={callePrincipal}
                    onChange={(e) => setCallePrincipal(e.target.value)}
                    placeholder="Ej. Av. 10 de Agosto"
                    className="w-full mt-1.5 p-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Numeración / Piso / Casa *
                  <input
                    type="text"
                    required
                    value={numeracion}
                    onChange={(e) => setNumeracion(e.target.value)}
                    placeholder="Ej. N24-102 o S/N"
                    className="w-full mt-1.5 p-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Calle Secundaria *
                  <input
                    type="text"
                    required
                    value={calleSecundaria}
                    onChange={(e) => setCalleSecundaria(e.target.value)}
                    placeholder="Ej. Mariana de Jesús"
                    className="w-full mt-1.5 p-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Teléfono / Celular Destinatario *
                  <input
                    type="tel"
                    required
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Ej. 0991234567"
                    className="w-full mt-1.5 p-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </label>
              </div>

              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Referencia de Entrega Ubicacional *
                <input
                  type="text"
                  required
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Ej. Frente a la farmacia Fybeca, casa verde 2 pisos"
                  className="w-full mt-1.5 p-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </label>
            </div>
          )}

          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {action === "RETRY_DELIVERY"
              ? "Instrucciones u Observación para el Repartidor *"
              : "Motivo / Justificación de la Devolución *"}
            <textarea
              required
              rows={3}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder={
                action === "RETRY_DELIVERY"
                  ? "Ej. Cliente atiende a partir de las 14:00. Llamar antes de llegar al número registrado."
                  : "Ej. Cliente desistió de la compra tras contacto telefónico."
              }
              className="w-full mt-1.5 p-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </label>

          <div className="modal-actions mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="secondary-button font-medium text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-button bg-red-600 hover:bg-red-700 text-white font-bold inline-flex items-center justify-center gap-1.5"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  Notificando a LAAR Courier...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {action === "RETRY_DELIVERY" ? "Enviar Solución de Novedad" : "Confirmar Devolución"}
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CancelShipmentModal({
  shipment,
  onClose,
  onSuccess,
}: {
  shipment: Shipment;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCancel(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return setError("Ingresa tu contraseña de usuario");
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/shipments/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: shipment.id,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo anular la guía");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al anular la guía");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal max-w-md w-full" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <span className="eyebrow text-red-500">CONFIRMACIÓN DE SEGURIDAD</span>
        <h2 className="text-lg font-bold">Anular Guía de Envío</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
          Ingresa tu contraseña de usuario para confirmar la anulación de la guía{" "}
          <strong className="font-mono text-slate-900 dark:text-white">{shipment.tracking || shipment.id}</strong>.
        </p>

        {error && (
          <div className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCancel} className="space-y-4">
          <label className="block text-xs font-semibold">
            Contraseña de Usuario *
            <div className="relative mt-1.5">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Escribe tu contraseña para autorizar"
                className="w-full p-2.5 pr-10 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>

          <div className="modal-actions mt-6 flex justify-end gap-2">
            <button type="button" className="secondary-button" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-button bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Anulando...
                </>
              ) : (
                "Confirmar y Anular Guía"
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
export function TrackingModule() {
  const [tracking, setTracking] = useState("");

  function search() {
    const trimmed = tracking.trim();
    if (trimmed) {
      window.location.href = `/tracking?guia=${encodeURIComponent(trimmed)}`;
    } else {
      window.location.href = `/tracking`;
    }
  }
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
                if (event.key === "Enter") search();
              }}
              placeholder="Servientrega, LaarCourier, Gintracom, Trajet…"
              autoFocus
            />
            <button className="primary-button" onClick={() => search()}>
              Consultar
            </button>
          </div>
        </label>
      </section>
    </>
  );
}

export function CustomerShipmentsModule() {
  const [shipments, setShipments] = useState<Array<Shipment & { tenantName?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [cancelingShipment, setCancelingShipment] = useState<Shipment | null>(null);

  async function loadAllShipments() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/all-shipments");
      const data = await res.json();
      if (res.ok && Array.isArray(data.shipments)) {
        setShipments(data.shipments);
      }
    } catch (err) {
      console.error("Error al cargar todos los envíos:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAllShipments();
  }, []);

  const [isSyncing, setIsSyncing] = useState(false);

  async function handleSyncNow() {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/cron/sync-shipments?secret=trajetix-cron-secret-2026");
      if (res.ok) {
        void loadAllShipments();
      }
    } catch (err) {
      console.error("Error al sincronizar guías:", err);
    } finally {
      setIsSyncing(false);
    }
  }

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return shipments.filter((item) => {
      const matchSearch =
        !term ||
        item.orderId?.toLowerCase().includes(term) ||
        item.tracking?.toLowerCase().includes(term) ||
        item.tenantName?.toLowerCase().includes(term) ||
        item.recipient?.name?.toLowerCase().includes(term) ||
        item.address?.city?.toLowerCase().includes(term);

      const matchStatus = statusFilter === "ALL" || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [shipments, search, statusFilter]);

  return (
    <>
      <ShippingHeader
        eyebrow="PANEL SUPERADMIN"
        title="Envíos de Clientes"
        copy="Supervisión global y gestión autorizada de anulación de guías para todas las tiendas registradas."
      />

      <section className="panel shipment-filter-panel mb-6">
        <div className="shipment-filter-grid">
          <label>
            Buscar por guía, tienda o cliente
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Escribe guía, tienda, cliente o ciudad..."
            />
          </label>
          <label>
            Filtrar por Estado
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">Todos los estados</option>
              <option value="LABEL_CREATED">Etiqueta Creada</option>
              <option value="PICKUP_SCHEDULED">Por Recolectar</option>
              <option value="IN_TRANSIT">En Tránsito</option>
              <option value="OUT_FOR_DELIVERY">Zona de Entrega</option>
              <option value="DELIVERED">Entregado</option>
              <option value="EXCEPTION">Con Novedad</option>
              <option value="CANCELLED">Anulado</option>
              <option value="RETURNED">Devolución / Entrega</option>
            </select>
          </label>
        </div>
        <div className="shipment-filter-footer flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <strong className="text-xs text-slate-500">{filtered.length} despachos globales encontrados</strong>
          <button
            className="secondary-button flex items-center gap-1.5 font-medium text-xs"
            type="button"
            onClick={handleSyncNow}
            disabled={isSyncing}
            title="Sincronizar en vivo el estado actual de todas las guías globales con las transportadoras"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-amber-500" : ""}`} />
            {isSyncing ? "Sincronizando..." : "Sincronizar Estados"}
          </button>
        </div>
      </section>

      <section className="panel table-panel shipment-management-panel" style={{ overflow: "visible" }}>
        <div className="table-scroll" style={{ overflowX: "auto", overflowY: "visible" }}>
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-red-500" />
              Cargando envíos globales de todas las tiendas...
            </div>
          ) : (
            <table className="shipment-management-table">
              <thead>
                <tr>
                  <th>Guía / Ref</th>
                  <th>Tienda / Comercio</th>
                  <th>Courier</th>
                  <th>Destinatario</th>
                  <th>Peso / Valor</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, index) => {
                  const generated = hasGeneratedGuide(item);
                  const weight = shipmentWeight(item);
                  const canCancel = ["DRAFT", "QUOTED", "LABEL_CREATED", "PICKUP_SCHEDULED"].includes(item.status);
                  const openUp = index >= Math.max(1, filtered.length - 2);

                  return (
                    <Fragment key={item.id}>
                      <tr>
                        <td>
                          <strong className="shipment-guide">{generated ? item.tracking : item.orderId}</strong>
                          <small>{item.orderId}</small>
                        </td>
                        <td>
                          <span className="px-2 py-1 rounded-md bg-red-950/40 border border-red-900/50 text-red-300 text-[0.65rem] font-semibold">
                            {item.tenantName || "Tienda"}
                          </span>
                        </td>
                        <td>
                          <strong>{item.carrier || "Por asignar"}</strong>
                          <small>{item.service || "Servicio por confirmar"}</small>
                        </td>
                        <td>
                          <strong>{item.recipient?.name ?? "Sin destinatario"}</strong>
                          <small>{[item.address?.city, item.address?.line1].filter(Boolean).join(" · ") || "Sin dirección"}</small>
                        </td>
                        <td>
                          <strong>{weight.toFixed(2)} kg</strong>
                          <small>{money(shipmentValue(item))}</small>
                          {(item.cod ?? 0) > 0 && <em className="cod-badge">COD</em>}
                        </td>
                        <td>
                          <strong>{item.createdAt ? new Date(item.createdAt).toLocaleDateString("es-EC") : "—"}</strong>
                          <small>{item.createdAt ? new Date(item.createdAt).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }) : ""}</small>
                        </td>
                        <td>
                          <span className={`shipment-status shipment-status-${shipmentStatusClass(item.status)}`}>
                            {shipmentStatusLabel(item.status)}
                          </span>
                        </td>
                        <td className="text-right relative">
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(openDropdownId === item.id ? null : item.id);
                              }}
                              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors inline-flex items-center gap-1 border border-slate-200 dark:border-slate-800"
                              title="Opciones de acción"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openDropdownId === item.id && (
                              <div
                                className={`absolute right-0 ${openUp ? "bottom-full mb-1" : "top-full mt-1"} w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 py-1 font-sans text-xs text-left`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {(item.labelUrl || item.tracking) && (
                                  <a
                                    href={
                                      item.labelUrl && !item.labelUrl.includes("laarcourier.com")
                                        ? item.labelUrl
                                        : `/api/shipments/label?id=${item.id}&tracking=${encodeURIComponent(item.tracking)}`
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2.5 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    onClick={() => setOpenDropdownId(null)}
                                  >
                                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                                    Ver / Imprimir Guía
                                  </a>
                                )}

                                {generated && (
                                  <a
                                    href={`/tracking?guia=${encodeURIComponent(item.tracking)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2.5 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    onClick={() => setOpenDropdownId(null)}
                                  >
                                    <Truck className="w-3.5 h-3.5 text-emerald-500" />
                                    Rastrear Envío
                                  </a>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpanded((current) => (current === item.id ? null : item.id));
                                    setOpenDropdownId(null);
                                  }}
                                  className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                                  {expanded === item.id ? "Ocultar Detalle" : "Ver Detalle"}
                                </button>

                                {canCancel && (
                                  <>
                                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenDropdownId(null);
                                        setCancelingShipment(item);
                                      }}
                                      className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors font-medium"
                                    >
                                      <Ban className="w-3.5 h-3.5 text-red-500" />
                                      Anular Guía
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expanded === item.id && (
                        <tr className="shipment-detail-row">
                          <td colSpan={8}>
                            <div className="shipment-detail-grid">
                              <span>
                                <small>Tienda Propietaria</small>
                                <strong className="text-red-400">{item.tenantName}</strong>
                              </span>
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
          )}
          {!loading && filtered.length === 0 && (
            <div className="empty shipment-empty">
              <span>▣</span>
              <h3>No hay envíos registrados de clientes</h3>
              <p>Las guías creadas por las tiendas aparecerán listadas aquí.</p>
            </div>
          )}
        </div>
      </section>

      {cancelingShipment && (
        <CancelShipmentModal
          shipment={cancelingShipment}
          onClose={() => setCancelingShipment(null)}
          onSuccess={() => {
            void loadAllShipments();
          }}
        />
      )}
    </>
  );
}
