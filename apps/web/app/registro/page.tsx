"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name"),
      organization: form.get("organization"),
      email: form.get("email"),
      password: form.get("password"),
      referralCode:
        new URLSearchParams(window.location.search).get("ref") ?? undefined,
    };
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "No se pudo crear la cuenta");
      setLoading(false);
      return;
    }
    const result = await signIn("credentials", {
      email: payload.email,
      password: payload.password,
      redirect: false,
    });
    if (result?.error) {
      setError("Cuenta creada. Inicia sesión manualmente.");
      setLoading(false);
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <main className="simple-auth">
      <div>
        <span>＋</span>
        <h1>Crear cuenta propietaria</h1>
        <p>Tu empresa quedará lista para operar en pocos minutos.</p>
        <form onSubmit={submit}>
          <label>
            Nombre completo
            <input name="name" required minLength={2} />
          </label>
          <label>
            Nombre de la tienda
            <input name="organization" required minLength={2} placeholder="ej. Mi Tienda Express" />
          </label>
          <label>
            Correo electrónico
            <input name="email" type="email" required />
          </label>
          <label>
            Contraseña
            <input name="password" type="password" minLength={12} required />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" disabled={loading}>
            {loading ? "Creando..." : "Crear espacio seguro"}
          </button>
        </form>
      </div>
    </main>
  );
}
