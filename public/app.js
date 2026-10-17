"use strict";

const config = window.GARAGE_CONFIG || {};
const $ = selector => document.querySelector(selector);
const elements = {
  categoryCards: $("#categoryCards"), categoryTabs: $("#categoryTabs"),
  grid: $("#grid"), empty: $("#empty"), loadError: $("#loadError"),
  search: $("#search"), sort: $("#sort"), filterToggle: $("#filterToggle"),
  filterPanel: $("#filterPanel"), filterBadge: $("#filterBadge"),
  type: $("#typeFilter"), brand: $("#brandFilter"), size: $("#sizeFilter"),
  condition: $("#conditionFilter"), color: $("#colorFilter"),
  showSold: $("#showSold"), activeFilters: $("#activeFilters"),
  count: $("#resultCount"), catalogTitle: $("#catalogTitle"),
  heroCount: $("#heroCount"), heroMain: $("#heroMainImage"), heroSide: $("#heroSideImage"),
  dialog: $("#productDialog")
};
const state = {
  products: [], category: "Todo", type: "Todo", brand: "Todo",
  size: "Todo", condition: "Todo", color: "Todo", search: "",
  sort: "order", showSold: false, loaded: false
};
const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
const money = (value, currency = config.currency || "ARS") =>
  new Intl.NumberFormat(config.locale || "es-AR", {style:"currency",currency,maximumFractionDigits:0}).format(Number(value));
const priceLabel = p => p.price === null || p.price === undefined || p.price === "" || !Number.isFinite(Number(p.price)) ?
  "Consultar" : money(p.price, p.currency || config.currency);
const isSold = p => p.availability === "Vendido";
const isPublic = p => p.publish !== false;
const visiblePool = () => state.products.filter(p => isPublic(p) && (state.showSold || !isSold(p)));
const imagePath = p => {
  if (typeof p.image === "string" && /^\/products\/VG-\d{3,5}\.webp$/.test(p.image)) return p.image;
  return /^VG-\d{3,5}$/.test(String(p.id || "")) ? "/products/" + p.id + ".webp" : "";
};
const whatsAppLink = (product = null) => {
  const phone = String(config.whatsappNumber || "").replace(/\D/g, "");
  if (!phone) return "";
  const message = product
    ? "¡Hola! Me interesa " + product.name + " (" + product.id + ") de la venta de garage. ¿Sigue disponible?"
    : "¡Hola! Vi tu venta de garage y quisiera hacer una consulta.";
  return "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
};
function configureContactLinks() {
  const href = whatsAppLink();
  if (!href) return;
  for (const id of ["navContact","footerContact","floatingContact"]) {
    const el = $("#"+id);
    el.href = href;el.target = "_blank";el.rel = "noopener noreferrer";
  }
}
function sortedProducts(items) {
  return [...items].sort((a,b) => {
    if (isSold(a) !== isSold(b)) return isSold(a) ? 1 : -1;
    switch (state.sort) {
      case "price-asc": return (a.price == null ? Infinity : Number(a.price)) - (b.price == null ? Infinity : Number(b.price));
      case "price-desc": return (b.price == null ? -Infinity : Number(b.price)) - (a.price == null ? -Infinity : Number(a.price));
      case "name": return String(a.name).localeCompare(String(b.name), "es");
      default: return Number(a.order ?? 99999) - Number(b.order ?? 99999);
    }
  });
}
function uniqueValues(key) {
  return [...new Set(visiblePool().map(p => p[key]).filter(Boolean).map(String))].sort((a,b) => a.localeCompare(b,"es",{numeric:true}));
}
const filterFields = [["type","Tipo"],["brand","Marca"],["size","Talle"],["condition","Condición"],["color","Color"]];
function filterOptions() {
  for (const [key,label] of filterFields) {
    const options=uniqueValues(key);
    if (state[key]!=="Todo" && !options.includes(state[key])) state[key]="Todo";
    elements[key].replaceChildren(
      new Option("Todos", "Todo"), ...options.map(val => new Option(val,val))
    );
    elements[key].value=state[key];
    elements[key].setAttribute("aria-label", "Filtrar por "+label.toLowerCase());
  }
}
function categoryCounts() {
  const groups = new Map();
  visiblePool().forEach(p => {
    const key = String(p.category || "Otros");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  });
  return groups;
}
function createElement(tag,className,text) {
  const el = document.createElement(tag);
  if (className) el.className=className;
  if (text!==undefined) el.textContent=String(text);
  return el;
}
function renderCategories() {
  const groups=categoryCounts();
  const entries=[...groups.entries()].sort(([a],[b]) => {
    const order=["Ropa","Libros","Accesorios"];
    const ai=order.indexOf(a),bi=order.indexOf(b);
    return (ai===-1?100:ai)-(bi===-1?100:bi) || a.localeCompare(b,"es");
  });
  const tabAll=createElement("button","category-tab"+(state.category==="Todo"?" active":""),"Ver todo");
  tabAll.type="button";tabAll.dataset.category="Todo";tabAll.setAttribute("aria-pressed",String(state.category==="Todo"));
  tabAll.append(createElement("span","",visiblePool().length));
  const tabs=[tabAll];
  const cards=[];
  entries.forEach(([name,items],index)=>{
    const selected=state.category===name;
    const tab=createElement("button","category-tab"+(selected?" active":""),name);
    tab.type="button";tab.dataset.category=name;tab.setAttribute("aria-pressed",String(selected));
    tab.append(createElement("span","",items.length));
    tabs.push(tab);
    const card=createElement("button","category-card");
    card.type="button";card.dataset.category=name;card.dataset.tone=String(index%3);
    const example=[...items].sort((a,b)=>(a.order||999)-(b.order||999))[0];
    if (example) {
      const img=createElement("img");
      img.alt="";img.loading="lazy";img.src=imagePath(example);
      img.onerror=()=>img.remove();
      card.append(img);
    }
    const top=createElement("div","category-top");
    top.append(createElement("span","",String(index+1).padStart(2,"0")+" / CATEGORÍA"),createElement("span","category-arrow","↗"));
    const bottom=createElement("div","category-bottom");
    const label=createElement("div");
    label.append(createElement("strong","",name),createElement("small","",items.length+" "+(items.length===1?"artículo":"artículos")));
    bottom.append(label);
    card.append(top,bottom);
    cards.push(card);
  });
  elements.categoryTabs.replaceChildren(...tabs);
  elements.categoryCards.replaceChildren(...cards);
}
function getMatches() {
  let items=visiblePool();
  if (state.category!=="Todo") items=items.filter(p=>p.category===state.category);
  for (const [key] of filterFields) {
    if (state[key]!=="Todo") items=items.filter(p=>String(p[key]??"")===state[key]);
  }
  if (state.search.trim()) {
    const q=normalize(state.search.trim());
    items=items.filter(p=>normalize([p.id,p.name,p.category,p.type,p.brand,p.size,p.color,p.condition,p.description].filter(Boolean).join(" ")).includes(q));
  }
  return sortedProducts(items);
}
function createProductCard(product) {
  const sold=isSold(product);
  const card=createElement("article","product-card"+(sold?" sold-card":""));
  const photo=createElement("div","product-photo");
  const fallback=createElement("div","product-placeholder");
  fallback.append(createElement("strong","","vg."),createElement("span","","Imagen no disponible"));
  photo.append(fallback);
  const src=imagePath(product);
  if (src) {
    const img=createElement("img");img.src=src;img.loading="lazy";img.decoding="async";img.alt="Fotografía de "+product.name;
    img.addEventListener("error",()=>img.remove(),{once:true});photo.append(img);
  }
  const pillText=sold?"Vendido":product.availability==="Reservado"?"Reservado":product.condition==="Nuevo con Etiqueta"?"Con etiqueta":"Disponible";
  const pill=createElement("span","product-tag"+(sold?" sold":product.availability==="Reservado"?" reserved":""),pillText);
  photo.append(pill);
  const quick=createElement("button","product-quick","Ver detalles ↗");quick.type="button";
  quick.dataset.product=product.id;quick.setAttribute("aria-label","Ver detalles de "+product.name);
  photo.append(quick);
  const body=createElement("div","product-content");
  body.append(createElement("span","product-category",[product.category,product.type].filter(Boolean).join(" · ")));
  body.append(createElement("h3","product-title",product.name));
  body.append(createElement("p","product-subtitle",[product.brand,product.size?"Talle "+product.size:null].filter(Boolean).join(" · ")||"Pieza seleccionada"));
  const bottom=createElement("div","product-bottom");
  bottom.append(createElement("strong","product-price",priceLabel(product)));
  const details=createElement("button","product-view","↗");details.type="button";details.dataset.product=product.id;details.setAttribute("aria-label","Ver "+product.name);
  bottom.append(details);body.append(bottom);
  card.append(photo,body);
  return card;
}
function renderActiveFilters() {
  const items=[];
  if(state.category!=="Todo") items.push(["category","Categoría: "+state.category]);
  for(const [key,label] of filterFields)if(state[key]!=="Todo")items.push([key,label+": "+state[key]]);
  if(state.search.trim())items.push(["search","Búsqueda: "+state.search.trim()]);
  if(state.showSold)items.push(["showSold","Incluye vendidos"]);
  elements.activeFilters.replaceChildren(...items.map(([key,label])=>{
    const button=createElement("button","active-chip",label+" ×");button.type="button";button.dataset.clear=key;
    button.setAttribute("aria-label","Quitar "+label);return button;
  }));
  const count=items.filter(([key])=>key!=="search").length;
  elements.filterBadge.hidden=count===0;elements.filterBadge.textContent=count;
  $("#clearFilters").disabled=items.length===0;
}
function render() {
  if (!state.loaded) return;
  renderCategories();
  const items=getMatches();
  elements.grid.replaceChildren(...items.map(createProductCard));
  elements.empty.hidden=items.length>0;
  const sold=state.products.filter(p=>isPublic(p)&&isSold(p)).length;
  elements.count.textContent=items.length+" "+(items.length===1?"artículo":"artículos")+(sold&&!state.showSold?" · "+sold+" vendidos ocultos":"");
  elements.catalogTitle.textContent="";elements.catalogTitle.append("Todo lo ");
  const emph=createElement("em","",state.category==="Todo"?"disponible":state.category);
  elements.catalogTitle.append(emph);
  renderActiveFilters();
}
function resetFilters() {
  Object.assign(state,{category:"Todo",type:"Todo",brand:"Todo",size:"Todo",condition:"Todo",color:"Todo",search:"",sort:"order",showSold:false});
  elements.search.value="";elements.sort.value="order";elements.showSold.checked=false;
  filterOptions();render();
}
function setCategory(category) {
  state.category=category;
  for(const [key] of filterFields)state[key]="Todo";
  state.search="";elements.search.value="";
  filterOptions();render();
  $("#catalogo").scrollIntoView({behavior:"smooth",block:"start"});
}
function setHero() {
  const items=visiblePool().filter(p=>imagePath(p));
  const featured=items.find(p=>p.category==="Ropa")||items[0];
  const second=items.find(p=>p.category!==featured?.category)||items.find(p=>p.id!==featured?.id);
  function setImage(img,product) {
    if(!product){img.removeAttribute("src");return;}
    img.src=imagePath(product);img.alt="Fotografía de "+product.name;
    img.onerror=()=>img.removeAttribute("src");
  }
  setImage(elements.heroMain,featured);setImage(elements.heroSide,second);
  const count=state.products.filter(p=>isPublic(p)&&!isSold(p)).length;
  elements.heroCount.textContent=count+" "+(count===1?"artículo para descubrir":"artículos para descubrir");
}
function openProduct(id) {
  const p=state.products.find(item=>item.id===id&&isPublic(item));
  if(!p) return;
  const img=$("#modalImage"),fallback=$("#modalFallback");
  img.hidden=false;fallback.hidden=true;
  img.src=imagePath(p);img.alt="Foto grande de "+p.name;
  img.onload=()=>{img.hidden=false;fallback.hidden=true;};
  img.onerror=()=>{img.hidden=true;fallback.hidden=false;};
  $("#modalCategory").textContent=[p.category,p.type].filter(Boolean).join(" / ");
  $("#modalName").textContent=p.name;$("#modalCode").textContent=p.id;
  $("#modalPrice").textContent=priceLabel(p);
  $("#modalDescription").textContent=p.description||"Consultanos para más detalles de este producto.";
  const specs=[p.brand&&"Marca: "+p.brand,p.size&&"Talle: "+p.size,p.color&&"Color: "+p.color,p.condition&&"Estado: "+p.condition].filter(Boolean);
  $("#modalSpecs").replaceChildren(...specs.map(v=>createElement("span","",v)));
  const badge=$("#modalBadge");
  badge.hidden=!isSold(p)&&p.availability!=="Reservado";
  badge.textContent=isSold(p)?"Vendido":p.availability==="Reservado"?"Reservado":"";
  const action=$("#modalWhatsApp"),href=whatsAppLink(p);
  if(isSold(p)) {
    action.removeAttribute("href");action.classList.add("disabled");action.setAttribute("aria-disabled","true");
    action.textContent="Producto vendido";
  }else {
    action.classList.remove("disabled");action.removeAttribute("aria-disabled");
    if(href) action.href=href;else action.removeAttribute("href");
    action.textContent=p.availability==="Reservado"?"Consultar disponibilidad ↗":"Consultar por WhatsApp ↗";
  }
  elements.dialog.showModal();
}
async function loadCatalog() {
  elements.loadError.hidden=true;
  try {
    const res=await fetch("/data/products.json",{cache:"no-store"});
    if(!res.ok)throw Error("HTTP "+res.status);
    const data=await res.json();
    if(!Array.isArray(data))throw Error("Catálogo no disponible");
    state.products=data;state.loaded=true;
    elements.grid.hidden=false;
    filterOptions();setHero();render();configureContactLinks();
    $("#catalogIntro").textContent="Explorá "+state.products.filter(p=>isPublic(p)&&!isSold(p)).length+" hallazgos disponibles y encontrá el tuyo.";
  }catch(err) {
    console.error("No se pudo cargar la tienda",err);
    elements.loadError.hidden=false;elements.empty.hidden=true;elements.grid.replaceChildren();
    elements.count.textContent="No pudimos cargar el catálogo";
    elements.categoryCards.replaceChildren(createElement("p","loading-text","No pudimos cargar las categorías."));
    elements.heroCount.textContent="Consultá nuestro catálogo";
  }
}
elements.categoryCards.addEventListener("click",e=>{const b=e.target.closest("[data-category]");if(b)setCategory(b.dataset.category)});
elements.categoryTabs.addEventListener("click",e=>{const b=e.target.closest("[data-category]");if(b)setCategory(b.dataset.category)});
elements.grid.addEventListener("click",e=>{const b=e.target.closest("[data-product]");if(b)openProduct(b.dataset.product)});
elements.search.addEventListener("input",e=>{state.search=e.target.value;render()});
elements.sort.addEventListener("change",e=>{state.sort=e.target.value;render()});
for(const [key] of filterFields)elements[key].addEventListener("change",e=>{state[key]=e.target.value;render()});
elements.showSold.addEventListener("change",e=>{
  state.showSold=e.target.checked;filterOptions();
  if(!visiblePool().some(p=>p.category===state.category))state.category="Todo";
  setHero();render();
});
elements.filterToggle.addEventListener("click",()=>{
  const opening=elements.filterPanel.hidden;
  elements.filterPanel.hidden=!opening;
  elements.filterToggle.setAttribute("aria-expanded",String(opening));
});
$("#clearFilters").addEventListener("click",resetFilters);
$("#emptyReset").addEventListener("click",resetFilters);
$("#retryLoad").addEventListener("click",loadCatalog);
elements.activeFilters.addEventListener("click",e=>{
  const key=e.target.closest("[data-clear]")?.dataset.clear;
  if(!key)return;
  if(key==="showSold") {state.showSold=false;elements.showSold.checked=false;filterOptions();}
  else if(key==="search"){state.search="";elements.search.value=""}
  else state[key]="Todo";
  if(key==="category")filterOptions();
  render();
});
$("#modalClose").addEventListener("click",()=>elements.dialog.close());
elements.dialog.addEventListener("click",e=>{if(e.target===elements.dialog)elements.dialog.close()});
configureContactLinks();
loadCatalog();
