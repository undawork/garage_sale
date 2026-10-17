# Panel de administración (MVP)

Este panel se integra con el Worker existente sin Supabase. Se publica bajo `/admin/`, y la API bajo `/api/admin/*`. **Todas esas rutas quedan cerradas (403) mientras no se configuren los secretos y Cloudflare Access.** La landing pública no requiere autenticación.

## Arquitectura
- HTML/CSS/JS sin framework, adaptable a celular.
- Worker valida firma RS256 del JWT de Cloudflare Access, emisor, audiencia y vencimiento antes de servir cualquier archivo del panel o endpoint.
- GitHub Contents API lee y actualiza `public/data/products.json` con SHA para evitar pisar cambios concurrentes.
- Las fotos JPEG se guardan en `source-images/VG-XXX.jpg`; el workflow actual genera `public/products/VG-XXX.webp`.
- Sin base de datos ni credenciales en el navegador.

## Configuración necesaria ANTES de fusionar/desplegar
1. En Cloudflare Zero Trust > Access > Applications, crear una aplicación **Self-hosted** que cubra `https://TU-DOMINIO/admin/*` **y** `https://TU-DOMINIO/api/admin/*` (o dos aplicaciones con la misma audiencia, según la configuración de Zero Trust). Autorizar solo el correo del administrador. Cubrir también `/admin` sin barra final.
2. Copiar el **Application Audience (AUD)** y dominio del equipo (ej. `mi-equipo.cloudflareaccess.com`).
3. Crear un fine-grained GitHub token limitado a **undawork/garage_sale**, permiso **Contents: Read and write**. Guardarlo solo como secreto de Worker; nunca en `public/`, GitHub o `wrangler.jsonc`.
4. Configurar los siguientes secretos mediante Wrangler (desde una máquina autenticada):
   ```sh
   npx wrangler secret put ACCESS_TEAM_DOMAIN
   npx wrangler secret put ACCESS_AUD
   npx wrangler secret put GITHUB_TOKEN
   ```
5. Probar en entorno de prueba, verificar que `/admin/`, `/admin/admin.js` y `/api/admin/products` den **403** sin JWT válido y que la landing siga funcionando.
6. Recién después hacer merge/deploy. Revisar si el hosting usa Workers Static Assets, no Pages.

## Limitaciones conocidas del MVP
- Una foto principal por producto; soporte de galería y borrar imágenes en fase posterior.
- El panel escribe directamente en `main` cuando se guarda. El despliegue de cambios de JSON depende del mecanismo de CI/deploy conectado al repositorio. **El workflow actual solo optimiza imágenes: no garantiza desplegar cambios del catálogo**. Hay que revisar/habilitar el despliegue automático.
- La foto podría tardar en aparecer por el workflow de optimización y despliegue.
- La foto usa un máximo aproximado de 2 MB y se convierte a JPEG en navegador; HEIC depende del navegador.
- La seguridad depende de configurar Cloudflare Access correctamente y de no exponer rutas equivalentes por otro dominio sin protección. El Worker vuelve a validar JWT independientemente de la regla externa.
- Para desarrollo local, las rutas admin darán 403 sin credenciales de Access válidas.
- Futuro: edición de múltiples fotos, mejor gestión de errores y preview antes de publicar.

## Riesgos a probar
- Integración Cloudflare Access JWT y su claim aud.
- Validación de dimensiones y formato de imágenes.
- GitHub Actions genera WebP y despliega correctamente.
- Concurrencia: cambios simultáneos regresan 409 y obligan recargar.
