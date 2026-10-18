import assert from "node:assert/strict";
import fs from "node:fs";

const html=fs.readFileSync("public/index.html","utf8");
const css=fs.readFileSync("public/styles.css","utf8");
const js=fs.readFileSync("public/app.js","utf8");
const products=JSON.parse(fs.readFileSync("public/data/products.json","utf8"));

const dialogStart=html.indexOf('<dialog id="productDialog"');
const dialogEnd=html.indexOf("</dialog>",dialogStart);
assert.ok(dialogStart>=0&&dialogEnd>dialogStart,"Falta modal de producto");
const modal=html.slice(dialogStart,dialogEnd);
const header=modal.indexOf('class="modal-topbar"');
const scroller=modal.indexOf('id="modalScroll"');
const footer=modal.indexOf('class="modal-actions"');
const action=modal.indexOf('id="modalWhatsApp"');
assert.ok(0<header&&header<scroller&&scroller<footer&&footer<action,
  "Cerrar y acción deben estar fuera del contenido con scroll");
assert.equal((modal.match(/id="modalWhatsApp"/g)||[]).length,1);
assert.ok(modal.includes('aria-labelledby="modalName"'),"El diálogo debe tener nombre accesible");

assert.match(css,/\.product-dialog\[open\]\{display:flex;flex-direction:column\}/);
assert.match(css,/\.modal-scroll\{[^}]*overflow-y:auto;overflow-x:hidden/);
assert.match(css,/\.modal-info h2\{[^}]*overflow-wrap:anywhere;/s);
assert.match(css,/\.modal-info\{[^}]*min-width:0;/s);
assert.match(css,/height:100dvh;max-height:100dvh;/);
assert.match(css,/padding:11px 16px calc\(10px \+ env\(safe-area-inset-bottom,0px\)\)/);
assert.match(css,/\.modal-image img\[hidden\],\.modal-fallback\[hidden\],\.modal-badge\[hidden\]\{display:none!important\}/);
assert.ok(js.includes('$("#modalScroll").scrollTop=0;'),"El modal debe abrir sin conservar scroll antiguo");
assert.ok(js.includes('$("#modalClose").focus({preventScroll:true});'),"Cerrar debe ser alcanzable por teclado");
assert.ok(products.some(p=>p.name.length>27),"La prueba debe cubrir títulos largos");
console.log("Modal responsive: scroll central, título adaptable y acciones siempre accesibles.");
