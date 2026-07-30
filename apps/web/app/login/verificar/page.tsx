import Link from "next/link";
import type { Route } from "next";
export default function VerifyPage() { return <main className="simple-auth"><div><span>✉</span><h1>Revisa tu correo</h1><p>Enviamos un enlace seguro para acceder a TrajetixERP.</p><Link href={"/login" as Route}>Volver al inicio de sesión</Link></div></main>; }
