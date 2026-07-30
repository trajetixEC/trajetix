"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type ReferralData = {
  code: string;
  commissionMinor: number;
  totals: {
    referrals: number;
    active: number;
    networkShipments: number;
    earnedMinor: number;
  };
  referrals: Array<{
    id: string;
    company: string;
    status: string;
    shipments: number;
    commissionMinor: number;
    joinedAt: string;
  }>;
};

const usd = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
});

export function ReferralsModule() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/referrals", { cache: "no-store" });
    const body = (await response.json().catch(() => ({}))) as
      ReferralData | { error?: string };
    if (!response.ok || !("code" in body)) {
      setNotice(
        "error" in body
          ? (body.error ?? "No se pudo cargar")
          : "No se pudo cargar",
      );
      setLoading(false);
      return;
    }
    setData(body);
    setCode(body.code);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const referralUrl = data ? `https://trajetix.com/r/${data.code}` : "";

  async function copyLink() {
    await navigator.clipboard.writeText(referralUrl);
    setNotice("Enlace copiado. Ya puedes compartirlo.");
  }

  async function saveCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    const response = await fetch("/api/referrals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      code?: string;
      error?: string;
    };
    setSaving(false);
    if (!response.ok || !body.code) {
      setNotice(body.error ?? "No se pudo personalizar el enlace");
      return;
    }
    setData((current) =>
      current ? { ...current, code: body.code! } : current,
    );
    setCode(body.code);
    setEditing(false);
    setNotice("Enlace personalizado correctamente.");
  }

  if (loading) {
    return <div className="module-loading">Cargando tu red de referidos…</div>;
  }
  if (!data) {
    return (
      <section className="referrals-page">
        <div className="module-empty">
          <h2>No se pudo abrir Referidos</h2>
          <p>{notice}</p>
          <button className="secondary-button" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="referrals-page">
      <header className="module-heading referral-heading">
        <div>
          <span className="eyebrow">CRECE CON TU RED</span>
          <h1>Mis referidos</h1>
          <p>
            Invita a otras empresas a usar TrajetixERP y gana{" "}
            {usd.format(data.commissionMinor / 100)} por cada envío que generen.
          </p>
        </div>
        <div className="referral-rate">
          <small>Comisión por envío</small>
          <strong>{usd.format(data.commissionMinor / 100)}</strong>
          <span>acreditación automática</span>
        </div>
      </header>

      <article className="referral-link-card">
        <div className="referral-card-title">
          <span>↗</span>
          <div>
            <strong>Tu enlace de referido</strong>
            <small>Compártelo con otras personas o empresas.</small>
          </div>
        </div>
        {editing ? (
          <form className="referral-edit" onSubmit={saveCode}>
            <span>trajetix.com/r/</span>
            <input
              aria-label="Código personalizado"
              value={code}
              onChange={(event) => setCode(event.target.value.toLowerCase())}
              minLength={3}
              maxLength={50}
              pattern="[a-zA-Z0-9-]+"
              required
            />
            <button className="primary-button" disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setCode(data.code);
                setEditing(false);
              }}
            >
              Cancelar
            </button>
          </form>
        ) : (
          <div className="referral-link-row">
            <code>{referralUrl}</code>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void copyLink()}
            >
              ▣ Copiar
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setEditing(true)}
            >
              ✎ Personalizar
            </button>
          </div>
        )}
        <p className="referral-help">
          Cuando alguien cree una empresa desde este enlace, sus envíos sumarán
          comisiones directamente a tu billetera.
        </p>
        {notice && <div className="referral-notice">{notice}</div>}
      </article>

      <div className="referral-metrics">
        <article>
          <span>Personas invitadas</span>
          <strong>{data.totals.referrals}</strong>
          <small>{data.totals.active} cuentas activas</small>
        </article>
        <article>
          <span>Envíos de mi red</span>
          <strong>{data.totals.networkShipments}</strong>
          <small>guías que generaron comisión</small>
        </article>
        <article className="commission-total">
          <span>Comisiones ganadas</span>
          <strong>{usd.format(data.totals.earnedMinor / 100)}</strong>
          <small>total acreditado en tu billetera</small>
        </article>
      </div>

      <article className="referral-table-card">
        <div className="referral-table-heading">
          <div>
            <h2>Empresas de mi red</h2>
            <p>Actividad real generada por cada referido.</p>
          </div>
          <span>{data.referrals.length} referidos</span>
        </div>
        {data.referrals.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Estado</th>
                  <th>Envíos</th>
                  <th>Comisión total</th>
                  <th>Desde</th>
                </tr>
              </thead>
              <tbody>
                {data.referrals.map((referral) => (
                  <tr key={referral.id}>
                    <td>
                      <strong>{referral.company}</strong>
                    </td>
                    <td>
                      <span className="referral-status">
                        {referral.status === "ACTIVE"
                          ? "Activo"
                          : referral.status}
                      </span>
                    </td>
                    <td>{referral.shipments}</td>
                    <td className="referral-earned">
                      {usd.format(referral.commissionMinor / 100)}
                    </td>
                    <td>
                      {new Intl.DateTimeFormat("es-EC", {
                        dateStyle: "medium",
                      }).format(new Date(referral.joinedAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="referral-empty">
            <span>↗</span>
            <h3>Tu red empieza con el primer enlace</h3>
            <p>
              Copia tu enlace y compártelo. Aquí aparecerán únicamente referidos
              y envíos reales.
            </p>
          </div>
        )}
      </article>
    </section>
  );
}
