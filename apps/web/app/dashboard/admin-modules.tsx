"use client";

import { FormEvent, useEffect, useState } from "react";
import { ECUADOR_BANKS } from "../../lib/ecuador-banks";
import { getZeroMarginUsers, setZeroMarginUser } from "../../lib/carrier-config-store";
import { processImageToWebP } from "../../lib/image-processor";
import {
  Loader2,
  Building2,
  Upload,
  CheckCircle2,
  XCircle,
  Eye,
  AlertCircle,
  RefreshCw,
  FileText,
  Plus,
  CreditCard,
  History,
  ShieldCheck,
} from "lucide-react";

type RechargeItem = {
  id: string;
  amount: number;
  bankName: string;
  referenceNumber: string;
  receiptUrl: string;
  status: string;
  note?: string | null;
  createdAt: string;
  tenantName?: string;
  requestedBy?: string;
  approvedBy?: string | null;
};

type FinanceData = {
  wallet: { balance: number; currency: string };
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    createdAt: string;
  }>;
  accounts: Array<{
    id: string;
    bankName: string;
    accountType: string;
    accountLast4: string;
    holderName: string;
    isDefault: boolean;
  }>;
  withdrawals: Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: string;
    bankName: string;
    accountLast4: string;
  }>;
  recharges?: RechargeItem[];
};
const emptyFinance: FinanceData = {
  wallet: { balance: 0, currency: "USD" },
  transactions: [],
  accounts: [],
  withdrawals: [],
  recharges: [],
};
const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
});

export function FinanceModule() {
  const [tab, setTab] = useState<"wallet" | "recharges" | "banks" | "withdrawals" | "admin-recharges">("wallet");
  const [data, setData] = useState(emptyFinance);
  const [recharges, setRecharges] = useState<RechargeItem[]>([]);
  const [adminRecharges, setAdminRecharges] = useState<RechargeItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState("");

  const [rechargeAmount, setRechargeAmount] = useState("");
  const [rechargeBank, setRechargeBank] = useState("Banco Guayaquil");
  const [rechargeRef, setRechargeRef] = useState("");
  const [rechargeNote, setRechargeNote] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [imageProcessing, setImageProcessing] = useState(false);
  const [loadingRecharge, setLoadingRecharge] = useState(false);
  const [selectedReceiptModal, setSelectedReceiptModal] = useState<string | null>(null);
  const [processingActionId, setProcessingActionId] = useState<string | null>(null);
  async function load() {
    const response = await fetch("/api/finance/overview");
    if (response.ok) {
      const resData = (await response.json()) as FinanceData;
      setData(resData);
      if (Array.isArray(resData.recharges)) {
        setRecharges(resData.recharges);
      }
    }
  }

  async function loadRecharges() {
    try {
      const res = await fetch("/api/finance/recharges");
      if (res.ok) {
        const body = await res.json();
        if (Array.isArray(body.recharges)) setRecharges(body.recharges);
      }
    } catch (err) {
      console.error("Error al cargar recargas:", err);
    }
  }

  async function loadAdminRecharges() {
    try {
      const res = await fetch("/api/admin/recharges");
      if (res.ok) {
        const body = await res.json();
        if (Array.isArray(body.recharges)) {
          setAdminRecharges(body.recharges);
          setIsAdmin(true);
        }
      }
    } catch (err) {
      console.error("Error al cargar recargas administrativas:", err);
    }
  }

  useEffect(() => {
    void load();
    void loadRecharges();
    void loadAdminRecharges();

    const interval = setInterval(() => {
      void load();
      void loadRecharges();
      void loadAdminRecharges();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  async function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageProcessing(true);
    setMessage("");
    try {
      const processed = await processImageToWebP(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.75,
        maxSizeBytes: 2 * 1024 * 1024,
      });
      setReceiptUrl(processed.dataUrl);
    } catch (err: any) {
      setMessage(err.message || "Error al procesar la captura comprobante.");
    } finally {
      setImageProcessing(false);
    }
  }

  async function submitRecharge(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!receiptUrl) {
      setMessage("Por favor adjunta la captura o comprobante de la transferencia.");
      return;
    }
    setLoadingRecharge(true);
    try {
      const res = await fetch("/api/finance/recharges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(rechargeAmount),
          bankName: rechargeBank,
          referenceNumber: rechargeRef,
          receiptUrl: receiptUrl,
          note: rechargeNote,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "No se pudo solicitar la recarga");
      setMessage(body.message || "Solicitud de recarga enviada con éxito.");
      setRechargeAmount("");
      setRechargeBank("Banco Guayaquil");
      setRechargeRef("");
      setReceiptUrl("");
      setRechargeNote("");
      await loadRecharges();
      window.dispatchEvent(new Event("wallet:updated"));
    } catch (err: any) {
      setMessage(err.message || "Error al enviar la recarga");
    } finally {
      setLoadingRecharge(false);
    }
  }

  async function handleAdminRechargeAction(rechargeId: string, action: "APPROVE" | "REJECT") {
    setProcessingActionId(rechargeId);
    try {
      const res = await fetch("/api/admin/recharges/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rechargeId, action }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Error al procesar recarga");
      setMessage(body.message);
      await loadAdminRecharges();
      await loadRecharges();
      await load();
      window.dispatchEvent(new Event("wallet:updated"));
    } catch (err: any) {
      setMessage(err.message || "Error al procesar la recarga");
    } finally {
      setProcessingActionId(null);
    }
  }
  async function addBank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetch("/api/finance/bank-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankCode: form.get("bankCode"),
        accountType: form.get("accountType"),
        accountNumber: form.get("accountNumber"),
        holderName: form.get("holderName"),
        holderId: form.get("holderId"),
        isDefault: form.has("isDefault"),
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setMessage(
      response.ok
        ? "Cuenta bancaria agregada"
        : (body.error ?? "No se pudo agregar"),
    );
    if (response.ok) {
      formElement.reset();
      await load();
    }
  }
  async function withdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetch("/api/finance/withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankAccountId: form.get("bankAccountId"),
        amount: Number(form.get("amount")),
        note: form.get("note"),
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setMessage(
      response.ok
        ? "Retiro solicitado"
        : (body.error ?? "No se pudo solicitar"),
    );
    if (response.ok) {
      formElement.reset();
      await load();
    }
  }
  return (
    <>
      <div className="page-header">
        <div>
          <span>FINANZAS</span>
          <h1>Finanzas</h1>
          <p>
            Administra saldo, cuentas bancarias y solicitudes de retiro de esta
            empresa.
          </p>
        </div>
      </div>
      <div className="finance-tabs">
        <button
          className={tab === "wallet" ? "active" : ""}
          onClick={() => setTab("wallet")}
        >
          Billetera
        </button>
        <button
          className={tab === "recharges" ? "active" : ""}
          onClick={() => setTab("recharges")}
        >
          Recargas
        </button>
        <button
          className={tab === "banks" ? "active" : ""}
          onClick={() => setTab("banks")}
        >
          Cuentas bancarias
        </button>
        <button
          className={tab === "withdrawals" ? "active" : ""}
          onClick={() => setTab("withdrawals")}
        >
          Retiros
        </button>
        {isAdmin && (
          <button
            className={tab === "admin-recharges" ? "active" : ""}
            onClick={() => setTab("admin-recharges")}
            style={{ color: "var(--amber-500, #f59e0b)", fontWeight: "bold" }}
          >
            🛡️ Revisar Recargas (Admin)
          </button>
        )}
      </div>
      {message && (
        <p className="module-notice">
          {message}
          <button onClick={() => setMessage("")}>×</button>
        </p>
      )}
      {tab === "wallet" && (
        <>
          <section className="wallet-card">
            <span>Saldo disponible</span>
            <strong>{money.format(data.wallet.balance)}</strong>
            <small>Fondos disponibles para solicitar transferencias</small>
          </section>
          <section className="panel table-panel">
            <div className="panel-title">
              <div>
                <h2>Movimientos</h2>
                <p>Historial de créditos, débitos y fondos retenidos.</p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Tipo</th>
                    <th>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {new Date(item.createdAt).toLocaleString("es-EC")}
                      </td>
                      <td>{item.description}</td>
                      <td>{item.type}</td>
                      <td
                        className={
                          item.amount >= 0 ? "positive-money" : "danger-text"
                        }
                      >
                        {money.format(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.transactions.length === 0 && (
                <div className="empty">
                  <h3>Sin movimientos</h3>
                  <p>Los pagos y retiros aparecerán aquí.</p>
                </div>
              )}
            </div>
          </section>
        </>
      )}
      {tab === "banks" && (
        <div className="finance-layout">
          <section className="panel finance-form">
            <h2>Agregar cuenta de Ecuador</h2>
            <p>
              El número completo se guarda cifrado y sólo mostramos los últimos
              cuatro dígitos.
            </p>
            <form onSubmit={addBank}>
              <label>
                Banco
                <select name="bankCode" required>
                  {ECUADOR_BANKS.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tipo
                <select name="accountType">
                  <option value="AHORROS">Ahorros</option>
                  <option value="CORRIENTE">Corriente</option>
                </select>
              </label>
              <label>
                Número de cuenta
                <input
                  name="accountNumber"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6,20}"
                />
              </label>
              <label>
                Titular
                <input name="holderName" required />
              </label>
              <label>
                Cédula o RUC
                <input name="holderId" required />
              </label>
              <label className="checkbox-label">
                <input name="isDefault" type="checkbox" /> Cuenta predeterminada
              </label>
              <button className="primary-button">Guardar cuenta</button>
            </form>
          </section>
          <section className="panel bank-list">
            <h2>Cuentas registradas</h2>
            {data.accounts.map((item) => (
              <article key={item.id}>
                <span>🏦</span>
                <div>
                  <b>{item.bankName}</b>
                  <small>
                    {item.accountType} · •••• {item.accountLast4}
                  </small>
                  <em>{item.holderName}</em>
                </div>
                {item.isDefault && <i>Principal</i>}
              </article>
            ))}
            {data.accounts.length === 0 && (
              <p>No hay cuentas bancarias registradas.</p>
            )}
          </section>
        </div>
      )}
      {tab === "withdrawals" && (
        <div className="finance-layout">
          <section className="panel finance-form">
            <h2>Solicitar retiro</h2>
            <p>
              Saldo disponible: <b>{money.format(data.wallet.balance)}</b>
            </p>
            <form onSubmit={withdraw}>
              <label>
                Cuenta destino
                <select name="bankAccountId" required>
                  <option value="">Seleccionar</option>
                  {data.accounts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.bankName} · •••• {item.accountLast4}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Monto
                <input
                  name="amount"
                  type="number"
                  min="1"
                  max={data.wallet.balance}
                  step="0.01"
                  required
                />
              </label>
              <label>
                Nota
                <input name="note" />
              </label>
              <button
                className="primary-button"
                disabled={data.accounts.length === 0 || data.wallet.balance < 1}
              >
                Solicitar transferencia
              </button>
            </form>
          </section>
          <section className="panel bank-list">
            <h2>Solicitudes</h2>
            {data.withdrawals.map((item) => (
              <article key={item.id}>
                <span>⇩</span>
                <div>
                  <b>{money.format(item.amount)}</b>
                  <small>
                    {item.bankName} · •••• {item.accountLast4}
                  </small>
                  <em>{new Date(item.createdAt).toLocaleString("es-EC")}</em>
                </div>
                <i>{item.status}</i>
              </article>
            ))}
            {data.withdrawals.length === 0 && (
              <p>No hay retiros solicitados.</p>
            )}
          </section>
        </div>
      )}
      {tab === "recharges" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Columna Izquierda: Información Bancaria Oficial + Formulario */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Tarjeta de Cuenta Oficial Trajetix */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-slate-900 dark:text-slate-100 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-amber-200/60 dark:border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Cuenta Bancaria Oficial Trajetix</h3>
                </div>
                <span className="bg-amber-100 dark:bg-amber-400/10 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-400/20 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                  Recargas Directas
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block mb-0.5 text-[11px] font-semibold">Titular de la Cuenta:</span>
                  <strong className="text-slate-900 dark:text-white text-sm font-extrabold">Mendoza Herrera Cesar Javier</strong>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block mb-0.5 text-[11px] font-semibold">Banco / Entidad:</span>
                  <strong className="text-slate-900 dark:text-white text-sm font-extrabold">Banco Guayaquil</strong>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block mb-0.5 text-[11px] font-semibold">Tipo y N° de Cuenta:</span>
                  <strong className="text-amber-800 dark:text-amber-400 font-mono text-sm font-bold bg-amber-100/70 dark:bg-slate-950/60 px-2.5 py-1 rounded-md inline-block border border-amber-300/80 dark:border-slate-800">
                    Ahorro # 0038996066
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block mb-0.5 text-[11px] font-semibold">Identificación / Cédula:</span>
                  <strong className="text-slate-900 dark:text-white font-mono text-sm font-bold">0927767236</strong>
                </div>
                <div className="sm:col-span-2 pt-2 border-t border-amber-200/50 dark:border-slate-800/50 mt-1">
                  <span className="text-slate-500 dark:text-slate-400 block mb-0.5 text-[11px] font-semibold">Correo para Notificación de Comprobante:</span>
                  <strong className="text-amber-700 dark:text-amber-300 font-mono text-xs font-bold">CESAR.MENDOZA221995@GMAIL.COM</strong>
                </div>
              </div>
            </div>

            {/* Formulario de Solicitud de Recarga */}
            <section className="panel finance-form bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">Solicitar Recarga de Saldo</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Realiza la transferencia a la cuenta oficial e ingresa el comprobante para su aprobación inmediata.</p>

              <form onSubmit={submitRecharge} className="space-y-4">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Monto a Recargar ($ USD) *
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={rechargeAmount}
                    onChange={(e) => setRechargeAmount(e.target.value)}
                    placeholder="Ej. 50.00"
                    className="w-full mt-1.5 p-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Banco de Origen / Método *
                  <input
                    type="text"
                    required
                    value={rechargeBank}
                    onChange={(e) => setRechargeBank(e.target.value)}
                    placeholder="Ej. Banco Guayaquil, Pichincha, Transferencia..."
                    className="w-full mt-1.5 p-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Número de Comprobante / Referencia *
                  <input
                    type="text"
                    required
                    value={rechargeRef}
                    onChange={(e) => setRechargeRef(e.target.value)}
                    placeholder="Ej. 004829102"
                    className="w-full mt-1.5 p-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Captura / Comprobante de Pago (Imagen) *
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptChange}
                    required={!receiptUrl}
                    className="mt-1.5 block w-full text-xs text-slate-500 dark:text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border file:border-slate-200 dark:file:border-slate-700 file:text-xs file:font-semibold file:bg-slate-100 hover:file:bg-slate-200 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-200 dark:hover:file:bg-slate-700 cursor-pointer transition-colors"
                  />
                </label>

                {imageProcessing && (
                  <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/50 p-3 rounded-xl border border-amber-200 dark:border-amber-900">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Procesando y convirtiendo comprobante a WebP (regla de compresión)...</span>
                  </div>
                )}

                {receiptUrl && !imageProcessing && (
                  <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-950 p-3 text-center">
                    <img src={receiptUrl} alt="Vista previa comprobante" className="max-h-48 mx-auto rounded-lg object-contain shadow-xs" />
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 block font-mono font-semibold">✓ Captura WebP optimizada de alta calidad</span>
                  </div>
                )}

                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Observación / Nota (Opcional)
                  <input
                    type="text"
                    value={rechargeNote}
                    onChange={(e) => setRechargeNote(e.target.value)}
                    placeholder="Ej. Transferencia efectuada a las 10:30 AM"
                    className="w-full mt-1.5 p-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </label>

                <button
                  type="submit"
                  className="primary-button w-full flex items-center justify-center gap-2 py-3 rounded-xl shadow-md text-sm font-bold transition-all mt-2"
                  disabled={loadingRecharge || imageProcessing || !receiptUrl}
                >
                  {loadingRecharge ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando solicitud...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Enviar Solicitud de Recarga
                    </>
                  )}
                </button>
              </form>
            </section>
          </div>

          {/* Columna Derecha: Historial de Recargas Solicitadas */}
          <div className="lg:col-span-5">
            <section className="panel bank-list bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">Historial de Recargas</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Estado de solicitudes enviadas y comprobantes adjuntos.</p>

              <div className="flex flex-col gap-3.5">
                {recharges.map((item) => (
                  <article key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <strong className="text-emerald-600 dark:text-emerald-400 text-base font-mono font-extrabold">{money.format(item.amount)}</strong>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider ${
                          item.status === "APPROVED"
                            ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800"
                            : item.status === "REJECTED"
                            ? "bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800"
                            : "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
                        }`}>
                          {item.status === "APPROVED" ? "Aprobada" : item.status === "REJECTED" ? "Rechazada" : "Pendiente"}
                        </span>
                      </div>
                      <small className="text-slate-600 dark:text-slate-400 block text-xs truncate">
                        {item.bankName} · Ref: <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{item.referenceNumber}</span>
                      </small>
                      <em className="text-[11px] text-slate-400 dark:text-slate-500 not-italic block mt-0.5">{new Date(item.createdAt).toLocaleString("es-EC")}</em>
                    </div>

                    {item.receiptUrl && (
                      <button
                        type="button"
                        onClick={() => setSelectedReceiptModal(item.receiptUrl)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0 flex items-center gap-1.5"
                        title="Ver comprobante"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-500" /> Captura
                      </button>
                    )}
                  </article>
                ))}

                {recharges.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 p-6 text-center bg-slate-50/50 dark:bg-slate-950/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    No has solicitado recargas de saldo aún.
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {tab === "admin-recharges" && isAdmin && (
        <section className="panel table-panel">
          <div className="panel-title flex items-center justify-between">
            <div>
              <h2>Revisión Global de Recargas (SuperAdmin)</h2>
              <p>Revisa los comprobantes bancarios y aprueba o rechaza recargas de saldo de todas las tiendas.</p>
            </div>
            <button
              onClick={loadAdminRecharges}
              className="secondary-button flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Actualizar
            </button>
          </div>

          <div className="table-scroll overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Tienda / Usuario</th>
                  <th>Monto</th>
                  <th>Banco & Ref</th>
                  <th>Comprobante</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {adminRecharges.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong className="block text-slate-100 text-xs">{item.tenantName}</strong>
                      <span className="text-[11px] text-slate-400">{item.requestedBy}</span>
                    </td>
                    <td>
                      <strong className="text-emerald-400 font-mono text-sm">{money.format(item.amount)}</strong>
                    </td>
                    <td>
                      <span className="block text-xs font-semibold">{item.bankName}</span>
                      <span className="font-mono text-[11px] text-slate-400">Ref: {item.referenceNumber}</span>
                    </td>
                    <td>
                      {item.receiptUrl ? (
                        <button
                          type="button"
                          onClick={() => setSelectedReceiptModal(item.receiptUrl)}
                          className="secondary-button text-xs py-1 px-2.5 flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3 text-amber-500" /> Ver Captura
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">Sin foto</span>
                      )}
                    </td>
                    <td className="text-xs text-slate-400">
                      {new Date(item.createdAt).toLocaleString("es-EC")}
                    </td>
                    <td>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        item.status === "APPROVED"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : item.status === "REJECTED"
                          ? "bg-red-950 text-red-400 border border-red-800"
                          : "bg-amber-950 text-amber-400 border border-amber-800"
                      }`}>
                        {item.status === "APPROVED" ? "Aprobada" : item.status === "REJECTED" ? "Rechazada" : "Pendiente"}
                      </span>
                    </td>
                    <td className="text-right">
                      {item.status === "PENDING" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleAdminRechargeAction(item.id, "APPROVE")}
                            disabled={processingActionId === item.id}
                            className="primary-button bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1 px-2.5 flex items-center gap-1"
                          >
                            {processingActionId === item.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            Aprobar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdminRechargeAction(item.id, "REJECT")}
                            disabled={processingActionId === item.id}
                            className="secondary-button border-red-800 text-red-400 hover:bg-red-950 text-xs py-1 px-2.5 flex items-center gap-1"
                          >
                            {processingActionId === item.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            Rechazar
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">
                          {item.approvedBy ? `Por ${item.approvedBy}` : "Procesada"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {adminRecharges.length === 0 && (
              <div className="empty p-6 text-center text-xs text-slate-400">
                No hay solicitudes de recarga globales pendientes.
              </div>
            )}
          </div>
        </section>
      )}

      {selectedReceiptModal && (
        <div className="modal-backdrop" onMouseDown={() => setSelectedReceiptModal(null)}>
          <div className="modal max-w-xl w-full p-4" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-500" /> Comprobante / Captura de Pago (WebP)
              </h3>
              <button className="modal-close" onClick={() => setSelectedReceiptModal(null)}>×</button>
            </div>
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-center max-h-[70vh] overflow-y-auto">
              <img src={selectedReceiptModal} alt="Comprobante de pago" className="w-full h-auto max-h-[60vh] object-contain rounded" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type Member = {
  id: string;
  status: "ACTIVE" | "SUSPENDED" | "INVITED";
  user: {
    id: string;
    name?: string | null;
    email: string;
    phone?: string | null;
    lastLoginAt?: string | null;
  };
  roles: Array<{ id: string; name: string; systemKey?: string | null }>;
  permissions: string[];
  customPermissions: boolean;
};
type MembersData = {
  members: Member[];
  roles: Array<{
    id: string;
    name: string;
    systemKey?: string | null;
    permissions: string[];
  }>;
  modules: Record<string, readonly string[]>;
};
type UserModal =
  | { kind: "create" }
  | { kind: "edit"; member: Member }
  | { kind: "permissions"; member: Member }
  | null;

const moduleLabels: Record<string, string> = {
  dashboard: "Dashboard",
  orders: "Pedidos",
  inventory: "Inventario",
  products: "Productos",
  shipments: "Envíos",
  customers: "Clientes",
  warehouses: "Bodegas",
  stores: "Tiendas",
  picking: "Picking",
  packing: "Packing",
  delivery: "Entregas",
  suppliers: "Proveedores",
  branding: "Branding y dominio",
  settings: "Configuración y equipo",
  finance: "Finanzas",
};
const permissionLabels: Record<string, string> = {
  read: "Ver",
  create: "Crear",
  update: "Editar",
  cancel: "Cancelar",
  adjust: "Ajustar stock",
  transfer: "Transferir",
  archive: "Archivar",
  invite: "Invitar",
  manage: "Administrar",
};
const exactPermissionLabels: Record<string, string> = {
  "dashboard:read": "Ver resumen / dashboard",
  "shipments:create": "Crear nuevos envíos",
  "shipments:read": "Ver mis pedidos y tracking",
  "warehouses:read": "Ver bodegas",
  "warehouses:create": "Registrar bodegas",
  "warehouses:update": "Editar bodegas",
  "products:read": "Ver productos y stock",
  "products:create": "Crear productos",
  "products:update": "Editar productos",
  "inventory:read": "Ver inventario",
  "inventory:adjust": "Ajustar inventario",
  "finance:read": "Ver billetera, cuentas y retiros",
  "finance:manage": "Gestionar finanzas y solicitar retiros",
};

export function StoreUsersModule() {
  const [data, setData] = useState<MembersData>({
    members: [],
    roles: [],
    modules: {},
  });
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [modal, setModal] = useState<UserModal>(null);
  const [saving, setSaving] = useState(false);
  const [zeroMarginUsers, setZeroMarginUsersState] = useState<string[]>([]);

  useEffect(() => {
    setZeroMarginUsersState(getZeroMarginUsers());
  }, []);

  function toggleZeroMargin(userEmail: string, enable: boolean) {
    setZeroMarginUser(userEmail, enable);
    setZeroMarginUsersState(getZeroMarginUsers());
    setMessage(
      enable
        ? `Se otorgó permiso de Envíos sin Ganancia (Precio de costo) a ${userEmail}`
        : `Se revocó permiso de Envíos sin Ganancia para ${userEmail}`
    );
  }
  async function load() {
    const response = await fetch("/api/admin/members");
    if (response.ok) setData((await response.json()) as MembersData);
  }
  useEffect(() => {
    void load();
  }, []);

  async function request(method: string, body?: object, suffix = "") {
    setSaving(true);
    const init: RequestInit = { method };
    if (body) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    }
    const response = await fetch(`/api/admin/members${suffix}`, init);
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setSaving(false);
    setMessage(
      response.ok
        ? "Cambios guardados correctamente"
        : (result.error ?? "No se pudo completar la acción"),
    );
    if (response.ok) {
      setModal(null);
      await load();
    }
    return response.ok;
  }
  async function changeRole(membershipId: string, roleId: string) {
    await request("PATCH", { action: "role", membershipId, roleId });
  }
  async function toggleStatus(member: Member) {
    await request("PATCH", {
      action: "status",
      membershipId: member.id,
      status: member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
    });
  }
  async function remove(member: Member) {
    if (
      window.confirm(
        `¿Eliminar a ${member.user.name ?? member.user.email} de esta empresa?`,
      )
    )
      await request("DELETE", undefined, `?membershipId=${member.id}`);
  }
  const filtered = data.members.filter((member) => {
    const matchesText =
      `${member.user.name ?? ""} ${member.user.email} ${member.user.phone ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase());
    return matchesText && (status === "ALL" || member.status === status);
  });

  return (
    <>
      <div className="page-header">
        <div>
          <span>CONFIGURACIÓN DE EQUIPO</span>
          <h1>Usuarios de tienda</h1>
          <p>
            Gestiona usuarios y controla exactamente a qué módulos tienen
            acceso.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => setModal({ kind: "create" })}
        >
          ＋ Nuevo usuario
        </button>
      </div>
      {message && (
        <p className="module-notice">
          {message}
          <button onClick={() => setMessage("")}>×</button>
        </p>
      )}
      <section className="panel users-panel">
        <div className="users-toolbar">
          <label className="users-search">
            <span>⌕</span>
            <input
              aria-label="Buscar usuarios"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre, correo o teléfono…"
            />
          </label>
          <select
            aria-label="Filtrar usuarios por estado"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="ALL">Todos los estados</option>
            <option value="ACTIVE">Activos</option>
            <option value="SUSPENDED">Suspendidos</option>
            <option value="INVITED">Invitados</option>
          </select>
          <button
            type="button"
            className="icon-action"
            aria-label="Actualizar lista"
            title="Actualizar"
            onClick={() => void load()}
          >
            ↻
          </button>
        </div>
        <p className="users-count">
          {filtered.length}{" "}
          {filtered.length === 1
            ? "usuario encontrado"
            : "usuarios encontrados"}
        </p>
        <div className="table-scroll">
          <table className="users-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th>Rol</th>
                <th>Envíos Sin Ganancia</th>
                <th>Permisos</th>
                <th>Último acceso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => {
                const isZeroMargin = zeroMarginUsers.includes(member.user.email);
                return (
                  <tr key={member.id}>
                    <td>
                      <strong>{member.user.name ?? "Sin nombre"}</strong>
                    </td>
                    <td>{member.user.email}</td>
                    <td>{member.user.phone || "—"}</td>
                    <td>
                      <span
                        className={`member-status ${member.status.toLowerCase()}`}
                      >
                        {member.status === "ACTIVE"
                          ? "Activo"
                          : member.status === "SUSPENDED"
                            ? "Suspendido"
                            : "Invitado"}
                      </span>
                    </td>
                    <td>
                      <select
                        className="role-select"
                        value={member.roles[0]?.id ?? ""}
                        onChange={(event) =>
                          void changeRole(member.id, event.target.value)
                        }
                      >
                        {data.roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <label className="zero-margin-toggle" title="Permitir generar envíos a precio de costo puro (0% ganancia Trajetix) para familiares, amigos o cuentas secundarias">
                        <input
                          type="checkbox"
                          checked={isZeroMargin}
                          onChange={(e) => toggleZeroMargin(member.user.email, e.target.checked)}
                        />
                        <span>{isZeroMargin ? "⚡ Precio Costo (0% Ganancia)" : "Estándar"}</span>
                      </label>
                    </td>
                    <td>
                      <button
                        className="permission-count"
                        onClick={() => setModal({ kind: "permissions", member })}
                      >
                        ♢ {member.permissions.length}
                        {member.customPermissions
                          ? " personalizados"
                          : " por rol"}
                      </button>
                    </td>
                    <td>
                      {member.user.lastLoginAt
                        ? new Date(member.user.lastLoginAt).toLocaleString(
                            "es-EC",
                          )
                        : "Nunca"}
                    </td>
                    <td>
                      <div className="user-actions">
                        <button
                          type="button"
                          aria-label="Editar usuario"
                          title="Editar usuario"
                          onClick={() => setModal({ kind: "edit", member })}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          aria-label={
                            member.status === "ACTIVE"
                              ? "Suspender acceso"
                              : "Activar acceso"
                          }
                          title={
                            member.status === "ACTIVE"
                              ? "Suspender acceso"
                              : "Activar acceso"
                          }
                          onClick={() => void toggleStatus(member)}
                        >
                          {member.status === "ACTIVE" ? "⊘" : "✓"}
                        </button>
                        <button
                          type="button"
                          className="danger-action"
                          aria-label="Eliminar de la empresa"
                          title="Eliminar de la empresa"
                          onClick={() => void remove(member)}
                        >
                          ⌫
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="empty">
              <h3>No encontramos usuarios</h3>
              <p>Cambia los filtros o registra un nuevo usuario.</p>
            </div>
          )}
        </div>
      </section>
      {modal?.kind === "create" && (
        <UserEditor
          title="Nuevo usuario"
          roles={data.roles}
          saving={saving}
          onClose={() => setModal(null)}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void request("POST", {
              name: form.get("name"),
              email: form.get("email"),
              phone: form.get("phone"),
              password: form.get("password"),
              roleId: form.get("roleId"),
            });
          }}
        />
      )}
      {modal?.kind === "edit" && (
        <UserEditor
          title="Editar usuario"
          member={modal.member}
          roles={data.roles}
          saving={saving}
          onClose={() => setModal(null)}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void request("PATCH", {
              action: "profile",
              membershipId: modal.member.id,
              name: form.get("name"),
              email: form.get("email"),
              phone: form.get("phone"),
              password: form.get("password"),
            });
          }}
        />
      )}
      {modal?.kind === "permissions" && (
        <PermissionsEditor
          member={modal.member}
          modules={data.modules}
          allowedPermissions={
            data.roles.find((role) => role.id === modal.member.roles[0]?.id)
              ?.permissions ?? []
          }
          saving={saving}
          onClose={() => setModal(null)}
          onSave={(permissions) =>
            void request("PATCH", {
              action: "permissions",
              membershipId: modal.member.id,
              permissions,
            })
          }
        />
      )}
    </>
  );
}

function UserEditor({
  title,
  member,
  roles,
  saving,
  onClose,
  onSubmit,
}: {
  title: string;
  member?: Member;
  roles: MembersData["roles"];
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal user-editor"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <span className="eyebrow">EQUIPO DE LA EMPRESA</span>
        <h2>{title}</h2>
        <p>
          {member
            ? "Actualiza los datos. Deja la contraseña vacía para conservarla."
            : "Crea credenciales y asigna el rol inicial de este usuario."}
        </p>
        <form onSubmit={onSubmit}>
          <label>
            Nombre completo
            <input
              name="name"
              required
              minLength={2}
              defaultValue={member?.user.name ?? ""}
              autoFocus
            />
          </label>
          <label>
            Correo electrónico
            <input
              name="email"
              type="email"
              required
              defaultValue={member?.user.email ?? ""}
            />
          </label>
          <label>
            Teléfono
            <input
              name="phone"
              type="tel"
              defaultValue={member?.user.phone ?? ""}
              placeholder="+593 99 123 4567"
            />
          </label>
          <label>
            {member ? "Nueva contraseña (opcional)" : "Contraseña temporal"}
            <input
              name="password"
              type="password"
              minLength={8}
              required={!member}
              placeholder="Mínimo 8 caracteres"
            />
          </label>
          {!member && (
            <label>
              Perfil de acceso
              <select
                name="roleId"
                required
                defaultValue={
                  roles.find((role) => role.systemKey === "vendedor")?.id ??
                  roles[0]?.id
                }
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button className="primary-button" disabled={saving}>
              {saving ? "Guardando…" : member ? "Actualizar" : "Crear usuario"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function PermissionsEditor({
  member,
  modules,
  allowedPermissions,
  saving,
  onClose,
  onSave,
}: {
  member: Member;
  modules: MembersData["modules"];
  allowedPermissions: string[];
  saving: boolean;
  onClose: () => void;
  onSave: (permissions: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(member.permissions);
  const allowed = new Set(allowedPermissions);
  const visibleModules = Object.entries(modules)
    .map(
      ([module, permissions]) =>
        [
          module,
          permissions.filter((permission) => allowed.has(permission)),
        ] as const,
    )
    .filter(([, permissions]) => permissions.length > 0);
  function toggle(permission: string) {
    setSelected((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );
  }
  function toggleModule(permissions: readonly string[]) {
    const active = permissions.every((permission) =>
      selected.includes(permission),
    );
    setSelected((current) =>
      active
        ? current.filter((permission) => !permissions.includes(permission))
        : [...new Set([...current, ...permissions])],
    );
  }
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal permissions-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <span className="eyebrow">ACCESO POR MÓDULO</span>
        <h2>Permisos de {member.user.name ?? member.user.email}</h2>
        <p>
          Sólo puedes activar permisos incluidos en el perfil{" "}
          {member.roles[0]?.name ?? "de tienda"}.
        </p>
        <div className="permission-groups">
          {visibleModules.map(([module, permissions]) => {
            const all = permissions.every((permission) =>
              selected.includes(permission),
            );
            return (
              <article key={module}>
                <header>
                  <strong>{moduleLabels[module] ?? module}</strong>
                  <button onClick={() => toggleModule(permissions)}>
                    {all ? "Desactivar todos" : "Activar todos"}
                  </button>
                </header>
                {permissions.map((permission) => (
                  <label key={permission}>
                    <span>
                      {exactPermissionLabels[permission] ??
                        permissionLabels[permission.split(":")[1] ?? ""] ??
                        permission}
                    </span>
                    <input
                      type="checkbox"
                      checked={selected.includes(permission)}
                      onChange={() => toggle(permission)}
                    />
                  </label>
                ))}
              </article>
            );
          })}
        </div>
        <div className="permissions-footer">
          <span>
            {selected.filter((permission) => allowed.has(permission)).length}{" "}
            permisos seleccionados
          </span>
          <div>
            <button className="secondary-button" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="primary-button"
              disabled={saving}
              onClick={() =>
                onSave(selected.filter((permission) => allowed.has(permission)))
              }
            >
              {saving ? "Guardando…" : "Guardar permisos"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
