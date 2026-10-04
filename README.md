# Venta de Garage

Catálogo simple y responsive para publicar productos de una venta de garage, con filtros y contacto directo por WhatsApp.

## Arquitectura

- **Google Drive:** fuente de trabajo para fotos y planilla de productos.
- **GitHub:** versión publicable del catálogo.
- **Cloudflare Workers Static Assets:** hosting y despliegue automático.
- **WhatsApp:** CTA personalizado por producto.

## Catálogo

El sitio lee `public/data/products.json`. Cada producto puede tener:

```json
{
  "id": "VG-001",
  "name": "Camisa Zara celeste",
  "category": "Ropa",
  "type": "Camisa",
  "brand": "Zara",
  "size": "L",
  "color": "Celeste",
  "condition": "Excelente",
  "price": 25000,
  "currency": "ARS",
  "availability": "Disponible",
  "publish": true,
  "image": "/products/VG-001.png",
  "description": "Poco uso",
  "order": 1
}
```

## WhatsApp

Completar el número internacional sin + ni espacios en `public/config.js`:

```js
whatsappNumber: "549351XXXXXXXX"
```

## Desarrollo local

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run deploy
```

Cloudflare también puede desplegar automáticamente desde la rama `main`.
