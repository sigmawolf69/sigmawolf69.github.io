interface Env {
  GALLERY_BUCKET:R2Bucket
  PUBLIC_BASE_URL:string
  IMAGE_PREFIX:string
  SELECTION_KEY:string
  ALLOWED_ORIGIN:string
}

type GalleryImage={id:string;slug:string;title:string;url:string}
type Selection={version:number;updatedAt:string;expiresAt:string;total:number;images:GalleryImage[]}
const FOUR_HOURS=4*60*60*1000
const imagePattern=/\.(?:png|jpe?g|gif|webp|avif|svg)$/i
const encodePath=(value:string)=>value.split('/').map(encodeURIComponent).join('/')
const title=(key:string)=>{const file=key.split('/').pop()||key;return file.replace(/-[a-f0-9]{12}(?=\.[^.]+$)/i,'').replace(/\.[^.]+$/,'').replace(/[-_]+/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase())}
const shuffle=<T,>(items:T[])=>{for(let index=items.length-1;index>0;index--){const target=Math.floor(Math.random()*(index+1));[items[index],items[target]]=[items[target],items[index]]}return items}

function response(selection:Selection,env:Env){const ttl=Math.max(0,Math.min(14400,Math.floor((Date.parse(selection.expiresAt)-Date.now())/1000)));return new Response(JSON.stringify(selection),{headers:{'content-type':'application/json; charset=utf-8','access-control-allow-origin':env.ALLOWED_ORIGIN||'*','cache-control':`public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=300`,'x-gallery-expires':selection.expiresAt}})}

async function readCurrent(env:Env){const stored=await env.GALLERY_BUCKET.get(env.SELECTION_KEY);if(!stored)return null;try{return await stored.json<Selection>()}catch{return null}}

async function createSelection(env:Env):Promise<Selection>{
  const prefix=`${env.IMAGE_PREFIX.replace(/^\/+|\/+$/g,'')}/`;let cursor:string|undefined,objects:R2Object[]=[]
  do{const page=await env.GALLERY_BUCKET.list({prefix,cursor,limit:1000});objects.push(...page.objects.filter(object=>imagePattern.test(object.key)));cursor=page.truncated?page.cursor:undefined}while(cursor)
  const chosen=shuffle(objects).slice(0,10),now=new Date(),expires=new Date(now.getTime()+FOUR_HOURS)
  const images=chosen.map(object=>{const relative=object.key.slice(prefix.length),clean=relative.replace(/-[a-f0-9]{12}(?=\.[^.]+$)/i,'').replace(/\.[^.]+$/,'');return{id:object.etag.replaceAll('"',''),slug:encodeURIComponent(clean),title:title(object.key),url:`${env.PUBLIC_BASE_URL.replace(/\/$/,'')}/${encodePath(object.key)}`}})
  const selection={version:1,updatedAt:now.toISOString(),expiresAt:expires.toISOString(),total:images.length,images}
  await env.GALLERY_BUCKET.put(env.SELECTION_KEY,JSON.stringify(selection),{httpMetadata:{contentType:'application/json',cacheControl:'no-store'}})
  return selection
}

async function getSelection(env:Env,force=false){const current=await readCurrent(env);if(!force&&current&&Date.parse(current.expiresAt)>Date.now())return current;return createSelection(env)}

export default {
  async fetch(request:Request,env:Env,context:ExecutionContext):Promise<Response>{const url=new URL(request.url);if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':env.ALLOWED_ORIGIN||'*','access-control-allow-methods':'GET, OPTIONS','access-control-max-age':'86400'}});if(request.method!=='GET'||(url.pathname!=='/'&&url.pathname!=='/images'))return new Response('Not found',{status:404});const cache=caches.default,cached=await cache.match(request);if(cached)return cached;try{const fresh=response(await getSelection(env),env);context.waitUntil(cache.put(request,fresh.clone()));return fresh}catch(error){return Response.json({error:'Gallery temporarily unavailable',detail:error instanceof Error?error.message:'Unknown error'},{status:500,headers:{'access-control-allow-origin':env.ALLOWED_ORIGIN||'*','cache-control':'no-store'}})}},
  async scheduled(_controller:ScheduledController,env:Env):Promise<void>{await getSelection(env)}
}
