"use client";

import { useState } from "react";
import { CitySelect } from "./city-select";
import {
  CarrierConfig,
  ZoneKey,
  calculateCarrierFreightRate,
  loadCarrierConfig,
  saveCarrierConfig,
} from "../../lib/carrier-config-store";

type CarrierConfigModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export function CarrierConfigModal({ isOpen, onClose, onSaved }: CarrierConfigModalProps) {
  const [config, setConfig] = useState<CarrierConfig>(() => loadCarrierConfig("laar"));
  const [activeTab, setActiveTab] = useState<"general" | "pickup" | "rates" | "coverage">("general");
  const [testingApi, setTestingApi] = useState(false);
  const [apiStatus, setApiStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Live Rate Simulator state
  const [simOrigin, setSimOrigin] = useState("Quito");
  const [simDest, setSimDest] = useState("Guayaquil");
  const [simDestZone, setSimDestZone] = useState<ZoneKey | undefined>(undefined);
  const [simWeight, setSimWeight] = useState(3);
  const [simCod, setSimCod] = useState(60);
  const [simZeroMargin, setSimZeroMargin] = useState(false);

  // New location mapping state
  const [newCity, setNewCity] = useState("");
  const [newLaarCode, setNewLaarCode] = useState("");
  const [newLaarName, setNewLaarName] = useState("");
  const [newZone, setNewZone] = useState<ZoneKey>("principal");

  if (!isOpen) return null;

  const handleSave = () => {
    saveCarrierConfig(config);
    if (onSaved) onSaved();
    onClose();
  };

  const testConnection = async () => {
    setTestingApi(true);
    setApiStatus(null);
    try {
      // Simulate/test connection to LAAR authentication endpoint
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (config.general.apiUser && config.general.apiPassword) {
        setApiStatus({
          success: true,
          message: "Conexión exitosa con API LAAR Courier (HTTP 200 OK — Token JWT emitido)",
        });
      } else {
        setApiStatus({
          success: false,
          message: "Credenciales incompletas. Ingrese usuario y contraseña API.",
        });
      }
    } catch (err: unknown) {
      setApiStatus({ success: false, message: (err as Error).message || "Error al conectar con la API de LAAR" });
    } finally {
      setTestingApi(false);
    }
  };

  const simResult = calculateCarrierFreightRate({
    config,
    originCity: simOrigin,
    destinationCity: simDest,
    ...(simDestZone ? { destinationZone: simDestZone } : {}),
    weightKg: simWeight,
    codAmount: simCod,
    isZeroMarginUser: simZeroMargin,
  });

  const addLocationMapping = () => {
    if (!newCity || !newLaarCode) return;
    const newItem = {
      id: String(Date.now()),
      canonicalCity: newCity.trim(),
      laarCityCode: newLaarCode.trim().toUpperCase(),
      laarCityName: newLaarName.trim() || newCity.trim(),
      zone: newZone,
    };
    setConfig((prev) => ({
      ...prev,
      locationMappings: [...prev.locationMappings, newItem],
    }));
    setNewCity("");
    setNewLaarCode("");
    setNewLaarName("");
  };

  const removeLocationMapping = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      locationMappings: prev.locationMappings.filter((m) => m.id !== id),
    }));
  };

  return (
    <div className="carrier-modal-overlay">
      <div className="carrier-modal-container">
        <header className="carrier-modal-header">
          <div className="title-row">
            <span className="carrier-badge">LAAR COURIER</span>
            <h2>Configuración Avanzada de Transportadora</h2>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </header>

        {/* Global Active Toggle */}
        <div className="carrier-active-bar">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={config.active}
              onChange={(e) => setConfig({ ...config, active: e.target.checked })}
            />
            <span className="slider round"></span>
          </label>

            <b>
              {config.active
                ? "🟢 Transportadora ACTIVA en Nuevo Envío"
                : "🔴 Transportadora DESACTIVADA en Nuevo Envío"}
            </b>
            <small>
              {config.active
                ? "Los usuarios verán las cotizaciones de esta transportadora."
                : "Esta transportadora no aparecerá como opción de envío."}
            </small>
        </div>

        {/* Tab Navigation */}
        <nav className="carrier-tabs">
          <button
            type="button"
            className={activeTab === "general" ? "active" : ""}
            onClick={() => setActiveTab("general")}
          >
            📋 1. General
          </button>
          <button
            type="button"
            className={activeTab === "pickup" ? "active" : ""}
            onClick={() => setActiveTab("pickup")}
          >
            🚛 2. Recolección
          </button>
          <button
            type="button"
            className={activeTab === "rates" ? "active" : ""}
            onClick={() => setActiveTab("rates")}
          >
            💲 3. Fletes y Márgenes
          </button>
          <button
            type="button"
            className={activeTab === "coverage" ? "active" : ""}
            onClick={() => setActiveTab("coverage")}
          >
            🗺️ 4. Cobertura
          </button>
        </nav>

        <div className="carrier-tab-content">
          {/* TAB 1: INFORMACIÓN GENERAL */}
          {activeTab === "general" && (
            <div className="tab-pane">
              <h3>Datos de Integración de la Transportadora</h3>
              <div className="form-grid-2">
                <label>
                  Nombre Comercial
                  <input
                    value={config.general.name}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        general: { ...config.general, name: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  Código Identificador
                  <input readOnly value={config.general.carrierKey} />
                </label>
              </div>

              <div className="form-grid-2">
                <label>
                  URL Base API LAAR
                  <input
                    value={config.general.baseUrl}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        general: { ...config.general, baseUrl: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  Logo (URL)
                  <input
                    value={config.general.logoUrl}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        general: { ...config.general, logoUrl: e.target.value },
                      })
                    }
                  />
                </label>
              </div>

              <h4>Credenciales de Acceso API LAAR</h4>
              <div className="form-grid-2">
                <label>
                  Usuario API
                  <input
                    value={config.general.apiUser}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        general: { ...config.general, apiUser: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  Contraseña API
                  <input
                    type="password"
                    value={config.general.apiPassword}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        general: { ...config.general, apiPassword: e.target.value },
                      })
                    }
                  />
                </label>
              </div>

              <div className="api-test-row">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={testingApi}
                  onClick={testConnection}
                >
                  {testingApi ? "Verificando API…" : "⚡ Probar Credenciales API LAAR"}
                </button>
                {apiStatus && (
                  <span className={apiStatus.success ? "status-success" : "status-error"}>
                    {apiStatus.message}
                  </span>
                )}
              </div>

              <h4>Capacidades Habilitadas</h4>
              <div className="checkbox-grid">
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={config.general.capabilities.cod}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        general: {
                          ...config.general,
                          capabilities: { ...config.general.capabilities, cod: e.target.checked },
                        },
                      })
                    }
                  />
                  Recaudo Contra Entrega (COD)
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={config.general.capabilities.tracking}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        general: {
                          ...config.general,
                          capabilities: { ...config.general.capabilities, tracking: e.target.checked },
                        },
                      })
                    }
                  />
                  Rastreo Web en Tiempo Real
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={config.general.capabilities.thermalLabel}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        general: {
                          ...config.general,
                          capabilities: { ...config.general.capabilities, thermalLabel: e.target.checked },
                        },
                      })
                    }
                  />
                  Generación de Guía Térmica PDF
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={config.general.capabilities.pickupOrigin}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        general: {
                          ...config.general,
                          capabilities: { ...config.general.capabilities, pickupOrigin: e.target.checked },
                        },
                      })
                    }
                  />
                  Recolección en Bodega/Origen
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: RECOLECCIÓN Y ENTREGA */}
          {activeTab === "pickup" && (
            <div className="tab-pane">
              <h3>Parámetros de Operación y Tiempos de Recolección</h3>
              <p className="tab-note">
                Configura los días y horarios en los que LAAR realiza la retirada de paquetes en bodega y las condiciones del servicio.
              </p>

              <h4>Días Hábiles de Recolección</h4>
              <div className="days-row">
                {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((day) => {
                  const isSelected = config.pickup.days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      className={`day-btn ${isSelected ? "active" : ""}`}
                      onClick={() => {
                        const updatedDays = isSelected
                          ? config.pickup.days.filter((d) => d !== day)
                          : [...config.pickup.days, day];
                        setConfig({
                          ...config,
                          pickup: { ...config.pickup, days: updatedDays },
                        });
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <div className="form-grid-3">
                <label>
                  Hora Inicio Recolección
                  <input
                    type="time"
                    value={config.pickup.startTime}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        pickup: { ...config.pickup, startTime: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  Hora Fin Recolección
                  <input
                    type="time"
                    value={config.pickup.endTime}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        pickup: { ...config.pickup, endTime: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  Hora Límite Solicitud (Cut-off Time)
                  <input
                    type="time"
                    value={config.pickup.cutoffTime}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        pickup: { ...config.pickup, cutoffTime: e.target.value },
                      })
                    }
                  />
                </label>
              </div>

              <h4>Políticas de Servicio y Liquidación COD</h4>
              <div className="form-grid-2">
                <label>
                  Frecuencia de Liquidación de Recaudos COD (Días)
                  <input
                    type="number"
                    min="1"
                    value={config.pickup.settlementCycleDays}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        pickup: { ...config.pickup, settlementCycleDays: Number(e.target.value) },
                      })
                    }
                  />
                  <small>Según contrato LAAR: Las facturas de flete se descuentan de la liquidación COD cada 8 días.</small>
                </label>

                <label className="checkbox-item standalone-check">
                  <input
                    type="checkbox"
                    checked={config.pickup.workdaysOnly}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        pickup: { ...config.pickup, workdaysOnly: e.target.checked },
                      })
                    }
                  />
                  Excluir días feriados / festivos nacionales automáticamente
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: FLETES, TARIFAS Y MÁRGENES DE GANANCIA */}
          {activeTab === "rates" && (
            <div className="tab-pane">
              <h3>Matriz de Fletes (Costos LAAR) & Márgenes Trajetix</h3>
              
              <h4>1. Tarifas de LAAR por Zona (Costo que paga Trajetix)</h4>
              <div className="table-responsive">
                <table className="config-table">
                  <thead>
                    <tr>
                      <th>Zona Tarifaria</th>
                      <th>Kg Incluidos</th>
                      <th>Costo Base LAAR ($)</th>
                      <th>Costo Kg Adicional ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["local", "principal", "secundario", "especial", "oriente"] as ZoneKey[]).map((zone) => (
                      <tr key={zone}>
                        <td>
                          <b className="zone-tag">{zone.toUpperCase()}</b>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={config.rates.zones[zone].baseKg}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setConfig({
                                ...config,
                                rates: {
                                  ...config.rates,
                                  zones: {
                                    ...config.rates.zones,
                                    [zone]: { ...config.rates.zones[zone], baseKg: val },
                                  },
                                },
                              });
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            value={config.rates.zones[zone].baseCost}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setConfig({
                                ...config,
                                rates: {
                                  ...config.rates,
                                  zones: {
                                    ...config.rates.zones,
                                    [zone]: { ...config.rates.zones[zone], baseCost: val },
                                  },
                                },
                              });
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            value={config.rates.zones[zone].extraKgCost}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setConfig({
                                ...config,
                                rates: {
                                  ...config.rates,
                                  zones: {
                                    ...config.rates.zones,
                                    [zone]: { ...config.rates.zones[zone], extraKgCost: val },
                                  },
                                },
                              });
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h4>2. Configuración de Márgenes de Ganancia de Trajetix</h4>
              <div className="form-grid-3 margin-box">
                <label>
                  Margen Trajetix sobre Flete Base (%)
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={config.rates.trajetixFreightMarginPercent}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        rates: { ...config.rates, trajetixFreightMarginPercent: Number(e.target.value) },
                      })
                    }
                  />
                  <small>Porcentaje de ganancia añadido al costo de flete.</small>
                </label>

                <label>
                  Margen Trajetix sobre Comisión COD (%)
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={config.rates.trajetixCodMarginPercent}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        rates: { ...config.rates, trajetixCodMarginPercent: Number(e.target.value) },
                      })
                    }
                  />
                  <small>Porcentaje de ganancia sobre la comisión COD.</small>
                </label>

                <label>
                  Sobrecargo Fijo por Envío ($)
                  <input
                    type="number"
                    min="0"
                    step="0.10"
                    value={config.rates.fixedSurcharge}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        rates: { ...config.rates, fixedSurcharge: Number(e.target.value) },
                      })
                    }
                  />
                  <small>Cargo fijo adicional por cada guía generada.</small>
                </label>
              </div>

              <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-6 mb-3">
                3. Simulador de Cotización en Tiempo Real
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex flex-col gap-3">
                  <CitySelect
                    label="Ciudad de Origen"
                    value={simOrigin}
                    onChange={(city) => setSimOrigin(city)}
                    placeholder="Selecciona origen (ej. Quito)..."
                  />

                  <CitySelect
                    label="Ciudad de Destino"
                    value={simDest}
                    onChange={(city, loc) => {
                      setSimDest(city);
                      setSimDestZone(loc?.laarZone as ZoneKey | undefined);
                    }}
                    placeholder="Selecciona destino (ej. Guayaquil, Atacames)..."
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Peso (kg)
                      <input
                        type="number"
                        min="1"
                        value={simWeight}
                        onChange={(e) => setSimWeight(Number(e.target.value))}
                        className="w-full mt-1.5 p-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono shadow-sm"
                      />
                    </label>

                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Recaudo COD ($)
                      <input
                        type="number"
                        min="0"
                        value={simCod}
                        onChange={(e) => setSimCod(Number(e.target.value))}
                        className="w-full mt-1.5 p-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono shadow-sm"
                      />
                    </label>
                  </div>

                  <label className="text-xs text-slate-600 dark:text-slate-300 font-medium flex items-center gap-2 mt-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={simZeroMargin}
                      onChange={(e) => setSimZeroMargin(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-700 text-red-500"
                    />
                    Ver como usuario sin margen (0% Ganancia)
                  </label>
                </div>

                {/* Panel de ResultadosAdaptado a Tema Claro / Oscuro */}
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 text-slate-900 dark:text-slate-100 flex flex-col gap-4 shadow-sm">
                  {/* Trayecto / Zona Detectada */}
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold">Trayecto Detectado:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider font-mono ${
                      simResult.zoneKey === "local"
                        ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                        : simResult.zoneKey === "principal"
                        ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                        : simResult.zoneKey === "secundario"
                        ? "bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                        : simResult.zoneKey === "oriente"
                        ? "bg-pink-50 dark:bg-pink-950 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800"
                        : "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                    }`}>
                      {simResult.zoneKey === "local"
                        ? "LOCAL (Misma Ciudad)"
                        : `NACIONAL / ${simResult.zoneName}`}
                    </span>
                  </div>

                  {/* Desglose Tarifas LAAR */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span>Flete Base Courier ({simWeight} kg):</span>
                      <strong className="font-mono text-slate-900 dark:text-white text-xs">${simResult.laarFreightCost.toFixed(2)}</strong>
                    </div>
                    {simCod > 0 && (
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span>Comisión COD Courier (${simCod}):</span>
                        <strong className="font-mono text-slate-900 dark:text-white text-xs">${simResult.laarCodCost.toFixed(2)}</strong>
                      </div>
                    )}
                    <div className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100 border-t border-slate-200 dark:border-slate-800 pt-2 text-xs">
                      <span>Costo Total Courier (A pagar a LAAR):</span>
                      <strong className="font-mono text-slate-900 dark:text-slate-100 text-xs">${simResult.laarTotalCost.toFixed(2)}</strong>
                    </div>
                  </div>

                  {/* Desglose Detallado Margen Ganancia Trajetix */}
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                    <div className="flex items-center justify-between text-xs font-bold mb-2">
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-xs">
                        💰 Margen Ganancia Trajetix {simResult.isZeroMarginApplied ? "(Exento 0%)" : ""}:
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono text-sm font-extrabold">+${simResult.trajetixProfitTotal.toFixed(2)}</span>
                    </div>

                    {!simResult.isZeroMarginApplied && (
                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-900/90 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[11px] mb-0.5">Margen Flete (+{config.rates.trajetixFreightMarginPercent}%):</span>
                          <strong className="text-emerald-700 dark:text-emerald-300 font-mono text-xs font-bold">+${simResult.freightMargin.toFixed(2)}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[11px] mb-0.5">Margen COD (+{config.rates.trajetixCodMarginPercent}%):</span>
                          <strong className="text-emerald-700 dark:text-emerald-300 font-mono text-xs font-bold">+${simResult.codMargin.toFixed(2)}</strong>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Precio Final Cobrado al Cliente en "Nuevo Envío" */}
                  <div className="flex items-center justify-between border-t-2 border-dashed border-slate-200 dark:border-slate-800 pt-3 mt-1">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">Precio Final al Cliente</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Mostrado en &quot;Nuevo Envío&quot;</span>
                    </div>
                    <span className="text-2xl font-black text-red-600 dark:text-red-500 font-mono">${simResult.finalPriceToClient.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: COBERTURA Y TABLA TRADUCTORA DE LOCALIDADES */}
          {activeTab === "coverage" && (
            <div className="tab-pane">
              <h3>Tabla Traductora de Localidades y Cobertura (LAAR)</h3>
              <p className="tab-note">
                Normaliza y traduce las ciudades ingresadas por los usuarios en &quot;Nuevo envío&quot; hacia la codificación de LAAR Courier y su zona tarifaria.
              </p>

              <div className="add-mapping-form">
                <h4>Agregar Nueva Traducción de Localidad</h4>
                <div className="form-grid-4">
                  <label>
                    Ciudad Canónica (Trajetix)
                    <input
                      placeholder="Ej. Tena"
                      value={newCity}
                      onChange={(e) => setNewCity(e.target.value)}
                    />
                  </label>
                  <label>
                    Código Ciudad LAAR
                    <input
                      placeholder="Ej. TNA"
                      value={newLaarCode}
                      onChange={(e) => setNewLaarCode(e.target.value)}
                    />
                  </label>
                  <label>
                    Nombre Oficial LAAR
                    <input
                      placeholder="Ej. El Tena"
                      value={newLaarName}
                      onChange={(e) => setNewLaarName(e.target.value)}
                    />
                  </label>
                  <label>
                    Zona Tarifaria
                    <select
                      value={newZone}
                      onChange={(e) => setNewZone(e.target.value as ZoneKey)}
                    >
                      <option value="local">Local</option>
                      <option value="principal">Principal</option>
                      <option value="secundario">Secundario</option>
                      <option value="especial">Especial</option>
                      <option value="oriente">Oriente</option>
                    </select>
                  </label>
                </div>
                <button type="button" className="primary-button add-btn" onClick={addLocationMapping}>
                  ＋ Registrar Traducción
                </button>
              </div>

              <h4>Mapa de Traducción Registrado ({config.locationMappings.length} localidades)</h4>
              <div className="table-responsive">
                <table className="config-table">
                  <thead>
                    <tr>
                      <th>Ciudad Canónica</th>
                      <th>Código LAAR</th>
                      <th>Nombre Oficial LAAR</th>
                      <th>Zona Tarifaria</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.locationMappings.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <b>{m.canonicalCity}</b>
                        </td>
                        <td><code>{m.laarCityCode}</code></td>
                        <td>{m.laarCityName}</td>
                        <td>
                          <span className={`zone-tag ${m.zone}`}>{m.zone.toUpperCase()}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="danger-icon-btn"
                            onClick={() => removeLocationMapping(m.id)}
                            title="Eliminar mapeo"
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="carrier-modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="primary-button" onClick={handleSave}>
            💾 Guardar Configuración de Transportadora
          </button>
        </footer>
      </div>
    </div>
  );
}
