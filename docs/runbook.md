# Runbook — operación de NO.ID Records

Estado y pasos para operar y mantener la plataforma. Repo: `Goatdev00/noidentityrecords`. Sitio: https://noidentityrecords.com

## Arquitectura en una línea

SPA estática (Vite/React) en GitHub Pages con dominio propio + Supabase (Postgres/Auth/Storage/Edge Functions) + Resend (correos) + Bold (pagos, pendiente). El frontend solo usa la anon key; la seguridad real es RLS.

## Deploy (automático)

Cada `push` a `main` dispara `.github/workflows/deploy.yml`: instala, construye (`npm run build`, que incluye `tsc` + copia `index.html`→`404.html` para el fallback de la SPA) y publica con `actions/deploy-pages`. No hay que hacer nada manual.

- **Secrets de GitHub Actions** (Settings → Secrets and variables → Actions): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BOLD_IDENTITY_KEY`. Son **opcionales**: el código trae como fallback los valores públicos (anon key de Supabase), así que el build funciona sin ellos. Solo son valores públicos — nunca pongas aquí llaves secretas.
- **Pages** (Settings → Pages): Source = GitHub Actions; Custom domain = `noidentityrecords.com`; Enforce HTTPS activado.
- **DNS en Hostinger**: 4 registros A → `185.199.108–111.153`; CNAME `www` → `goatdev00.github.io`. (Guía detallada en `docs/deploy-dns.md`.)

## Supabase

- **Proyecto:** `ztzgnorjnffpgytnwnvy`.
- **Migraciones:** `supabase/migrations/` en orden. Aplicadas vía Management API. Si en algún momento enlazas el CLI (`supabase link`), corre `supabase migration repair` antes de `supabase db push` porque no están registradas en el tracking del CLI.
- **Auth:** Site URL `https://noidentityrecords.com`; redirect allow-list incluye el dominio, `www` y `localhost:5173`. Google OAuth activo. SMTP con Resend activo (remitente `No.ID Records <no-reply@noidentityrecords.com>`), plantillas de correo en negro/blanco.
- **Edge Functions:** `generate-certificate` desplegada. Secret `RESEND_API_KEY` cargado. Para redesplegar:
  ```bash
  SUPABASE_ACCESS_TOKEN=<token> npx supabase@latest functions deploy generate-certificate --project-ref ztzgnorjnffpgytnwnvy
  ```
- **Roles:** un usuario se hace `teacher`/`admin` solo a mano en el dashboard → Table Editor → `profiles` → columna `role`. No hay UI pública para ello.

## Resend (correos)

Dominio `noidentityrecords.com` verificado en Resend con estos registros DNS en Hostinger (ya creados):

- **SPF/MX**: registro de envío que Resend indica (normalmente un TXT `v=spf1 include:...` y/o registros MX/`send.`).
- **DKIM**: registro(s) TXT `resend._domainkey` (o el nombre que Resend muestre) con la clave pública.
- (Opcional recomendado) **DMARC**: TXT `_dmarc` con `v=DMARC1; p=none;`.

Si el dominio se cae en Resend, revisa Domains → estado; re-verifica si algún registro cambió.

## Pagos Bold (pendiente)

Falta cuando haya cuenta de comercio en Bold:

1. **Llave de identidad** (pública) → GitHub Secret `VITE_BOLD_IDENTITY_KEY` (y `.env` local).
2. **Llave secreta** → solo como secret de Edge Function en Supabase (`BOLD_SECRET_KEY`). Nunca en el frontend ni el repo.
3. Implementar Edge Functions `create-payment` (calcula el monto en el servidor + firma de integridad) y `bold-webhook` (valida firma, idempotente, crea enrollment/order + descuenta stock + correos).
4. Registrar la URL del webhook en el Panel de Comercios de Bold → Integraciones.

## Gestión de contenido (sin tocar código)

- **Cursos y lecciones:** panel del maestro en `/panel` (rol teacher/admin).
- **Productos de merch:** dashboard de Supabase → Table Editor → `products` y `product_variants`. Imágenes al bucket `merch-images`. (Hay un producto de ejemplo sembrado — bórralo cuando cargues los reales.)
- **Música (/musica):** tabla `media_embeds`.

## Verificaciones rápidas

```bash
node scripts/test-rls.mjs   # RLS desde afuera con la anon key pública
npm run build               # build local (typecheck + bundle + 404.html)
npm run dev                 # http://localhost:5173
```
