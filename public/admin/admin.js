"use strict";
let products=[],sha="",currentId=null,readOnly=true,dirty=false,busy=false;
const marked=new Set(),$=s=>document.querySelector(s),form=$("#form"),status=$("#status");
const fields=["id","name","category","type","brand","size","color","condition","price","availability","order","description"];
let localImageUrl=null;
const money=value=>value==null||value===""?"Consultar":new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(Number(value));
const picture=p=>p.image||("/products/"+p.id+".webp");
function report(message,error=false){status.textContent=message;status.classList.toggle("error",error)}
function notice(message,error=false){const node=$("#notice");node.textContent=message;node.classList.toggle("error",error);node.hidden=!message}
async function api(path,options={}){
  const response=await fetch("/api/admin/"+path,{...options,headers:{"content-type":"application/json",...(options.headers||{})},credentials:"same-origin"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||"Error "+response.status);
  return data;
}
function stats(){
  const count=field=>products.filter(field).length;
  $("#stat-total").textContent=products.length;
  $("#stat-available").textContent=count(p=>p.availability==="Disponible"&&p.publish!==false);
  $("#stat-reserved").textContent=count(p=>p.availability==="Reservado"&&p.publish!==false);
  $("#stat-sold").textContent=count(p=>p.availability==="Vendido");
  $("#stat-hidden").textContent=count(p=>p.publish===false);
}
function filtered(){
  const search=$("#search").value.trim().toLocaleLowerCase("es");
  const filter=$("#statusFilter").value;
  return [...products].filter(p=>{
    if(filter==="Oculto"&&p.publish!==false)return false;
    if(filter!=="Todos"&&filter!=="Oculto"&&(p.availability!==filter||p.publish===false))return false;
    return !search||(p.name+" "+p.id+" "+(p.brand||"")).toLocaleLowerCase("es").includes(search);
  }).sort((a,b)=>(a.order||9999)-(b.order||9999));
}
function pill(p){
  const label=p.publish===false?"Oculto":p.availability||"Disponible";
  const el=document.createElement("span");el.className="pill "+(label==="Vendido"?"sold":label==="Reservado"?"reserved":label==="Oculto"?"hidden":"");el.textContent=label;return el;
}
function list(){
  const rows=filtered(),listEl=$("#items");
  $("#count").textContent=rows.length+" de "+products.length+" productos";
  listEl.replaceChildren();
  for(const p of rows){
    const row=document.createElement("div");row.className="item-row"+(p.id===currentId?" active":"");
    const check=document.createElement("input");check.type="checkbox";check.className="item-select";check.checked=marked.has(p.id);check.setAttribute("aria-label","Seleccionar "+p.id);
    check.addEventListener("change",()=>{if(check.checked)marked.add(p.id);else marked.delete(p.id);list()});
    const img=document.createElement("img");img.className="item-thumb";img.src=picture(p);img.alt="";img.loading="lazy";
    img.addEventListener("error",()=>{const empty=document.createElement("span");empty.className="item-thumb item-placeholder";empty.textContent="Sin foto";img.replaceWith(empty)},{once:true});
    const open=document.createElement("button");open.type="button";open.className="item-open";
    const name=document.createElement("strong");name.textContent=p.name;const info=document.createElement("small");info.textContent=p.id+" · "+money(p.price);
    open.append(name,info);open.addEventListener("click",()=>choose(p.id));
    row.append(check,img,open,pill(p));listEl.append(row);
  }
  const all=rows.length>0&&rows.every(p=>marked.has(p.id));
  const select=$("#selectAll");select.checked=all;select.indeterminate=rows.some(p=>marked.has(p.id))&&!all;
  $("#bulk").hidden=marked.size===0;$("#bulkCount").textContent=marked.size+" seleccionados";
  $("#clearSelection").disabled=marked.size===0;
  document.querySelectorAll("[data-bulk]").forEach(btn=>btn.disabled=readOnly||busy);
  if(!rows.length){const empty=document.createElement("p");empty.textContent="No hay productos con estos filtros.";empty.className="empty-list";listEl.append(empty)}
}
function cleanupLocalImage(){if(localImageUrl){URL.revokeObjectURL(localImageUrl);localImageUrl=null}}
function photoPreview(p){
  const img=$("#preview"),empty=$("#imageEmpty");
  img.hidden=true;empty.hidden=false;img.removeAttribute("src");
  if(!p?.id)return;
  img.onload=()=>{img.hidden=false;empty.hidden=true};
  img.onerror=()=>{img.hidden=true;empty.hidden=false};
  img.src=picture(p);
}
function current(){return products.find(p=>p.id===currentId)||null}
function choose(id,force=false){
  if(dirty&&!force&&!confirm("Tenés cambios sin guardar. ¿Descartarlos?"))return;
  cleanupLocalImage();dirty=false;currentId=id;
  const p=current();const isNew=!p;
  for(const key of fields){
    const input=form.elements.namedItem(key);
    if(!input)continue;
    input.value=p?.[key]??"";
  }
  if(isNew){const highest=Math.max(0,...products.map(p=>Number(p.id.slice(3))||0));form.elements.namedItem("id").value="VG-"+String(highest+1).padStart(3,"0")}
  form.elements.namedItem("publish").checked=p?.publish!==false;
  form.elements.namedItem("availability").value=p?.availability||"Disponible";
  form.elements.namedItem("order").value=p?.order||products.length+1;
  $("#photo").value="";
  $("#title").textContent=p?p.name:"Nuevo producto";
  $("#subTitle").textContent=p?"Código "+p.id+" · Guardá para actualizar la tienda.":"Completá los datos y guardá antes de subir una foto.";
  $("#deleteOne").disabled=readOnly||busy||isNew;
  report("");
  photoPreview(p);
  preview();
  list();
}
function preview(){
  const old=current(),get=k=>form.elements.namedItem(k)?.value||"";
  $("#previewName").textContent=get("name")||"Nombre del producto";
  $("#previewMeta").textContent=[get("category"),get("brand"),get("size")&&"Talle "+get("size")].filter(Boolean).join(" · ");
  $("#previewPrice").textContent=money(get("price")===""?null:get("price"));
  const state=get("availability");
  const badge=$("#previewStatus");badge.textContent=state||"Disponible";badge.className="status-pill "+(state==="Vendido"?"sold":state==="Reservado"?"reserved":"");
  const visible=form.elements.namedItem("publish").checked;
  $("#previewVisibility").textContent=!visible?"Oculto: no aparece en la tienda":state==="Vendido"?"Vendido: no aparece por defecto en la tienda":"Visible en la tienda";
  const disabled=readOnly||busy||!old;
  for(const btn of ["#quickSold","#quickReserved","#quickAvailable"])$(btn).disabled=disabled;
}
function draft(){
  const original=current()||{},result={...original};
  for(const key of fields){
    const raw=form.elements.namedItem(key).value.trim();
    result[key]=key==="price"?(raw===""?null:Number(raw)):key==="order"?(raw===""?products.length+1:Number(raw)):raw;
  }
  result.id=result.id.toUpperCase();
  result.publish=form.elements.namedItem("publish").checked;
  result.currency="ARS";result.image=result.image||null;
  return result;
}
async function saveCatalog(next,returnTo,successMessage){
  if(readOnly||busy)throw Error("No se pueden guardar cambios en este momento.");
  busy=true;$("#save").disabled=true;list();preview();$("#deleteOne").disabled=true;
  try{
    const result=await api("products",{method:"PUT",body:JSON.stringify({products:next,sha})});
    products=next;sha=result.sha;marked.clear();
    stats();dirty=false;choose(returnTo&&products.some(p=>p.id===returnTo)?returnTo:products[0]?.id||null,true);
    const msg=successMessage||"Cambios guardados en GitHub. Cloudflare los publicará en unos instantes.";
    report(msg);notice(msg);
    return true;
  }catch(error){report(error.message,true);notice(error.message,true);return false}
  finally{busy=false;$("#save").disabled=readOnly;$("#deleteOne").disabled=readOnly||!current();list();preview()}
}
function ensureClean(){return !dirty||confirm("Tenés cambios sin guardar. ¿Descartarlos para continuar?")}
async function quickChange(availability){
  const p=current();if(!p||!ensureClean())return;
  const next=products.map(x=>x.id===p.id?{...x,availability}:x);
  report("Guardando estado…");await saveCatalog(next,p.id,"Estado actualizado a "+availability+". La tienda se actualizará en unos instantes.");
}
async function bulk(action){
  const ids=[...marked];if(!ids.length||readOnly||busy||!ensureClean())return;
  if(action==="delete"){
    if(!confirm("¿Eliminar "+ids.length+" producto(s) del catálogo?\n\nSe quitarán del catálogo público y del administrador. Sus fotos permanecerán en GitHub como respaldo."))return;
    const next=products.filter(p=>!marked.has(p.id));
    await saveCatalog(next,marked.has(currentId)?next[0]?.id:currentId,"Productos eliminados del catálogo. Las fotos se conservaron en GitHub.");
    return;
  }
  const next=products.map(p=>{
    if(!marked.has(p.id))return p;
    if(action==="hide")return {...p,publish:false};
    if(action==="show")return {...p,publish:true};
    return {...p,availability:action};
  });
  const message=action==="hide"?"Productos ocultos":action==="show"?"Productos publicados":"Productos marcados como "+action.toLowerCase();
  await saveCatalog(next,currentId,message+". Cloudflare actualizará la tienda en unos instantes.");
}
async function load(){
  try{
    const data=await api("products");
    products=Array.isArray(data.products)?data.products:[];sha=data.sha||"";readOnly=Boolean(data.readOnly);
    for(const key of ["#save","#upload","#new"])$(key).disabled=readOnly;
    stats();choose(products[0]?.id||null,true);
    if(readOnly)report("Modo lectura: falta configurar GITHUB_TOKEN en Cloudflare.",true);
  }catch(error){report("No se pudo cargar el catálogo: "+error.message,true);notice("No se pudo cargar el catálogo: "+error.message,true)}
}
form.addEventListener("input",event=>{if(event.target.id==="photo")return;dirty=true;preview()});
form.addEventListener("change",event=>{if(event.target.id==="photo")return;dirty=true;preview()});
form.addEventListener("submit",async event=>{
  event.preventDefault();if(readOnly||busy)return;
  const product=draft(),id=product.id;
  if(!/^VG-\d{3,5}$/.test(id)){report("Usá un código como VG-031.",true);return}
  if(products.some(p=>p.id===id&&p.id!==currentId)){report("Ese código ya existe.",true);return}
  if(!Number.isInteger(product.order)||product.order<1){report("El orden debe ser un número entero positivo.",true);return}
  const next=products.filter(p=>p.id!==currentId);next.push(product);
  report("Guardando producto…");await saveCatalog(next,id,"Producto guardado. Cloudflare lo publicará en unos instantes.");
});
$("#new").addEventListener("click",()=>choose(null));
$("#search").addEventListener("input",list);
$("#statusFilter").addEventListener("change",list);
$("#selectAll").addEventListener("change",event=>{
  const ids=filtered().map(p=>p.id);
  for(const id of ids){if(event.target.checked)marked.add(id);else marked.delete(id)}list();
});
$("#clearSelection").addEventListener("click",()=>{marked.clear();list()});
document.querySelectorAll("[data-bulk]").forEach(btn=>btn.addEventListener("click",()=>bulk(btn.dataset.bulk)));
$("#quickSold").addEventListener("click",()=>quickChange("Vendido"));
$("#quickReserved").addEventListener("click",()=>quickChange("Reservado"));
$("#quickAvailable").addEventListener("click",()=>quickChange("Disponible"));
$("#deleteOne").addEventListener("click",()=>{
  const p=current();if(!p||readOnly||busy||!ensureClean())return;
  if(confirm("¿Eliminar "+p.name+" ("+p.id+") del catálogo?\n\nEsta acción quita la ficha. La foto seguirá guardada en GitHub.")){
    saveCatalog(products.filter(x=>x.id!==p.id),null,"Producto quitado del catálogo; foto conservada.");
  }
});
$("#photo").addEventListener("change",event=>{
  cleanupLocalImage();
  const file=event.target.files?.[0];if(!file){photoPreview(current());return}
  localImageUrl=URL.createObjectURL(file);const img=$("#preview");
  img.src=localImageUrl;img.hidden=false;$("#imageEmpty").hidden=true;
  img.onerror=()=>{img.hidden=true;$("#imageEmpty").hidden=false};
});
$("#upload").addEventListener("click",async()=>{
  if(readOnly||busy)return;const product=current(),file=$("#photo").files?.[0];
  if(!product){report("Guardá el producto antes de subir la fotografía.",true);return}
  if(dirty){report("Guardá primero los cambios del formulario.",true);return}
  if(!file){report("Seleccioná una foto antes de subirla.",true);return}
  report("Preparando fotografía…");
  try{
    const bitmap=await createImageBitmap(file),scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement("canvas");canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
    canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    const data=canvas.toDataURL("image/jpeg",.82);
    if(data.length>2800000)throw Error("La foto supera 2 MB optimizada.");
    await api("image",{method:"PUT",body:JSON.stringify({id:product.id,data})});
    report("Foto enviada. GitHub la optimizará y Cloudflare la publicará.");
    notice("Fotografía enviada. Puede tardar unos instantes en aparecer en la tienda.");
  }catch(error){report("Error al subir: "+error.message,true)}
});
window.addEventListener("beforeunload",event=>{if(dirty){event.preventDefault();event.returnValue=""}});
load();
