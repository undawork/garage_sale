import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataPath = path.join(root, "public", "data", "products.json");
const productsDir = path.join(root, "public", "products");

const products = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const ids = new Set();
const errors = [];
const warnings = [];

if (!Array.isArray(products)) {
  errors.push("products.json debe contener un array.");
} else {
  for (const [index, product] of products.entries()) {
    const row = index + 1;
    if (!product.id) errors.push(`Fila ${row}: falta id.`);
    if (!product.name) errors.push(`Fila ${row}: falta name.`);
    if (!product.category) errors.push(`Fila ${row}: falta category.`);

    if (product.id) {
      if (ids.has(product.id)) errors.push(`ID duplicado: ${product.id}`);
      ids.add(product.id);

      const explicit = product.image
        ? path.join(root, "public", String(product.image).replace(/^\//, ""))
        : null;
      const conventional = path.join(productsDir, `${product.id}.webp`);
      const imagePath = explicit || conventional;

      if (!fs.existsSync(imagePath)) {
        warnings.push(`${product.id}: falta foto optimizada (esperada: public/products/${product.id}.webp)`);
      }
    }
  }
}

if (warnings.length) {
  console.warn("\nAvisos:");
  warnings.forEach(w => console.warn(`- ${w}`));
}

if (errors.length) {
  console.error("\nErrores:");
  errors.forEach(e => console.error(`- ${e}`));
  process.exit(1);
}

console.log(`\nCatálogo válido: ${products.length} productos.`);
console.log("Las fotos faltantes son avisos y no bloquean el deploy.");
