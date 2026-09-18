# Free-plan daily video catalog Worker

This Cron Worker downloads every page from `https://animeid.com/api/browse` and atomically replaces `videos.json` in R2. Because the Workers Free plan permits only 50 external subrequests per invocation, it fetches at most 40 pages every ten minutes and saves progress in R2.

For a 160-page source, a refresh finishes in roughly 40–50 minutes. The existing `videos.json` remains available throughout the refresh. When publication succeeds, entries removed upstream disappear and new or changed entries replace the old catalog. The next refresh begins after the published catalog is at least 24 hours old.

## Deploy

1. Confirm the R2 bucket name in `wrangler.jsonc` (`himages` by default).
2. Run `npm install` in this folder.
3. Run `npx wrangler login` if needed.
4. Run `npm run deploy`.
5. To enable manual refreshes, set a private token with `npx wrangler secret put REFRESH_TOKEN`. Without this secret, the public manual-refresh endpoint stays disabled and Cron still works normally.

The first Cron invocation starts automatically within ten minutes. To start immediately:

```powershell
curl.exe -X POST -H "Authorization: Bearer YOUR_TOKEN" https://daily-video-catalog.YOUR-SUBDOMAIN.workers.dev/refresh
```

Each manual call processes one stage. Cron continues the remaining stages automatically. Check `/status`; the finished catalog is served from `/videos.json` with CORS enabled.

## Connect the website

In GitHub repository **Settings → Secrets and variables → Actions → Variables**, create:

```text
VITE_VIDEOS_URL=https://daily-video-catalog.YOUR-SUBDOMAIN.workers.dev/videos.json
```

Run the website deployment once. Future refreshes happen in Cloudflare without another GitHub build.
