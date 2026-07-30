# Producción en GitHub y Vercel

## GitHub

El repositorio debe usar `main` como rama protegida. Active revisión obligatoria, CI requerida, secret scanning, Dependabot y bloqueo de force-push.

## Vercel

Importe el repositorio desde la raíz. `vercel.json` contiene el build del monorepo. Configure en Vercel las variables de `.env.example`; use conexiones pooled para `DATABASE_URL` y directa para `DIRECT_URL`.

Agregue estos secretos al environment `production` de GitHub:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

El workflow `Deploy production` compila en Vercel y despliega únicamente desde `main`. Las migraciones de base de datos deben ejecutarse como job controlado antes del despliegue; no se ejecutan automáticamente desde instancias web.
