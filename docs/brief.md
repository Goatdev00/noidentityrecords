# Brief vinculante — plataforma No.ID Records

> Copia del brief original del proyecto (jul 2026). Es el contrato de producto: ante cualquier duda de alcance o arquitectura, manda este documento.

## 1. Rol y objetivo

Plataforma web de No.ID Records, sello y colectivo de techno de Bogotá. Tres secciones: **Academia** (cursos online estilo Platzi/Moodle), **Merch** (tienda de ropa) y **Música** (embeds de Bandcamp, SoundCloud y otras plataformas). Trabajo por fases (sección 14), commit al final de cada fase.

## 2. Stack (no negociable)

- **Frontend:** Vite + React 18 + TypeScript + Tailwind CSS + React Router. SPA 100% estática (GitHub Pages).
- **BaaS:** Supabase (Postgres + Auth + Storage + Edge Functions). No hay servidor propio.
- **Emails:** Resend, SIEMPRE desde Supabase Edge Functions. La API key jamás toca el frontend ni el repo.
- **Pagos:** Bold (bold.co — Colombia, COP), Botón de pagos en integración personalizada + webhooks. Docs: https://developers.bold.co. Capa de pagos desacoplada.
- **Deploy:** GitHub Actions → GitHub Pages, dominio noidentityrecords.com (DNS en Hostinger).
- **Librerías sugeridas:** @supabase/supabase-js, @dnd-kit/*, pdf-lib (Edge Function), Zustand o Context API (carrito).

## 3. Restricciones de arquitectura

1. GitHub Pages solo sirve estáticos. Toda lógica sensible (verificar pagos, otorgar acceso, correos, certificados, stock) vive en Supabase Edge Functions.
2. El frontend solo usa la anon key. Seguridad real = RLS activado en toda tabla con políticas explícitas.
3. Los links de video de lecciones nunca legibles por no inscritos (tabla `lesson_content` separada con RLS de inscripción).
4. SPA en GitHub Pages: `base: '/'`, `public/CNAME`, `404.html` fallback.
5. Cero secretos en el repo: `.env` ignorado, `.env.example` documentado, GitHub Secrets para build, Supabase secrets para Edge Functions (RESEND_API_KEY, BOLD_SECRET_KEY). La llave de identidad de Bold es pública; la secreta solo en Edge Functions.
6. El repo debe ser público para Pages gratis — seguro porque el frontend no contiene secretos.

## 4. Sistema de diseño

Identidad definida en `reference/pagina-original.html` (⚠️ el sitio original está caído; los tokens exactos quedaron especificados aquí). No inventar otra dirección estética.

- Fondo: negro puro #000 con gradiente radial sutil fijo (#1a1a1a centro → #000), opacidad baja.
- Tipografías (Google Fonts): **Space Grotesk** (300/400/700) cuerpo y datos; **Syncopate** (400/700) títulos y etiquetas, siempre uppercase con letter-spacing amplio (~0.15em títulos, 0.6–0.8em etiquetas tipo "ACADEMIA"). Fallback local a 'Horizon'.
- Jerarquía por opacidad, no por color: texto 100%, etiquetas ~40%, metadatos 30–60%.
- Bordes/tarjetas: rgba(255,255,255,0.05); hover → borde 0.2, translateY(-5px), sombra profunda. Transiciones cubic-bezier(0.16, 1, 0.3, 1).
- Acento opcional #9a64ff solo en detalles mínimos. Nada de gradientes de colores.
- Firma: luz que sigue el cursor (radial 200px, mix-blend-mode: screen, interpolación 0.15) — solo desktop, respeta prefers-reduced-motion — y animación flotante sutil en hero.
- Copy: frases cortas, mayúsculas espaciadas, español. Cierre: "THE VOID IS CALLING".
- Minimalista con mucho aire. Ante la duda, quitar. Mobile-first desde 380px. Foco de teclado visible.

## 5. Layout global

- Header fijo translúcido: logo No.ID (link a home), nav central ACADEMIA · MERCH · MÚSICA, icono de persona a la derecha (sin sesión → login; con sesión → menú: Mi perfil, Mis cursos, Mis pedidos, Panel de maestro solo teacher/admin, Cerrar sesión).
- Footer: redes (Instagram, SoundCloud, Bandcamp, RA), submenú (Academia, Merch, Música, Términos, Contacto), logo pequeño, © 2026 NO.IDENTITY. THE VOID IS CALLING.
- Home: hero con logo y accesos a las tres secciones.

## 6. Auth y roles (Supabase Auth)

- Google OAuth + email/contraseña (verificación + recuperación).
- SMTP de Supabase Auth con Resend → correos desde no-reply@noidentityrecords.com.
- Trigger en auth.users → crea fila en profiles con role='student'.
- Roles: student (default), teacher (solo asignación manual en dashboard Supabase), admin.
- Guards: /panel solo teacher/admin; /perfil autenticado; reproductor solo inscritos.

## 7. Modelo de datos (migraciones en /supabase/migrations, todas con RLS comentada)

| Tabla | Campos clave | Notas |
|---|---|---|
| profiles | id uuid PK = auth.users.id, role, display_name, avatar_url | Cada usuario lee/edita el suyo (role solo admin) |
| courses | id, teacher_id, slug, title, subtitle, description, price_cop int, cover_url, published | SELECT público si published o dueño/admin; escritura dueño/admin |
| modules | id, course_id, title, position | Visible si el curso es visible |
| lessons | id, module_id, title, subtitle, description, position | Solo metadata pública (temario) |
| lesson_content | lesson_id PK, video_url, links jsonb | RLS estricta: solo inscrito, maestro dueño o admin |
| enrollments | id, user_id, course_id, payment_id, created_at, UNIQUE(user_id,course_id) | Acceso de por vida. INSERT solo service role |
| lesson_progress | PK(user_id, lesson_id), completed_at | CRUD propio y solo si inscrito |
| certificates | id, user_id, course_id, code UNIQUE, pdf_path, issued_at | INSERT solo Edge Function; lectura pública por code |
| products | id, slug, name, description, price_cop, images text[], active | SELECT público si active |
| product_variants | id, product_id, size, stock | |
| orders | id, user_id, status, total_cop, shipping jsonb, payment_id | Usuario lee las suyas; escritura Edge Function |
| order_items | order_id, variant_id, qty, unit_price_cop | |
| payments | id, provider, reference UNIQUE, status, amount_cop, user_id, kind, metadata | Escritura solo service role |
| media_embeds | id, platform, title, meta, embed_url, position, active | Alimenta /musica |

Buckets: course-covers (público), merch-images (público), certificates (privado, URL firmada), avatars (público). Subida restringida por políticas.

## 8. Academia

- **/academia:** grid de cursos publicados (imagen, título, subtítulo, precio "80.000 COP", etiqueta "ACCESO PERMANENTE").
- **/academia/:slug:** cabecera personalizable, descripción, maestro, temario completo visible pero bloqueado. Botón COMPRAR CURSO (login si no hay sesión) o CONTINUAR con % de progreso.
- **/academia/:slug/aprender:** dos columnas (sidebar módulos/lecciones con checks y barra de progreso; área con video, título, subtítulo, descripción, links). Player: YouTube (youtube-nocookie, rel=0, modestbranding=1) y Vimeo (máxima calidad). YouTube no permite forzar calidad desde embed; Vimeo/Bunny sí (documentado en README). Botón MARCAR COMO COMPLETADA + auto-marcado al terminar (YouTube IFrame API / Vimeo events). Navegación anterior/siguiente + CONTINUAR → primera lección incompleta. Al 100%: banner de certificado.
- **Certificados:** Edge Function generate-certificate (verifica 100% en servidor, PDF b/n con pdf-lib: logo, estudiante, curso, maestro, fecha, código único), bucket privado, fila en certificates, email Resend. Descarga en perfil con URL firmada. /verificar/:code público.
- **/perfil:** datos + avatar editable, estadísticas (cursos con %, lecciones, certificados con descarga), historial de pedidos merch.
- **/panel (maestro):** solo teacher/admin, cada maestro solo sus cursos. CRUD curso (título, subtítulo, descripción, precio COP, cabecera con upload y preview), publicar/despublicar. Módulos y lecciones: crear, editar, eliminar, duplicar, reordenar con drag & drop (@dnd-kit, persistiendo position), mover lecciones entre módulos. Lección: título, subtítulo, descripción, video por link externo (NUNCA subida de video), links extra (label+url). "Ver como estudiante". Estética idéntica al resto.

## 9. Merch

- /merch: grid con hover del sitio original, nombre, precio COP.
- /merch/:slug: galería, descripción, selector de talla (stock), agregar al carrito.
- Carrito: drawer lateral, localStorage, editable.
- Checkout: formulario de envío (nombre, documento, dirección, ciudad, teléfono) → pago con Bold → al aprobarse: email de confirmación (Resend), descuento de stock, pedido visible en /perfil.
- Gestión de productos por ahora desde dashboard de Supabase.

## 10. Música

- /musica: réplica mejorada de las secciones BANDCAMP y SOUNDCLOUD del original (tarjetas noid-audio-container con cabecera de título) + bloque "OTRAS PLATAFORMAS".
- Embeds desde la tabla media_embeds. Iframes lazy con placeholders.

## 11. Pagos (Bold, COP)

- Botón de pagos, integración personalizada (https://checkout.bold.co/library/boldPaymentButton.js + new BoldCheckout({...}).open()). Consultar https://developers.bold.co antes de implementar; usar nombres de campos exactos. Monto en COP sin decimales (mínimo 1.000 COP); el botón no funciona dentro de iframes.
- **Edge Function create-payment:** recibe kind (course|merch) + ids, calcula monto en servidor, crea fila en payments con order_id único, devuelve order_id + monto + firma de integridad: SHA-256 de `{order_id}{monto}{COP}{llave_secreta}`. La llave secreta jamás sale del servidor.
- Frontend abre BoldCheckout con llave de identidad (pública), orderId, amount, currency 'COP', integritySignature, description, redirectionUrl → /pago/:orderId. Prellenar customerData.
- **Edge Function bold-webhook** (URL registrada en Panel de Comercios de Bold): valida x-bold-signature (HMAC-SHA256 hex con llave secreta sobre body en Base64, comparación tiempo constante), idempotente por order_id, actualiza payments.status; solo con SALE_APPROVED: crea enrollment (curso) o marca order pagada + descuenta stock (merch) + emails. En pruebas la firma se valida con llave vacía (flag de entorno).
- /pago/:orderId solo consulta payments; jamás otorga acceso. Manejar estado pendiente con elegancia (el webhook puede tardar minutos).

## 12. Emails (Resend, desde Edge Functions)

Plantillas HTML sobrias en negro y blanco, remitente No.ID Records <no-reply@noidentityrecords.com>:

1. Compra de curso confirmada (botón al curso).
2. Pedido de merch confirmado (resumen, tallas, envío).
3. Certificado emitido (PDF o link).
4. Verificación de cuenta y reset (SMTP de Supabase Auth con Resend).

README debe documentar registros DNS (SPF/DKIM) en Hostinger para verificar el dominio en Resend.

## 13. Deploy

- .github/workflows/deploy.yml: push a main → install, build, deploy con actions/deploy-pages, inyectando VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY desde GitHub Secrets.
- public/CNAME + 404.html.
- README con pasos: (1) DNS Hostinger: 4 registros A de GitHub Pages + CNAME www; (2) HTTPS en Pages; (3) Site URL y Redirect URLs en Supabase Auth + OAuth en Google Cloud Console; (4) secrets de Edge Functions + URL del webhook en Bold; (5) correr en local.

## 14. Fases (commit + checklist al cierre de cada una)

1. Scaffold + design tokens + layout global + home + /musica con embeds.
2. Supabase: migraciones + RLS + trigger profiles + buckets.
3. Autenticación completa.
4. Academia pública.
5. Panel del maestro.
6. Pagos Bold + inscripciones.
7. Experiencia de aprendizaje.
8. Certificados + emails.
9. Merch completa.
10. CI/CD + pulido.

Al cerrar cada fase: qué se hizo, qué probar manualmente, qué configuración externa toca hacer (Supabase, Google, Resend, Bold, Hostinger).

## 15. Reglas estrictas

- Ninguna clave secreta en cliente/repo, nunca.
- RLS en todas las tablas. Probar explícitamente que un no inscrito no puede leer lesson_content ni insertar en enrollments vía API directa.
- Montos siempre calculados en servidor.
- Videos siempre por link externo.
- Interfaz en español; código, nombres y commits en inglés.
- Respetar la estética; ante la duda, quitar.
- Si falta una llave/dato/decisión: preguntar antes de inventar.

## 16. Datos del proyecto

- Dominio: noidentityrecords.com (⚠️ expirado/aparcado en Hostinger a jul 2026 — renovar antes del deploy).
- Supabase: https://ztzgnorjnffpgytnwnvy.supabase.co — anon key `sb_publishable_eScEZXS_8OyryL3_xvudVA_1yKkinmt` (pública por diseño).
- Curso inicial: "Técnicas de producción de techno hipnótico x EL MAMU" — 80.000 COP — videos YouTube ocultos (links pendientes).
- Logo: originalmente https://noidentityrecords.com/wp-content/uploads/2025/02/LOGO_NOID.png (caído) → `/public/logo-noid.png`.
- Redes: Instagram https://www.instagram.com/noid.col/ · SoundCloud https://soundcloud.com/noidcol · Bandcamp https://noidrecords.bandcamp.com/ · RA https://fr.ra.co/promoters/142608
- Nota: la sección 9 del brief original decía "pago con Wompi" en checkout; prevalece Bold (secciones 2 y 11).
