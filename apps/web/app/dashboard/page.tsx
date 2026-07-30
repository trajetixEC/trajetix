import type { Metadata } from "next";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { DashboardApp } from "./dashboard-app";

export const metadata: Metadata = { title: "Centro de operaciones" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login" as Route);
  return <DashboardApp user={{ name: session.user.name ?? "Usuario", role: session.user.roles[0] ?? "viewer", tenant: session.user.tenantName ?? "Mi organización", permissions: session.user.permissions }} />;
}
