# Roadmap incremental

## Fase 1 — Foundation (actual)

Monorepo, web shell, modelo tenant/usuario/RBAC, productos, saldos y movimientos de inventario, pedidos, auditoría, outbox, OpenAPI inicial, Docker y CI.

## Fase 2 — Identity & SaaS control plane

Auth.js, OAuth/magic link/2FA, invitaciones, selector de organización, autorización central, planes, Stripe/PayPal/PayPhone, metering y portal Super Admin.

## Fase 3 — OMS + catálogo + conectores

Catálogo variable, clientes, tiendas, importación idempotente, pedidos, impuestos, Shopify/WooCommerce, webhooks y API pública completa.

## Fase 4 — WMS + fulfillment

Recepción, ubicaciones, lotes/series/caducidad, reservas, picking waves, packing, etiquetas, transferencias, conteos y devoluciones.

## Fase 5 — TMS + carriers

Cotizador, adaptadores Ecuador, guías, tracking canónico, manifiestos, COD, POD, rutas, app de conductor y geolocalización.

## Fase 6 — Ecommerce + dropshipping

Storefront, temas, checkout, marketplace, sincronización, comisiones, reputación, payouts y afiliados.

## Fase 7 — ERP/CRM/Analytics/AI

Facturación electrónica localizada, tesorería, CRM, campañas, data warehouse, forecasting y copilot con permisos y trazabilidad.

## Gates por fase

Ninguna fase pasa a producción sin threat model, migración reversible, telemetría, runbook, pruebas de aislamiento tenant, carga, accesibilidad WCAG AA y restauración verificada.

