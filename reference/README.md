# Referencia de diseño

- `pagina-original.html` — HTML original del sitio (aportado por el usuario, jul 2026). Es la fuente de verdad de los tokens: gradiente radial, luz de cursor (0.12 → 70%, lerp 0.15), tarjetas `noid-audio-container` (radio 4px, borde 0.05 → 0.2, translateY(-5px), sombra 0 20px 40px), etiquetas de sección (20px, tracking 0.8em, opacidad 40%, alineadas a la izquierda), flotación (-15px, 4s) y los embeds originales de Bandcamp/SoundCloud.
- `LOGO_NOID.png` — logo oficial transparente 3375px (master). Los derivados servidos viven en `/public` (`logo-noid.png`, `logo-noid-wordmark.png`, `favicon.png`).

Nota: el dominio noidentityrecords.com estuvo aparcado en Hostinger (el WordPress original ya no está en línea), por eso las URLs absolutas a `noidentityrecords.com/wp-content/...` dentro del HTML de referencia no cargan.
