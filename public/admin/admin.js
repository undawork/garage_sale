"use strict";
const $=selector=>document.querySelector(selector);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
const money=v=>v===null||v===undefined||v===""?"Consultar":new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(Number(v));
const photoURL=p=>p.image||("/products/"+p.id+".webp");
const form=$("#form"),dialog=$("#editDialog"),addDialog=$("#addDialog"),frame=$("#addFrame");
const keys=["id","name","category","type","brand","size","color","condition","price","availability","order","description"];
let products=[],sha="",readOnly=true,busy=false,dirty=false,formDirty=false,photoDirty=false,currentId=null,searchFilter="Todos",categoryFilter="Todas",selectionMode=false,localURL=null,localSource=null,photoRotation=0;
const selected=new Set();
function notify(message,error=false){
  const node=$("#notice");node.textContent=message;node.classList.toggle("error",error);node.hidden=!message;
}
function report(message,error=false){
  const node=$("#status");node.textContent=message;node.classList.toggle("error",error);
}
async function api(path,options={}){
  const response=await fetch("/api/admin/"+path,{...options,credentials:"same-origin",headers:{"content-type":"application/json",...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||"Error "+response.status);
  return data;
}
function stats(){
  const count=f=>products.filter(f).length;
  $("#stat-total").textContent=products.length;
  $("#stat-available").textContent=count(p=>p.publish!==false&&p.availability!=="Vendido");
  $("#stat-reserved").textContent=count(p=>p.availability==="Reservado");
  $("#stat-sold").textContent=count(p=>p.availability==="Vendido");
  $("#stat-hidden").textContent=count(p=>p.publish===false);
}
function categories(){
  const filter=$("#categoryFilter"),prior=filter.value;
  const values=[...new Set(products.map(p=>p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
  filter.replaceChildren();
  filter.append(new Option("Todas las categorías","Todas"),...values.map(s=>new Option(s,s)));
  filter.value=values.includes(prior)?prior:"Todas";categoryFilter=filter.value;
}
function filtered(){
  const search=$("#search").value.trim().toLocaleLowerCase("es");
  return products.filter(p=>{
    if(searchFilter==="Oculto"&&p.publish!==false)return false;
    if(searchFilter==="Disponible"&&(p.availability!=="Disponible"||p.publish===false))return false;
    if(searchFilter==="Reservado"&&(p.availability!=="Reservado"||p.publish===false))return false;
    if(searchFilter==="Vendido"&&p.availability!=="Vendido")return false;
    if(categoryFilter!=="Todas"&&p.category!==categoryFilter)return false;
    return !search||[p.name,p.id,p.brand,p.type,p.category].filter(Boolean).join(" ").toLocaleLowerCase("es").includes(search);
  }).sort((a,b)=>(a.order||99999)-(b.order||99999));
}
function tagLabel(p){return p.publish===false?"Borrador":p.availability||"Disponible"}
function card(p){
  const node=el("article","item-card"+(selectionMode?" selection-mode":"")+(selected.has(p.id)?" selected":""));
  const main=el("button","card-main");main.type="button";main.setAttribute("aria-label",(selectionMode?"Seleccionar ":"Editar ")+p.name);
  main.addEventListener("click",()=>{
    if(selectionMode){selected.has(p.id)?selected.delete(p.id):selected.add(p.id);render();return}
    openEditor(p.id);
  });
  const photo=el("div","card-photo"),placeholder=el("div","card-placeholder");
  placeholder.append(el("span","","◇"),el("small","","Foto pendiente"));
  photo.append(placeholder);
  const img=document.createElement("img");img.loading="lazy";img.alt="Foto de "+p.name;
  img.addEventListener("error",()=>img.remove(),{once:true});
  img.src=photoURL(p);photo.append(img);
  const status=tagLabel(p);
  const badge=el("span","card-tag"+(status==="Borrador"?" hidden":status==="Reservado"?" reserved":status==="Vendido"?" sold":""),status);
  photo.append(badge);
  const data=el("div","card-data");
  data.append(el("span","card-type",[p.category,p.type].filter(Boolean).join(" · ").toLocaleUpperCase("es")));
  data.append(el("h3","card-title",p.name));
  data.append(el("span","card-sub",[p.brand,p.size?"Talle "+p.size:null].filter(Boolean).join(" · ")));
  const bottom=el("div","card-bottom");
  bottom.append(el("strong","card-price",money(p.price)),el("span","card-arrow","↗"));
  data.append(bottom);main.append(photo,data);node.append(main);
  const selector=el("label","item-selector");
  selector.setAttribute("aria-label","Seleccionar "+p.name);
  const check=document.createElement("input");check.type="checkbox";check.checked=selected.has(p.id);
  check.addEventListener("change",()=>{
    if(check.checked)selected.add(p.id);else selected.delete(p.id);render();
  });
  selector.append(check);node.append(selector);
  return node;
}
function render(){
  const rows=filtered();
  $("#count").textContent=rows.length+" de "+products.length+" artículos";
  $("#items").replaceChildren(...rows.map(card));
  $("#empty").hidden=rows.length>0;
  $("#bulk").hidden=!selectionMode;
  $("#bulkCount").textContent=selected.size+" "+(selected.size===1?"seleccionado":"seleccionados");
  $("#selectionToggle").setAttribute("aria-pressed",String(selectionMode));
  $("#selectionToggle").textContent=selectionMode?"Finalizar selección":"Seleccionar varios";
  for(const btn of document.querySelectorAll("[data-bulk]"))btn.disabled=readOnly||busy||!selected.size;
}
function applyFilter(value){
  searchFilter=value;
  document.querySelectorAll("[data-filter]").forEach(b=>{const active=b.dataset.filter===value;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active))});
  render();
}
function revoke(){
  if(localURL)URL.revokeObjectURL(localURL);
  localURL=null;localSource=null;photoRotation=0;
  $("#editorRotate").hidden=true;
  $("#editorRotateLabel").hidden=true;
  $("#rotatedPreview").hidden=true;
}
function current(){return products.find(p=>p.id===currentId)||null}
function photoPreview(p){
  const img=$("#preview"),fallback=$("#imageEmpty"),canvas=$("#rotatedPreview");
  img.hidden=true;canvas.hidden=true;fallback.hidden=false;img.removeAttribute("src");
  if(localURL){
    if(localSource?.naturalWidth){
      window.GarageImageTools.draw(canvas,localSource,photoRotation,24);
      canvas.hidden=false;fallback.hidden=true;
    }
    return;
  }
  img.onload=()=>{if(!localURL){img.hidden=false;fallback.hidden=true}};
  img.onerror=()=>{img.hidden=true;fallback.hidden=false};
  if(p)img.src=photoURL(p);
}
function preview(){
  const get=k=>form.elements.namedItem(k)?.value||"";
  $("#previewName").textContent=get("name")||"Sin nombre";
  $("#previewMeta").textContent=[get("category"),get("brand"),get("size")&&"Talle "+get("size")].filter(Boolean).join(" · ");
  $("#previewPrice").textContent=money(get("price")===""?null:get("price"));
  const availability=get("availability");
  const badge=$("#previewStatus");
  badge.textContent=availability||"Disponible";
  badge.className="status-pill"+(availability==="Vendido"?" sold":availability==="Reservado"?" reserved":"");
  $("#previewVisibility").textContent=form.elements.namedItem("publish").checked?"En tienda":"Borrador oculto";
}
function openEditor(id){
  if(busy||readOnly)return;
  if(dialog.open){if(!requestCloseEditor())return}
  const p=products.find(v=>v.id===id);if(!p)return;
  currentId=id;dirty=false;formDirty=false;photoDirty=false;revoke();
  $("#uploadPhoto").hidden=true;$("#photoUploadHelp").hidden=true;$("#photoUploadHelp").textContent="";
  for(const key of keys){
    const input=form.elements.namedItem(key);if(input)input.value=p[key]??"";
  }
  form.elements.namedItem("publish").checked=p.publish!==false;
  $("#photo").value="";
  $("#title").textContent="Editar producto";
  $("#subTitle").textContent="Código "+p.id+" · Revisá y guardá tus cambios.";
  $("#deleteOne").disabled=readOnly;
  report("");photoPreview(p);preview();
  dialog.showModal();
}
function requestCloseEditor(){
  if(busy){report("Esperá a que termine de guardar.");return false}
  if((dirty||$("#photo").files?.length)&&!confirm("Tenés cambios sin guardar. ¿Descartarlos?"))return false;
  dirty=false;formDirty=false;photoDirty=false;revoke();dialog.close();currentId=null;return true;
}
function buildDraft(){
  const original=current();if(!original)throw Error("No hay producto seleccionado");
  const draft={...original};
  for(const key of keys){
    if(key==="id")continue;
    const value=form.elements.namedItem(key).value.trim();
    draft[key]=key==="price"?(value===""?null:Number(value)):key==="order"?(value===""?(original.order||1):Number(value)):value;
  }
  draft.publish=form.elements.namedItem("publish").checked;
  draft.currency="ARS";
  return draft;
}
async function jpegData(file,rotation=0){
  return window.GarageImageTools.toJpegData(file,rotation,"editor");
}
async function photoReady(p){
  try{
    const response=await fetch(photoURL(p)+"?check="+Date.now(),{method:"HEAD",cache:"no-store"});
    return response.ok&&/^image\//i.test(response.headers.get("content-type")||"");
  }catch{return false}
}
async function saveCatalog(next,message){
  if(readOnly||busy)throw Error("El catálogo no está disponible para edición.");
  busy=true;render();$("#save").disabled=true;
  try{
    const result=await api("products",{method:"PUT",body:JSON.stringify({sha,products:next})});
    products=next;sha=result.sha;stats();categories();render();notify(message||"Cambios guardados. La tienda se sincronizará en unos instantes.");
    return true;
  }catch(e){
    if(e.message.includes("cambió")||e.message.includes("409"))notify("El catálogo se actualizó desde otro lugar. Recargá el panel antes de intentar otra vez.",true);
    else notify("No se guardaron los cambios: "+e.message,true);
    report(e.message,true);return false;
  }finally{busy=false;$("#save").disabled=readOnly;render()}
}
/* Subir una imagen NO debe requerir guardar de nuevo toda la ficha.
   El archivo va a GitHub, luego su optimizador genera WebP y Cloudflare
   publica la actualización. Si falla, la foto seleccionada se conserva
   para poder reintentar sin modificar los datos del artículo. */
async function uploadReplacementPhoto(){
  if(busy||readOnly)return false;
  const p=current(),file=$("#photo").files?.[0];
  if(!p||!file){
    report("Primero elegí una imagen para reemplazar la fotografía.",true);return false;
  }
  if(!/^image\//.test(file.type)&&!/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)){
    report("Formato no admitido. Elegí JPG, PNG o WebP.",true);return false;
  }
  if(file.size>25*1024*1024){
    report("La foto es muy grande. Elegí una de menos de 25 MB.",true);return false;
  }
  const uploadButton=$("#uploadPhoto"),help=$("#photoUploadHelp");
  busy=true;uploadButton.disabled=true;$("#save").disabled=true;$("#photo").disabled=true;
  help.hidden=false;help.classList.remove("error");help.textContent="Preparando la imagen para subirla…";
  report("Preparando la fotografía…");
  try{
    const image=await jpegData(file,photoRotation);
    help.textContent="Subiendo la fotografía a GitHub…";
    report("Enviando la fotografía…");
    await api("image",{method:"PUT",body:JSON.stringify({id:p.id,data:image})});
    $("#photo").value="";
    photoDirty=false;dirty=formDirty;
    uploadButton.hidden=true;
    help.textContent="✓ Foto recibida por GitHub. Se está optimizando y Cloudflare la publicará en unos minutos. La vista previa muestra la nueva imagen seleccionada.";
    report("✓ Fotografía enviada correctamente. La publicación puede tardar unos minutos.");
    notify("Fotografía de "+p.name+" subida correctamente. Se está procesando; no hace falta repetir la carga.");
    return true;
  }catch(e){
    help.classList.add("error");
    help.textContent="No se pudo subir: "+e.message+". La foto sigue seleccionada; podés intentar de nuevo.";
    report("No se pudo cargar la foto: "+e.message+". Probá otra vez o utilizá un JPG.",true);
    return false;
  }finally{
    busy=false;uploadButton.disabled=false;$("#save").disabled=readOnly;$("#photo").disabled=false;
  }
}
async function submitEdit(event){
  event.preventDefault();
  if(busy||readOnly)return;
  const p=current();if(!p)return;
  const edited=buildDraft();
  if(!edited.name||!edited.category||!Number.isFinite(edited.order)||edited.order<1){
    report("Completá nombre, categoría y orden válido.",true);return;
  }
  const file=$("#photo").files?.[0]||null;
  if(edited.publish&&p.publish===false&&(file||!(await photoReady(p)))){
    report("Primero subí la fotografía y esperá a que esté disponible. Después podrás publicar la ficha.",true);
    form.elements.namedItem("publish").checked=false;preview();return;
  }
  if(file&&!await uploadReplacementPhoto())return;
  if(formDirty){
    const next=products.map(x=>x.id===p.id?edited:x);
    report("Guardando cambios de la ficha…");
    const ok=await saveCatalog(next,"Datos guardados. Cloudflare actualizará la tienda.");
    if(!ok)return;
  }else if(!file){
    report("No hay cambios pendientes.");return;
  }
  dirty=false;formDirty=false;photoDirty=false;
  if(file)notify("Fotografía enviada correctamente. La nueva foto se verá cuando terminen la optimización y el despliegue.");
  revoke();dialog.close();currentId=null;render();
}
async function bulk(action){
  if(!selected.size||busy||readOnly)return;
  const ids=new Set(selected);
  if(action==="delete"&&!confirm("¿Eliminar "+ids.size+" productos del catálogo? Sus fotos se conservarán en GitHub."))return;
  if(action==="show"){
    const targets=products.filter(p=>ids.has(p.id)&&p.publish===false);
    const missing=await Promise.all(targets.map(async p=>({name:p.name,ready:await photoReady(p)})));
    if(missing.some(p=>!p.ready)){notify("Hay fotografías pendientes. No se publicaron: "+missing.filter(p=>!p.ready).map(p=>p.name).join(", "),true);return}
  }
  const next=action==="delete"?products.filter(p=>!ids.has(p.id)):
    products.map(p=>!ids.has(p.id)?p:{
      ...p,...(action==="show"?{publish:true}:action==="hide"?{publish:false}:{availability:action})
    });
  const message=action==="delete"?"Productos eliminados.":action==="hide"?"Productos ocultos.":action==="show"?"Productos publicados.":"Estado actualizado.";
  if(await saveCatalog(next,message+" La tienda se sincronizará en unos instantes.")){
    selected.clear();selectionMode=false;render();
  }
}
async function removeCurrent(){
  const p=current();if(!p||busy||readOnly)return;
  if(!confirm("¿Eliminar "+p.name+" ("+p.id+") del catálogo? La foto seguirá en GitHub."))return;
  const next=products.filter(x=>x.id!==p.id);
  if(await saveCatalog(next,"Producto eliminado. Su foto quedó como respaldo en GitHub.")){dirty=false;revoke();dialog.close();currentId=null}
}
async function reload(silent=false){
  try{
    const data=await api("products");
    if(!Array.isArray(data.products))throw Error("Respuesta inesperada");
    products=data.products;sha=data.sha||"";readOnly=!!data.readOnly;
    stats();categories();render();
    $("#new").disabled=readOnly;
    if(readOnly)notify("El inventario está en modo lectura. Revisá la configuración de acceso.",true);
  }catch(e){if(!silent)notify("No se pudo cargar el inventario: "+e.message,true)}
}
function showAdd(){
  if(readOnly||busy)return;
  if(!frame.src)frame.src=frame.dataset.src;
  addDialog.showModal();
}
function closeAdd(){
  try{
    const win=frame.contentWindow;
    if(win?.hasUnsavedProductDrafts?.()&&!confirm("Tenés fichas sin guardar en la carga. ¿Salir y descartarlas?"))return;
  }catch{}
  addDialog.close();
  // Recargar la lista también cuando el usuario cerró sin recibir el mensaje de publicación.
  reload(true);
}
form.addEventListener("input",e=>{if(e.target.id==="photo")return;dirty=true;formDirty=true;preview()});
form.addEventListener("change",e=>{if(e.target.id==="photo")return;dirty=true;formDirty=true;preview()});
form.addEventListener("submit",submitEdit);
$("#photo").addEventListener("change",e=>{
  revoke();
  const file=e.target.files?.[0];
  if(file){
    localURL=URL.createObjectURL(file);
    const image=new Image();localSource=image;
    image.onload=()=>{
      if(localSource===image){
        photoPreview(current());
        report("Foto lista para revisar. Podés girarla antes de guardar.");
      }
    };
    image.onerror=()=>{
      if(localSource===image)report("No se pudo abrir esta imagen. Probá con JPG o PNG.",true);
    };
    image.src=localURL;
    $("#editorRotate").hidden=false;
    $("#editorRotateLabel").hidden=false;
    $("#editorRotateLabel").textContent="Orientación original";
    dirty=true;photoDirty=true;
    $("#uploadPhoto").hidden=false;
    $("#photoUploadHelp").hidden=false;
    $("#photoUploadHelp").classList.remove("error");
    $("#photoUploadHelp").textContent="Imagen lista para revisar. Girala si lo necesitás y tocá «Subir esta foto».";
    report("Preparando vista previa de la foto…");
  }else {
    photoDirty=false;dirty=formDirty;
    $("#uploadPhoto").hidden=true;$("#photoUploadHelp").hidden=true;
    photoPreview(current());
  }
});
$("#uploadPhoto").addEventListener("click",uploadReplacementPhoto);
function rotateEditorPhoto(delta){
  if(!localURL||busy)return;
  photoRotation=window.GarageImageTools.angle(photoRotation+delta);
  photoPreview(current());
  $("#editorRotateLabel").textContent=photoRotation?"Rotación: "+photoRotation+"°. Se guardará en esa posición.":"Orientación original";
  dirty=true;photoDirty=true;
}
$("#editorRotateLeft").addEventListener("click",()=>rotateEditorPhoto(-90));
$("#editorRotateRight").addEventListener("click",()=>rotateEditorPhoto(90));
$("#closeEditor").addEventListener("click",requestCloseEditor);
$("#cancelEditor").addEventListener("click",requestCloseEditor);
dialog.addEventListener("cancel",e=>{e.preventDefault();requestCloseEditor()});
dialog.addEventListener("click",e=>{if(e.target===dialog)requestCloseEditor()});
$("#deleteOne").addEventListener("click",removeCurrent);
$("#search").addEventListener("input",render);
$("#categoryFilter").addEventListener("change",e=>{categoryFilter=e.target.value;render()});
document.querySelectorAll("[data-filter]").forEach(btn=>btn.addEventListener("click",()=>applyFilter(btn.dataset.filter)));
$("#selectionToggle").addEventListener("click",()=>{
  selectionMode=!selectionMode;selected.clear();render();
});
$("#clearSelection").addEventListener("click",()=>{selectionMode=false;selected.clear();render()});
$("#selectAll").addEventListener("click",()=>{for(const p of filtered())selected.add(p.id);render()});
document.querySelectorAll("[data-bulk]").forEach(btn=>btn.addEventListener("click",()=>bulk(btn.dataset.bulk)));
$("#resetFilters").addEventListener("click",()=>{
  $("#search").value="";$("#categoryFilter").value="Todas";categoryFilter="Todas";applyFilter("Todos");
});
$("#new").addEventListener("click",showAdd);
$("#closeAdd").addEventListener("click",closeAdd);
addDialog.addEventListener("cancel",e=>{e.preventDefault();closeAdd()});
window.addEventListener("message",e=>{
  if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.type!=="garage-sale:batch-saved")return;
  reload(true);
  const count=Number(e.data.count)||0;
  notify(count+" "+(count===1?"producto guardado":"productos guardados")+" como borrador. Podés revisarlos aquí al cerrar la carga.");
});
window.addEventListener("beforeunload",e=>{if(dialog.open&&dirty){e.preventDefault();e.returnValue=""}});
reload();
