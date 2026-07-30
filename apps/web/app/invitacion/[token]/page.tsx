import { createHash } from "node:crypto";
import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { getPrisma } from "../../../lib/prisma";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getPrisma().invitation.findUnique({ where: { tokenHash: createHash("sha256").update(token).digest("hex") }, include: { tenant: true } });
  if (!invitation || invitation.expiresAt < new Date()) return <main className="simple-auth"><div><span>!</span><h1>Invitación no válida</h1><p>El enlace expiró o ya no está disponible.</p><Link href={"/login" as Route}>Ir al inicio de sesión</Link></div></main>;
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=${encodeURIComponent(`/invitacion/${token}`)}` as Route);
  if (session.user.email?.toLowerCase() !== invitation.email) return <main className="simple-auth"><div><span>!</span><h1>Usa el correo invitado</h1><p>Esta invitación pertenece a {invitation.email}. Cierra sesión e ingresa con esa cuenta.</p></div></main>;
  redirect("/dashboard");
}
