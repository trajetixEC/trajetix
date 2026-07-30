"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type TrackingResult = { guide: string; carrier: string; service?: string; status: string; destination: string; recipient: string; updatedAt: string; events: Array<{ status: string; description: string; location?: string | null; occurredAt: string }> };

export function PublicTracking({ initialGuide = "" }: { initialGuide?: string }) {
  const [guide, setGuide] = useState(initialGuide);
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function search(event?: FormEvent) {
    event?.preventDefault(); if (guide.trim().length < 3) return;
    setLoading(true); setError(""); setResult(null);
    const response = await fetch(`/api/tracking/${encodeURIComponent(guide.trim())}`);
    const body = await response.json() as TrackingResult & { error?: string };
    if (response.ok) setResult(body); else setError(body.error ?? "No encontramos esa guía");
    setLoading(false);
  }
  return <main className="public-tracking"><div className="tracking-nav"><Link href="/">TrajetixERP</Link><Link href="/login">Acceso empresas</Link></div><section><span className="eyebrow">TRACKING MULTITRANSPORTADORA</span><h1>¿Dónde está tu paquete?</h1><p>Consulta guías de Servientrega, LaarCourier, Gintracom, Trajet y demás transportadoras integradas.</p><form onSubmit={search}><input value={guide} onChange={event => setGuide(event.target.value)} placeholder="Ingresa tu número de guía" autoFocus /><button disabled={loading}>{loading ? "Consultando…" : "Rastrear envío"}</button></form>{error && <p className="tracking-error">{error}</p>}{result && <article className="public-tracking-result"><header><div><small>{result.carrier} · {result.service}</small><h2>{result.guide}</h2><p>Destino: {result.destination}</p></div><b>{result.status}</b></header><div className="tracking-timeline">{result.events.length > 0 ? result.events.map((item,index) => <div key={`${item.occurredAt}-${index}`}><i></i><span><b>{item.description}</b><small>{item.location ? `${item.location} · ` : ""}{new Date(item.occurredAt).toLocaleString("es-EC")}</small></span></div>) : <div><i></i><span><b>Estado actual: {result.status}</b><small>Actualizado {new Date(result.updatedAt).toLocaleString("es-EC")}</small></span></div>}</div></article>}</section></main>;
}
