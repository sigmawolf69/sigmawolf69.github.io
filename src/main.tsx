import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'
import { Check, ChevronsUpDown, Menu as MenuIcon, Moon, Sun, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'

const savedTheme=localStorage.getItem('theme')
const initialDark=savedTheme?savedTheme==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches
document.documentElement.classList.toggle('dark',initialDark)

type Video = { id:string; slug:string; title:string; titleId?:string; titleSlug?:string; ep:number|null; views:number; likes:number; censored:boolean; brand:string; quality:string; year:number; language:string; duration:string; tags:string[]; cover:string; thumb:string; backdrop:string; embedUrl:string; description:string; grad:string[]; releasedAt:string }
type Route = { path:string; params:URLSearchParams }
type Catalog = { total:number; pages:number; videos:Video[] }

const catalogUrl=new URL('../videos.json',import.meta.url).href
const DB_NAME='titties-catalog',STORE_NAME='catalog',DB_VERSION=1
const withTimeout=<T,>(promise:Promise<T>,ms:number,message:string)=>new Promise<T>((resolve,reject)=>{const timer=window.setTimeout(()=>reject(new Error(message)),ms);promise.then(value=>{window.clearTimeout(timer);resolve(value)},error=>{window.clearTimeout(timer);reject(error)})})
function openCatalogDb(){return new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(DB_NAME,DB_VERSION);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE_NAME))request.result.createObjectStore(STORE_NAME)};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Catalog storage is blocked'))})}
function readCachedCatalog(db:IDBDatabase){return new Promise<Catalog|undefined>((resolve,reject)=>{const request=db.transaction(STORE_NAME).objectStore(STORE_NAME).get(catalogUrl);request.onsuccess=()=>resolve(request.result as Catalog|undefined);request.onerror=()=>reject(request.error)})}
function storeCatalog(db:IDBDatabase,value:Catalog){return new Promise<void>((resolve,reject)=>{const transaction=db.transaction(STORE_NAME,'readwrite');const store=transaction.objectStore(STORE_NAME);store.clear();store.put(value,catalogUrl);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error)})}
async function loadCatalog():Promise<Catalog>{
  let db:IDBDatabase|undefined
  try{db=await withTimeout(openCatalogDb(),1500,'Catalog storage timed out');const cached=await withTimeout(readCachedCatalog(db),2500,'Cached catalog read timed out');if(cached)return cached}catch{/* Storage can be unavailable or blocked; HTTP cache remains available. */}
  const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),30000)
  const response=await fetch(catalogUrl,{cache:'force-cache',signal:controller.signal}).finally(()=>window.clearTimeout(timer));if(!response.ok)throw new Error(`Catalog request failed (${response.status})`)
  const value=await response.json() as Catalog
  if(db)storeCatalog(db,value).catch(()=>undefined)
  return value
}

let catalog:Catalog
try{catalog=await loadCatalog()}catch(reason){const message=reason instanceof Error?reason.message:'Unknown catalog error';const mount=document.getElementById('root');if(mount)mount.innerHTML=`<main style="min-height:100vh;display:grid;place-items:center;align-content:center;gap:12px;padding:24px;background:#090909;color:#eee;font:14px system-ui;text-align:center"><h1 style="margin:0">The video library could not load</h1><p style="color:#aaa">${message.replace(/[<>&]/g,'')}</p><button style="padding:10px 16px;border:1px solid #444;border-radius:8px;background:#222;color:#fff;cursor:pointer" onclick="location.reload()">Try again</button></main>`;throw reason}
const videos:Video[] = Array.isArray(catalog.videos) ? catalog.videos : []
const MEDIA_ORIGIN=(import.meta.env.VITE_MEDIA_ORIGIN||'https://animeidhentai.com').replace(/\/$/,'')
const mediaUrl=(value?:string)=>{if(!value)return'';if(/^(?:https?:|data:|blob:)/i.test(value))return value;return new URL(value.startsWith('/')?value:`/${value}`,`${MEDIA_ORIGIN}/`).href}
const videoSearchText=new Map(videos.map(v=>[v.id,[v.title,v.brand,v.language,...(v.tags||[])].join(' ').toLowerCase()]))
const allTags=[...new Set(videos.flatMap(v=>v.tags||[]))].sort()
const allBrands=[...new Set(videos.map(v=>v.brand).filter(Boolean))].sort()
const tagCounts=new Map<string,number>(),brandCounts=new Map<string,number>()
videos.forEach(v=>{brandCounts.set(v.brand,(brandCounts.get(v.brand)||0)+1);v.tags?.forEach(tag=>tagCounts.set(tag,(tagCounts.get(tag)||0)+1))})
const compact=(n=0)=>new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n)
const art=(v:Video):React.CSSProperties=>{const[a='#302014',b='#090909']=v.grad||[];return{backgroundColor:a,backgroundImage:`linear-gradient(135deg,${a}12,${b}18),url("${mediaUrl(v.cover||v.thumb)}")`}}
const normalizedSeriesTitle=(value:string)=>value.toLowerCase().replace(/\b(?:episode|ep|part|chapter|season|ova)\s*\d+\b/gi,'').replace(/[\s._-]+\d+\s*$/,'').replace(/[^a-z0-9]+/g,' ').trim()

function useRoute(){
  const read=():Route=>{const current=new URL(window.location.href);const fallback=current.searchParams.get('__route');if(fallback){history.replaceState({},'',fallback);return{path:window.location.pathname.replace(/\/+$/,'')||'/',params:new URLSearchParams(window.location.search)}}return{path:current.pathname.replace(/\/+$/,'')||'/',params:current.searchParams}}
  const[route,setRoute]=useState(read)
  useEffect(()=>{const update=()=>setRoute(read());window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update)},[])
  return[route,(href:string)=>{history.pushState({},'',href);setRoute(read());window.scrollTo({top:0})}] as const
}

function Link({href,navigate,className,style,children}:{href:string;navigate:(href:string)=>void;className?:string;style?:React.CSSProperties;children:React.ReactNode}){
  return <a href={href} className={className} style={style} onClick={e=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();navigate(href)}}}>{children}</a>
}

function ThemeToggle(){
  const[dark,setDark]=useState(()=>document.documentElement.classList.contains('dark'))
  const toggle=()=>{const next=!dark;setDark(next);document.documentElement.classList.toggle('dark',next);localStorage.setItem('theme',next?'dark':'light')}
  return <Button type="button" variant="ghost" size="icon" className="theme-toggle" onClick={toggle} aria-label={`Switch to ${dark?'light':'dark'} theme`}>{dark?<Sun/>:<Moon/>}</Button>
}

function LiveSearch({initial,onSearch,compact=false}:{initial:string;onSearch:(value:string)=>void;compact?:boolean}){
  const[value,setValue]=useState(initial);const callback=useRef(onSearch);const timerRef=useRef<number|undefined>(undefined);callback.current=onSearch
  useEffect(()=>setValue(initial),[initial])
  useEffect(()=>{if(value===initial)return;timerRef.current=window.setTimeout(()=>callback.current(value.trim()),300);return()=>window.clearTimeout(timerRef.current)},[value,initial])
  const submit=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();window.clearTimeout(timerRef.current);callback.current(value.trim())}
  const clear=()=>{window.clearTimeout(timerRef.current);setValue('');callback.current('')}
  return <form className={compact?'search':'page-search'} onSubmit={submit}>{compact&&<span>⌕</span>}<span className="search-input-wrap"><Input name="q" value={value} onChange={e=>setValue(e.target.value)} placeholder={compact?'Search videos…':'Search by title, tag, or brand'}/>{compact&&value&&<Button type="button" variant="ghost" size="icon-sm" className="clear-search" onClick={clear} aria-label="Clear search"><X/></Button>}</span>{!compact&&<><Button type="submit">Search</Button><Button type="button" variant="outline" onClick={clear}><X/> Clear</Button></>}</form>
}

function FilterCombobox({label,items,value,counts,onChange}:{label:string;items:string[];value:string;counts:Map<string,number>;onChange:(value:string)=>void}){
  const[open,setOpen]=useState(false)
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="outline" role="combobox" aria-expanded={open} className="filter-combobox"><span>{value||`All ${label.toLowerCase()}`}</span><ChevronsUpDown/></Button></PopoverTrigger><PopoverContent className="filter-popover" align="start"><Command><CommandInput placeholder={`Find ${label.toLowerCase()}…`}/><CommandList><CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty><CommandItem value={`all ${label}`} onSelect={()=>{onChange('');setOpen(false)}}><Check className={!value?'visible':'invisible'}/>All {label.toLowerCase()}<small>{videos.length}</small></CommandItem>{items.map(item=><CommandItem key={item} value={item} onSelect={()=>{onChange(item);setOpen(false)}}><Check className={value===item?'visible':'invisible'}/><span>{item}</span><small>{counts.get(item)||0}</small></CommandItem>)}</CommandList></Command></PopoverContent></Popover>
}

function Header({route,navigate}:{route:Route;navigate:(href:string)=>void}){
  const[open,setOpen]=useState(false);const term=route.path==='/search'?route.params.get('q')||'':''
  const go=(href:string)=>{setOpen(false);navigate(href)}
  const active=(path:string)=>path==='/'?route.path==='/':route.path===path||route.path.startsWith(`${path}/`)
  return <><header className="header"><Link href="/" navigate={go} className="brand"><span className="brand-mark">T</span><span className="brand-copy"><strong>Titties</strong><small>Discover in HD</small></span></Link>
    <nav className={open?'nav open':'nav'}><div className="mobile-nav-title"><span>Explore</span><Button variant="ghost" size="icon-sm" onClick={()=>setOpen(false)} aria-label="Close menu"><X/></Button></div><Link href="/" navigate={go} className={active('/')?'active':''}>Home</Link><Link href="/search" navigate={go} className={active('/search')?'active':''}>Search</Link><Link href="/categories" navigate={go} className={active('/categories')?'active':''}>Categories</Link><Link href="/brands" navigate={go} className={active('/brands')?'active':''}>Brands</Link><Link href="/random" navigate={go} className={active('/random')?'active':''}>Random</Link></nav>
    <LiveSearch compact initial={term} onSearch={q=>go(`/search${q?`?q=${encodeURIComponent(q)}`:''}`)}/><div className="header-actions"><ThemeToggle/><Button variant="ghost" size="icon" className="menu" onClick={()=>setOpen(!open)} aria-label={open?'Close menu':'Open menu'}>{open?<X/>:<MenuIcon/>}</Button></div>
  </header>{open&&<button className="mobile-nav-backdrop" onClick={()=>setOpen(false)} aria-label="Close navigation"/>}</>
}

function VideoCard({video,navigate}:{video:Video;navigate:(href:string)=>void}){return <Card className="video-card video-card-inner"><Link href={`/video/${video.slug}`} navigate={navigate} className="video-card-main"><span className="poster" style={art(video)}><Badge className="quality">{video.quality||'HD'}</Badge><span className="play">▶</span><Badge variant="secondary" className="duration">{video.duration||'--:--'}</Badge></span><span className="card-copy"><strong>{video.title}</strong></span></Link><span className="card-meta"><Link href={`/search?brand=${encodeURIComponent(video.brand)}`} navigate={navigate} className="brand-link">{video.brand}</Link><span>· EP {video.ep??'—'}</span></span></Card>}

function Carousel({title,href,items,navigate}:{title:string;href:string;items:Video[];navigate:(href:string)=>void}){
  const rail=useRef<HTMLDivElement>(null);const move=(dir:number)=>rail.current?.scrollBy({left:dir*rail.current.clientWidth*.8,behavior:'smooth'})
  return <section className="home-section"><div className="carousel-heading"><Link href={href} navigate={navigate}>{title} <span>●</span></Link><div className="section-actions"><Button asChild variant="ghost" size="sm" className="section-link"><Link href={href} navigate={navigate}>View all <span>→</span></Link></Button><span className="carousel-buttons"><Button variant="outline" size="icon" onClick={()=>move(-1)} aria-label={`Previous ${title}`}>‹</Button><Button variant="outline" size="icon" onClick={()=>move(1)} aria-label={`Next ${title}`}>›</Button></span></div></div><div className="carousel-rail" ref={rail}>{items.map(v=><VideoCard key={v.id} video={v} navigate={navigate}/>)}</div></section>
}

function DirectoryCarousel({title,href,items,navigate}:{title:string;href:string;items:{name:string;video:Video;count:number}[];navigate:(href:string)=>void}){
  const rail=useRef<HTMLDivElement>(null);return <section className="home-section"><div className="carousel-heading"><Link href={href} navigate={navigate}>{title} <span>●</span></Link><div className="section-actions"><Button asChild variant="ghost" size="sm" className="section-link"><Link href={href} navigate={navigate}>Explore <span>→</span></Link></Button><span className="carousel-buttons"><Button variant="outline" size="icon" onClick={()=>rail.current?.scrollBy({left:-700,behavior:'smooth'})} aria-label={`Previous ${title}`}>‹</Button><Button variant="outline" size="icon" onClick={()=>rail.current?.scrollBy({left:700,behavior:'smooth'})} aria-label={`Next ${title}`}>›</Button></span></div></div><div className="carousel-rail directory-rail" ref={rail}>{items.map(x=><Link key={x.name} href={`${href}?${href.includes('categor')?'tag':'brand'}=${encodeURIComponent(x.name)}`} navigate={navigate} className="directory-tile" style={art(x.video)}><strong>{x.name}</strong><small>{x.count} releases</small></Link>)}</div></section>
}

function Home({navigate}:{navigate:(href:string)=>void}){
  const latest=useMemo(()=>[...videos].sort((a,b)=>+new Date(b.releasedAt)-+new Date(a.releasedAt)).slice(0,18),[])
  const trending=useMemo(()=>[...videos].sort((a,b)=>b.views-a.views).slice(0,18),[])
  const random=useMemo(()=>[...videos].sort(()=>Math.random()-.5).slice(0,18),[])
  const tags=useMemo(()=>[...allTags].sort(()=>Math.random()-.5).slice(0,18).map(name=>{const matches=videos.filter(v=>v.tags?.includes(name));return{name,count:matches.length,video:matches[Math.floor(Math.random()*matches.length)]}}),[])
  const brands=useMemo(()=>[...allBrands].sort(()=>Math.random()-.5).slice(0,18).map(name=>{const matches=videos.filter(v=>v.brand===name);return{name,count:matches.length,video:matches[Math.floor(Math.random()*matches.length)]}}),[])
  const peak=useMemo(()=>videos.length?videos[Math.floor(Math.random()*videos.length)]:undefined,[]);return <main className="home"><section className="welcome"><p>Welcome back</p><h1>What are we watching today?</h1></section>{peak&&<section className="peak" style={{backgroundImage:`linear-gradient(90deg,#101010 15%,#101010aa),url("${mediaUrl(peak.backdrop||peak.cover)}")`}}><div><span>Peak of the day</span><h2>{peak.title}</h2><Link href={`/search?brand=${encodeURIComponent(peak.brand)}`} navigate={navigate} className="peak-brand">{peak.brand}</Link><div className="video-description">{peak.description||`${peak.title} episode ${peak.ep}, available in ${peak.quality}.`}</div><Link href={`/video/${peak.slug}`} navigate={navigate}>▶ Watch now</Link></div><VideoCard video={peak} navigate={navigate}/></section>}
    <Carousel title="Latest" href="/search?sort=latest" items={latest} navigate={navigate}/><Carousel title="Trending" href="/search?sort=trending" items={trending} navigate={navigate}/><Carousel title="Random" href="/random" items={random} navigate={navigate}/><DirectoryCarousel title="Categories" href="/categories" items={tags} navigate={navigate}/><DirectoryCarousel title="Brands" href="/brands" items={brands} navigate={navigate}/></main>
}

const PAGE_SIZE=24
function SearchPage({route,navigate}:{route:Route;navigate:(href:string)=>void}){
  const q=route.params.get('q')||'',tag=route.params.get('tag')||'',brand=route.params.get('brand')||'',sort=route.params.get('sort')||'latest';const requested=Number(route.params.get('page')||1)
  const deferredQ=useDeferredValue(q)
  const tags=allTags,brands=allBrands
  const results=useMemo(()=>{const needle=deferredQ.toLowerCase();const found=videos.filter(v=>(videoSearchText.get(v.id)||'').includes(needle)&&(!tag||v.tags?.includes(tag))&&(!brand||v.brand===brand));return found.sort((a,b)=>sort==='trending'?b.views-a.views:+new Date(b.releasedAt)-+new Date(a.releasedAt))},[deferredQ,tag,brand,sort])
  const pages=Math.max(1,Math.ceil(results.length/PAGE_SIZE)),page=Math.min(Math.max(requested,1),pages),shown=results.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE)
  const href=(changes:Record<string,string|number>)=>{const p=new URLSearchParams(route.params);Object.entries(changes).forEach(([k,v])=>v?p.set(k,String(v)):p.delete(k));return`/search${p.size?`?${p}`:''}`}
  const visible=[...new Set([1,pages,page-2,page-1,page,page+1,page+2])].filter(n=>n>=1&&n<=pages).sort((a,b)=>a-b)
  const go=(url:string)=>(e:React.MouseEvent<HTMLAnchorElement>)=>{e.preventDefault();navigate(url)}
  return <main className="search-page content"><div className="search-title"><div><h1>Search library</h1><p>{results.length} videos found · Page {page} of {pages}</p></div><LiveSearch initial={q} onSearch={value=>navigate(href({q:value,page:1}))}/></div><div className="search-filters"><div><span>Filter by</span><FilterCombobox label="Categories" items={tags} value={tag} counts={tagCounts} onChange={value=>navigate(href({tag:value,page:1}))}/><FilterCombobox label="Brands" items={brands} value={brand} counts={brandCounts} onChange={value=>navigate(href({brand:value,page:1}))}/></div>{(tag||brand)&&<Button variant="ghost" size="sm" onClick={()=>navigate(href({tag:'',brand:'',page:1}))}><X/> Clear filters</Button>}</div><div className="active-filters">{tag&&<Badge variant="secondary">Category: {tag}<button onClick={()=>navigate(href({tag:'',page:1}))} aria-label="Remove category"><X/></button></Badge>}{brand&&<Badge variant="secondary">Brand: {brand}<button onClick={()=>navigate(href({brand:'',page:1}))} aria-label="Remove brand"><X/></button></Badge>}</div><div className="search-layout"><section><div className="result-tools"><span>{q?`Results for “${q}”`:'All videos'}</span><div><Button asChild variant={sort==='latest'?'default':'outline'} size="sm"><Link href={href({sort:'latest',page:1})} navigate={navigate}>Latest</Link></Button><Button asChild variant={sort==='trending'?'default':'outline'} size="sm"><Link href={href({sort:'trending',page:1})} navigate={navigate}>Trending</Link></Button></div></div>{shown.length?<div className="video-grid">{shown.map(v=><VideoCard key={v.id} video={v} navigate={navigate}/>)}</div>:<Card className="empty"><h3>No videos found</h3><p>Try a different category, brand, or search.</p></Card>}<Pagination className="pagination"><PaginationContent><PaginationItem><PaginationPrevious href={href({page:Math.max(1,page-1)})} onClick={go(href({page:Math.max(1,page-1)}))} aria-disabled={page===1}/></PaginationItem>{visible.map((n,i)=><React.Fragment key={n}>{i>0&&visible[i-1]!==n-1&&<PaginationItem><PaginationEllipsis/></PaginationItem>}<PaginationItem><PaginationLink href={href({page:n})} onClick={go(href({page:n}))} isActive={n===page}>{n}</PaginationLink></PaginationItem></React.Fragment>)}<PaginationItem><PaginationNext href={href({page:Math.min(pages,page+1)})} onClick={go(href({page:Math.min(pages,page+1)}))} aria-disabled={page===pages}/></PaginationItem></PaginationContent></Pagination></section></div></main>
}

function Directory({kind,navigate}:{kind:'categories'|'brands';navigate:(href:string)=>void}){const names=kind==='categories'?allTags:allBrands;return <main className="content directory-page"><div className="search-title"><h1>{kind==='categories'?'Categories':'Brands'}</h1><p>Browse the complete library</p></div><div className="directory-grid">{names.map(name=>{const matches=kind==='categories'?videos.filter(v=>v.tags?.includes(name)):videos.filter(v=>v.brand===name);return <Link key={name} href={`/search?${kind==='categories'?'tag':'brand'}=${encodeURIComponent(name)}`} navigate={navigate} className="directory-tile" style={art(matches[0])}><strong>{name}</strong><small>{matches.length} releases →</small></Link>})}</div></main>}

function Watch({video,navigate}:{video:Video;navigate:(href:string)=>void}){
  const brandHref=`/search?brand=${encodeURIComponent(video.brand)}`
  const related=useMemo(()=>{const key=normalizedSeriesTitle(video.title);return videos.filter(candidate=>candidate.id!==video.id&&((video.titleId&&candidate.titleId===video.titleId)||(video.titleSlug&&candidate.titleSlug===video.titleSlug)||(key.length>2&&normalizedSeriesTitle(candidate.title)===key))).sort((a,b)=>(a.ep??0)-(b.ep??0)).slice(0,18)},[video])
  const latest=useMemo(()=>videos.filter(v=>v.id!==video.id).sort((a,b)=>+new Date(b.releasedAt)-+new Date(a.releasedAt)).slice(0,18),[video.id])
  const random=useMemo(()=>videos.filter(v=>v.id!==video.id).sort(()=>Math.random()-.5).slice(0,15),[video.id])
  const trending=useMemo(()=>videos.filter(v=>v.id!==video.id).sort((a,b)=>b.views-a.views).slice(0,18),[video.id])
  return <main className="watch-page"><div className="player-shell"><iframe src={video.embedUrl} title={video.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="no-referrer"/></div><section className="watch-info"><div className="watch-copy"><span className="eyebrow">Now playing</span><h1>{video.title} <small>EP {video.ep}</small></h1><p>{compact(video.views)} views · <Link href={brandHref} navigate={navigate} className="inline-brand">{video.brand}</Link></p><div className="video-description">{video.description||'No description is available for this video.'}</div></div><div className="badges"><Button asChild variant="secondary" size="sm"><Link href={brandHref} navigate={navigate} className="video-brand-link">Brand: {video.brand}</Link></Button>{(video.tags||[]).map(tag=><Button asChild key={tag} variant="outline" size="sm"><Link href={`/search?tag=${encodeURIComponent(tag)}`} navigate={navigate}>{tag}</Link></Button>)}</div></section><div className="watch-carousels">{related.length>0&&<Carousel title="More from this series" href={`/search?q=${encodeURIComponent(normalizedSeriesTitle(video.title))}`} items={related} navigate={navigate}/>} {latest.length>0&&<Carousel title="Latest" href="/search?sort=latest" items={latest} navigate={navigate}/>} {random.length>0&&<Carousel title="Random" href="/random" items={random} navigate={navigate}/>} {trending.length>0&&<Carousel title="Trending" href="/search?sort=trending" items={trending} navigate={navigate}/>}</div></main>
}

class ErrorBoundary extends React.Component<React.PropsWithChildren,{error:Error|null}>{state={error:null as Error|null};static getDerivedStateFromError(error:Error){return{error}}render(){return this.state.error?<main className="fatal"><h1>The library could not load</h1><p>{this.state.error.message}</p><button onClick={()=>location.reload()}>Reload</button></main>:this.props.children}}

function App(){const[route,navigate]=useRoute();let page:React.ReactNode;if(route.path==='/')page=<Home navigate={navigate}/>;else if(route.path==='/search')page=<SearchPage route={route} navigate={navigate}/>;else if(route.path==='/categories')page=<Directory kind="categories" navigate={navigate}/>;else if(route.path==='/brands')page=<Directory kind="brands" navigate={navigate}/>;else if(route.path==='/random')page=videos.length?<Watch video={videos[Math.floor(Math.random()*videos.length)]} navigate={navigate}/>:null;else if(route.path.startsWith('/video/')){const slug=decodeURIComponent(route.path.slice(7));const video=videos.find(v=>v.slug===slug||v.id===slug);page=video?<Watch video={video} navigate={navigate}/>:<div className="empty"><h1>Video not found</h1></div>}else page=<div className="empty"><h1>Page not found</h1><Link href="/" navigate={navigate}>Return home</Link></div>;return <div className="app"><Header route={route} navigate={navigate}/>{page}<footer><Link href="/" navigate={navigate} className="brand"><span className="brand-mark">T</span><span>Titties</span></Link><p>Watch your favorites in HD.</p><span>© {new Date().getFullYear()}</span></footer></div>}
const root=document.getElementById('root');if(!root)throw new Error('Root element was not found');createRoot(root).render(<ErrorBoundary><App/></ErrorBoundary>)
