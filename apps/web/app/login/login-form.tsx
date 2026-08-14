"use client";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import type { Route } from "next";
import { Eye, EyeOff } from "lucide-react";

type Availability = { google: boolean; magic: boolean };
const social = [{ id: "google", label: "Google", mark: "G" }] as const;

export function LoginForm({ available }: { available: Availability }) {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));

    if (mode === "magic") {
      const result = await signIn("resend", {
        email,
        redirect: false,
        callbackUrl: "/dashboard",
      });
      setLoading(false);
      if (result?.error)
        setError("No se pudo enviar el enlace. Revisa la configuración de correo.");
      else setSent(true);
      return;
    }

    const result = await signIn("credentials", {
      email,
      password: String(form.get("password")),
      otp: String(form.get("otp") ?? ""),
      redirect: false,
      callbackUrl: "/dashboard",
    });
    setLoading(false);
    if (result?.error)
      setError("Credenciales o código de seguridad incorrectos.");
    else window.location.href = "/dashboard";
  }

  return (
    <main className="auth-page">
      <section className="auth-brand">
        <Link href="/">
          <Image
            src="/brand/trajetix-logo.png"
            alt="TrajetixERP"
            width={620}
            height={248}
            priority
          />
        </Link>
        <div>
          <span className="eyebrow">ACCESO SEGURO</span>
          <h1>
            Tu operación,
            <br />
            bajo control.
          </h1>
          <p>Un espacio protegido para gestionar cada pedido, producto y entrega.</p>
        </div>
        <small>© 2026 TrajetixERP · Privacidad · Términos</small>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-card">
          <span className="auth-lock">⌾</span>
          <h2>Bienvenido de nuevo</h2>
          <p>Ingresa a tu espacio de trabajo</p>
          <div className="social-grid">
            {social.map((provider) => {
              const enabled = available.google;
              return (
                <button
                  key={provider.id}
                  disabled={!enabled}
                  title={
                    enabled
                      ? `Continuar con ${provider.label}`
                      : `Configura ${provider.label} en variables de entorno`
                  }
                  onClick={() => signIn(provider.id, { callbackUrl: "/dashboard" })}
                >
                  <b>{provider.mark}</b>
                  {provider.label}
                </button>
              );
            })}
          </div>
          <div className="auth-divider">
            <span>o continúa con tu correo</span>
          </div>
          {sent ? (
            <div className="auth-success">
              <b>✓ Revisa tu correo</b>
              <p>Enviamos un enlace seguro para iniciar sesión.</p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <label>
                Correo electrónico
                <input name="email" type="email" required placeholder="tu@empresa.com" />
              </label>
              {mode === "password" && (
                <>
                  <label className="relative">
                    Contraseña
                    <div className="relative mt-1">
                      <input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        placeholder="••••••••••••"
                        style={{ paddingRight: "2.5rem" }}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: "absolute",
                          right: "0.75rem",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          padding: "0.25rem",
                        }}
                        title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      >
                        {showPassword ? (
                          <EyeOff style={{ width: "1rem", height: "1rem" }} />
                        ) : (
                          <Eye style={{ width: "1rem", height: "1rem" }} />
                        )}
                      </button>
                    </div>
                  </label>
                  <label>
                    Código 2FA <small>(si está habilitado)</small>
                    <input
                      name="otp"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      placeholder="000000"
                    />
                  </label>
                </>
              )}
              {error && <div className="auth-error">{error}</div>}
              <button
                className="auth-submit"
                disabled={loading || (mode === "magic" && !available.magic)}
              >
                {loading
                  ? "Procesando..."
                  : mode === "password"
                  ? "Iniciar sesión"
                  : "Enviar enlace mágico"}
              </button>
            </form>
          )}
          <div className="auth-links">
            <button
              onClick={() => {
                setMode(mode === "password" ? "magic" : "password");
                setSent(false);
                setError("");
              }}
            >
              {mode === "password" ? "Usar Magic Link" : "Usar contraseña"}
            </button>
            <Link href={"/recuperar" as Route}>¿Olvidaste tu contraseña?</Link>
          </div>
          <p className="auth-note">
            Primera instalación:{" "}
            <Link href={"/registro" as Route}>crear cuenta propietaria</Link>
          </p>
          <p className="auth-note">
            ¿Recibiste una invitación? Ábrela desde tu correo para unirte al equipo.
          </p>
        </div>
      </section>
    </main>
  );
}
