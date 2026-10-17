"use strict";
/**
 * Rotation is applied to pixels before uploading, not just to CSS previews.
 * One canvas renderer is shared by single-product editing and batch entry.
 */
(function () {
  const BG = "#f8f8f6";
  const angle = value => ((Number(value) || 0) % 360 + 360) % 360;

  function draw(canvas, source, rotation, padding = 0, background = BG) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("No se pudo preparar la imagen.");
    const w = source.naturalWidth || source.width;
    const h = source.naturalHeight || source.height;
    if (!w || !h) throw Error("La imagen no tiene dimensiones válidas.");
    const degrees = angle(rotation);
    const turned = degrees === 90 || degrees === 270;
    const orientedW = turned ? h : w;
    const orientedH = turned ? w : h;
    const scale = Math.min((canvas.width - padding * 2) / orientedW, (canvas.height - padding * 2) / orientedH);
    if (!(scale > 0)) throw Error("Las dimensiones de la imagen no son válidas.");

    // Reset the canvas on every repaint: rotating more than once must not
    // compound the previous transform or leave a stale image behind.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(degrees * Math.PI / 180);
    ctx.drawImage(source, -w * scale / 2, -h * scale / 2, w * scale, h * scale);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  async function openImage(file) {
    try {
      const bitmap = await createImageBitmap(file);
      return {image: bitmap, close: () => bitmap.close()};
    } catch {
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(Error("El navegador no puede abrir esta foto. Probá con JPG o PNG."));
          image.src = url;
        });
        return {image: img, close: () => {}};
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  }

  async function toJpegData(file, rotation = 0, mode = "batch") {
    const loaded = await openImage(file);
    try {
      const source = loaded.image;
      const w = source.naturalWidth || source.width;
      const h = source.naturalHeight || source.height;
      const degrees = angle(rotation);
      const swapped = degrees === 90 || degrees === 270;
      const orientedW = swapped ? h : w;
      const orientedH = swapped ? w : h;
      const canvas = document.createElement("canvas");
      let padding = 0;
      if (mode === "batch") {
        canvas.width = 1200;
        canvas.height = 1500;
        padding = 70;
      } else {
        const scale = Math.min(1, 1500 / Math.max(orientedW, orientedH));
        canvas.width = Math.max(1, Math.round(orientedW * scale));
        canvas.height = Math.max(1, Math.round(orientedH * scale));
      }
      draw(canvas, source, degrees, padding);
      let result = canvas.toDataURL("image/jpeg", .82);
      if (result.length > 2600000) result = canvas.toDataURL("image/jpeg", .65);
      if (result.length > 2800000) throw Error("La fotografía supera el tamaño permitido luego de girarla y optimizarla.");
      return result;
    } finally {
      loaded.close();
    }
  }

  window.GarageImageTools = {draw, toJpegData, angle};
})();
