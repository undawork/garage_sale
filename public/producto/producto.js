"use strict";

// Página de producto independiente: una imagen completa, información separada
// y una única acción principal, sin lightbox ni scroll dentro de un modal.
const $ = selector => document.querySelector(selector);
const config = window.GARAGE_CONFIG || {};
const currency = value => value == null || value === "" || !Number.isFinite(Number(value))
  ? "Consultar" : new Intl.NumberFormat(config.locale || "es-AR", {
      style:"currency", currency:config.currency || "ARS", maximumFractionDigits:0
    }).format(Number(value));
const validId = id => /^VG-\d{3,5}$/.test(id);
const imagePath = product => {
  if(typeof product.image === "string" && /^\/products\/VG-\d{3,5}\.webp$/.test(product.image))return product.image;
  return validId(String(product.id || ""))?"/products/"+product.id+".webp":"";
};
const create = (tag,cls,content) => {
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(content!==undefined)node.textContent=String(content);
  return node;
};
const isSold = p => p.availability==="Vendido";
function contactLink(p){
  const phone=String(config.whatsappNumber || "").replace(/\D/g,"");
  if(!phone)return "";
  return "https://wa.me/"+phone+"?text="+encodeURIComponent("¡Hola! Me interesa "+p.name+" ("+p.id+") de la venta de garage. ¿Sigue disponible?");
}
function showError(){
  $("#loading").hidden=true;
  $("#product").hidden=true;
  $("#error").hidden=false;
  $("#mobileAction").hidden=true;
  document.title="Artículo no disponible · Venta de Garage";
}
function fillImage(img, fallback, p, fresh=false){
  img.hidden=true;fallback.hidden=false;img.removeAttribute("src");
  const src=imagePath(p);
  if(!src)return;
  img.onload=()=>{img.hidden=false;fallback.hidden=true};
  img.onerror=()=>{img.hidden=true;fallback.hidden=false};
  img.alt="Fotografía completa de "+p.name;
  img.src=src+(fresh?"?v="+Date.now():"");
}
function makeSpec(label,value){
  const row=create("div","detail-spec-row");
  row.append(create("dt","",label),create("dd","",value));
  return row;
}
function updateAction(link,p,compact=false){
  link.classList.remove("is-disabled");
  link.removeAttribute("aria-disabled");
  if(isSold(p)){
    link.removeAttribute("href");link.classList.add("is-disabled");
    link.setAttribute("aria-disabled","true");
    link.textContent="Producto vendido";
    return;
  }
  const href=contactLink(p);
  if(href)link.href=href;else {
    link.removeAttribute("href");link.classList.add("is-disabled");
    link.setAttribute("aria-disabled","true");
  }
  link.textContent=!href?"Consulta no disponible":p.availability==="Reservado"?
    (compact?"Consultar reserva ↗":"Consultar disponibilidad ↗"):
    (compact?"Consultar ↗":"Consultar por WhatsApp ↗");
}
function relatedCard(p){
  const link=create("a","related-card");link.href="/producto/?id="+encodeURIComponent(p.id);
  link.setAttribute("aria-label","Ver "+p.name);
  const media=create("div","related-card-media"),image=create("img");
  image.loading="lazy";image.decoding="async";image.alt="Fotografía de "+p.name;
  image.onerror=()=>image.remove();
  image.src=imagePath(p);
  media.append(image);
  const body=create("div","related-card-body");
  body.append(create("small","",p.category||""),create("strong","",p.name),create("span","",currency(p.price)));
  link.append(media,body);
  return link;
}
function render(p,all){
  $("#loading").hidden=true;
  $("#error").hidden=true;
  $("#product").hidden=false;
  $("#breadcrumbName").textContent=p.name;
  document.title=p.name+" · Venta de Garage";
  $("meta[name='description']").content="Conocé "+p.name+" en Venta de Garage. Consultá detalles y disponibilidad por WhatsApp.";

  $("#detailCategory").textContent=[p.category,p.type].filter(Boolean).join(" · ").toLocaleUpperCase("es");
  $("#detailName").textContent=p.name;
  $("#detailId").textContent="Código "+p.id;
  const state=isSold(p)?"Vendido":p.availability==="Reservado"?"Reservado":"Disponible";
  $("#detailStatus").textContent=state;
  $("#detailStatus").className="detail-status "+(isSold(p)?"sold":p.availability==="Reservado"?"reserved":"");
  $("#detailPrice").textContent=currency(p.price);
  $("#detailDescription").textContent=p.description?.trim()||"Consultanos para conocer más detalles de este artículo.";

  $("#detailSpecs").replaceChildren(
    ...[["Marca",p.brand],["Talle",p.size],["Color",p.color],["Estado",p.condition]]
      .filter(([,value])=>value && value!=="-")
      .map(([name,value])=>makeSpec(name,value))
  );
  if(!$("#detailSpecs").children.length)$("#detailSpecs").hidden=true;

  fillImage($("#detailImage"),$("#detailImageMissing"),p,true);
  updateAction($("#detailWhatsApp"),p);
  updateAction($("#mobileWhatsApp"),p,true);
  $("#mobilePrice").textContent=currency(p.price);
  $("#mobileStatus").textContent=state;
  $("#mobileAction").hidden=false;

  const related=all.filter(x=>x.publish!==false&&!isSold(x)&&x.id!==p.id&&x.category===p.category)
    .sort((a,b)=>(a.order||999)-(b.order||999)).slice(0,3);
  $("#related").hidden=!related.length;
  if(related.length)$("#relatedGrid").replaceChildren(...related.map(relatedCard));
}
async function load(){
  const id=new URLSearchParams(location.search).get("id")||"";
  if(!validId(id)){showError();return}
  try{
    const response=await fetch("/data/products.json",{cache:"no-store"});
    if(!response.ok)throw Error("No se pudo leer el catálogo");
    const products=await response.json();
    if(!Array.isArray(products))throw Error("Catálogo incorrecto");
    const product=products.find(p=>p.id===id&&p.publish!==false);
    if(!product){showError();return}
    render(product,products);
  }catch(error){
    console.error("Error al cargar el artículo",error);
    showError();
  }
}
load();
