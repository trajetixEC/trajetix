"use client";

import { useState } from "react";
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
    } catch (err: any) {
      setApiStatus({ success: false, message: err.message || "Error al conectar con la API de LAAR" });
    } finally {
      setTestingApi(false);
    }
  };

  const simResult = calculateCarrierFreightRate({
    config,
    originCity: simOrigin,
    destinationCity: simDest,
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
            📋 1. Información General
          </button>
          <button
            type="button"
            className={activeTab === "pickup" ? "active" : ""}
            onClick={() => setActiveTab("pickup")}
          >
            🚛 2. Recolección y Entrega
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
            🗺️ 4. Cobertura y Localidades
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

              <h4>3. Simulador de Cotización en Tiempo Real</h4>
              <div className="simulator-panel">
                <div className="sim-inputs">
                  <label>
                    Origen
                    <input value={simOrigin} onChange={(e) => setSimOrigin(e.target.value)} />
                  </label>
                  <label>
                    Destino
                    <input value={simDest} onChange={(e) => setSimDest(e.target.value)} />
                  </label>
                  <label>
                    Peso (kg)
                    <input
                      type="number"
                      min="1"
                      value={simWeight}
                      onChange={(e) => setSimWeight(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Recaudo COD ($)
                    <input
                      type="number"
                      min="0"
                      value={simCod}
                      onChange={(e) => setSimCod(Number(e.target.value))}
                    />
                  </label>
                  <label className="checkbox-item sim-check">
                    <input
                      type="checkbox"
                      checked={simZeroMargin}
                      onChange={(e) => setSimZeroMargin(e.target.checked)}
                    />
                    Ver como usuario sin margen (0% Ganancia)
                  </label>
                </div>

                <div className="sim-results">
                  <div className="sim-badge">Zona detectada: {simResult.zoneName}</div>
                  <div className="sim-row">
                    <span>Costo Flete LAAR:</span>
                    <strong>${simResult.laarFreightCost.toFixed(2)}</strong>
                  </div>
                  <div className="sim-row">
                    <span>Costo COD LAAR:</span>
                    <strong>${simResult.laarCodCost.toFixed(2)}</strong>
                  </div>
                  <div className="sim-row highlight-subtotal">
                    <span>Costo Total LAAR (A pagar a courier):</span>
                    <strong>${simResult.laarTotalCost.toFixed(2)}</strong>
                  </div>
                  <div className="sim-row profit-row">
                    <span>
                      Margen Ganancia Trajetix {simResult.isZeroMarginApplied ? "(Exento 0%)" : ""}:
                    </span>
                    <strong className="profit-text">+${simResult.trajetixProfitTotal.toFixed(2)}</strong>
                  </div>
                  <div className="sim-row final-total">
                    <span>Precio Final en "Nuevo Envío":</span>
                    <strong className="final-price">${simResult.finalPriceToClient.toFixed(2)}</strong>
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
                Normaliza y traduce las ciudades ingresadas por los usuarios en "Nuevo envío" hacia la codificación de LAAR Courier y su zona tarifaria.
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
