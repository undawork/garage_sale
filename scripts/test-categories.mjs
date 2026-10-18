import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const scope={window:{}};
vm.runInNewContext(fs.readFileSync("public/categories.js","utf8"),scope);
const categories=Array.from(scope.window.GARAGE_CATEGORIES);
assert.deepEqual(categories,["Ropa","Libros","Accesorios","Tech & Home"]);
assert.equal(new Set(categories).size,4);
const catalog=JSON.parse(fs.readFileSync("public/data/products.json","utf8"));
for(const item of catalog){
  assert.ok(categories.includes(item.category),item.id+" tiene categoría fuera del selector: "+item.category);
}
assert.equal(catalog.find(p=>p.id==="VG-036")?.category,"Tech & Home");
assert.equal(catalog.find(p=>p.id==="VG-037")?.category,"Tech & Home");
const css=fs.readFileSync("public/styles.css","utf8");
assert.ok(css.includes(".category-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))"));
assert.ok(!css.includes(".category-grid{grid-template-columns:repeat(3"));
for(const path of ["public/index.html","public/admin/index.html","public/admin/alta/index.html"]){
  assert.ok(fs.readFileSync(path,"utf8").includes('src="/categories.js"'),path+" no carga categorías");
}
console.log("4 categorías compartidas; productos y cuadrícula 2x2 coherentes.");
