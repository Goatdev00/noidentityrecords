# NO.ID Records — reglas del proyecto

Plataforma del sello de techno No.ID Records (Bogotá): Academia (cursos), Merch (tienda), Música (embeds). El brief completo y vinculante está en `docs/brief.md` — léelo antes de tocar arquitectura, pagos o RLS.

## Stack (no negociable)

- Vite + React 18 + TS + Tailwind 4 + React Router. SPA estática en GitHub Pages (dominio noidentityrecords.com).
- Supabase (Postgres + Auth + Storage + Edge Functions). Sin servidor propio.
- Resend solo desde Edge Functions. Bold (bold.co) para pagos en COP, capa desacoplada.

## Reglas estrictas

- Cero secretos en cliente/repo. Frontend solo usa la anon key; la seguridad real es RLS en TODAS las tablas.
- `lesson_content` solo legible con enrollment (tabla separada de `lessons`). `enrollments`/`payments`/`certificates` se escriben solo vía service role (Edge Functions).
- Montos de pago SIEMPRE calculados en servidor. Videos SIEMPRE por link externo (nunca subida de video).
- UI en español; código, nombres y commits en inglés. Commit al final de cada fase.
- Estética: negro puro, jerarquía por opacidad, Syncopate/Space Grotesk, mucho aire. Ante la duda, QUITA. Tokens en `src/index.css`.

## Estado

- Fase actual y checklist: ver `README.md` (sección Fases).
- OJO: el dominio noidentityrecords.com está expirado/aparcado en Hostinger (jul 2026) — el sitio WordPress original ya no existe y `reference/pagina-original.html` se reconstruyó parcialmente. El usuario debe renovar el dominio antes de la fase 10.
