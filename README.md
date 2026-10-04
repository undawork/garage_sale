# Venta de Garage

Catálogo responsive para publicar productos de una venta de garage, con filtros y contacto directo por WhatsApp.

## Arquitectura

- **Google Drive / Google Sheet:** fuente de trabajo.
- **GitHub:** versión publicable.
- **Cloudflare Workers Static Assets:** hosting.
- **WhatsApp:** CTA por producto.

## Imágenes

Las imágenes maestras se guardan en `source-images/` usando el ID del producto:

- `VG-001.png`
- `VG-002.png`
- etc.

GitHub Actions las convierte automáticamente a WebP optimizado en:

- `public/products/VG-001.webp`
- `public/products/VG-002.webp`

La web usa las imágenes WebP. Si una imagen todavía no existe, muestra un placeholder.

## Datos

Los datos del catálogo viven en `public/data/products.json`.

Si falta precio, la web muestra **Consultar**.

## Desarrollo

```bash
npm install
npm run optimize-images
npm run dev
```

## Validación

```bash
npm run validate
```

## Deploy

```bash
npm run deploy
```
