import { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
type Shape = "rectangle" | "ellipse";
type Effect = "blur" | "pixelate" | "solid";
type Region = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: Shape;
  effect: Effect;
  amount: number;
  color: string;
};
type BatchItem = {
  id: number;
  name: string;
  src: string;
  regions: Region[];
  history: Region[][];
  future: Region[][];
  sample?: boolean;
};
const sample =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#25213a"/><stop offset=".48" stop-color="#67509d"/><stop offset="1" stop-color="#f08762"/></linearGradient><radialGradient id="r"><stop stop-color="#ffd8b9"/><stop offset="1" stop-color="#f08762" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="760" fill="url(#g)"/><circle cx="890" cy="190" r="300" fill="url(#r)" opacity=".85"/><path d="M0 610C210 480 315 680 510 540s350-100 690 70v150H0z" fill="#171627" opacity=".75"/><circle cx="320" cy="270" r="128" fill="#ffc6a0"/><path d="M190 274c8-191 271-194 270 16-70-55-198-64-270-16z" fill="#30253d"/><rect x="208" y="380" width="228" height="250" rx="110" fill="#526fb0"/><circle cx="275" cy="270" r="12" fill="#29212d"/><circle cx="367" cy="270" r="12" fill="#29212d"/><path d="M290 327q31 24 62 0" fill="none" stroke="#9e5362" stroke-width="7" stroke-linecap="round"/><text x="680" y="420" fill="white" font-family="Arial" font-size="64" font-weight="700">A private moment</text><text x="684" y="476" fill="#efeafd" font-family="Arial" font-size="25">Choose an area to protect before sharing.</text></svg>`
  );

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null),
    imageRef = useRef<HTMLImageElement | null>(null),
    startRef = useRef<{ x: number; y: number } | null>(null),
    dragDepthRef = useRef(0);
  const [items, setItems] = useState<BatchItem[]>([
      {
        id: 1,
        name: "portrait-sample.jpg",
        src: sample,
        regions: [],
        history: [],
        future: [],
        sample: true,
      },
    ]),
    [currentIndex, setCurrentIndex] = useState(0);
  const current = items[currentIndex],
    imageSrc = current.src,
    imageName = current.name,
    regions = current.regions;
  const history = current.history,
    future = current.future;
  const [exporting, setExporting] = useState(false),
    [notice, setNotice] = useState(""),
    [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [selected, setSelected] = useState<number | null>(null),
    [shape, setShape] = useState<Shape>("rectangle"),
    [effect, setEffect] = useState<Effect>("blur"),
    [amount, setAmount] = useState(28),
    [color, setColor] = useState("#111118"),
    [draft, setDraft] = useState<Region | null>(null);
  const active = regions.find((r) => r.id === selected);
  const checkpoint = (next: Region[]) =>
    setItems((all) =>
      all.map((item, i) =>
        i === currentIndex
          ? {
              ...item,
              regions: next,
              history: [...item.history.slice(-20), item.regions],
              future: [],
            }
          : item
      )
    );
  const draw = useCallback(() => {
    const canvas = canvasRef.current,
      img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    for (const r of [...regions, ...(draft ? [draft] : [])]) {
      ctx.save();
      ctx.beginPath();
      if (r.shape === "ellipse")
        ctx.ellipse(
          r.x + r.w / 2,
          r.y + r.h / 2,
          Math.abs(r.w / 2),
          Math.abs(r.h / 2),
          0,
          0,
          Math.PI * 2
        );
      else ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      if (r.effect === "solid") {
        ctx.fillStyle = r.color;
        ctx.fillRect(r.x, r.y, r.w, r.h);
      } else if (r.effect === "blur") {
        ctx.filter = `blur(${r.amount}px)`;
        const p = r.amount * 2;
        ctx.drawImage(
          img,
          r.x - p,
          r.y - p,
          r.w + p * 2,
          r.h + p * 2,
          r.x - p,
          r.y - p,
          r.w + p * 2,
          r.h + p * 2
        );
      } else {
        const s = Math.max(4, Math.round(r.amount / 2)),
          ow = Math.max(1, Math.ceil(r.w / s)),
          oh = Math.max(1, Math.ceil(r.h / s)),
          off = document.createElement("canvas");
        off.width = ow;
        off.height = oh;
        off.getContext("2d")!.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, ow, oh);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(off, 0, 0, ow, oh, r.x, r.y, r.w, r.h);
        ctx.imageSmoothingEnabled = true;
      }
      ctx.restore();
      if (r.id === selected || r === draft) {
        ctx.save();
        ctx.strokeStyle = "#8b5cf6";
        ctx.lineWidth = 4;
        ctx.setLineDash([12, 8]);
        if (r.shape === "ellipse") {
          ctx.beginPath();
          ctx.ellipse(
            r.x + r.w / 2,
            r.y + r.h / 2,
            Math.abs(r.w / 2),
            Math.abs(r.h / 2),
            0,
            0,
            Math.PI * 2
          );
          ctx.stroke();
        } else ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.restore();
      }
    }
  }, [regions, draft, selected]);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setNotice("");
      draw();
    };
    img.onerror = () =>
      setNotice(
        "This image could not be opened. Try a JPG, PNG, or WebP file."
      );
    img.src = imageSrc;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageSrc, draw]);
  useEffect(draw, [draw]);
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!,
      b = c.getBoundingClientRect();
    return {
      x: ((e.clientX - b.left) * c.width) / b.width,
      y: ((e.clientY - b.top) * c.height) / b.height,
    };
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = point(e);
    startRef.current = p;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraft({
      id: Date.now(),
      x: p.x,
      y: p.y,
      w: 0,
      h: 0,
      shape,
      effect,
      amount,
      color,
    });
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!startRef.current || !draft) return;
    const p = point(e),
      s = startRef.current;
    setDraft({
      ...draft,
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  };
  const onUp = () => {
    if (draft && draft.w > 12 && draft.h > 12) {
      checkpoint([...regions, draft]);
      setSelected(draft.id);
    }
    setDraft(null);
    startRef.current = null;
  };
  const updateActive = (patch: Partial<Region>) => {
    if (selected !== null)
      checkpoint(
        regions.map((r) => (r.id === selected ? { ...r, ...patch } : r))
      );
  };
  const undo = () => {
    if (history.length) {
      setItems((all) =>
        all.map((item, i) =>
          i === currentIndex
            ? {
                ...item,
                regions: item.history.at(-1)!,
                history: item.history.slice(0, -1),
                future: [item.regions, ...item.future],
              }
            : item
        )
      );
      setSelected(null);
    }
  };
  const redo = () => {
    if (future.length) {
      setItems((all) =>
        all.map((item, i) =>
          i === currentIndex
            ? {
                ...item,
                regions: item.future[0],
                history: [...item.history, item.regions],
                future: item.future.slice(1),
              }
            : item
        )
      );
      setSelected(null);
    }
  };
  const remove = () => {
    if (selected !== null) {
      checkpoint(regions.filter((r) => r.id !== selected));
      setSelected(null);
    }
  };
  const upload = (files?: FileList | null) => {
    if (!files?.length) return;
    const valid = Array.from(files).filter((f) =>
      ["image/jpeg", "image/png", "image/webp"].includes(f.type)
    );
    if (!valid.length) {
      setNotice("Choose JPG, PNG, or WebP images.");
      return;
    }
    const added = valid.map((f, i) => ({
      id: Date.now() + i,
      name: f.name,
      src: URL.createObjectURL(f),
      regions: [],
      history: [],
      future: [],
    }));
    setItems((all) =>
      all.length === 1 && all[0].sample ? added : [...all, ...added]
    );
    if (items.length === 1 && items[0].sample) setCurrentIndex(0);
    setSelected(null);
    setNotice(
      valid.length < files.length ? "Some unsupported files were skipped." : ""
    );
  };
  useEffect(() => {
    const containsFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files");
    const handleDragEnter = (event: DragEvent) => {
      if (!containsFiles(event)) return;
      event.preventDefault();
      dragDepthRef.current += 1;
      setIsDraggingFiles(true);
    };
    const handleDragOver = (event: DragEvent) => {
      if (!containsFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const handleDragLeave = (event: DragEvent) => {
      if (!containsFiles(event)) return;
      event.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setIsDraggingFiles(false);
    };
    const handleDrop = (event: DragEvent) => {
      if (!containsFiles(event)) return;
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDraggingFiles(false);
      upload(event.dataTransfer?.files);
    };
    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  });
  const switchImage = (index: number) => {
    setCurrentIndex(index);
    setSelected(null);
    setDraft(null);
  };
  const removeImage = (index: number) => {
    if (items.length === 1) return;
    const removed = items[index];
    if (removed.src.startsWith("blob:")) URL.revokeObjectURL(removed.src);
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    setCurrentIndex(Math.min(index, next.length - 1));
    setSelected(null);
  };
  const download = async () => {
    try {
      triggerDownload(
        await renderProcessed(imageSrc, regions),
        `protected-${safeName(imageName)}.png`
      );
    } catch {
      setNotice("The image could not be exported. Please try again.");
    }
  };
  const downloadAll = async () => {
    setExporting(true);
    try {
      const zip = new JSZip();
      for (const [index, item] of items.entries()) {
        const blob = await renderProcessed(item.src, item.regions);
        zip.file(
          `${String(index + 1).padStart(2, "0")}-protected-${safeName(
            item.name
          )}.png`,
          blob
        );
      }
      triggerDownload(
        await zip.generateAsync({ type: "blob" }),
        "blurshield-protected-images.zip"
      );
    } catch {
      setNotice("The ZIP could not be created. Please try again.");
    } finally {
      setExporting(false);
    }
  };
  return (
    <main className="app-shell">
      {isDraggingFiles && (
        <div className="drop-overlay" role="status" aria-live="polite">
          <div>
            <span aria-hidden="true">＋</span>
            <strong>Drop images anywhere</strong>
            <small>JPG, PNG, or WebP · multiple files supported</small>
          </div>
        </div>
      )}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">B</span>
          <span>
            Blur<span>Shield</span>
          </span>
        </div>
        <div className="privacy">
          <span>●</span> Your images stay on this device
        </div>
        <a
          className="code-link"
          href="https://www.patreon.com/c/abcd"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Download the full website code from Patreon (opens in a new tab)"
        >
          <span aria-hidden="true">↓</span>
          <span className="code-link-label">Buy Full Code</span>
        </a>
      </header>
      <section className="hero">
        <div>
          <p className="eyebrow">PRIVATE BY DESIGN 😊</p>
          <h1>
            Hide what matters.
            <br />
            <span>Share with confidence.</span>
          </h1>
          <p>
            Process multiple photos one by one, then download everything
            together.
          </p>
        </div>
        <label className="upload">
          <span>＋</span>
          <strong>Choose photos</strong>
          <small>JPG, PNG or WebP · multiple allowed</small>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => upload(e.target.files)}
          />
        </label>
      </section>
      {notice && (
        <div className="notice" role="status">
          {notice}
          <button onClick={() => setNotice("")} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
      <section className="batch">
        <div className="batch-head">
          <div>
            <strong>
              {items.length} {items.length === 1 ? "image" : "images"} in this
              batch
            </strong>
            <span>
              Select each photo and add the regions you want to protect.
            </span>
          </div>
          <label>
            ＋ Add more
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => upload(e.target.files)}
            />
          </label>
        </div>
        <div className="batch-strip">
          {items.map((item, i) => (
            <div
              key={item.id}
              className={`batch-card ${i === currentIndex ? "active" : ""}`}
            >
              <button onClick={() => switchImage(i)}>
                <img src={item.src} alt="" />
                <span>
                  <strong>
                    {i + 1}. {item.name}
                  </strong>
                  <small>
                    {item.regions.length
                      ? `✓ ${item.regions.length} protected`
                      : "Not processed yet"}
                  </small>
                </span>
              </button>
              {items.length > 1 && (
                <button
                  className="batch-remove"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => removeImage(i)}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="editor">
        <div className="editor-head">
          <div className="filename">
            <span>▧</span>
            <div>
              <small>NOW EDITING</small>
              <strong>{imageName}</strong>
            </div>
          </div>
          <div className="history">
            <button onClick={undo} disabled={!history.length}>
              ↶ <span>Undo</span>
            </button>
            <button onClick={redo} disabled={!future.length}>
              ↷ <span>Redo</span>
            </button>
            <button
              className="delete"
              onClick={remove}
              disabled={selected === null}
            >
              ⌫ <span>Delete region</span>
            </button>
          </div>
        </div>
        <div className="workspace">
          <div className="stage">
            <canvas
              ref={canvasRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
            />
            <div className="draw-hint">✦ Click and drag to protect an area</div>
          </div>
          <aside className="panel">
            <div className="panel-title">
              <div>
                <small>REGION SETTINGS</small>
                <h2>{active ? "Edit protection" : "New protection"}</h2>
              </div>
              <span className="count">{regions.length}</span>
            </div>
            <Control label="Shape">
              <div className="segmented">
                <button
                  className={
                    (active?.shape ?? shape) === "rectangle" ? "active" : ""
                  }
                  onClick={() =>
                    active
                      ? updateActive({ shape: "rectangle" })
                      : setShape("rectangle")
                  }
                >
                  ▭ Rectangle
                </button>
                <button
                  className={
                    (active?.shape ?? shape) === "ellipse" ? "active" : ""
                  }
                  onClick={() =>
                    active
                      ? updateActive({ shape: "ellipse" })
                      : setShape("ellipse")
                  }
                >
                  ◯ Ellipse
                </button>
              </div>
            </Control>
            <Control label="Protection style">
              <div className="effect-grid">
                {(["blur", "pixelate", "solid"] as Effect[]).map((x) => (
                  <button
                    key={x}
                    className={(active?.effect ?? effect) === x ? "active" : ""}
                    onClick={() =>
                      active ? updateActive({ effect: x }) : setEffect(x)
                    }
                  >
                    <span>
                      {x === "blur" ? "◉" : x === "pixelate" ? "▦" : "■"}
                    </span>
                    {x}
                  </button>
                ))}
              </div>
            </Control>
            <Control
              label={
                (active?.effect ?? effect) === "pixelate"
                  ? "Pixel size"
                  : "Intensity"
              }
              value={`${active?.amount ?? amount}px`}
            >
              <input
                type="range"
                min="6"
                max="64"
                value={active?.amount ?? amount}
                onChange={(e) =>
                  active
                    ? updateActive({ amount: +e.target.value })
                    : setAmount(+e.target.value)
                }
              />
            </Control>
            {(active?.effect ?? effect) === "solid" && (
              <Control label="Cover color">
                <input
                  className="color"
                  type="color"
                  value={active?.color ?? color}
                  onChange={(e) =>
                    active
                      ? updateActive({ color: e.target.value })
                      : setColor(e.target.value)
                  }
                />
              </Control>
            )}
            <div className="regions">
              <div className="regions-head">
                <strong>Protected regions</strong>
                <small>{regions.length} TOTAL</small>
              </div>
              {!regions.length ? (
                <p>Draw over the image to add your first protected region.</p>
              ) : (
                regions.map((r, i) => (
                  <button
                    key={r.id}
                    className={selected === r.id ? "selected" : ""}
                    onClick={() => setSelected(r.id)}
                  >
                    <span>
                      {r.effect === "blur"
                        ? "◉"
                        : r.effect === "pixelate"
                        ? "▦"
                        : "■"}
                    </span>
                    <div>
                      <strong>Region {i + 1}</strong>
                      <small>
                        {r.shape} · {r.effect}
                      </small>
                    </div>
                    <em>›</em>
                  </button>
                ))
              )}
            </div>
          </aside>
        </div>
        <div className="export">
          <div>
            <span>✓</span>
            <p>
              <strong>
                Image {currentIndex + 1} of {items.length}
              </strong>
              <small>
                {regions.length} protected{" "}
                {regions.length === 1 ? "region" : "regions"} · changes are
                saved as you work
              </small>
            </p>
          </div>
          <div className="export-actions">
            <button className="secondary" onClick={download}>
              ↓ This image
            </button>
            <button onClick={downloadAll} disabled={exporting}>
              ↓ {exporting ? "Preparing ZIP…" : `Download all ${items.length}`}
            </button>
          </div>
        </div>
      </section>
      <footer>
        <strong>BlurShield</strong>
        <span>Built for private, local-first image editing.</span>
      </footer>
    </main>
  );
}
function Control({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="control">
      <label>
        {label}
        <span>{value}</span>
      </label>
      {children}
    </div>
  );
}
function safeName(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "image"
  );
}
function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function renderProcessed(src: string, regions: Region[]) {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  for (const r of regions) {
    ctx.save();
    ctx.beginPath();
    if (r.shape === "ellipse")
      ctx.ellipse(
        r.x + r.w / 2,
        r.y + r.h / 2,
        Math.abs(r.w / 2),
        Math.abs(r.h / 2),
        0,
        0,
        Math.PI * 2
      );
    else ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    if (r.effect === "solid") {
      ctx.fillStyle = r.color;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    } else if (r.effect === "blur") {
      ctx.filter = `blur(${r.amount}px)`;
      const p = r.amount * 2;
      ctx.drawImage(
        img,
        r.x - p,
        r.y - p,
        r.w + p * 2,
        r.h + p * 2,
        r.x - p,
        r.y - p,
        r.w + p * 2,
        r.h + p * 2
      );
    } else {
      const s = Math.max(4, Math.round(r.amount / 2)),
        w = Math.max(1, Math.ceil(r.w / s)),
        h = Math.max(1, Math.ceil(r.h / s)),
        off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      off.getContext("2d")!.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, w, h);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, w, h, r.x, r.y, r.w, r.h);
      ctx.imageSmoothingEnabled = true;
    }
    ctx.restore();
  }
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Unable to export image")),
      "image/png"
    )
  );
}
