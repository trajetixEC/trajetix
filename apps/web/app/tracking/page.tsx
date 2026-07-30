import type { Metadata } from "next";
import { PublicTracking } from "./tracking-client";

export const metadata: Metadata = { title: "Rastrear envío · TrajetixERP", description: "Consulta el estado y el historial de tu paquete." };

export default async function TrackingPage({ searchParams }: { searchParams: Promise<{ guia?: string }> }) {
  const params = await searchParams;
  return <PublicTracking initialGuide={params.guia ?? ""} />;
}
