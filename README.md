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

## Fases

1. ✅ Scaffold + sistema de diseño + layout global + home + /musica
2. ⬜ Supabase: migraciones + RLS + trigger de profiles + buckets
3. ⬜ Autenticación (Google + email, verificación, reset, guards)
4. ⬜ Academia pública (catálogo + landing de curso)
5. ⬜ Panel del maestro (CRUD + drag & drop)
6. ⬜ Pagos Bold + inscripciones
7. ⬜ Experiencia de aprendizaje (player, progreso)
8. ⬜ Certificados + emails Resend
9. ⬜ Merch completa (carrito, checkout, pedidos)
10. ⬜ CI/CD GitHub Pages + pulido final

> **Nota sobre video:** YouTube no permite forzar la calidad de reproducción desde el embed (la elige el reproductor según la conexión del usuario). Vimeo y Bunny sí lo permiten. Los videos de las lecciones siempre van por link externo; esta plataforma no aloja video.
