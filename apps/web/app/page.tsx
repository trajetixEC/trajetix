import Image from "next/image";
import Link from "next/link";

const benefits = [
  {
    icon: "⌁",
    title: "Tus ventas se convierten en envíos",
    copy: "Conecta Shopify o tu ecommerce mediante API y webhooks. Centraliza pedidos, clientes, productos y stock sin repetir trabajo.",
  },
  {
    icon: "⌖",
    title: "El courier correcto para cada entrega",
    copy: "Cotiza, genera guías y consulta tracking desde una sola operación. Tus integraciones de transporte quedan protegidas y administradas por Trajetix.",
  },
  {
    icon: "▤",
    title: "Inventario real, incluso con varias bodegas",
    copy: "Conoce existencias por bodega, registra ajustes, controla mínimos y mantén trazabilidad mediante kardex y movimientos.",
  },
  {
    icon: "◎",
    title: "Seguimiento que también ve tu cliente",
    copy: "Cada guía conserva su estado e historial. Comparte el tracking público y reduce preguntas repetitivas por WhatsApp.",
  },
  {
    icon: "◫",
    title: "Finanzas vinculadas a la operación",
    copy: "Consulta fletes, recaudos COD, saldos y movimientos. Administra cuentas bancarias y solicitudes de retiro por empresa.",
  },
  {
    icon: "♙",
    title: "Tu equipo ve únicamente lo necesario",
    copy: "Crea perfiles para vendedores, bodega y finanzas. Cada módulo respeta permisos y la información permanece aislada por empresa.",
  },
] as const;

const couriers = [
  "Servientrega",
  "LaarCourier",
  "Gintracom",
  "Trajet",
  "DHL",
  "FedEx",
] as const;

const setupSteps = [
  [
    "01",
    "Crea tu cuenta",
    "Registra tu empresa y obtén un espacio de trabajo privado.",
  ],
  [
    "02",
    "Configura tu operación",
    "Agrega bodegas, productos, clientes y miembros del equipo.",
  ],
  [
    "03",
    "Conecta y empieza",
    "Vincula tu ecommerce y los couriers habilitados para generar envíos.",
  ],
] as const;

export default function HomePage() {
  return (
    <main className="landing">
      <nav className="landing-nav" aria-label="Navegación principal">
        <Link href="/" aria-label="TrajetixERP, inicio">
          <Image
            src="/brand/trajetix-logo.png"
            alt="TrajetixERP"
            width={620}
            height={248}
            priority
          />
        </Link>
        <div className="landing-nav-links">
          <a href="#ventajas">Ventajas</a>
          <a href="#integraciones">Integraciones</a>
          <a href="#como-funciona">Cómo funciona</a>
        </div>
        <div className="landing-nav-actions">
          <Link className="button button-ghost" href="/login">
            Ingresar
          </Link>
          <Link className="button" href="/registro">
            Crear cuenta
          </Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="eyebrow">ECOMMERCE Y LOGÍSTICA, CONECTADOS</span>
          <h1>De la venta a la entrega, sin cambiar de sistema.</h1>
          <p>
            TrajetixERP reúne ecommerce, inventario, bodegas, envíos, tracking y
            finanzas para que tu empresa opere con información real desde un
            solo lugar.
          </p>
          <div className="actions">
            <Link className="button landing-primary" href="/registro">
              Crear mi cuenta
            </Link>
            <a className="button button-ghost" href="#como-funciona">
              Ver cómo funciona
            </a>
          </div>
          <div className="hero-promises" aria-label="Beneficios de activación">
            <span>✓ Cuenta operativa en minutos</span>
            <span>✓ Datos separados por empresa</span>
            <span>✓ Sin datos ficticios</span>
          </div>
        </div>

        <div
          className="hero-preview"
          aria-label="Vista previa del tablero TrajetixERP"
        >
          <div className="preview-top">
            <span />
            <span />
            <span />
            <small>Operación en tiempo real</small>
          </div>
          <div className="preview-grid">
            <div>
              <small>ENVÍOS DEL MES</small>
              <strong>1.284</strong>
              <em>↑ operación centralizada</em>
            </div>
            <div>
              <small>EN TRÁNSITO</small>
              <strong>184</strong>
              <em>Tracking unificado</em>
            </div>
            <div>
              <small>ENTREGAS A TIEMPO</small>
              <strong>96,4%</strong>
              <em>Visibilidad completa</em>
            </div>
          </div>
          <div className="preview-chart" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="preview-feed">
            <span>
              <i /> Pedido recibido
            </span>
            <span>
              <i /> Guía generada
            </span>
            <span>
              <i /> Entrega confirmada
            </span>
          </div>
        </div>
      </section>

      <section className="landing-proof" aria-label="Capacidades principales">
        <div>
          <strong>Una plataforma</strong>
          <span>para toda la operación</span>
        </div>
        <div>
          <strong>Multiempresa</strong>
          <span>información aislada y segura</span>
        </div>
        <div>
          <strong>Tiempo real</strong>
          <span>envíos, stock y estados</span>
        </div>
        <div>
          <strong>API abierta</strong>
          <span>lista para integraciones</span>
        </div>
      </section>

      <section id="ventajas" className="landing-section benefits-section">
        <div className="section-heading">
          <span className="eyebrow">VENTAJAS DE TRAJETIXERP</span>
          <h2>Más control para vender y entregar mejor.</h2>
          <p>
            Cada módulo comparte el mismo contexto operativo, sin mezclar los
            datos de otras empresas ni depender de hojas de cálculo separadas.
          </p>
        </div>
        <div className="benefits-grid">
          {benefits.map((benefit) => (
            <article key={benefit.title}>
              <span>{benefit.icon}</span>
              <h3>{benefit.title}</h3>
              <p>{benefit.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="integraciones"
        className="landing-section integrations-showcase"
      >
        <div>
          <span className="eyebrow">ECOMMERCE + COURIERS</span>
          <h2>Conecta tu tienda con los mejores couriers del país.</h2>
          <p>
            Recibe pedidos desde Shopify o tu plataforma mediante API y
            webhooks. Luego cotiza servicios, genera guías y concentra el
            tracking de los couriers habilitados para tu cuenta.
          </p>
          <ul>
            <li>Sincronización de pedidos, productos y stock.</li>
            <li>Modalidades con recaudo COD y sin recaudo.</li>
            <li>Historial de estados y tracking compartible.</li>
            <li>
              Credenciales de transportadoras administradas de forma segura.
            </li>
          </ul>
          <Link className="button" href="/registro">
            Empezar ahora
          </Link>
        </div>
        <div
          className="integration-orbit"
          aria-label="Integraciones disponibles mediante conectores"
        >
          <div className="shopify-node">
            <b>S</b>
            <span>Shopify</span>
          </div>
          <div className="orbit-center">
            <Image
              src="/brand/trajetix-app-icon.png"
              alt="TrajetixERP"
              width={1024}
              height={1024}
            />
          </div>
          <div className="courier-cloud">
            {couriers.map((courier) => (
              <span key={courier}>{courier}</span>
            ))}
          </div>
          <small>
            Los servicios disponibles dependen de las credenciales y cobertura
            contratadas.
          </small>
        </div>
      </section>

      <section id="como-funciona" className="landing-section setup-section">
        <div className="section-heading compact">
          <span className="eyebrow">LISTO PARA OPERAR</span>
          <h2>Tu empresa puede empezar en minutos.</h2>
          <p>
            Un inicio guiado y directo, sin tener que construir tu operación
            desde cero.
          </p>
        </div>
        <div className="setup-grid">
          {setupSteps.map(([number, title, copy]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <span className="eyebrow">EMPIEZA HOY</span>
          <h2>Convierte cada pedido en una operación controlada.</h2>
          <p>
            Crea tu cuenta, configura tu empresa y comienza a registrar envíos
            reales.
          </p>
        </div>
        <div>
          <Link className="button landing-primary" href="/registro">
            Crear cuenta
          </Link>
          <Link className="button button-ghost" href="/login">
            Ya tengo una cuenta
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <Image
          src="/brand/trajetix-logo.png"
          alt="TrajetixERP"
          width={620}
          height={248}
        />
        <p>
          Gestión ecommerce, logística e inventario para operaciones que quieren
          crecer.
        </p>
        <span>© {new Date().getFullYear()} TrajetixERP</span>
      </footer>
    </main>
  );
}
