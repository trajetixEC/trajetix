"use client";

import { FormEvent, useEffect, useState } from "react";
import { ECUADOR_BANKS } from "../../lib/ecuador-banks";
import { getZeroMarginUsers, setZeroMarginUser } from "../../lib/carrier-config-store";

type FinanceData = {
  wallet: { balance: number; currency: string };
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    createdAt: string;
  }>;
  accounts: Array<{
    id: string;
    bankName: string;
    accountType: string;
    accountLast4: string;
    holderName: string;
    isDefault: boolean;
  }>;
  withdrawals: Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: string;
    bankName: string;
    accountLast4: string;
  }>;
};
const emptyFinance: FinanceData = {
  wallet: { balance: 0, currency: "USD" },
  transactions: [],
  accounts: [],
  withdrawals: [],
};
const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
});

export function FinanceModule() {
  const [tab, setTab] = useState<"wallet" | "banks" | "withdrawals">("wallet");
  const [data, setData] = useState(emptyFinance);
  const [message, setMessage] = useState("");
  async function load() {
    const response = await fetch("/api/finance/overview");
    if (response.ok) setData((await response.json()) as FinanceData);
  }
  useEffect(() => {
    void load();
  }, []);
  async function addBank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetch("/api/finance/bank-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankCode: form.get("bankCode"),
        accountType: form.get("accountType"),
        accountNumber: form.get("accountNumber"),
        holderName: form.get("holderName"),
        holderId: form.get("holderId"),
        isDefault: form.has("isDefault"),
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setMessage(
      response.ok
        ? "Cuenta bancaria agregada"
        : (body.error ?? "No se pudo agregar"),
    );
    if (response.ok) {
      formElement.reset();
      await load();
    }
  }
  async function withdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetch("/api/finance/withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankAccountId: form.get("bankAccountId"),
        amount: Number(form.get("amount")),
        note: form.get("note"),
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setMessage(
      response.ok
        ? "Retiro solicitado"
        : (body.error ?? "No se pudo solicitar"),
    );
    if (response.ok) {
      formElement.reset();
      await load();
    }
  }
  return (
    <>
      <div className="page-header">
        <div>
          <span>FINANZAS</span>
          <h1>Finanzas</h1>
          <p>
            Administra saldo, cuentas bancarias y solicitudes de retiro de esta
            empresa.
          </p>
        </div>
      </div>
      <div className="finance-tabs">
        <button
          className={tab === "wallet" ? "active" : ""}
          onClick={() => setTab("wallet")}
        >
          Billetera
        </button>
        <button
          className={tab === "banks" ? "active" : ""}
          onClick={() => setTab("banks")}
        >
          Cuentas bancarias
        </button>
        <button
          className={tab === "withdrawals" ? "active" : ""}
          onClick={() => setTab("withdrawals")}
        >
          Retiros
        </button>
      </div>
      {message && (
        <p className="module-notice">
          {message}
          <button onClick={() => setMessage("")}>×</button>
        </p>
      )}
      {tab === "wallet" && (
        <>
          <section className="wallet-card">
            <span>Saldo disponible</span>
            <strong>{money.format(data.wallet.balance)}</strong>
            <small>Fondos disponibles para solicitar transferencias</small>
          </section>
          <section className="panel table-panel">
            <div className="panel-title">
              <div>
                <h2>Movimientos</h2>
                <p>Historial de créditos, débitos y fondos retenidos.</p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Tipo</th>
                    <th>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {new Date(item.createdAt).toLocaleString("es-EC")}
                      </td>
                      <td>{item.description}</td>
                      <td>{item.type}</td>
                      <td
                        className={
                          item.amount >= 0 ? "positive-money" : "danger-text"
                        }
                      >
                        {money.format(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.transactions.length === 0 && (
                <div className="empty">
                  <h3>Sin movimientos</h3>
                  <p>Los pagos y retiros aparecerán aquí.</p>
                </div>
              )}
            </div>
          </section>
        </>
      )}
      {tab === "banks" && (
        <div className="finance-layout">
          <section className="panel finance-form">
            <h2>Agregar cuenta de Ecuador</h2>
            <p>
              El número completo se guarda cifrado y sólo mostramos los últimos
              cuatro dígitos.
            </p>
            <form onSubmit={addBank}>
              <label>
                Banco
                <select name="bankCode" required>
                  {ECUADOR_BANKS.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tipo
                <select name="accountType">
                  <option value="AHORROS">Ahorros</option>
                  <option value="CORRIENTE">Corriente</option>
                </select>
              </label>
              <label>
                Número de cuenta
                <input
                  name="accountNumber"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6,20}"
                />
              </label>
              <label>
                Titular
                <input name="holderName" required />
              </label>
              <label>
                Cédula o RUC
                <input name="holderId" required />
              </label>
              <label className="checkbox-label">
                <input name="isDefault" type="checkbox" /> Cuenta predeterminada
              </label>
              <button className="primary-button">Guardar cuenta</button>
            </form>
          </section>
          <section className="panel bank-list">
            <h2>Cuentas registradas</h2>
            {data.accounts.map((item) => (
              <article key={item.id}>
                <span>🏦</span>
                <div>
                  <b>{item.bankName}</b>
                  <small>
                    {item.accountType} · •••• {item.accountLast4}
                  </small>
                  <em>{item.holderName}</em>
                </div>
                {item.isDefault && <i>Principal</i>}
              </article>
            ))}
            {data.accounts.length === 0 && (
              <p>No hay cuentas bancarias registradas.</p>
            )}
          </section>
        </div>
      )}
      {tab === "withdrawals" && (
        <div className="finance-layout">
          <section className="panel finance-form">
            <h2>Solicitar retiro</h2>
            <p>
              Saldo disponible: <b>{money.format(data.wallet.balance)}</b>
            </p>
            <form onSubmit={withdraw}>
              <label>
                Cuenta destino
                <select name="bankAccountId" required>
                  <option value="">Seleccionar</option>
                  {data.accounts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.bankName} · •••• {item.accountLast4}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Monto
                <input
                  name="amount"
                  type="number"
                  min="1"
                  max={data.wallet.balance}
                  step="0.01"
                  required
                />
              </label>
              <label>
                Nota
                <input name="note" />
              </label>
              <button
                className="primary-button"
                disabled={data.accounts.length === 0 || data.wallet.balance < 1}
              >
                Solicitar transferencia
              </button>
            </form>
          </section>
          <section className="panel bank-list">
            <h2>Solicitudes</h2>
            {data.withdrawals.map((item) => (
              <article key={item.id}>
                <span>⇩</span>
                <div>
                  <b>{money.format(item.amount)}</b>
                  <small>
                    {item.bankName} · •••• {item.accountLast4}
                  </small>
                  <em>{new Date(item.createdAt).toLocaleString("es-EC")}</em>
                </div>
                <i>{item.status}</i>
              </article>
            ))}
            {data.withdrawals.length === 0 && (
              <p>No hay retiros solicitados.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}

type Member = {
  id: string;
  status: "ACTIVE" | "SUSPENDED" | "INVITED";
  user: {
    id: string;
    name?: string | null;
    email: string;
    phone?: string | null;
    lastLoginAt?: string | null;
  };
  roles: Array<{ id: string; name: string; systemKey?: string | null }>;
  permissions: string[];
  customPermissions: boolean;
};
type MembersData = {
  members: Member[];
  roles: Array<{
    id: string;
    name: string;
    systemKey?: string | null;
    permissions: string[];
  }>;
  modules: Record<string, readonly string[]>;
};
type UserModal =
  | { kind: "create" }
  | { kind: "edit"; member: Member }
  | { kind: "permissions"; member: Member }
  | null;

const moduleLabels: Record<string, string> = {
  dashboard: "Dashboard",
  orders: "Pedidos",
  inventory: "Inventario",
  products: "Productos",
  shipments: "Envíos",
  customers: "Clientes",
  warehouses: "Bodegas",
  stores: "Tiendas",
  picking: "Picking",
  packing: "Packing",
  delivery: "Entregas",
  suppliers: "Proveedores",
  branding: "Branding y dominio",
  settings: "Configuración y equipo",
  finance: "Finanzas",
};
const permissionLabels: Record<string, string> = {
  read: "Ver",
  create: "Crear",
  update: "Editar",
  cancel: "Cancelar",
  adjust: "Ajustar stock",
  transfer: "Transferir",
  archive: "Archivar",
  invite: "Invitar",
  manage: "Administrar",
};
const exactPermissionLabels: Record<string, string> = {
  "dashboard:read": "Ver resumen / dashboard",
  "shipments:create": "Crear nuevos envíos",
  "shipments:read": "Ver mis pedidos y tracking",
  "warehouses:read": "Ver bodegas",
  "warehouses:create": "Registrar bodegas",
  "warehouses:update": "Editar bodegas",
  "products:read": "Ver productos y stock",
  "products:create": "Crear productos",
  "products:update": "Editar productos",
  "inventory:read": "Ver inventario",
  "inventory:adjust": "Ajustar inventario",
  "finance:read": "Ver billetera, cuentas y retiros",
  "finance:manage": "Gestionar finanzas y solicitar retiros",
};

export function StoreUsersModule() {
  const [data, setData] = useState<MembersData>({
    members: [],
    roles: [],
    modules: {},
  });
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [modal, setModal] = useState<UserModal>(null);
  const [saving, setSaving] = useState(false);
  const [zeroMarginUsers, setZeroMarginUsersState] = useState<string[]>([]);

  useEffect(() => {
    setZeroMarginUsersState(getZeroMarginUsers());
  }, []);

  function toggleZeroMargin(userEmail: string, enable: boolean) {
    setZeroMarginUser(userEmail, enable);
    setZeroMarginUsersState(getZeroMarginUsers());
    setMessage(
      enable
        ? `Se otorgó permiso de Envíos sin Ganancia (Precio de costo) a ${userEmail}`
        : `Se revocó permiso de Envíos sin Ganancia para ${userEmail}`
    );
  }
  async function load() {
    const response = await fetch("/api/admin/members");
    if (response.ok) setData((await response.json()) as MembersData);
  }
  useEffect(() => {
    void load();
  }, []);

  async function request(method: string, body?: object, suffix = "") {
    setSaving(true);
    const init: RequestInit = { method };
    if (body) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    }
    const response = await fetch(`/api/admin/members${suffix}`, init);
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setSaving(false);
    setMessage(
      response.ok
        ? "Cambios guardados correctamente"
        : (result.error ?? "No se pudo completar la acción"),
    );
    if (response.ok) {
      setModal(null);
      await load();
    }
    return response.ok;
  }
  async function changeRole(membershipId: string, roleId: string) {
    await request("PATCH", { action: "role", membershipId, roleId });
  }
  async function toggleStatus(member: Member) {
    await request("PATCH", {
      action: "status",
      membershipId: member.id,
      status: member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
    });
  }
  async function remove(member: Member) {
    if (
      window.confirm(
        `¿Eliminar a ${member.user.name ?? member.user.email} de esta empresa?`,
      )
    )
      await request("DELETE", undefined, `?membershipId=${member.id}`);
  }
  const filtered = data.members.filter((member) => {
    const matchesText =
      `${member.user.name ?? ""} ${member.user.email} ${member.user.phone ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase());
    return matchesText && (status === "ALL" || member.status === status);
  });

  return (
    <>
      <div className="page-header">
        <div>
          <span>CONFIGURACIÓN DE EQUIPO</span>
          <h1>Usuarios de tienda</h1>
          <p>
            Gestiona usuarios y controla exactamente a qué módulos tienen
            acceso.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => setModal({ kind: "create" })}
        >
          ＋ Nuevo usuario
        </button>
      </div>
      {message && (
        <p className="module-notice">
          {message}
          <button onClick={() => setMessage("")}>×</button>
        </p>
      )}
      <section className="panel users-panel">
        <div className="users-toolbar">
          <label className="users-search">
            <span>⌕</span>
            <input
              aria-label="Buscar usuarios"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre, correo o teléfono…"
            />
          </label>
          <select
            aria-label="Filtrar usuarios por estado"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="ALL">Todos los estados</option>
            <option value="ACTIVE">Activos</option>
            <option value="SUSPENDED">Suspendidos</option>
            <option value="INVITED">Invitados</option>
          </select>
          <button
            type="button"
            className="icon-action"
            aria-label="Actualizar lista"
            title="Actualizar"
            onClick={() => void load()}
          >
            ↻
          </button>
        </div>
        <p className="users-count">
          {filtered.length}{" "}
          {filtered.length === 1
            ? "usuario encontrado"
            : "usuarios encontrados"}
        </p>
        <div className="table-scroll">
          <table className="users-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th>Rol</th>
                <th>Envíos Sin Ganancia</th>
                <th>Permisos</th>
                <th>Último acceso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => {
                const isZeroMargin = zeroMarginUsers.includes(member.user.email);
                return (
                  <tr key={member.id}>
                    <td>
                      <strong>{member.user.name ?? "Sin nombre"}</strong>
                    </td>
                    <td>{member.user.email}</td>
                    <td>{member.user.phone || "—"}</td>
                    <td>
                      <span
                        className={`member-status ${member.status.toLowerCase()}`}
                      >
                        {member.status === "ACTIVE"
                          ? "Activo"
                          : member.status === "SUSPENDED"
                            ? "Suspendido"
                            : "Invitado"}
                      </span>
                    </td>
                    <td>
                      <select
                        className="role-select"
                        value={member.roles[0]?.id ?? ""}
                        onChange={(event) =>
                          void changeRole(member.id, event.target.value)
                        }
                      >
                        {data.roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <label className="zero-margin-toggle" title="Permitir generar envíos a precio de costo puro (0% ganancia Trajetix) para familiares, amigos o cuentas secundarias">
                        <input
                          type="checkbox"
                          checked={isZeroMargin}
                          onChange={(e) => toggleZeroMargin(member.user.email, e.target.checked)}
                        />
                        <span>{isZeroMargin ? "⚡ Precio Costo (0% Ganancia)" : "Estándar"}</span>
                      </label>
                    </td>
                    <td>
                      <button
                        className="permission-count"
                        onClick={() => setModal({ kind: "permissions", member })}
                      >
                        ♢ {member.permissions.length}
                        {member.customPermissions
                          ? " personalizados"
                          : " por rol"}
                      </button>
                    </td>
                    <td>
                      {member.user.lastLoginAt
                        ? new Date(member.user.lastLoginAt).toLocaleString(
                            "es-EC",
                          )
                        : "Nunca"}
                    </td>
                    <td>
                      <div className="user-actions">
                        <button
                          type="button"
                          aria-label="Editar usuario"
                          title="Editar usuario"
                          onClick={() => setModal({ kind: "edit", member })}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          aria-label={
                            member.status === "ACTIVE"
                              ? "Suspender acceso"
                              : "Activar acceso"
                          }
                          title={
                            member.status === "ACTIVE"
                              ? "Suspender acceso"
                              : "Activar acceso"
                          }
                          onClick={() => void toggleStatus(member)}
                        >
                          {member.status === "ACTIVE" ? "⊘" : "✓"}
                        </button>
                        <button
                          type="button"
                          className="danger-action"
                          aria-label="Eliminar de la empresa"
                          title="Eliminar de la empresa"
                          onClick={() => void remove(member)}
                        >
                          ⌫
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="empty">
              <h3>No encontramos usuarios</h3>
              <p>Cambia los filtros o registra un nuevo usuario.</p>
            </div>
          )}
        </div>
      </section>
      {modal?.kind === "create" && (
        <UserEditor
          title="Nuevo usuario"
          roles={data.roles}
          saving={saving}
          onClose={() => setModal(null)}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void request("POST", {
              name: form.get("name"),
              email: form.get("email"),
              phone: form.get("phone"),
              password: form.get("password"),
              roleId: form.get("roleId"),
            });
          }}
        />
      )}
      {modal?.kind === "edit" && (
        <UserEditor
          title="Editar usuario"
          member={modal.member}
          roles={data.roles}
          saving={saving}
          onClose={() => setModal(null)}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void request("PATCH", {
              action: "profile",
              membershipId: modal.member.id,
              name: form.get("name"),
              email: form.get("email"),
              phone: form.get("phone"),
              password: form.get("password"),
            });
          }}
        />
      )}
      {modal?.kind === "permissions" && (
        <PermissionsEditor
          member={modal.member}
          modules={data.modules}
          allowedPermissions={
            data.roles.find((role) => role.id === modal.member.roles[0]?.id)
              ?.permissions ?? []
          }
          saving={saving}
          onClose={() => setModal(null)}
          onSave={(permissions) =>
            void request("PATCH", {
              action: "permissions",
              membershipId: modal.member.id,
              permissions,
            })
          }
        />
      )}
    </>
  );
}

function UserEditor({
  title,
  member,
  roles,
  saving,
  onClose,
  onSubmit,
}: {
  title: string;
  member?: Member;
  roles: MembersData["roles"];
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal user-editor"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <span className="eyebrow">EQUIPO DE LA EMPRESA</span>
        <h2>{title}</h2>
        <p>
          {member
            ? "Actualiza los datos. Deja la contraseña vacía para conservarla."
            : "Crea credenciales y asigna el rol inicial de este usuario."}
        </p>
        <form onSubmit={onSubmit}>
          <label>
            Nombre completo
            <input
              name="name"
              required
              minLength={2}
              defaultValue={member?.user.name ?? ""}
              autoFocus
            />
          </label>
          <label>
            Correo electrónico
            <input
              name="email"
              type="email"
              required
              defaultValue={member?.user.email ?? ""}
            />
          </label>
          <label>
            Teléfono
            <input
              name="phone"
              type="tel"
              defaultValue={member?.user.phone ?? ""}
              placeholder="+593 99 123 4567"
            />
          </label>
          <label>
            {member ? "Nueva contraseña (opcional)" : "Contraseña temporal"}
            <input
              name="password"
              type="password"
              minLength={8}
              required={!member}
              placeholder="Mínimo 8 caracteres"
            />
          </label>
          {!member && (
            <label>
              Perfil de acceso
              <select
                name="roleId"
                required
                defaultValue={
                  roles.find((role) => role.systemKey === "vendedor")?.id ??
                  roles[0]?.id
                }
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button className="primary-button" disabled={saving}>
              {saving ? "Guardando…" : member ? "Actualizar" : "Crear usuario"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function PermissionsEditor({
  member,
  modules,
  allowedPermissions,
  saving,
  onClose,
  onSave,
}: {
  member: Member;
  modules: MembersData["modules"];
  allowedPermissions: string[];
  saving: boolean;
  onClose: () => void;
  onSave: (permissions: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(member.permissions);
  const allowed = new Set(allowedPermissions);
  const visibleModules = Object.entries(modules)
    .map(
      ([module, permissions]) =>
        [
          module,
          permissions.filter((permission) => allowed.has(permission)),
        ] as const,
    )
    .filter(([, permissions]) => permissions.length > 0);
  function toggle(permission: string) {
    setSelected((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );
  }
  function toggleModule(permissions: readonly string[]) {
    const active = permissions.every((permission) =>
      selected.includes(permission),
    );
    setSelected((current) =>
      active
        ? current.filter((permission) => !permissions.includes(permission))
        : [...new Set([...current, ...permissions])],
    );
  }
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal permissions-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <span className="eyebrow">ACCESO POR MÓDULO</span>
        <h2>Permisos de {member.user.name ?? member.user.email}</h2>
        <p>
          Sólo puedes activar permisos incluidos en el perfil{" "}
          {member.roles[0]?.name ?? "de tienda"}.
        </p>
        <div className="permission-groups">
          {visibleModules.map(([module, permissions]) => {
            const all = permissions.every((permission) =>
              selected.includes(permission),
            );
            return (
              <article key={module}>
                <header>
                  <strong>{moduleLabels[module] ?? module}</strong>
                  <button onClick={() => toggleModule(permissions)}>
                    {all ? "Desactivar todos" : "Activar todos"}
                  </button>
                </header>
                {permissions.map((permission) => (
                  <label key={permission}>
                    <span>
                      {exactPermissionLabels[permission] ??
                        permissionLabels[permission.split(":")[1] ?? ""] ??
                        permission}
                    </span>
                    <input
                      type="checkbox"
                      checked={selected.includes(permission)}
                      onChange={() => toggle(permission)}
                    />
                  </label>
                ))}
              </article>
            );
          })}
        </div>
        <div className="permissions-footer">
          <span>
            {selected.filter((permission) => allowed.has(permission)).length}{" "}
            permisos seleccionados
          </span>
          <div>
            <button className="secondary-button" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="primary-button"
              disabled={saving}
              onClick={() =>
                onSave(selected.filter((permission) => allowed.has(permission)))
              }
            >
              {saving ? "Guardando…" : "Guardar permisos"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
