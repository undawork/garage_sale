const REPO = "undawork/garage_sale";
const PATH = "public/data/products.json";
const json = (value, status = 200) => new Response(JSON.stringify(value), {status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const decode = text => Uint8Array.from(atob(text.replace(/-/g,"+").replace(/_/g,"/")), c=>c.charCodeAt(0));
const encode = text => btoa(String.fromCharCode(...new TextEncoder().encode(text)));
async function authorized(request, env) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return false;
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    const claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
    const domain = env.ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//,"").replace(/\/$/,"");
    if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/i.test(domain)) return false;
    const issuer = "https://" + domain;
    if (header.alg !== "RS256" || typeof header.kid !== "string" || claims.iss !== issuer ||
        !Array.isArray(claims.aud) || !claims.aud.includes(env.ACCESS_AUD) ||
        typeof claims.exp !== "number" || claims.exp <= Date.now()/1000 ||
        typeof claims.nbf === "number" && claims.nbf > Date.now()/1000) return false;
    const keysResponse = await fetch(issuer+"/cdn-cgi/access/certs", {cf:{cacheTtl:300,cacheEverything:true}});
    if (!keysResponse.ok) return false;
    const keys = await keysResponse.json();
    const jwk = keys.keys?.find(k=>k.kid===header.kid && k.kty==="RSA");
    if (!jwk) return false;
    const key = await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    return crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decode(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
  } catch { return false; }
}
async function github(env, path, method="GET", body=null) {
  const res = await fetch("https://api.github.com/repos/"+REPO+"/contents/"+path, {
    method, headers:{"authorization":"Bearer "+env.GITHUB_TOKEN,"accept":"application/vnd.github+json","x-github-api-version":"2022-11-28","user-agent":"garage-sale-admin","content-type":"application/json"},
    ...(body ? {body:JSON.stringify(body)} : {})
  });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw Object.assign(new Error(res.status===409?"El archivo cambió. Recargá antes de guardar.":"GitHub devolvió "+res.status),{status:res.status});
  return data;
}
const allowed = new Set(["id","name","category","type","brand","size","color","condition","price","currency","availability","publish","image","description","order"]);
function validate(products) {
  if (!Array.isArray(products) || products.length > 500) throw Error("Catálogo inválido");
  const ids=new Set();
  return products.map((p,i)=>{
    if (!p || typeof p!=="object" || Array.isArray(p)) throw Error("Producto inválido");
    const clean=Object.fromEntries(Object.entries(p).filter(([k])=>allowed.has(k)));
    if (!/^VG-\d{3,5}$/.test(clean.id||"") || ids.has(clean.id)) throw Error("ID inválido o repetido en fila "+(i+1));
    ids.add(clean.id);
    if (typeof clean.name!=="string" || !clean.name.trim() || clean.name.length>160 || !clean.category || typeof clean.category!=="string") throw Error("Nombre o categoría inválidos");
    for(const k of ["name","category","type","brand","size","color","condition","currency","availability","image","description"])
      if (clean[k]!=null && (typeof clean[k]!=="string" || clean[k].length>2000)) throw Error("Texto inválido: "+k);
    if(clean.price!==null && clean.price!==undefined && (!Number.isFinite(clean.price)||clean.price<0)) throw Error("Precio inválido");
    if(typeof clean.publish!=="boolean") throw Error("Publicación inválida");
    if(clean.image && !/^\/products\/VG-\d{3,5}\.webp$/.test(clean.image)) throw Error("Ruta de foto inválida");
    clean.order=Number.isInteger(clean.order)?clean.order:i+1;
    return clean;
  });
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    const admin=url.pathname==="/admin" || url.pathname.startsWith("/admin/");
    const api=url.pathname.startsWith("/api/admin/");
    if (!admin && !api) return env.ASSETS.fetch(request);
    if (!await authorized(request,env)) return admin ? new Response("Acceso denegado. Configurá Cloudflare Access y sus secretos.",{status:403}) : json({error:"Acceso denegado"},403);
    if(admin) {
      const path=url.pathname==="/admin" ? "/admin/" : url.pathname;
      const response=await env.ASSETS.fetch(new Request(new URL(path,url),request));
      const headers=new Headers(response.headers);
      headers.set("cache-control","no-store"); headers.set("x-frame-options","SAMEORIGIN"); headers.set("x-content-type-options","nosniff");
      headers.set("content-security-policy","default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'self'");
      return new Response(response.body,{status:response.status,headers});
    }
    if(request.method!=="GET" && (request.headers.get("origin")!==url.origin || !request.headers.get("content-type")?.startsWith("application/json"))) return json({error:"Solicitud no permitida"},403);
    try {
      if (url.pathname==="/api/admin/products" && request.method==="GET") {
        if (!env.GITHUB_TOKEN) {
          const res = await env.ASSETS.fetch(new Request(new URL("/data/products.json", url.origin)));
          if (!res.ok) return json({error:"No se pudo leer el catálogo"},502);
          return json({products:await res.json(),sha:null,readOnly:true});
        }
        const file=await github(env,PATH);
        const data=JSON.parse(new TextDecoder().decode(decode(file.content.replace(/\s/g,""))));
        return json({products:data,sha:file.sha,readOnly:false});
      }
      if (url.pathname==="/api/admin/products" && request.method==="PUT") {
        if (!env.GITHUB_TOKEN) return json({error:"La edición requiere configurar GITHUB_TOKEN en Cloudflare."},503);
        const payload=await request.json();
        if(typeof payload.sha!=="string" || !/^[a-f0-9]{40}$/.test(payload.sha)) return json({error:"Versión requerida"},400);
        const products=validate(payload.products);
        const saved=await github(env,PATH,"PUT",{message:"admin: actualizar catálogo",content:encode(JSON.stringify(products,null,2)+"\n"),sha:payload.sha,branch:"main"});
        return json({sha:saved.content.sha});
      }
      if (url.pathname==="/api/admin/image" && request.method==="PUT") {
        if (!env.GITHUB_TOKEN) return json({error:"La carga de fotos requiere configurar GITHUB_TOKEN en Cloudflare."},503);
        const input=await request.json();
        if(!/^VG-\d{3,5}$/.test(input.id||"") || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(input.data||"") || input.data.length>2800000) return json({error:"Foto inválida (JPEG hasta 2 MB)"},400);
        const path="source-images/"+input.id+".jpg";
        let sha;
        try {sha=(await github(env,path)).sha;} catch(e){if(e.status!==404) throw e;}
        await github(env,path,"PUT",{message:"admin: foto "+input.id,content:input.data.split(",")[1],...(sha?{sha}:{}),branch:"main"});
        return json({ok:true,notice:"Foto enviada. GitHub Actions la optimiza para publicación."});
      }
      return json({error:"Ruta no encontrada"},404);
    } catch(e){return json({error:e.message||"Error interno"},e.status===409?409:400);}
  }
};