"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type AccountData = {
  user: {
    id: string;
    publicId: string;
    name: string;
    email: string;
    phone: string;
    identificationType: string;
    identificationNumber: string;
    appearance: "LIGHT" | "DARK" | "SYSTEM";
    status: string;
    emailVerified: boolean;
    role: string;
    owner: boolean;
    hasPassword: boolean;
  };
  company: {
    displayName: string;
    legalName: string;
    phone: string;
    email: string;
    address: string;
    status: string;
  };
  billing: {
    identificationType: string;
    identificationNumber: string;
    legalName: string;
    fiscalAddress: string;
    phone: string;
    email: string;
  };
};

type ProfileModuleProps = {
  onUpdated: (name: string, tenant: string) => void;
};

async function profileRequest(body?: unknown) {
  const response = await fetch(
    "/api/account/profile",
    body
      ? {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const data = (await response.json()) as AccountData & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "No se pudo guardar");
  return data;
}

function Field({
  label,
  name,
  value,
  disabled,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  disabled: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        disabled={disabled}
        placeholder={placeholder}
      />
    </label>
  );
}

export function ProfileModule({ onUpdated }: ProfileModuleProps) {
  const [data, setData] = useState<AccountData | null>(null);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await profileRequest());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cancel = () => {
    setEditing(false);
    setMessage("");
    setFormKey((value) => value + 1);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data) return;
    setLoading(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "");
    try {
      const currentPassword = value("currentPassword");
      const newPassword = value("newPassword");
      const confirmPassword = value("confirmPassword");
      if (currentPassword || newPassword || confirmPassword) {
        await profileRequest({
          action: "password",
          currentPassword,
          newPassword,
          confirmPassword,
        });
      }
      await profileRequest({
        action: "profile",
        name: value("name"),
        phone: value("phone"),
        identificationType: value("identificationType"),
        identificationNumber: value("identificationNumber"),
        ...(data.user.owner
          ? {
              company: {
                displayName: value("companyDisplayName"),
                legalName: value("companyLegalName"),
                phone: value("companyPhone"),
                email: value("companyEmail"),
                address: value("companyAddress"),
              },
              billing: {
                identificationType: value("billingIdentificationType"),
                identificationNumber: value("billingIdentificationNumber"),
                legalName: value("billingLegalName"),
                fiscalAddress: value("billingFiscalAddress"),
                phone: value("billingPhone"),
                email: value("billingEmail"),
              },
            }
          : {}),
      });
      const fresh = await profileRequest();
      setData(fresh);
      onUpdated(fresh.user.name, fresh.company.displayName);
      setEditing(false);
      setFormKey((current) => current + 1);
      setMessage("Cambios guardados correctamente");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data)
    return <div className="profile-loading">Cargando tu perfil…</div>;
  if (!data)
    return (
      <div className="profile-loading">{message || "Perfil no disponible"}</div>
    );

  const initials = data.user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <form className="profile-page" key={formKey} onSubmit={submit}>
      <section className="profile-hero">
        <span>{initials}</span>
        <div>
          <small>MI CUENTA TRAJETIX</small>
          <h1>{data.user.name}</h1>
          <p>{data.user.email}</p>
        </div>
        <div className="profile-hero-badges">
          <b>{data.user.role}</b>
          <b className="active">
            {data.user.status === "ACTIVE" ? "Activo" : data.user.status}
          </b>
        </div>
      </section>

      <div className="profile-edit-bar">
        <div>
          <strong>
            {editing ? "Modo de edición" : "Información de la cuenta"}
          </strong>
          <small>
            Actualiza tus datos personales, empresariales y de facturación.
          </small>
        </div>
        {editing ? (
          <div>
            <button type="button" className="secondary-button" onClick={cancel}>
              Cancelar
            </button>
            <button type="submit" className="primary-button" disabled={loading}>
              Guardar cambios
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="primary-button"
            onClick={() => setEditing(true)}
          >
            Editar perfil y configuración
          </button>
        )}
      </div>

      {message && (
        <div
          className={`profile-message ${message.includes("correctamente") ? "success" : ""}`}
        >
          {message}
        </div>
      )}

      <div className="profile-grid">
        <div>
          <section className="profile-card">
            <h2>Configuración del perfil</h2>
            <p>Mantén actualizada tu información personal.</p>
            <div className="profile-fields">
              <Field
                label="Nombre completo"
                name="name"
                value={data.user.name}
                disabled={!editing}
              />
              <Field
                label="Teléfono móvil"
                name="phone"
                value={data.user.phone}
                disabled={!editing}
              />
              <Field
                label="Correo electrónico"
                name="email"
                value={data.user.email}
                disabled
                type="email"
              />
              <label>
                Tipo de identificación
                <select
                  name="identificationType"
                  defaultValue={data.user.identificationType}
                  disabled={!editing}
                >
                  <option value="">Seleccionar…</option>
                  <option value="CEDULA">Cédula</option>
                  <option value="RUC">RUC</option>
                  <option value="PASAPORTE">Pasaporte</option>
                </select>
              </label>
              <Field
                label="Número de identificación"
                name="identificationNumber"
                value={data.user.identificationNumber}
                disabled={!editing}
              />
            </div>
          </section>

          <section className="profile-card">
            <h2>Empresa</h2>
            <p>
              {data.user.owner
                ? "Datos legales y de contacto de tu empresa."
                : "Sólo el propietario puede modificar estos datos."}
            </p>
            <div className="profile-fields">
              <Field
                label="Nombre comercial"
                name="companyDisplayName"
                value={data.company.displayName}
                disabled={!editing || !data.user.owner}
              />
              <Field
                label="Razón social"
                name="companyLegalName"
                value={data.company.legalName}
                disabled={!editing || !data.user.owner}
              />
              <Field
                label="Teléfono"
                name="companyPhone"
                value={data.company.phone}
                disabled={!editing || !data.user.owner}
              />
              <Field
                label="Correo de empresa"
                name="companyEmail"
                value={data.company.email}
                disabled={!editing || !data.user.owner}
                type="email"
              />
              <Field
                label="Dirección"
                name="companyAddress"
                value={data.company.address}
                disabled={!editing || !data.user.owner}
              />
            </div>
          </section>

          <section className="profile-card">
            <h2>Datos de facturación</h2>
            <p>
              Trajetix emite con estos datos las facturas por servicios de
              envío.
            </p>
            <div className="profile-fields">
              <label>
                Tipo de identificación
                <select
                  name="billingIdentificationType"
                  defaultValue={data.billing.identificationType}
                  disabled={!editing || !data.user.owner}
                >
                  <option value="">Seleccionar…</option>
                  <option value="CEDULA">Cédula</option>
                  <option value="RUC">RUC</option>
                  <option value="PASAPORTE">Pasaporte</option>
                </select>
              </label>
              <Field
                label="Número (Cédula / RUC)"
                name="billingIdentificationNumber"
                value={data.billing.identificationNumber}
                disabled={!editing || !data.user.owner}
              />
              <Field
                label="Razón social / Nombre para factura"
                name="billingLegalName"
                value={data.billing.legalName}
                disabled={!editing || !data.user.owner}
              />
              <Field
                label="Dirección fiscal"
                name="billingFiscalAddress"
                value={data.billing.fiscalAddress}
                disabled={!editing || !data.user.owner}
              />
              <Field
                label="Teléfono de facturación"
                name="billingPhone"
                value={data.billing.phone}
                disabled={!editing || !data.user.owner}
              />
              <Field
                label="Email de facturación"
                name="billingEmail"
                value={data.billing.email}
                disabled={!editing || !data.user.owner}
                type="email"
              />
            </div>
          </section>
        </div>

        <div>
          <section className="profile-card account-details">
            <h2>Detalles de la cuenta</h2>
            <dl>
              <div>
                <dt>ID de usuario</dt>
                <dd>{data.user.publicId}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd className="status-active">
                  ●{" "}
                  {data.user.status === "ACTIVE" ? "Activo" : data.user.status}
                </dd>
              </div>
              <div>
                <dt>Empresa</dt>
                <dd>{data.company.displayName}</dd>
              </div>
              <div>
                <dt>Estado de empresa</dt>
                <dd>{data.company.status}</dd>
              </div>
              <div>
                <dt>Correo verificado</dt>
                <dd>{data.user.emailVerified ? "Sí" : "Pendiente"}</dd>
              </div>
            </dl>
          </section>

          <section className="profile-card">
            <h2>Cambiar contraseña</h2>
            <p>
              {data.user.hasPassword
                ? "La contraseña nueva debe tener al menos 12 caracteres."
                : "Tu acceso actual usa Google o enlace mágico. Para crear una clave usa Recuperar contraseña."}
            </p>
            <div className="profile-fields password-fields">
              <Field
                label="Contraseña actual"
                name="currentPassword"
                value=""
                disabled={!editing || !data.user.hasPassword}
                type="password"
              />
              <Field
                label="Nueva contraseña"
                name="newPassword"
                value=""
                disabled={!editing || !data.user.hasPassword}
                type="password"
              />
              <Field
                label="Confirmar contraseña nueva"
                name="confirmPassword"
                value=""
                disabled={!editing || !data.user.hasPassword}
                type="password"
              />
            </div>
          </section>
        </div>
      </div>
    </form>
  );
}
