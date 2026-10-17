"use strict";
if(new URL(location.href).searchParams.get("integrado")==="1")document.body.classList.add("embedded");

/* Una imagen equivale a un producto. La separación de objetos en una sola foto
   y el borrado inteligente de fondo requieren un servicio de IA adicional. */
const MAX_PHOTOS=8, MAX_SIZE=15*1024*1024, ROOT="/api/admin/";
const drafts=[];
let publishing=false, catalogLoaded=false, publicationWatch=0;
const $=selector=>document.querySelector(selector);
const input=$("#batchInput"),zone=$("#dropZone"),cards=$("#drafts");
const action=$("#publish"),progress=$("#progress"),result=$("#success");
const txt=(tag,className,value)=>{
  const node=document.createElement(tag); if(className)node.className=className;
  if(value!==undefined)node.textContent=String(value);return node;
};
const idNum=id=>Number(String(id||"").replace(/^VG-/,""))||0;
function status(message,error=false){
  progress.textContent=message;progress.style.color=error?"#aa4238":"";
}
function setReady(){
  const count=drafts.length;
  $("#draftCount").textContent=count+" / "+MAX_PHOTOS;
  $("#summary").textContent=count===0?"Todavía no hay productos":
    count+" "+(count===1?"producto listo para revisar":"productos para revisar");
  action.disabled=!count||publishing||!catalogLoaded;
  action.textContent=publishing?"Procesando lote…":
    count===1?"Guardar borrador ↗":"Guardar "+count+" borradores ↗";
  input.disabled=publishing;
  cards.querySelectorAll("input,select,textarea,button").forEach(el=>el.disabled=publishing);
}
function readableFilename(filename){
  const base=filename.replace(/\.[^.]+$/,"").replace(/[_-]+/g," ").trim();
  if(/^(IMG|DSC|PXL|DCIM|photo|image|whatsapp|screenshot|captura|foto)\b/i.test(base)||/^\d[\d\s]*$/.test(base))return "";
  return base.replace(/\b[a-záéíóúüñ]/g,letter=>letter.toUpperCase()).slice(0,160);
}
function addFiles(files){
  if(publishing)return;
  publicationWatch++;
  result.hidden=true;
  const images=Array.from(files||[]);
  let accepted=0,skipped=0;
  for(const file of images){
    if(drafts.length>=MAX_PHOTOS){skipped++;continue}
    if((!file.type.startsWith("image/")&&!/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))||file.size>MAX_SIZE||!file.size){skipped++;continue}
    if(drafts.some(d=>d.file.name===file.name&&d.file.size===file.size&&d.file.lastModified===file.lastModified)){skipped++;continue}
    const draft={file,url:URL.createObjectURL(file),name:readableFilename(file.name),
      category:"",type:"",brand:"",size:"",condition:"",price:"",description:"",
      visible:false,assignedId:null,uploaded:false,rotation:0,source:null,note:"",error:false};
    drafts.push(draft);accepted++;
    cards.append(renderCard(draft));
  }
  if(drafts.length)cards.querySelector(".empty-drafts")?.remove();
  setReady();
  status(accepted?accepted+" "+(accepted===1?"foto agregada":"fotos agregadas")+". Revisá nombre y categoría antes de publicar.":
    "No se agregaron fotos. Comprobá el formato, tamaño o límite del lote.",!accepted);
  if(skipped)status(accepted+" agregadas; "+skipped+" omitidas (repetidas, grandes o supera 8).",!accepted);
  input.value="";
}
function option(label,value=label){const el=document.createElement("option");el.value=value;el.textContent=label;return el}
function field(draft,label,key,opts={}){
  const wrapper=txt("label",opts.wide?"wide":"");
  wrapper.append(txt("span","",label));
  let control;
  if(opts.options){
    control=document.createElement("select");
    control.append(option("Seleccionar categoría",""),...opts.options.map(x=>option(x)));
  }else if(opts.textarea){
    control=document.createElement("textarea");control.rows=2;
  }else{
    control=document.createElement("input");control.type=opts.number?"number":"text";
    if(opts.number){control.min="0";control.step="1"}
    else control.maxLength=opts.maxLength||160;
    if(opts.placeholder)control.placeholder=opts.placeholder;
  }
  control.value=draft[key]||"";
  control.name=key;
  control.addEventListener("input",()=>{draft[key]=control.value;if(draft.error){draft.error=false;draft.note="";updateNote(draft)}});
  wrapper.append(control);return wrapper;
}
function updateNote(draft){
  if(!draft.node)return;
  const node=draft.node.querySelector(".draft-state");
  node.textContent=draft.note||"Listo para revisar";
  node.classList.toggle("error",Boolean(draft.error));
  draft.node.classList.toggle("failed",Boolean(draft.error));
}
function renderCard(draft){
  const card=txt("article","draft");draft.node=card;
  const photoColumn=txt("div","photo-column");
  const thumb=txt("div","draft-thumb"),photo=document.createElement("canvas");
  photo.width=240;photo.height=300;
  photo.setAttribute("role","img");
  photo.setAttribute("aria-label","Vista previa de "+draft.file.name+" con la orientación seleccionada");
  thumb.append(photo);
  const rotateControls=txt("div","rotate-controls");
  const left=txt("button","rotate-button","↶ Izquierda");
  const right=txt("button","rotate-button","Derecha ↷");
  left.type="button";right.type="button";
  left.setAttribute("aria-label","Girar "+draft.file.name+" 90 grados a la izquierda");
  right.setAttribute("aria-label","Girar "+draft.file.name+" 90 grados a la derecha");
  function repaint(){
    if(draft.source?.naturalWidth)window.GarageImageTools.draw(photo,draft.source,draft.rotation,14);
  }
  function rotate(amount){
    if(publishing)return;
    draft.rotation=window.GarageImageTools.angle(draft.rotation+amount);
    draft.uploaded=false; // In a retry, the changed orientation must be uploaded again.
    repaint();
    draft.note=draft.rotation?"Giro aplicado: "+draft.rotation+"°. Se guardará así.":"Orientación original restaurada.";
    draft.error=false;updateNote(draft);
  }
  left.addEventListener("click",()=>rotate(-90));
  right.addEventListener("click",()=>rotate(90));
  rotateControls.append(left,right);
  photoColumn.append(thumb,rotateControls);
  const previewSource=new Image();draft.source=previewSource;
  previewSource.onload=repaint;
  previewSource.onerror=()=>{
    draft.error=true;draft.note="No se pudo mostrar esta foto. Probá JPG o PNG.";updateNote(draft);
  };
  previewSource.src=draft.url;
  const body=txt("div","draft-body");
  const top=txt("div","draft-top"),position=txt("span","draft-index","PRODUCTO "+(drafts.length));
  const code=txt("span","draft-id","Código asignado al publicar");
  top.append(position,code);
  const remove=txt("button","remove","Quitar ×");remove.type="button";remove.setAttribute("aria-label","Quitar "+draft.file.name);
  remove.addEventListener("click",()=>{
    if(publishing)return;
    URL.revokeObjectURL(draft.url);
    drafts.splice(drafts.indexOf(draft),1);card.remove();
    drafts.forEach((d,i)=>d.node.querySelector(".draft-index").textContent="PRODUCTO "+(i+1));
    if(!drafts.length){
      const empty=txt("div","empty-drafts");empty.append(txt("span","","◇"),txt("strong","","Tus productos aparecerán acá"),txt("p","","Elegí una o varias fotos para comenzar."));
      cards.append(empty);
    }
    result.hidden=true;setReady();status(drafts.length?"Revisá las fichas antes de publicar.":"Primero seleccioná las fotografías.");
  });
  const grid=txt("div","draft-fields");
  grid.append(
    field(draft,"Nombre *","name",{wide:true,placeholder:"Ej.: Sweater gris de lana"}),
    field(draft,"Categoría *","category",{options:["Ropa","Libros","Accesorios","Otros"]}),
    field(draft,"Precio (ARS)","price",{number:true,placeholder:"Consultar"}),
    field(draft,"Tipo","type",{placeholder:"Ej.: Sweater"}),
    field(draft,"Marca","brand",{placeholder:"Opcional"}),
    field(draft,"Talle","size",{placeholder:"Opcional"}),
    field(draft,"Estado / condición","condition",{placeholder:"Ej.: Excelente"}),
    field(draft,"Descripción","description",{wide:true,textarea:true})
  );
  const visible=txt("p","draft-footer","Se guardará como borrador privado. Podés publicarlo desde el inventario cuando la foto esté lista.");
  body.append(top,grid,visible);
  const note=txt("p","draft-state","Listo para revisar");
  body.append(note);card.append(photoColumn,body,remove);
  return card;
}
async function request(path,opts={}){
  const res=await fetch(ROOT+path,{...opts,credentials:"same-origin",headers:{"content-type":"application/json",...(opts.headers||{})}});
  const body=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(body.error||"Error "+res.status);
  return body;
}
function verifyDrafts(){
  for(const d of drafts){
    d.error=false;d.note="";
    d.name=String(d.name||"").trim();
    if(!d.name||d.name.length>160){d.error=true;d.note="Completá un nombre de hasta 160 caracteres.";updateNote(d);return false}
    if(!d.category){d.error=true;d.note="Seleccioná una categoría.";updateNote(d);return false}
    if(d.price!==""&&(!Number.isFinite(Number(d.price))||Number(d.price)<0)){d.error=true;d.note="Ingresá un precio válido o dejalo vacío.";updateNote(d);return false}
    if(d.description.length>2000){d.error=true;d.note="La descripción es demasiado extensa.";updateNote(d);return false}
    updateNote(d);
  }
  return true;
}
async function jpegData(file,rotation=0){
  return window.GarageImageTools.toJpegData(file,rotation,"batch");
}

/* El alta de fichas y la publicación de sus fotos son dos procesos distintos:
   GitHub Actions genera los WebP y Cloudflare publica la nueva versión. */
function showReceipt(batch){
  result.replaceChildren();
  const title=txt("strong","receipt-heading","✓ "+batch.length+" "+(batch.length===1?"borrador guardado":"borradores guardados")+" en GitHub");
  const caption=txt("p","receipt-intro","Las fichas están guardadas como borradores ocultos. Las fotos se optimizan; después podés revisar cada artículo y publicarlo desde el inventario.");
  const list=txt("div","receipt-list");
  const statuses=new Map();
  for(const product of batch){
    const row=txt("div","receipt-row");
    const details=txt("div","receipt-product");
    details.append(txt("strong","",product.name),txt("small","",product.id));
    const state=txt("span","receipt-state","Esperando foto…");
    row.append(details,state);list.append(row);
    statuses.set(product.id,state);
  }
  const actions=txt("div","receipt-actions");
  const inventory=txt("a","receipt-link","Abrir inventario ↗");inventory.href="/admin/";
  const shop=txt("a","receipt-link","Ver tienda ↗");shop.href="/";shop.target="_blank";shop.rel="noopener";
  actions.append(inventory,shop);
  result.append(title,caption,list,actions);
  result.hidden=false;
  watchPublication(batch,statuses,caption);
}
async function watchPublication(batch,statuses,caption){
  const watch=++publicationWatch;
  let tries=0;
  const check=async()=>{
    if(watch!==publicationWatch)return;
    tries++;
    let allReady=true;
    try{
      const response=await fetch("/data/products.json?nocache="+Date.now(),{cache:"no-store"});
      if(!response.ok)throw Error("Catálogo aún no actualizado");
      const catalog=await response.json();
      if(!Array.isArray(catalog))throw Error("Catálogo aún no disponible");
      const published=new Set(catalog.map(item=>item.id));
      for(const product of batch){
        const label=statuses.get(product.id);
        if(!published.has(product.id)){
          label.textContent="Guardado · preparando publicación";allReady=false;continue;
        }
        try{
          const file=await fetch("/products/"+encodeURIComponent(product.id)+".webp?nocache="+Date.now(),{method:"HEAD",cache:"no-store"});
          if(file.ok&&/^image\//i.test(file.headers.get("content-type")||"")){
            label.textContent=product.publish?"Foto visible ✓":"Foto lista · producto oculto";
            label.classList.add("ready");
          }else{
            label.textContent="Ficha publicada · procesando foto…";allReady=false;
          }
        }catch{
          label.textContent="Ficha publicada · esperando foto…";allReady=false;
        }
      }
      if(allReady){
        caption.textContent="¡Fotos disponibles! Ahora podés abrir el inventario, revisar las fichas y decidir cuáles publicar.";
        status("¡Listo! Fotos disponibles. Tus nuevos artículos siguen ocultos hasta que los publiques.");
        return;
      }
    }catch{
      allReady=false;
    }
    if(watch!==publicationWatch)return;
    if(tries<45)setTimeout(check,8000);
    else{
      caption.textContent="Los productos se guardaron correctamente, pero la verificación de imágenes tardó más de lo habitual. La publicación sigue en GitHub y Cloudflare: revisá el inventario dentro de unos minutos o actualizá la tienda.";
      status("Productos guardados. La comprobación de las fotos sigue pendiente.");
    }
  };
  check();
}
async function load(){
  try{
    const data=await request("products");
    if(!Array.isArray(data.products)||data.readOnly)throw Error("El inventario está en modo lectura. Revisá GITHUB_TOKEN en Cloudflare.");
    catalogLoaded=true;setReady();
  }catch(e){catalogLoaded=false;status("No se pudo conectar con el inventario: "+e.message,true)}
}
async function publish(){
  if(publishing||!catalogLoaded||!drafts.length)return;
  result.hidden=true;
  if(!verifyDrafts()){status("Hay una ficha incompleta. Revisá los campos destacados.",true);return}
  publishing=true;setReady();
  let uploadCount=0;
  try{
    status("Comprobando códigos y versión del catálogo…");
    const initial=await request("products");
    if(initial.readOnly)throw Error("El inventario está en modo lectura.");
    const current=initial.products||[],existing=new Set(current.map(p=>p.id));
    let last=Math.max(0,...current.map(p=>idNum(p.id)),...drafts.filter(d=>d.assignedId).map(d=>idNum(d.assignedId)));
    for(const d of drafts){
      if(d.assignedId&&existing.has(d.assignedId))throw Error("El código "+d.assignedId+" ya está ocupado. No se guardó el lote.");
      if(!d.assignedId){last++;if(last>99999)throw Error("Se agotaron los códigos disponibles.");d.assignedId="VG-"+String(last).padStart(3,"0")}
      d.node.querySelector(".draft-id").textContent=d.assignedId;
    }
    for(let i=0;i<drafts.length;i++){
      const d=drafts[i];if(d.uploaded)continue;
      d.note="Preparando fotografía…";updateNote(d);
      status("Preparando y subiendo foto "+(i+1)+" de "+drafts.length+"…");
      try{
        const data=await jpegData(d.file,d.rotation);
        await request("image",{method:"PUT",body:JSON.stringify({id:d.assignedId,data})});
        d.uploaded=true;uploadCount++;
        d.note="Foto enviada correctamente ✓";d.error=false;updateNote(d);
      }catch(e){
        d.error=true;d.note=e.message;updateNote(d);
        throw Error("No se pudo subir "+d.file.name+": "+e.message+". Podés reintentar sin repetir las fotos ya subidas.");
      }
    }
    status("Guardando "+drafts.length+" fichas en el catálogo…");
    const latest=await request("products");
    if(latest.readOnly)throw Error("El inventario pasó a modo lectura.");
    const latestIds=new Set(latest.products.map(p=>p.id));
    if(drafts.some(d=>latestIds.has(d.assignedId)))throw Error("Otro producto ocupó uno de los códigos. Revisá el inventario antes de reintentar.");
    const orderStart=Math.max(0,...latest.products.map(p=>Number(p.order)||0));
    const batch=drafts.map((d,i)=>({
      id:d.assignedId,name:d.name,category:d.category,type:d.type.trim(),
      brand:d.brand.trim(),size:d.size.trim(),color:"",condition:d.condition.trim(),
      price:d.price===""?null:Number(d.price),currency:"ARS",availability:"Disponible",
      publish:false,image:"/products/"+d.assignedId+".webp",
      description:d.description.trim(),order:orderStart+i+1
    }));
    await request("products",{method:"PUT",body:JSON.stringify({sha:latest.sha,products:[...latest.products,...batch]})});
    const savedBatch=batch.map(p=>({id:p.id,name:p.name,publish:p.publish}));
    drafts.forEach(d=>URL.revokeObjectURL(d.url));
    drafts.length=0;cards.replaceChildren();
    const empty=txt("div","empty-drafts");
    empty.append(txt("span","","✓"),txt("strong","","Borradores guardados"),txt("p","","Podés cargar otra tanda cuando quieras."));
    cards.append(empty);setReady();
    showReceipt(savedBatch);
    if(window.parent!==window)window.parent.postMessage({type:"garage-sale:batch-saved",count:savedBatch.length},location.origin);
    status("Borradores guardados. Se procesarán las fotos antes de que decidas publicarlos.");
    }catch(e){status(e.message,true)}
  finally{publishing=false;setReady()}
}
input.addEventListener("change",e=>addFiles(e.target.files));
zone.addEventListener("dragover",e=>{e.preventDefault();zone.classList.add("dragover")});
zone.addEventListener("dragleave",()=>zone.classList.remove("dragover"));
zone.addEventListener("drop",e=>{e.preventDefault();zone.classList.remove("dragover");addFiles(e.dataTransfer.files)});
action.addEventListener("click",publish);
window.addEventListener("beforeunload",e=>{if(drafts.length){e.preventDefault();e.returnValue=""}});
load();

window.hasUnsavedProductDrafts=()=>drafts.length>0;
