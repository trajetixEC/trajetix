import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage() {
  const session = await auth(); if (session?.user) redirect("/dashboard");
  return <LoginForm available={{ google: Boolean(process.env.AUTH_GOOGLE_ID), magic: Boolean(process.env.RESEND_API_KEY) }} />;
}
