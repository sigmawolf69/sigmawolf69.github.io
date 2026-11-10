import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const apiUrl =
  "https://api.github.com/repos/brave/adblock-lists/contents/brave-lists?ref=master";
const extraLists = [
  {
    name: "easylist.txt",
    url: "https://easylist.to/easylist/easylist.txt",
  },
];
const outputPath = path.resolve("src/generated/brave-site-blocklist.json");
const essentialAllowedHosts = new Set([
  "googletagmanager.com",
  "google-analytics.com",
  "tagmanager.google.com",
  "cloudflare.com",
  "cloudflare.net",
  "cloudflareinsights.com",
  "nhplayer.com",
]);
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "sigmawolf69-site-blocklist-builder",
  "X-GitHub-Api-Version": "2022-11-28",
};

const uniqueSorted = (values) => [...new Set(values)].sort();
const isEssentialHost = (host) => {
  for (const allowed of essentialAllowedHosts) {
    if (host === allowed || host.endsWith(`.${allowed}`)) return true;
  }
  return false;
};

function cleanHost(value) {
  const host = value.trim().toLowerCase().replace(/^\*\./, "");
  return /^[a-z0-9.-]+$/.test(host) && host.includes(".") ? host : null;
}

function parseNetworkRule(rawLine) {
  let line = rawLine.trim();
  if (!line || line.startsWith("!") || line.startsWith("[") || line.startsWith("#")) {
    return null;
  }

  const allow = line.startsWith("@@");
  if (allow) line = line.slice(2);

  // Element hiding, scriptlets, redirects and modifier-only rules require a
  // full browser ad-blocking engine and cannot be enforced by site JavaScript.
  if (/##|#@#|#\?#|#\$#|#%#/.test(line)) return null;
  const [pattern, modifiers = ""] = line.split("$", 2);
  if (/\b(?:redirect|redirect-rule|csp|removeparam|replace|permissions|header)=/i.test(modifiers)) {
    return null;
  }

  const hostMatch = pattern.match(/^\|\|([a-z0-9.-]+)\^(?:\*|$)/i);
  if (hostMatch) {
    const host = cleanHost(hostMatch[1]);
    return host ? { allow, kind: "host", value: host } : null;
  }

  const urlMatch = pattern.match(/^\|?(https?:\/\/[^*^|\s]+)(?:[|^*]|$)/i);
  if (urlMatch) return { allow, kind: "prefix", value: urlMatch[1].toLowerCase() };

  return null;
}

async function getJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function getText(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

const directory = await getJson(apiUrl);
const listFiles = directory.filter(
  (entry) => entry.type === "file" && entry.name.endsWith(".txt") && entry.download_url,
);
const sources = [
  ...listFiles.map((file) => ({ name: `brave-lists/${file.name}`, url: file.download_url })),
  ...extraLists,
];

const blockedHosts = [];
const blockedUrlPrefixes = [];
const allowedHosts = [];
const allowedUrlPrefixes = [];
let totalLines = 0;
let supportedRules = 0;

for (const file of sources) {
  const text = await getText(file.url);
  const lines = text.split(/\r?\n/);
  totalLines += lines.length;
  for (const line of lines) {
    const rule = parseNetworkRule(line);
    if (!rule) continue;
    supportedRules += 1;
    const target = rule.allow
      ? rule.kind === "host"
        ? allowedHosts
        : allowedUrlPrefixes
      : rule.kind === "host"
        ? blockedHosts
        : blockedUrlPrefixes;
    target.push(rule.value);
  }
}

const generated = {
  sources: [
    {
      url: "https://github.com/brave/adblock-lists/tree/master/brave-lists",
      license: "MPL-2.0",
    },
    {
      url: "https://easylist.to/easylist/easylist.txt",
      license: "GPL-3.0-or-later / CC-BY-SA-3.0",
    },
  ],
  generatedAt: new Date().toISOString(),
  files: sources.map((file) => file.name).sort(),
  stats: {
    files: sources.length,
    totalLines,
    supportedRules,
  },
  blockedHosts: uniqueSorted(blockedHosts).filter((host) => !isEssentialHost(host)),
  blockedUrlPrefixes: uniqueSorted(blockedUrlPrefixes).filter((prefix) => {
    try {
      return !isEssentialHost(new URL(prefix).hostname.toLowerCase());
    } catch {
      return true;
    }
  }),
  allowedHosts: uniqueSorted([...allowedHosts, ...essentialAllowedHosts]),
  allowedUrlPrefixes: uniqueSorted(allowedUrlPrefixes),
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(generated, null, 2)}\n`, "utf8");
console.log(
  `Generated ${outputPath} from ${generated.stats.files} lists (${generated.stats.supportedRules} supported network rules).`,
);
