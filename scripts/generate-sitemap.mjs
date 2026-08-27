import { readFile, writeFile } from 'node:fs/promises'

const origin='https://hentaititties.com'
const catalog=JSON.parse(await readFile(new URL('../videos.json',import.meta.url),'utf8'))
const videos=Array.isArray(catalog.videos)?catalog.videos:[]
const escapeXml=value=>String(value).replace(/[<>&'\"]/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[char]))
const fixed=[['/','daily','1.0'],['/search','daily','0.9'],['/categories','weekly','0.8'],['/brands','weekly','0.8'],['/blurshield','monthly','0.8']]
const urls=fixed.map(([path,frequency,priority])=>`  <url><loc>${origin}${path}</loc><changefreq>${frequency}</changefreq><priority>${priority}</priority></url>`)
for(const video of videos){
  if(!video.slug)continue
  const modified=video.releasedAt?`<lastmod>${new Date(video.releasedAt).toISOString().slice(0,10)}</lastmod>`:''
  urls.push(`  <url><loc>${origin}/video/${escapeXml(encodeURIComponent(video.slug))}</loc>${modified}<changefreq>monthly</changefreq><priority>0.7</priority></url>`)
}
await writeFile(new URL('../public/sitemap.xml',import.meta.url),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`)
console.log(`Generated sitemap with ${urls.length} URLs.`)
