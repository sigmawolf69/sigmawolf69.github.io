# Cloudflare R2 media uploader

This local tool securely synchronizes a folder of images and videos to R2 and then publishes `gallery/manifest.json`. Credentials remain on your computer. Static images are compressed for the web; videos are uploaded directly without compression or conversion.

## Setup

1. In Cloudflare, open **Storage & databases → R2** and create a Standard bucket.
2. In the bucket settings, connect a production custom domain, such as `images.example.com`. The `r2.dev` address is suitable only for development.
3. In the bucket's **CORS Policy**, allow `GET` from your website and local Vite development origins. Replace the domains below with yours:

```json
[
  {
    "AllowedOrigins": ["https://example.com", "http://localhost:5173"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

4. Under **R2 → Manage API Tokens**, create a token with **Object Read & Write**, restricted to this bucket. Copy the Access Key ID, Secret Access Key, and Account ID.
5. Copy `.env.example` to `.env` and fill in all values. Never commit `.env`.
6. From this folder, run `python -m pip install -r requirements.txt`.
7. Double-click `start-uploader.bat`, choose your local media folder, then click **Sync media to Cloudflare R2**.
8. Copy the project-root `.env.example` to `.env` and replace its URL with the manifest URL printed by the uploader, for example `https://images.example.com/gallery/manifest.json`.
9. Build and deploy the React website once. Future media syncs do not require another website build.

After the website has been deployed once with that variable, future uploader syncs appear automatically. The manifest is published last and cached for only 60 seconds.

Supported files: PNG, JPG, JPEG, GIF, WebP, AVIF, SVG, MP4, WebM, MOV, M4V, and OGV.

Static PNG, JPG, JPEG, WebP, and AVIF images are resized when necessary and compressed to WebP. SVG and GIF files keep their original formats. Videos retain their original format and contents. Every uploaded filename includes a short content hash, ensuring updated media receives a fresh CDN URL immediately.
