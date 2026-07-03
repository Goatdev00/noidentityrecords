# NO.ID RECORDS — plataforma web

Sello y colectivo de techno de Bogotá. Tres secciones: **Academia** (cursos online), **Merch** (tienda) y **Música** (embeds de Bandcamp/SoundCloud).

**Stack:** Vite + React 18 + TypeScript + Tailwind CSS 4 + React Router · Supabase (Postgres/Auth/Storage/Edge Functions) · Resend (emails) · Bold (pagos COP) · GitHub Pages (deploy estático).

## Arquitectura

- SPA 100% estática publicada en GitHub Pages con dominio propio `noidentityrecords.com`.
- Toda la lógica sensible (pagos, inscripciones, correos, certificados, stock) vive en **Supabase Edge Functions** — nunca en el cliente.
- El frontend solo usa la **anon key** de Supabase; la seguridad real es **Row Level Security**.
- Cero secretos en el repo: `.env` local ignorado, secrets de GitHub Actions para el build, secrets de Supabase para las Edge Functions.

## Correr en local

```bash
npm install
cp .env.example .env   # y completa las variables
npm run dev            # http://localhost:5173
npm run build          # build de producción en dist/ (+ 404.html de fallback SPA)
npm run preview        # sirve el build
```

Requiere Node 20+.

## Estructura

```
src/
  components/       # UI compartida (layout, tarjetas, embeds, cursor light)
  pages/            # una por ruta
  data/             # datos estáticos (mediaEmbeds → migra a la tabla media_embeds en fase 2)
  lib/              # constantes y utilidades
public/
  CNAME             # dominio propio para GitHub Pages
  logo-noid.png     # logo de la marca
reference/          # HTML original del sitio (referencia de diseño)
```

## Sistema de diseño

Tokens en `src/index.css` (`@theme` de Tailwind 4 → CSS variables):

- Fondo negro puro `#000` con gradiente radial sutil fijo (`#1a1a1a` → `#000`).
- **Space Grotesk** (300/400/700) para cuerpo; **Syncopate** (400/700) para títulos y etiquetas, siempre uppercase con tracking amplio (0.15em títulos, 0.6–0.8em etiquetas). Fallback local a `Horizon`.
- Jerarquía por **opacidad**, no por color (100% texto, ~40% etiquetas, 30–60% metadatos).
- Tarjetas con borde `rgba(255,255,255,0.05)` → `0.2` en hover + `translateY(-5px)`.
- Transiciones `cubic-bezier(0.16, 1, 0.3, 1)`. Acento `#9a64ff` solo en detalles.
- Luz que sigue el cursor (200px, `mix-blend-mode: screen`) — solo desktop, respeta `prefers-reduced-motion`.

## Base de datos (Supabase)

Migraciones en `supabase/migrations/` (aplicadas en orden):

| Archivo | Contenido |
|---|---|
| `…120000_initial_schema.sql` | 14 tablas, funciones helper (`is_admin`, `is_teacher_or_admin`), trigger `on_auth_user_created` (crea `profiles` con role `student`), índices |
| `…120100_rls_policies.sql` | RLS activado en TODAS las tablas + políticas comentadas + grants por columna en `profiles` + RPC `verify_certificate(code)` |
| `…120200_storage_buckets.sql` | Buckets `course-covers`/`merch-images`/`avatars` (públicos) y `certificates` (privado, solo URLs firmadas) + políticas de subida por carpeta `{uid}/` |
| `…120300_seed_media_embeds.sql` | Seed idempotente de `media_embeds` (solo si la tabla está vacía) |

**Modelo de seguridad:** el frontend solo tiene la anon key; las tablas de dinero/acceso (`payments`, `enrollments`, `orders`, `order_items`, `certificates`) **no tienen políticas de escritura** — solo las Edge Functions (service role) escriben en ellas, y además los privilegios INSERT/UPDATE/DELETE están revocados para `anon`/`authenticated`. `lesson_content` vive separada de `lessons` y solo es legible con enrollment (o siendo el maestro dueño/admin). El rol de un perfil no es editable por el cliente (grant por columnas). La verificación pública de certificados pasa por la RPC `verify_certificate`, nunca abriendo la tabla.

**Cómo aplicar** (elige una):
- Dashboard → SQL Editor → pegar cada archivo en orden.
- Management API (lo que se usó): `POST https://api.supabase.com/v1/projects/{ref}/database/query` con un access token.
- CLI: `supabase link --project-ref ztzgnorjnffpgytnwnvy && supabase db push`.

**Probar RLS desde afuera** (usa solo la anon key pública):

```bash
node scripts/test-rls.mjs
```

Verifica que un cliente anónimo no puede leer `lesson_content`, ni insertar `enrollments`, ni ver `payments`/`orders`/`certificates`, y que sí puede leer los `media_embeds` activos.

## Fases

1. ✅ Scaffold + sistema de diseño + layout global + home + /musica
2. ✅ Supabase: migraciones + RLS + trigger de profiles + buckets
3. ✅ Autenticación (Google + email, verificación, reset, guards) — Google OAuth activo; falta el SMTP de Resend (API key pendiente)
4. ✅ Academia pública (catálogo + landing de curso)
5. ✅ Panel del maestro (CRUD + drag & drop)
6. ⬜ Pagos Bold + inscripciones
7. ⬜ Experiencia de aprendizaje (player, progreso)
8. ⬜ Certificados + emails Resend
9. ⬜ Merch completa (carrito, checkout, pedidos)
10. ⬜ CI/CD GitHub Pages + pulido final

> **Nota sobre video:** YouTube no permite forzar la calidad de reproducción desde el embed (la elige el reproductor según la conexión del usuario). Vimeo y Bunny sí lo permiten. Los videos de las lecciones siempre van por link externo; esta plataforma no aloja video.
