# Autenticación y autorización

TrajetixERP usa Auth.js con sesiones JWT de 12 horas y persistencia de usuarios, cuentas, invitaciones y tokens en PostgreSQL mediante Prisma.

## Activación

1. Configure `DATABASE_URL` y `DIRECT_URL` con PostgreSQL.
2. Genere un secreto con `npx auth secret` y guárdelo como `AUTH_SECRET`.
3. Ejecute `pnpm db:generate` y `pnpm --filter @trajetix/database exec prisma db push` en el entorno inicial. En producción estable, genere y versiona una migración antes de aplicar cambios.
4. Configure `NEXT_PUBLIC_APP_URL` con el dominio público.
5. Añada los proveedores requeridos usando las variables de `.env.example`.
6. Configure `RESEND_API_KEY` y `AUTH_EMAIL_FROM` con un dominio verificado para magic links, recuperación e invitaciones.

## Callbacks OAuth

Use `https://<dominio>/api/auth/callback/<proveedor>`:

- Google: `google`
- Microsoft: `microsoft-entra-id`
- Facebook: `facebook`
- GitHub: `github`
- Apple: `apple`

## RBAC

Los permisos efectivos se obtienen exclusivamente desde la membresía activa y sus roles. Los módulos validan permisos como `orders:read`, `inventory:adjust`, `members:invite` y `roles:manage`. El middleware solo es una primera barrera; las páginas y APIs sensibles vuelven a validar sesión, tenant y permiso.

## 2FA

El secreto TOTP se cifra con AES-256-GCM usando una clave derivada de `AUTH_SECRET`. El usuario debe confirmar un primer código de seis dígitos antes de activar 2FA. Las cuentas con 2FA requieren contraseña y código TOTP al usar el proveedor de credenciales.

## Invitaciones

Las invitaciones son de un solo tenant, se vinculan al correo normalizado y caducan en siete días. Al iniciar sesión con el correo invitado se crea la membresía y se asigna el rol indicado o `viewer` por defecto.
