# TrajetixERP

Plataforma SaaS multi-tenant para ecommerce, OMS, WMS, TMS, fulfillment y logística en Latinoamérica.

## Estado

Este repositorio contiene la **Fase 1 — Foundation**: monorepo, arquitectura, aplicación web base, contratos de dominio, esquema PostgreSQL/Prisma, aislamiento multi-tenant, OpenAPI, Docker y CI.

## Inicio rápido

Requisitos: Node.js 22 LTS, Corepack y Docker.

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d postgres redis
pnpm db:generate
pnpm db:migrate
pnpm dev
```

En Windows con políticas que impiden `corepack enable`, agregue `tooling/bin` al `PATH` de la sesión; el repositorio incluye un shim local de `pnpm`.

Consulte [docs/architecture.md](docs/architecture.md), [docs/roadmap.md](docs/roadmap.md) y [docs/deployment.md](docs/deployment.md).

## Principios no negociables

- El `tenantId` se obtiene de la sesión o API key; nunca del cuerpo enviado por el cliente.
- Toda operación de negocio se ejecuta dentro de un `TenantContext`.
- Los módulos se comunican mediante puertos, eventos y contratos versionados.
- Importes monetarios se almacenan en unidades menores (`BigInt`) y códigos ISO 4217.
- Inventario y contabilidad usan movimientos inmutables, no simples contadores editables.
