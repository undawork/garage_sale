import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root=fs.readFileSync("public/index.html","utf8");
const cards=fs.readFileSync("public/app.js","utf8");
const cardCss=fs.readFileSync("public/styles.css","utf8");
const html=fs.readFileSync("public/producto/index.html","utf8");
const css=fs.readFileSync("public/producto/producto.css","utf8");
const js=fs.readFileSync("public/producto/producto.js","utf8");
const products=JSON.parse(fs.readFileSync("public/data/products.json","utf8"));
const ids=["VG-004","VG-027","VG-035","VG-037"];
for(const id of ids)assert.ok(products.some(p=>p.id===id),"Falta producto para prueba: "+id);
assert.ok(!root.includes('<dialog id="productDialog"'),"La tienda no debe abrir un lightbox");
assert.ok(!cards.includes("openProduct("),"El catálogo no debe llamar al modal antiguo");
assert.ok(!cardCss.includes(".product-dialog"),"Eliminar estilos del lightbox");
assert.ok(cards.includes('createElement("a","product-open")'),"Toda tarjeta debe enlazar al producto");
assert.ok(cards.includes('open.href="/producto/?id="+encodeURIComponent(product.id)'),"El enlace debe permitir abrir y compartir una ficha");

const expected=["detailImage","detailImageMissing","detailName","detailPrice","detailCategory","detailStatus",
 "detailDescription","detailSpecs","detailWhatsApp","mobileAction","mobileWhatsApp","error","related"];
for(const id of expected)assert.ok(html.includes('id="'+id+'"'),"Falta elemento "+id);
assert.ok(html.includes('href="/#catalogo"'),"La ficha debe permitir volver al catálogo");
assert.ok(html.includes('src="/producto/producto.js"'),"Falta script de producto");
assert.ok(html.includes('href="/producto/producto.css"'),"Faltan estilos del producto");
assert.ok(!html.includes("<dialog"),"La ficha no debe tener lightbox");
assert.ok(css.includes("aspect-ratio:1/1"),"El área de foto debe ser cuadrada");
assert.ok(css.includes("object-fit:contain"),"Las fotos no se deben recortar");
assert.ok(css.includes("grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr)"),"Imagen y texto separados en escritorio");
assert.ok(css.includes("flex-direction:column"),"La ficha móvil debe apilar foto y texto");
assert.ok(css.includes("position:fixed;left:0;right:0;bottom:0"),"El botón móvil debe permanecer visible");
assert.ok(css.includes("safe-area-inset-bottom"),"Respetar zona de gestos de móviles");
assert.ok(js.includes("p.publish!==false"),"Los borradores no deben ser públicos");
assert.ok(js.includes("if(isSold(p))"),"Los vendidos no deben permitir comprar");
assert.ok(js.includes("imagePath(p)")&&js.includes("src+(fresh?"),"La foto debe usar el WebP publicado");
assert.ok(js.includes("new URLSearchParams(location.search)"),"La ficha debe poder abrirse por URL");

new Function(js);new Function(cards);
const scope={location:{search:"?id=VG-004"},window:{GARAGE_CONFIG:{}},
 document:{querySelector:()=>null},Intl,URLSearchParams,Number,String};
assert.ok(products.find(p=>p.id==="VG-004").name.length>=20);
console.log("Producto independiente: imagen completa, título separado, enlaces compartibles y CTA móvil.");
