import { readFile, writeFile } from "node:fs/promises";

const origin = "https://hentaititties.com";
const contentUrl = new URL("../src/site-content.json", import.meta.url);
const siteContent = JSON.parse(await readFile(contentUrl, "utf8"));
const catalogUrl = (
  process.env.VITE_VIDEOS_URL || siteContent.links.videosJson
).trim();

async function loadVideos() {
  try {
    const response = await fetch(catalogUrl, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const catalog = await response.json();
    return Array.isArray(catalog) ? catalog : catalog.videos || [];
  } catch (error) {
    console.warn(
      `Could not load the video catalog from ${catalogUrl}; generating a sitemap with the fixed pages only.`,
    );
    console.warn(error instanceof Error ? error.message : error);
    return [];
  }
}

const videos = await loadVideos();
const escapeXml = (value) =>
  String(value).replace(
    /[<>&'\"]/g,
    (char) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[char],
  );
const fixed = [
  ["/", "daily", "1.0"],
  ["/search", "daily", "0.9"],
  ["/categories", "weekly", "0.8"],
  ["/brands", "weekly", "0.8"],
  ["/blurshield", "monthly", "0.8"],
];
const urls = fixed.map(
  ([path, frequency, priority]) =>
    `  <url><loc>${origin}${path}</loc><changefreq>${frequency}</changefreq><priority>${priority}</priority></url>`,
);
for (const video of videos) {
  if (!video.slug) continue;
  const modified = video.releasedAt
    ? `<lastmod>${new Date(video.releasedAt).toISOString().slice(0, 10)}</lastmod>`
    : "";
  urls.push(
    `  <url><loc>${origin}/video/${escapeXml(encodeURIComponent(video.slug))}</loc>${modified}<changefreq>monthly</changefreq><priority>0.7</priority></url>`,
  );
}
await writeFile(
  new URL("../public/sitemap.xml", import.meta.url),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
);
console.log(`Generated sitemap with ${urls.length} URLs.`);
