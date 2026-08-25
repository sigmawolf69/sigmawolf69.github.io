import json
from pathlib import Path

SRC = Path("animeidhentai_all_videos copy.json")
IMAGE_BASE = "https://animeidhentai.com"

data = json.loads(SRC.read_text(encoding="utf-8"))
videos_in = data.get("videos") or []

TAG_PHOTO = {
    "ahegao": "https://static-assets-44d.pages.dev/images/tags/ahegao-vertical.min.jpg",
    "big breasts": "https://static-assets-44d.pages.dev/images/tags/big_boobs-vertical.min.jpg",
    "big tits": "https://static-assets-44d.pages.dev/images/tags/big_boobs-vertical.min.jpg",
    "blowjob": "https://static-assets-44d.pages.dev/images/tags/blow_job-vertical.min.jpg",
    "creampie": "https://static-assets-44d.pages.dev/images/tags/creampie-vertical.min.jpg",
    "hd": "https://static-assets-44d.pages.dev/images/tags/hd-vertical.min.jpg",
    "hentai": "https://static-assets-44d.pages.dev/images/tags/hd-vertical.min.jpg",
    "nudity": "https://static-assets-44d.pages.dev/images/tags/uncensored-vertical.min.jpg",
    "paizuri": "https://static-assets-44d.pages.dev/images/tags/boob_job-vertical.min.jpg",
    "teasing": "https://static-assets-44d.pages.dev/images/tags/vanilla-vertical.min.jpg",
    "erotic game": "https://static-assets-44d.pages.dev/images/tags/plot-vertical.min.jpg",
}


def abs_url(path):
    if not path:
        return ""
    if path.startswith("http"):
        return path
    return IMAGE_BASE.rstrip("/") + path


mapped = []
tag_set = {}
brand_set = {}

for index, v in enumerate(videos_in):
    slug = v.get("slug") or str(v.get("id") or index)
    ep = v.get("ep")
    title = v.get("title") or slug
    name = f"{title} Episode {ep}" if ep not in (None, "") else title
    cover = abs_url(v.get("cover") or v.get("featureImage") or v.get("thumb"))
    poster = abs_url(v.get("backdrop") or v.get("thumb") or v.get("cover"))
    brand = v.get("brand") or "Unknown"
    tags = list(v.get("tags") or [])
    item = {
        "id": slug,
        "idLink": f"video.html?id={slug}",
        "name": name,
        "link": slug,
        "titleSlug": v.get("titleSlug") or slug,
        "description": v.get("description") or "",
        "poster_url": poster,
        "cover_url": cover,
        "brand": brand,
        "is_censored": bool(v.get("censored")),
        "tags": tags,
        "releasedDate": v.get("releasedAt") or "",
        "createdDate": v.get("releasedAt") or "",
        "embedUrl": v.get("embedUrl") or "",
        "duration": v.get("duration") or "",
        "quality": v.get("quality") or "",
        "language": v.get("language") or "",
        "views": v.get("views") or 0,
    }
    mapped.append(item)
    if brand not in brand_set:
        brand_set[brand] = cover
    for tag in tags:
        tag_set.setdefault(tag, cover)

tags_out = []
for name, fallback in sorted(tag_set.items(), key=lambda x: x[0].lower()):
    photo = TAG_PHOTO.get(name.lower(), fallback)
    tags_out.append({"Name": name, "PhotoLink": photo})

brands_out = [{"Name": name, "PhotoLink": photo} for name, photo in sorted(brand_set.items())]

Path("js/video.js").write_text(
    "var videos = " + json.dumps(mapped, ensure_ascii=False, indent=2) + ";\n",
    encoding="utf-8",
)
Path("js/tags.js").write_text(
    "var tags = " + json.dumps(tags_out, ensure_ascii=False, indent=2) + ";\n",
    encoding="utf-8",
)
Path("js/brands.js").write_text(
    "var brands = " + json.dumps(brands_out, ensure_ascii=False, indent=2) + ";\n",
    encoding="utf-8",
)
print(f"Wrote {len(mapped)} videos, {len(tags_out)} tags, {len(brands_out)} brands")
