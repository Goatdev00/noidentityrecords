# Deploy: GitHub Pages + dominio noidentityrecords.com (DNS en Hostinger)

Repo: `Goatdev00/noidentityrecords` · El push a `main` ya construye y publica vía `.github/workflows/deploy.yml`.

## 0. Prerrequisito — el dominio debe estar activo

El dominio estuvo **aparcado/expirado** en Hostinger. En [hPanel → Dominios](https://hpanel.hostinger.com/domains), verifica que `noidentityrecords.com` aparezca **Activo**; si dice "Expirado", renuévalo antes de seguir. Los cambios DNS de abajo se hacen con los nameservers por defecto de Hostinger (no hay que cambiarlos).

## 1. Activar GitHub Pages (una sola vez)

1. Ve a `https://github.com/Goatdev00/noidentityrecords/settings/pages`.
2. En **Build and deployment → Source**, elige **GitHub Actions**.
3. Ve a la pestaña **Actions** y, si el workflow "Deploy to GitHub Pages" del primer push falló (porque Pages aún no estaba activo), ábrelo y dale **Re-run all jobs**. Al terminar, el sitio queda en `https://goatdev00.github.io/noidentityrecords/` temporalmente.

## 2. Registros DNS en Hostinger

hPanel → Dominios → noidentityrecords.com → **DNS / Nameservers** → Registros DNS:

**Eliminar** los registros del parking: todo registro `A` de nombre `@` existente, y cualquier `CNAME` de nombre `@` o `www` que apunte a Hostinger.

**Crear** (TTL por defecto está bien):

| Tipo | Nombre | Contenido | Nota |
|---|---|---|---|
| A | @ | 185.199.108.153 | IP de GitHub Pages |
| A | @ | 185.199.109.153 | IP de GitHub Pages |
| A | @ | 185.199.110.153 | IP de GitHub Pages |
| A | @ | 185.199.111.153 | IP de GitHub Pages |
| CNAME | www | goatdev00.github.io | usuario en minúsculas |

Opcional (IPv6, recomendado): registros `AAAA` en `@` con `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.

⚠️ No dejes ningún otro registro A/AAAA/CNAME en `@` o `www` — el parking de Hostinger suele dejar uno.

## 3. Conectar el dominio en GitHub

1. De vuelta en **Settings → Pages → Custom domain**, escribe `noidentityrecords.com` y **Save** (el repo ya publica `public/CNAME`, así que el build lo mantiene).
2. Espera el chequeo DNS (✓ verde). La propagación suele tardar minutos, máximo 24–48 h.
3. Cuando el chequeo pase, marca **Enforce HTTPS** (el certificado puede tardar hasta ~1 h en emitirse).

## 4. Verificar

```
nslookup noidentityrecords.com      → debe devolver las 4 IPs 185.199.108-111.153
nslookup www.noidentityrecords.com  → debe resolver a goatdev00.github.io
```

Y en el navegador: `https://noidentityrecords.com` y `https://www.noidentityrecords.com` (www redirige al apex), y una ruta profunda como `https://noidentityrecords.com/musica` recargando la página (fallback 404.html).

## 5. Recomendado: verificar el dominio en tu cuenta GitHub

`github.com/settings/pages` → **Add a domain** → `noidentityrecords.com` → crea el registro TXT que te indique (en Hostinger, tipo TXT con el nombre `_github-pages-challenge-Goatdev00`) → Verify. Esto evita que otro repo pueda reclamar tu dominio.
