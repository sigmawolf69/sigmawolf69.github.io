from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import queue
import threading
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import boto3
from botocore.exceptions import ClientError
from PIL import Image, ImageOps

SUPPORTED = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg"}
HERE = Path(__file__).resolve().parent


def load_env(path: Path = HERE / ".env") -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def settings() -> dict[str, str]:
    load_env()
    required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"]
    missing = [key for key in required if not os.getenv(key)]
    if missing:
        raise RuntimeError(f"Missing values in .env: {', '.join(missing)}")
    return {
        "account": os.environ["R2_ACCOUNT_ID"],
        "access": os.environ["R2_ACCESS_KEY_ID"],
        "secret": os.environ["R2_SECRET_ACCESS_KEY"],
        "bucket": os.environ["R2_BUCKET"],
        "public": os.environ["R2_PUBLIC_BASE_URL"].rstrip("/"),
        "prefix": os.getenv("R2_IMAGE_PREFIX", "images").strip("/"),
        "manifest": os.getenv("R2_MANIFEST_KEY", "manifest.json").strip("/"),
    }


def client(config: dict[str, str]):
    return boto3.client(
        "s3",
        endpoint_url=f"https://{config['account']}.r2.cloudflarestorage.com",
        aws_access_key_id=config["access"],
        aws_secret_access_key=config["secret"],
        region_name="auto",
    )


def digest(path: Path) -> str:
    checksum = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            checksum.update(block)
    return checksum.hexdigest()


def title_for(path: Path) -> str:
    return path.stem.replace("-", " ").replace("_", " ").title()


def optimize_image(source: Path, destination: Path, report=print) -> Path:
    """Create a web-ready WebP without modifying the user's original image."""
    if source.suffix.lower() in {".svg", ".gif"}:
        report(f"Kept original format: {source.name}")
        return source
    max_dimension = max(640, int(os.getenv("IMAGE_MAX_DIMENSION", "2400")))
    min_bytes = max(0, int(os.getenv("IMAGE_TARGET_MIN_KB", "500")) * 1024)
    max_bytes = max(min_bytes + 1, int(os.getenv("IMAGE_TARGET_MAX_KB", "1000")) * 1024)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened)
        image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")
        quality = 98
        while True:
            image.save(destination, "WEBP", quality=quality, method=6, optimize=True)
            size = destination.stat().st_size
            if size <= max_bytes or quality <= 46:
                break
            quality -= 6
        while destination.stat().st_size > max_bytes and max(image.size) > 900:
            image.thumbnail((int(image.width * .86), int(image.height * .86)), Image.Resampling.LANCZOS)
            image.save(destination, "WEBP", quality=max(44, quality), method=6, optimize=True)
        final_size = destination.stat().st_size
        original_size = source.stat().st_size
        note = " (already efficient; not inflated)" if final_size < min_bytes else ""
        report(f"Optimized: {source.name} — {original_size / 1048576:.2f} MB → {final_size / 1048576:.2f} MB{note}")
    return destination


def sync_folder(folder: Path, report=print) -> dict:
    config = settings()
    r2 = client(config)
    files = sorted(path for path in folder.rglob("*") if path.is_file() and path.suffix.lower() in SUPPORTED)
    if not files:
        raise RuntimeError("No supported images were found in the selected folder.")
    images, uploaded, skipped = [], 0, 0
    with tempfile.TemporaryDirectory(prefix="r2-image-sync-") as temporary:
        temporary_root = Path(temporary)
        for index, path in enumerate(files, 1):
            original_relative = path.relative_to(folder)
            convert = path.suffix.lower() not in {".svg", ".gif"}
            upload_relative = original_relative.with_suffix(".webp") if convert else original_relative
            processed = optimize_image(path, temporary_root / upload_relative, report)
            relative = upload_relative.as_posix()
            sha256 = digest(processed)
            versioned_name = f"{upload_relative.stem}-{sha256[:12]}{upload_relative.suffix.lower()}"
            versioned_relative = upload_relative.with_name(versioned_name).as_posix()
            key = f"{config['prefix']}/{versioned_relative}"
            unchanged = False
            try:
                remote = r2.head_object(Bucket=config["bucket"], Key=key)
                unchanged = remote.get("Metadata", {}).get("sha256") == sha256
            except ClientError as error:
                status = error.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
                if status not in (403, 404):
                    raise
            if unchanged:
                skipped += 1
                report(f"[{index}/{len(files)}] Unchanged: {relative}")
            else:
                content_type = mimetypes.guess_type(processed.name)[0] or "application/octet-stream"
                r2.upload_file(
                    str(processed), config["bucket"], key,
                    ExtraArgs={"ContentType": content_type, "CacheControl": "public, max-age=31536000, immutable", "Metadata": {"sha256": sha256}},
                )
                uploaded += 1
                report(f"[{index}/{len(files)}] Uploaded: {relative}")
            images.append({
                "id": sha256[:16],
                "slug": quote(original_relative.as_posix().rsplit(".", 1)[0], safe=""),
                "title": title_for(path),
                "url": f"{config['public']}/{quote(key, safe='/')}",
                "width": None,
                "height": None,
            })
    manifest = {"version": 1, "updatedAt": datetime.now(timezone.utc).isoformat(), "total": len(images), "images": images}
    r2.put_object(
        Bucket=config["bucket"], Key=config["manifest"],
        Body=json.dumps(manifest, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
        ContentType="application/json; charset=utf-8", CacheControl="public, max-age=60, must-revalidate",
    )
    manifest_url = f"{config['public']}/{config['manifest']}"
    report(f"Done — uploaded {uploaded}, skipped {skipped}, total {len(images)}")
    report(f"Manifest: {manifest_url}")
    return manifest


def run_gui() -> None:
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk

    root = tk.Tk()
    root.title("Cloudflare R2 Image Sync")
    root.geometry("680x440")
    root.minsize(560, 360)
    selected = tk.StringVar(value=str((HERE / "images").resolve()))
    events: queue.Queue[tuple[str, str]] = queue.Queue()

    frame = ttk.Frame(root, padding=18)
    frame.pack(fill="both", expand=True)
    ttk.Label(frame, text="Local image folder", font=("Segoe UI", 12, "bold")).pack(anchor="w")
    row = ttk.Frame(frame)
    row.pack(fill="x", pady=(8, 12))
    ttk.Entry(row, textvariable=selected).pack(side="left", fill="x", expand=True)
    ttk.Button(row, text="Browse…", command=lambda: selected.set(filedialog.askdirectory(initialdir=selected.get()) or selected.get())).pack(side="left", padx=(8, 0))
    output = tk.Text(frame, height=15, state="disabled", font=("Consolas", 9), wrap="word")
    output.pack(fill="both", expand=True)
    sync_button = ttk.Button(frame, text="Sync images to Cloudflare R2")
    sync_button.pack(anchor="e", pady=(12, 0))

    def log(message: str) -> None:
        output.configure(state="normal")
        output.insert("end", message + "\n")
        output.see("end")
        output.configure(state="disabled")

    def worker() -> None:
        try:
            sync_folder(Path(selected.get()), lambda value: events.put(("log", value)))
            events.put(("done", "Upload and manifest update completed."))
        except Exception as error:
            events.put(("error", str(error)))

    def start() -> None:
        folder = Path(selected.get())
        if not folder.is_dir():
            messagebox.showerror("Folder not found", "Choose a valid image folder.")
            return
        sync_button.configure(state="disabled")
        log("Starting secure R2 sync…")
        threading.Thread(target=worker, daemon=True).start()

    def poll() -> None:
        try:
            while True:
                kind, message = events.get_nowait()
                if kind == "log":
                    log(message)
                else:
                    sync_button.configure(state="normal")
                    (messagebox.showinfo if kind == "done" else messagebox.showerror)("R2 Image Sync", message)
        except queue.Empty:
            pass
        root.after(100, poll)

    sync_button.configure(command=start)
    poll()
    root.mainloop()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sync a local image folder to Cloudflare R2.")
    parser.add_argument("folder", nargs="?", type=Path, help="Folder to sync; omit to open the graphical uploader.")
    args = parser.parse_args()
    if args.folder:
        sync_folder(args.folder.resolve())
    else:
        run_gui()
