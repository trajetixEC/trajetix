# Despliegue

## Local

Use Node 22 LTS, `corepack enable`, `pnpm install` y `docker compose up -d`. Genere Prisma y aplique migraciones antes de iniciar `pnpm dev`.

## Producción

- Web/BFF: Vercel con una conexión PostgreSQL pooled.
- Workers BullMQ: Railway, siempre activos y separados del runtime serverless.
- PostgreSQL: servicio administrado con PITR, réplicas y `DIRECT_URL` para migraciones.
- Redis: Upstash para caché/rate limit; Redis persistente compatible con BullMQ para jobs.
- Objetos: S3/R2 con URLs firmadas, antivirus y políticas de lifecycle.

La CI solo valida. Las migraciones de producción se ejecutan como job único previo al despliegue con `prisma migrate deploy`; nunca desde cada instancia web.

## Observabilidad mínima

Logs estructurados con tenant/correlation ID (sin PII), trazas OpenTelemetry, métricas RED, alertas de cola/webhooks, SLO por flujo y errores centralizados.

