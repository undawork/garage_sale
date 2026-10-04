import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceDir = path.resolve("source-images");
const outputDir = path.resolve("public/products");

await fs.mkdir(outputDir, { recursive: true });

const entries = await fs.readdir(sourceDir, { withFileTypes: true });
const images = entries
  .filter(entry => entry.isFile() && /^VG-\d{3}\.(png|jpg|jpeg)$/i.test(entry.name))
  .sort((a, b) => a.name.localeCompare(b.name));

for (const entry of images) {
  const id = entry.name.match(/^(VG-\d{3})/i)?.[1]?.toUpperCase();
  if (!id) continue;

  const input = path.join(sourceDir, entry.name);
  const output = path.join(outputDir, `${id}.webp`);

  await sharp(input)
    .webp({
      quality: 82,
      alphaQuality: 100,
      effort: 4,
      smartSubsample: true
    })
    .toFile(output);

  console.log(`${entry.name} -> public/products/${id}.webp`);
}

console.log(`Optimized ${images.length} product images.`);
