import type { Metadata } from "next";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { DashboardApp } from "./dashboard-app";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Centro de operaciones" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login" as Route);

  const isSuperAdmin = (session.user as Record<string, unknown>).platformRole === "SUPER_ADMIN";
  const rawRole = session.user.roles[0] ?? "viewer";
  const roleLabel = isSuperAdmin
    ? "SuperAdmin"
    : rawRole.toLowerCase() === "owner"
    ? "Propietario"
    : rawRole;

  return (
    <DashboardApp
      user={{
        name: session.user.name ?? "Usuario",
        role: roleLabel,
        tenant: session.user.tenantName ?? "Mi organización",
        permissions: session.user.permissions,
      }}
    />
  );
}
