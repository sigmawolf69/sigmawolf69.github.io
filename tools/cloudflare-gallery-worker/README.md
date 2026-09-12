# Four-hour random gallery Worker

This Worker exposes up to 20 random images or videos. The chosen set is saved in R2 for four hours, so cache misses around the world still read the same selection. A scheduled trigger replaces it every four hours.

## Deploy

1. Edit `wrangler.jsonc`.
2. Replace `replace-with-your-bucket-name` with the bucket used by the Python uploader.
3. Replace `PUBLIC_BASE_URL` with the bucket's public custom domain.
4. Replace `ALLOWED_ORIGIN` with your website origin for stricter CORS, or leave `*` for public reading.
5. Run `npm install` in this folder.
6. Run `npx wrangler login` and approve Cloudflare access.
7. Run `npm run deploy`.
8. Copy the deployed URL, normally `https://random-gallery-api.<subdomain>.workers.dev/images`.
9. In GitHub repository **Settings → Secrets and variables → Actions → Variables**, set `VITE_GALLERY_MANIFEST_URL` to that `/images` URL.
10. Trigger the website deployment once. Later Python uploads become eligible for the next four-hour selection automatically.

Direct R2 credentials are never stored in this Worker project. The Worker accesses the bucket through its R2 binding.
