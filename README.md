# Venta de Garage

Catálogo responsive para publicar productos de una venta de garage, con filtros y contacto directo por WhatsApp.

## Arquitectura

- **Google Drive / Google Sheet:** fuente de trabajo.
- **GitHub:** versión publicable.
- **Cloudflare Workers Static Assets:** hosting.
- **WhatsApp:** CTA por producto.

## Estado actual

La estructura admite publicar productos incompletos:

- sin foto -> muestra placeholder;
- sin precio -> muestra **Consultar**;
- con foto -> busca automáticamente `/products/ID.png`.

Ejemplo: `VG-001` utiliza `public/products/VG-001.png`.

Los datos del catálogo viven en `public/data/products.json`.

## WhatsApp

El número está configurado en `public/config.js`.

## Desarrollo

```bash
npm install
npm run dev
```

## Validación

```bash
npm run validate
```

El validador detecta IDs duplicados o datos obligatorios faltantes. Las fotos pendientes se reportan como avisos y no bloquean el deploy.

## Deploy

```bash
npm run deploy
```

Ver `docs/CATALOG_WORKFLOW.md` para el flujo de carga.
