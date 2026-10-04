# Flujo simple del catálogo

La web está preparada para trabajar aunque todavía falten precios o fotos.

## Fuente de verdad

- Google Sheet: datos comerciales y estado de cada producto.
- `public/data/products.json`: copia publicable de los datos.
- `public/products/`: imágenes publicables.

## Convención de imágenes

En la web cada producto busca automáticamente una imagen por ID:

- `VG-001` -> `public/products/VG-001.png`
- `VG-002` -> `public/products/VG-002.png`
- etc.

No hace falta que el nombre del archivo web incluya marca, tipo, talle o color.
Los nombres descriptivos pueden conservarse en Drive; al publicar solo importa el ID.

Si la imagen todavía no existe, la tarjeta sigue funcionando y muestra “Foto próximamente”.

## Precios

Si `price` está vacío o es `null`, la web muestra “Consultar” en vez de $0.
Por eso se puede publicar la estructura antes de completar precios.

## Carga futura

Para completar el catálogo:

1. Actualizar datos/precios en el Sheet.
2. Preparar las fotos finales.
3. Renombrar/cargar cada foto por ID: `VG-001.png`, `VG-002.png`, etc.
4. Sincronizar `products.json`.
5. Ejecutar `npm run validate`.
6. Publicar.

El validador avisa qué fotos faltan pero no bloquea el deploy por imágenes pendientes.
