import React, {
  lazy,
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Check,
  ChevronsUpDown,
  Menu as MenuIcon,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import blurShieldStyles from "@/features/blurshield/styles.css?inline";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  clickEffectSettings,
  clickEffectSprites,
  mascotSettings,
  videoStartSoundFiles,
  videoStartSounds,
} from "@/effects-config";
import siteContent from "@/site-content.json";

const BlurShield = lazy(() => import("@/features/blurshield/BlurShield"));

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
    AdProvider?: unknown[];
  }
}

const savedTheme = localStorage.getItem("theme");
const initialDark = savedTheme
  ? savedTheme === "dark"
  : window.matchMedia("(prefers-color-scheme: dark)").matches;
document.documentElement.classList.toggle("dark", initialDark);

type Video = {
  id: string;
  slug: string;
  title: string;
  titleId?: string;
  titleSlug?: string;
  ep: number | null;
  views: number;
  likes: number;
  censored: boolean;
  brand: string;
  quality: string;
  year: number;
  language: string;
  duration: string;
  tags: string[];
  cover: string;
  thumb: string;
  backdrop: string;
  embedUrl: string;
  description: string;
  grad: string[];
  releasedAt: string;
};
type Route = { path: string; params: URLSearchParams; noAds: boolean };
type Catalog = { total: number; pages: number; videos: Video[] };
type GalleryImage = { slug: string; title: string; src: string };

const catalogUrl = (import.meta.env.VITE_VIDEOS_URL || "/videos.json").trim();
const DB_NAME = "titties-catalog",
  STORE_NAME = "catalog",
  DB_VERSION = 1;
const withTimeout = <T,>(promise: Promise<T>, ms: number, message: string) =>
  new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
function openCatalogDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME))
        request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Catalog storage is blocked"));
  });
}
function readCachedCatalog(db: IDBDatabase) {
  return new Promise<Catalog | undefined>((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME)
      .objectStore(STORE_NAME)
      .get(catalogUrl);
    request.onsuccess = () => resolve(request.result as Catalog | undefined);
    request.onerror = () => reject(request.error);
  });
}
function storeCatalog(db: IDBDatabase, value: Catalog) {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    store.put(value, catalogUrl);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
async function loadCatalog(): Promise<Catalog> {
  let db: IDBDatabase | undefined, cached: Catalog | undefined;
  try {
    db = await withTimeout(openCatalogDb(), 1500, "Catalog storage timed out");
    cached = await withTimeout(
      readCachedCatalog(db),
      2500,
      "Cached catalog read timed out",
    );
  } catch {
    /* Storage can be unavailable or blocked; HTTP cache remains available. */
  }
  const controller = new AbortController(),
    timer = window.setTimeout(() => controller.abort(), 30000);
  let response: Response;
  try {
    response = await fetch(catalogUrl, {
      cache: "no-cache",
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(`Remote catalog request failed (${response.status})`);
    const type = response.headers.get("content-type") || "";
    if (!type.includes("json"))
      throw new Error("Remote catalog did not return JSON");
  } catch (error) {
    if (cached) return cached;
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
  if (!response.ok)
    throw new Error(`Catalog request failed (${response.status})`);
  const value = (await response.json()) as Catalog;
  if (db) storeCatalog(db, value).catch(() => undefined);
  return value;
}

let catalog: Catalog;
try {
  catalog = await loadCatalog();
} catch (reason) {
  const message =
    reason instanceof Error ? reason.message : "Unknown catalog error";
  const mount = document.getElementById("root");
  if (mount)
    mount.innerHTML = `<main style="min-height:100vh;display:grid;place-items:center;align-content:center;gap:12px;padding:24px;background:#090909;color:#eee;font:14px system-ui;text-align:center"><h1 style="margin:0">The video library could not load</h1><p style="color:#aaa">${message.replace(/[<>&]/g, "")}</p><button style="padding:10px 16px;border:1px solid #444;border-radius:8px;background:#222;color:#fff;cursor:pointer" onclick="location.reload()">Try again</button></main>`;
  throw reason;
}
const videos: Video[] = Array.isArray(catalog.videos) ? catalog.videos : [];
const MEDIA_ORIGIN = (
  import.meta.env.VITE_MEDIA_ORIGIN || "https://animeidhentai.com"
).replace(/\/$/, "");
const mediaUrl = (value?: string) => {
  if (!value) return "";
  if (/^(?:https?:|data:|blob:)/i.test(value)) return value;
  return new URL(
    value.startsWith("/") ? value : `/${value}`,
    `${MEDIA_ORIGIN}/`,
  ).href;
};
const videoSearchText = new Map(
  videos.map((v) => [
    v.id,
    [v.title, v.brand, v.language, ...(v.tags || [])].join(" ").toLowerCase(),
  ]),
);
const allTags = [...new Set(videos.flatMap((v) => v.tags || []))].sort();
const allBrands = [
  ...new Set(videos.map((v) => v.brand).filter(Boolean)),
].sort();
const galleryModules = import.meta.glob(
  "./gallery/*.{png,jpg,jpeg,gif,webp,avif,svg}",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;
const localGalleryImages: GalleryImage[] = Object.entries(galleryModules).map(
  ([path, src]) => {
    const file = path.split("/").pop() || path,
      slug = file.replace(/\.[^.]+$/, "");
    return {
      slug,
      title: slug
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
      src,
    };
  },
);
const GALLERY_MANIFEST_URL = (
    import.meta.env.VITE_GALLERY_MANIFEST_URL || siteContent.links.galleryApi
  ).trim(),
  GALLERY_CACHE_KEY = "remote-gallery-manifest-v1";
const PATREON_URL = siteContent.links.patreon;
function useGalleryImages() {
  const [images, setImages] = useState<GalleryImage[]>(() => {
    try {
      const cached = JSON.parse(
        localStorage.getItem(GALLERY_CACHE_KEY) || "null",
      ) as { images?: GalleryImage[] } | null;
      return cached?.images?.length ? cached.images : localGalleryImages;
    } catch {
      return localGalleryImages;
    }
  });
  useEffect(() => {
    if (!GALLERY_MANIFEST_URL) return;
    const controller = new AbortController();
    fetch(GALLERY_MANIFEST_URL, { cache: "default", signal: controller.signal })
      .then((response) => {
        if (!response.ok)
          throw new Error(`Gallery feed failed (${response.status})`);
        return response.json();
      })
      .then(
        (manifest: {
          images?: Array<{ slug?: string; title?: string; url?: string }>;
        }) => {
          const remote = (manifest.images || [])
            .filter((item) => item.slug && item.url)
            .map((item) => ({
              slug: item.slug!,
              title: item.title || item.slug!,
              src: item.url!,
            }));
          if (remote.length) {
            setImages(remote);
            localStorage.setItem(
              GALLERY_CACHE_KEY,
              JSON.stringify({ images: remote }),
            );
          }
        },
      )
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  return images;
}
const tagCounts = new Map<string, number>(),
  brandCounts = new Map<string, number>();
videos.forEach((v) => {
  brandCounts.set(v.brand, (brandCounts.get(v.brand) || 0) + 1);
  v.tags?.forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1));
});
const compact = (n = 0) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
const art = (v: Video): React.CSSProperties => {
  const [a = "#302014", b = "#090909"] = v.grad || [];
  return {
    backgroundColor: a,
    backgroundImage: `linear-gradient(135deg,${a}12,${b}18),url("${mediaUrl(v.cover || v.thumb)}")`,
  };
};
const normalizedSeriesTitle = (value: string) =>
  value
    .toLowerCase()
    .replace(/\b(?:episode|ep|part|chapter|season|ova)\s*\d+\b/gi, "")
    .replace(/[\s._-]+\d+\s*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const MotionCard = motion.create(Card);
const SOUND_PREFERENCE_KEY = "video-start-sound";

function playSynthStartSound() {
  const preset =
    videoStartSounds[Math.floor(Math.random() * videoStartSounds.length)];
  if (!preset) return;
  try {
    const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext,
      context = new AudioContextClass(),
      gain = context.createGain(),
      start = context.currentTime;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(preset.volume, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + preset.duration);
    gain.connect(context.destination);
    preset.notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = preset.wave;
      oscillator.frequency.setValueAtTime(frequency, start + index * 0.045);
      oscillator.connect(gain);
      oscillator.start(start + index * 0.045);
      oscillator.stop(start + preset.duration);
    });
    window.setTimeout(
      () => context.close(),
      Math.ceil((preset.duration + 0.15) * 1000),
    );
  } catch {
    /* Sound is optional when Web Audio is unavailable. */
  }
}
function playRandomStartSound() {
  if (localStorage.getItem(SOUND_PREFERENCE_KEY) !== "on") return;
  if (videoStartSoundFiles.length) {
    const audio = new Audio(
      videoStartSoundFiles[
        Math.floor(Math.random() * videoStartSoundFiles.length)
      ],
    );
    audio.volume = 0.35;
    audio.play().catch(playSynthStartSound);
    return;
  }
  playSynthStartSound();
}

type ClickBurst = {
  id: number;
  x: number;
  y: number;
  size: number;
  rotation: number;
  src: string;
  kind: "click" | "waterfall";
  drift: number;
};
function ClickEffects() {
  const reduced = useReducedMotion(),
    [bursts, setBursts] = useState<ClickBurst[]>([]),
    id = useRef(0),
    holdTimer = useRef<number | undefined>(undefined),
    streamTimer = useRef<number | undefined>(undefined),
    pointerId = useRef<number | undefined>(undefined),
    origin = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (reduced) return;
    const add = (kind: "click" | "waterfall") => {
        const waterfall = kind === "waterfall",
          size = waterfall
            ? 24 + Math.random() * 28
            : clickEffectSettings.minSize +
              Math.random() *
                (clickEffectSettings.maxSize - clickEffectSettings.minSize),
          burst = {
            id: ++id.current,
            x: origin.current.x + (waterfall ? Math.random() * 56 - 28 : 0),
            y: origin.current.y + (waterfall ? Math.random() * 12 - 6 : 0),
            size,
            rotation: Math.random() * 90 - 45,
            src: clickEffectSprites[
              Math.floor(Math.random() * clickEffectSprites.length)
            ],
            kind,
            drift: Math.random() * 70 - 35,
          };
        setBursts((current) => [...current.slice(-30), burst]);
      },
      stop = () => {
        window.clearTimeout(holdTimer.current);
        window.clearInterval(streamTimer.current);
        holdTimer.current = undefined;
        streamTimer.current = undefined;
        pointerId.current = undefined;
      },
      down = (event: PointerEvent) => {
        if (event.button !== 0 || !clickEffectSprites.length) return;
        stop();
        pointerId.current = event.pointerId;
        origin.current = { x: event.clientX, y: event.clientY };
        add("click");
        holdTimer.current = window.setTimeout(() => {
          add("waterfall");
          streamTimer.current = window.setInterval(
            () => add("waterfall"),
            clickEffectSettings.waterfallIntervalMs,
          );
        }, clickEffectSettings.holdDelayMs);
      },
      move = (event: PointerEvent) => {
        if (event.pointerId === pointerId.current)
          origin.current = { x: event.clientX, y: event.clientY };
      },
      up = (event: PointerEvent) => {
        if (event.pointerId === pointerId.current) stop();
      };
    document.addEventListener("pointerdown", down, { passive: true });
    document.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    window.addEventListener("pointercancel", up, { passive: true });
    window.addEventListener("blur", stop);
    return () => {
      stop();
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("blur", stop);
    };
  }, [reduced]);
  return (
    <div className="click-effects" aria-hidden="true">
      <AnimatePresence>
        {bursts.map((burst) => {
          const waterfall = burst.kind === "waterfall";
          return (
            <motion.img
              key={burst.id}
              src={burst.src}
              className={`click-burst ${waterfall ? "waterfall-drop" : ""}`}
              style={{
                left: burst.x,
                top: burst.y,
                width: burst.size,
                height: burst.size,
              }}
              initial={{
                opacity: 0,
                scale: waterfall ? 0.35 : 0.18,
                rotate: burst.rotation,
              }}
              animate={
                waterfall
                  ? {
                      opacity: [0, 0.95, 0.9, 0.72, 0],
                      scale: [0.35, 0.7, 0.9, 0.84, 0.62],
                      rotate: [
                        burst.rotation,
                        burst.rotation + 8,
                        burst.rotation + 18,
                        burst.rotation + 25,
                        burst.rotation + 34,
                      ],
                      x: [
                        0,
                        burst.drift * 0.15,
                        burst.drift * 0.48,
                        burst.drift * 0.72,
                        burst.drift,
                      ],
                      y: [0, -62, -92, -45, 165],
                    }
                  : {
                      opacity: [0, 1, 0.85, 0],
                      scale: [0.18, 0.72, 1.18, 1.42],
                      rotate: burst.rotation + 35,
                      y: [0, -8, -22, -42],
                    }
              }
              transition={{
                duration: waterfall
                  ? clickEffectSettings.waterfallDuration
                  : clickEffectSettings.duration,
                ease: waterfall ? "easeInOut" : "easeOut",
                times: waterfall ? [0, 0.2, 0.4, 0.62, 1] : undefined,
              }}
              onAnimationComplete={() =>
                setBursts((current) =>
                  current.filter((item) => item.id !== burst.id),
                )
              }
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function InactivityMascot() {
  const firstMascot = mascotSettings.mascots[0],
    [visible, setVisible] = useState(false),
    [choice, setChoice] = useState({
      mascot: firstMascot,
      quote: mascotSettings.quotes[0],
    }),
    reduced = useReducedMotion(),
    timer = useRef<number | undefined>(undefined),
    hideTimer = useRef<number | undefined>(undefined),
    visibleRef = useRef(false);
  visibleRef.current = visible;
  const closeMascot = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    window.clearTimeout(timer.current);
    window.clearTimeout(hideTimer.current);
    setVisible(false);
  };
  useEffect(() => {
    if (reduced || !firstMascot) return;
    const clear = () => {
        window.clearTimeout(timer.current);
        window.clearTimeout(hideTimer.current);
      },
      schedule = () => {
        clear();
        setVisible(false);
        const delay =
          (mascotSettings.minIdleSeconds +
            Math.random() *
              (mascotSettings.maxIdleSeconds - mascotSettings.minIdleSeconds)) *
          1000;
        timer.current = window.setTimeout(() => {
          setChoice({
            mascot:
              mascotSettings.mascots[
                Math.floor(Math.random() * mascotSettings.mascots.length)
              ],
            quote:
              mascotSettings.quotes[
                Math.floor(Math.random() * mascotSettings.quotes.length)
              ],
          });
          setVisible(true);
        }, delay);
      },
      activity = (event: Event) => {
        if (
          event.target instanceof Element &&
          event.target.closest(".inactivity-mascot")
        )
          return;
        if (visibleRef.current) {
          window.clearTimeout(hideTimer.current);
          hideTimer.current = window.setTimeout(
            schedule,
            mascotSettings.stayAfterActivitySeconds * 1000,
          );
        } else schedule();
      };
    schedule();
    const events = [
      "pointerdown",
      "pointermove",
      "keydown",
      "scroll",
      "touchstart",
    ] as const;
    events.forEach((name) =>
      window.addEventListener(name, activity, { passive: true }),
    );
    return () => {
      clear();
      events.forEach((name) => window.removeEventListener(name, activity));
    };
  }, [reduced, firstMascot]);
  const fromRight = mascotSettings.corner === "right";
  return (
    <AnimatePresence>
      {visible && choice.mascot && (
        <motion.div
          className={`inactivity-mascot mascot-${mascotSettings.corner}`}
          initial={{
            opacity: 0,
            x: fromRight ? 95 : -95,
            rotate: fromRight ? 8 : -8,
          }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          exit={{
            opacity: 0,
            x: fromRight ? 105 : -105,
            rotate: fromRight ? 10 : -10,
          }}
          transition={{ type: "spring", stiffness: 180, damping: 18 }}
        >
          <motion.a
            href={choice.mascot.link}
            target="_blank"
            rel="noreferrer"
            className="mascot-link"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            aria-label={`${choice.quote} Open ${choice.mascot.name} in a new tab`}
          >
            <motion.img
              src={choice.mascot.image}
              alt={choice.mascot.name}
              animate={{ y: [0, -5, 0], rotate: [0, 2, -2, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <span>{choice.quote}</span>
          </motion.a>
          <button
            type="button"
            className="mascot-close"
            onClick={closeMascot}
            aria-label="Close mascot"
          >
            <X />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function useRoute() {
  const read = (): Route => {
    const current = new URL(window.location.href);
    const fallback = current.searchParams.get("__route");
    if (fallback) {
      history.replaceState({}, "", fallback);
      return read();
    }
    const actual = current.pathname.replace(/\/+$/, "") || "/";
    const noAds = actual === "/noads" || actual.startsWith("/noads/");
    const path = noAds ? actual.slice(6) || "/" : actual;
    return { path, params: current.searchParams, noAds };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const update = () => setRoute(read());
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return [
    route,
    (href: string) => {
      const target =
        route.noAds && href.startsWith("/") && !href.startsWith("/noads")
          ? `/noads${href === "/" ? "" : href}`
          : href;
      history.pushState({}, "", target);
      setRoute(read());
      window.scrollTo({ top: 0 });
    },
  ] as const;
}

function Link({
  href,
  navigate,
  className,
  style,
  children,
}: {
  href: string;
  navigate: (href: string) => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const noAds =
    location.pathname === "/noads" || location.pathname.startsWith("/noads/");
  const target =
    noAds && href.startsWith("/") && !href.startsWith("/noads")
      ? `/noads${href === "/" ? "" : href}`
      : href;
  return (
    <a
      href={target}
      className={className}
      style={style}
      onClick={(e) => {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          navigate(href);
        }
      }}
    >
      {children}
    </a>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${dark ? "light" : "dark"} theme`}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

function SoundToggle() {
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(SOUND_PREFERENCE_KEY) === "on",
  );
  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(SOUND_PREFERENCE_KEY, next ? "on" : "off");
  };
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="sound-toggle"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={`${enabled ? "Disable" : "Enable"} video start sounds`}
    >
      {enabled ? <Volume2 /> : <VolumeX />}
    </Button>
  );
}

function LiveSearch({
  initial,
  onSearch,
  compact = false,
}: {
  initial: string;
  onSearch: (value: string) => void;
  compact?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const callback = useRef(onSearch);
  const timerRef = useRef<number | undefined>(undefined);
  callback.current = onSearch;
  useEffect(() => setValue(initial), [initial]);
  useEffect(() => {
    if (value === initial) return;
    timerRef.current = window.setTimeout(
      () => callback.current(value.trim()),
      300,
    );
    return () => window.clearTimeout(timerRef.current);
  }, [value, initial]);
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    window.clearTimeout(timerRef.current);
    callback.current(value.trim());
  };
  const clear = () => {
    window.clearTimeout(timerRef.current);
    setValue("");
    callback.current("");
  };
  return (
    <form className={compact ? "search" : "page-search"} onSubmit={submit}>
      {compact && <span>⌕</span>}
      <span className="search-input-wrap">
        <Input
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            compact
              ? siteContent.search.compactPlaceholder
              : siteContent.search.placeholder
          }
        />
        {compact && value && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="clear-search"
            onClick={clear}
            aria-label="Clear search"
          >
            <X />
          </Button>
        )}
      </span>
      {!compact && (
        <>
          <Button type="submit">Search</Button>
          <Button type="button" variant="outline" onClick={clear}>
            <X /> Clear
          </Button>
        </>
      )}
    </form>
  );
}

function FilterCombobox({
  label,
  items,
  value,
  counts,
  onChange,
}: {
  label: string;
  items: string[];
  value: string;
  counts: Map<string, number>;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="filter-combobox"
        >
          <span>{value || `All ${label.toLowerCase()}`}</span>
          <ChevronsUpDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="filter-popover" align="start">
        <Command>
          <CommandInput placeholder={`Find ${label.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
            <CommandItem
              value={`all ${label}`}
              onSelect={() => {
                onChange("");
                setOpen(false);
              }}
            >
              <Check className={!value ? "visible" : "invisible"} />
              All {label.toLowerCase()}
              <small>{videos.length}</small>
            </CommandItem>
            {items.map((item) => (
              <CommandItem
                key={item}
                value={item}
                onSelect={() => {
                  onChange(item);
                  setOpen(false);
                }}
              >
                <Check className={value === item ? "visible" : "invisible"} />
                <span>{item}</span>
                <small>{counts.get(item) || 0}</small>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function Header({
  route,
  navigate,
}: {
  route: Route;
  navigate: (href: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const term = route.path === "/search" ? route.params.get("q") || "" : "";
  const go = (href: string) => {
    setOpen(false);
    navigate(href);
  };
  const active = (path: string) =>
    path === "/"
      ? route.path === "/"
      : route.path === path || route.path.startsWith(`${path}/`);
  return (
    <>
      <motion.header
        className="header"
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Link href="/" navigate={go} className="brand">
          <span className="brand-mark">{siteContent.brand.mark}</span>
          <span className="brand-copy">
            <strong>{siteContent.brand.name}</strong>
            <small>{siteContent.brand.tagline}</small>
          </span>
        </Link>
        <nav className={open ? "nav open" : "nav"}>
          <div className="mobile-nav-title">
            <span>{siteContent.navigation.menuTitle}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X />
            </Button>
          </div>
          {siteContent.navigation.items.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              navigate={go}
              className={active(item.path) ? "active" : ""}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <LiveSearch
          compact
          initial={term}
          onSearch={(q) =>
            go(`/search${q ? `?q=${encodeURIComponent(q)}` : ""}`)
          }
        />
        <div className="header-actions">
          <SoundToggle />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="menu"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X /> : <MenuIcon />}
          </Button>
        </div>
      </motion.header>
      {open && (
        <button
          className="mobile-nav-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
    </>
  );
}

function Analytics({ route }: { route: Route }) {
  useEffect(() => {
    window.gtag?.("event", "page_view", {
      page_title: document.title,
      page_location: window.location.href,
      page_path: window.location.pathname + window.location.search,
    });
  }, [route.path, route.noAds, route.params.toString()]);
  return null;
}

function Seo({ route }: { route: Route }) {
  useEffect(() => {
    const editor = route.path === "/blurshield",
      slug = route.path.startsWith("/video/")
        ? decodeURIComponent(route.path.slice(7))
        : "",
      video = slug
        ? videos.find((v) => v.slug === slug || v.id === slug)
        : undefined,
      tag = route.params.get("tag"),
      brand = route.params.get("brand");
    let title = "Titties — HD video library",
      description =
        "Browse videos by title, category, brand, popularity, and release date.";
    if (editor) {
      title = "BlurShield — Free private photo blur and redaction tool";
      description =
        "Blur, pixelate, or cover sensitive areas in photos privately in your browser. Batch edit images and download them without uploading files.";
    } else if (video) {
      title = `${video.title} — Watch in ${video.quality || "HD"}`;
      description = (
        video.description ||
        `Watch ${video.title} from ${video.brand} in ${video.quality || "HD"}.`
      ).slice(0, 160);
    } else if (route.path === "/categories") {
      title = "Video Categories — Browse the complete library";
      description =
        "Explore the complete collection of video categories and discover releases by tag.";
    } else if (route.path === "/brands") {
      title = "Video Brands — Browse studios and creators";
      description =
        "Explore every available brand and find its latest and most popular releases.";
    } else if (route.path === "/search") {
      title = `${brand || tag || route.params.get("q") || "Search"} — Video results`;
      description = `Browse matching videos${brand ? ` from ${brand}` : ""}${tag ? ` in ${tag}` : ""}, with filters and pagination.`;
    }
    const canonicalUrl = `https://hentaititties.com${route.path === "/" ? "" : route.path}`;
    const image = video
      ? mediaUrl(video.backdrop || video.cover)
      : "https://hentaititties.com/favicon.ico";
    document.title = title;
    const set = (selector: string, attribute: string, value: string) => {
      const node = document.querySelector<HTMLMetaElement>(selector);
      if (node) node.setAttribute(attribute, value);
    };
    set('meta[name="description"]', "content", description);
    set(
      'meta[property="og:type"]',
      "content",
      video ? "video.other" : "website",
    );
    set('meta[property="og:title"]', "content", title);
    set('meta[property="og:description"]', "content", description);
    set('meta[property="og:url"]', "content", canonicalUrl);
    set('meta[property="og:image"]', "content", image);
    set('meta[name="twitter:title"]', "content", title);
    set('meta[name="twitter:description"]', "content", description);
    set('meta[name="twitter:image"]', "content", image);
    const canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (canonical) canonical.href = canonicalUrl;
  }, [route.path, route.params.toString()]);
  return null;
}

function BlurShieldPage() {
  const host = useRef<HTMLDivElement>(null);
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const element = host.current,
      setTheme = () => {
        element.dataset.theme = document.documentElement.classList.contains(
          "dark",
        )
          ? "dark"
          : "light";
      };
    setTheme();
    const observer = new MutationObserver(setTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const shadow = element.shadowRoot || element.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `:host{display:block;color-scheme:light}.app-shell{margin:0;background:#fbfaf7;color:#1b1930;font-family:Arial,Helvetica,sans-serif}${blurShieldStyles.replace(":root", ":host").replaceAll("body{", ".app-shell{").replace("html{scroll-behavior:smooth}", "")}`;
    shadow.appendChild(style);
    setRoot(shadow);
    return () => {
      observer.disconnect();
      setRoot(null);
      shadow.replaceChildren();
    };
  }, []);
  return (
    <main className="blurshield-route" ref={host}>
      {root &&
        createPortal(
          <Suspense
            fallback={<div className="tool-loading">Loading photo editor…</div>}
          >
            <BlurShield />
          </Suspense>,
          root,
        )}
    </main>
  );
}

function Ads({ disabled, routeKey }: { disabled: boolean; routeKey: string }) {
  useEffect(() => {
    if (disabled) return;
    const provider = document.createElement("script");
    provider.async = true;
    provider.type = "application/javascript";
    provider.src = "https://a.magsrv.com/ad-provider.js";
    provider.dataset.siteAd = "provider";
    provider.dataset.routeKey = routeKey;
    document.body.appendChild(provider);
    window.AdProvider = window.AdProvider || [];
    window.AdProvider.push({ serve: {} });
    const interstitial = document.createElement("script");
    interstitial.async = true;
    interstitial.type = "application/javascript";
    interstitial.src = "https://a.pemsrv.com/fp-interstitial.js";
    interstitial.dataset.idzone = "5108474";
    interstitial.dataset.ad_frequency_count = "1";
    interstitial.dataset.ad_frequency_period = "5";
    interstitial.dataset.type = "desktop";
    interstitial.dataset.browser_settings = "1";
    interstitial.dataset.ad_trigger_method = "3";
    interstitial.dataset.siteAd = "interstitial";
    interstitial.dataset.routeKey = routeKey;
    document.body.appendChild(interstitial);
    return () => {
      provider.remove();
      interstitial.remove();
    };
  }, [disabled, routeKey]);
  if (disabled) return null;
  return (
    <aside className="ad-wrap" aria-label="Advertisement">
      <ins
        className="eas6a97888e ad-slot"
        data-zoneid="5108472"
        data-site-ad="display"
      />
    </aside>
  );
}

function VideoCard({
  video,
  navigate,
}: {
  video: Video;
  navigate: (href: string) => void;
}) {
  return (
    <MotionCard
      className="video-card video-card-inner"
      whileHover={{ y: -6, scale: 1.012 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 360, damping: 26 }}
    >
      <Link
        href={`/video/${video.slug}`}
        navigate={navigate}
        className="video-card-main"
      >
        <span className="poster" style={art(video)}>
          <Badge className="quality">{video.quality || "HD"}</Badge>
          <span className="play">▶</span>
          <Badge variant="secondary" className="duration">
            {video.duration || "--:--"}
          </Badge>
        </span>
        <span className="card-copy">
          <strong>{video.title}</strong>
        </span>
      </Link>
      <span className="card-meta">
        <Link
          href={`/search?brand=${encodeURIComponent(video.brand)}`}
          navigate={navigate}
          className="brand-link"
        >
          {video.brand}
        </Link>
        <span>· EP {video.ep ?? "—"}</span>
      </span>
    </MotionCard>
  );
}

function Carousel({
  title,
  href,
  items,
  navigate,
}: {
  title: string;
  href: string;
  items: Video[];
  navigate: (href: string) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const move = (dir: number) =>
    rail.current?.scrollBy({
      left: dir * rail.current.clientWidth * 0.8,
      behavior: "smooth",
    });
  return (
    <section className="home-section">
      <div className="carousel-heading">
        <Link href={href} navigate={navigate}>
          {title} <span>●</span>
        </Link>
        <div className="section-actions">
          <Button asChild variant="ghost" size="sm" className="section-link">
            <Link href={href} navigate={navigate}>
              View all <span>→</span>
            </Link>
          </Button>
          <span className="carousel-buttons">
            <Button
              variant="outline"
              size="icon"
              onClick={() => move(-1)}
              aria-label={`Previous ${title}`}
            >
              ‹
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => move(1)}
              aria-label={`Next ${title}`}
            >
              ›
            </Button>
          </span>
        </div>
      </div>
      <div className="carousel-rail" ref={rail}>
        {items.map((v) => (
          <VideoCard key={v.id} video={v} navigate={navigate} />
        ))}
      </div>
    </section>
  );
}

function DirectoryCarousel({
  title,
  href,
  items,
  navigate,
}: {
  title: string;
  href: string;
  items: { name: string; video: Video; count: number }[];
  navigate: (href: string) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const filterKey = href.includes("categor") ? "tag" : "brand";
  return (
    <section className="home-section">
      <div className="carousel-heading">
        <Link href={href} navigate={navigate}>
          {title} <span>●</span>
        </Link>
        <div className="section-actions">
          <Button asChild variant="ghost" size="sm" className="section-link">
            <Link href={href} navigate={navigate}>
              Explore <span>→</span>
            </Link>
          </Button>
          <span className="carousel-buttons">
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                rail.current?.scrollBy({ left: -700, behavior: "smooth" })
              }
              aria-label={`Previous ${title}`}
            >
              ‹
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                rail.current?.scrollBy({ left: 700, behavior: "smooth" })
              }
              aria-label={`Next ${title}`}
            >
              ›
            </Button>
          </span>
        </div>
      </div>
      <div className="carousel-rail directory-rail" ref={rail}>
        {items.map((x) => (
          <Link
            key={x.name}
            href={`/search?${filterKey}=${encodeURIComponent(x.name)}`}
            navigate={navigate}
            className="directory-tile"
            style={art(x.video)}
          >
            <strong>{x.name}</strong>
            <small>{x.count} releases</small>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ImageCarousel({
  items,
  navigate,
}: {
  items: GalleryImage[];
  navigate: (href: string) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  return (
    <section className="home-section image-section">
      <div className="carousel-heading">
        <Link href="/images" navigate={navigate}>
          {siteContent.sections.images} <span>●</span>
        </Link>
        <div className="section-actions">
          <Button asChild variant="ghost" size="sm" className="section-link">
            <Link href="/images" navigate={navigate}>
              {siteContent.sections.viewAll} <span>→</span>
            </Link>
          </Button>
          <span className="carousel-buttons">
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                rail.current?.scrollBy({ left: -700, behavior: "smooth" })
              }
              aria-label="Previous images"
            >
              ‹
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                rail.current?.scrollBy({ left: 700, behavior: "smooth" })
              }
              aria-label="Next images"
            >
              ›
            </Button>
          </span>
        </div>
      </div>
      <div className="carousel-rail image-rail" ref={rail}>
        {items.map((image) => (
          <motion.div
            className="image-card"
            key={image.slug}
            whileHover={{ y: -5, scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link
              href={`/image/${encodeURIComponent(image.slug)}`}
              navigate={navigate}
            >
              <img src={image.src} alt={image.title} loading="lazy" />
              <strong>{image.title}</strong>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function ImagesPage({
  images,
  navigate,
}: {
  images: GalleryImage[];
  navigate: (href: string) => void;
}) {
  return (
    <main className="content images-page">
      <div className="search-title">
        <div>
          <h1>{siteContent.gallery.heading}</h1>
          <p>
            {images.length} {siteContent.gallery.countSuffix}
          </p>
        </div>
      </div>
      <div className="image-grid">
        {images.map((image) => (
          <motion.div
            className="image-card"
            key={image.slug}
            whileHover={{ y: -5, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link
              href={`/image/${encodeURIComponent(image.slug)}`}
              navigate={navigate}
            >
              <img src={image.src} alt={image.title} loading="lazy" />
              <strong>{image.title}</strong>
            </Link>
          </motion.div>
        ))}
      </div>
    </main>
  );
}

function ImagePage({
  image,
  images,
  navigate,
}: {
  image: GalleryImage;
  images: GalleryImage[];
  navigate: (href: string) => void;
}) {
  const index = images.findIndex((item) => item.slug === image.slug),
    previous = images[(index - 1 + images.length) % images.length],
    next = images[(index + 1) % images.length],
    go = (item: GalleryImage) =>
      navigate(`/image/${encodeURIComponent(item.slug)}`);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && previous) go(previous);
      if (event.key === "ArrowRight" && next) go(next);
      if (event.key === "Escape") navigate("/images");
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [image.slug, previous?.slug, next?.slug]);
  return (
    <main className="content image-page">
      <div className="image-viewer">
        <div className="slideshow-stage">
          <a
            href={PATREON_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={`${siteContent.gallery.openSupport} in a new tab`}
          >
            <motion.img
              key={image.slug}
              src={image.src}
              alt={image.title}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            />
          </a>
          {images.length > 1 && (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="slide-arrow slide-previous"
                onClick={() => go(previous)}
                aria-label={siteContent.gallery.previous}
              >
                ‹
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="slide-arrow slide-next"
                onClick={() => go(next)}
                aria-label={siteContent.gallery.next}
              >
                ›
              </Button>
            </>
          )}
        </div>
        <div className="image-viewer-bar">
          <div>
            <span>
              {siteContent.gallery.imageLabel} · {index + 1} of {images.length}
            </span>
            <h1>{image.title}</h1>
          </div>
          <div className="slideshow-actions">
            <Button asChild variant="outline">
              <a href={PATREON_URL} target="_blank" rel="noreferrer">
                {siteContent.gallery.openSupport}
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/images" navigate={navigate}>
                {siteContent.gallery.viewAll}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Home({
  images,
  navigate,
}: {
  images: GalleryImage[];
  navigate: (href: string) => void;
}) {
  const latest = useMemo(
    () =>
      [...videos]
        .sort((a, b) => +new Date(b.releasedAt) - +new Date(a.releasedAt))
        .slice(0, 18),
    [],
  );
  const trending = useMemo(
    () => [...videos].sort((a, b) => b.views - a.views).slice(0, 18),
    [],
  );
  const random = useMemo(
    () => [...videos].sort(() => Math.random() - 0.5).slice(0, 18),
    [],
  );
  const randomImages = useMemo(
    () => [...images].sort(() => Math.random() - 0.5).slice(0, 10),
    [images],
  );
  const tags = useMemo(
    () =>
      [...allTags]
        .sort(() => Math.random() - 0.5)
        .slice(0, 18)
        .map((name) => {
          const matches = videos.filter((v) => v.tags?.includes(name));
          return {
            name,
            count: matches.length,
            video: matches[Math.floor(Math.random() * matches.length)],
          };
        }),
    [],
  );
  const brands = useMemo(
    () =>
      [...allBrands]
        .sort(() => Math.random() - 0.5)
        .slice(0, 18)
        .map((name) => {
          const matches = videos.filter((v) => v.brand === name);
          return {
            name,
            count: matches.length,
            video: matches[Math.floor(Math.random() * matches.length)],
          };
        }),
    [],
  );
  const peak = useMemo(
    () =>
      videos.length
        ? videos[Math.floor(Math.random() * videos.length)]
        : undefined,
    [],
  );
  return (
    <main className="home">
      <section className="welcome">
        <p>{siteContent.home.eyebrow}</p>
        <h1>{siteContent.home.heading}</h1>
      </section>
      {peak && (
        <section className="peak">
          <span
            className="peak-backdrop"
            aria-hidden="true"
            style={{
              backgroundImage: `url("${mediaUrl(peak.backdrop || peak.cover)}")`,
            }}
          />
          <div>
            <span>{siteContent.home.featuredLabel}</span>
            <h2>{peak.title}</h2>
            <Link
              href={`/search?brand=${encodeURIComponent(peak.brand)}`}
              navigate={navigate}
              className="peak-brand"
            >
              {peak.brand}
            </Link>
            <div className="video-description">
              {peak.description ||
                `${peak.title} episode ${peak.ep}, available in ${peak.quality}.`}
            </div>
            <Link href={`/video/${peak.slug}`} navigate={navigate}>
              {siteContent.home.watchButton}
            </Link>
          </div>
          <VideoCard video={peak} navigate={navigate} />
        </section>
      )}
      <Carousel
        title={siteContent.sections.latest}
        href="/search?sort=latest"
        items={latest}
        navigate={navigate}
      />
      <Carousel
        title={siteContent.sections.trending}
        href="/search?sort=trending"
        items={trending}
        navigate={navigate}
      />
      <Carousel
        title={siteContent.sections.random}
        href="/random"
        items={random}
        navigate={navigate}
      />
      {randomImages.length > 0 && (
        <ImageCarousel items={randomImages} navigate={navigate} />
      )}
      <DirectoryCarousel
        title={siteContent.sections.categories}
        href="/categories"
        items={tags}
        navigate={navigate}
      />
      <DirectoryCarousel
        title={siteContent.sections.brands}
        href="/brands"
        items={brands}
        navigate={navigate}
      />
    </main>
  );
}

const PAGE_SIZE = 24;
function SearchPage({
  route,
  navigate,
}: {
  route: Route;
  navigate: (href: string) => void;
}) {
  const q = route.params.get("q") || "",
    tag = route.params.get("tag") || "",
    brand = route.params.get("brand") || "",
    sort = route.params.get("sort") || "latest";
  const requested = Number(route.params.get("page") || 1);
  const deferredQ = useDeferredValue(q);
  const tags = allTags,
    brands = allBrands;
  const results = useMemo(() => {
    const needle = deferredQ.toLowerCase();
    const found = videos.filter(
      (v) =>
        (videoSearchText.get(v.id) || "").includes(needle) &&
        (!tag || v.tags?.includes(tag)) &&
        (!brand || v.brand === brand),
    );
    return found.sort((a, b) =>
      sort === "trending"
        ? b.views - a.views
        : +new Date(b.releasedAt) - +new Date(a.releasedAt),
    );
  }, [deferredQ, tag, brand, sort]);
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE)),
    page = Math.min(Math.max(requested, 1), pages),
    shown = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const href = (changes: Record<string, string | number>) => {
    const p = new URLSearchParams(route.params);
    Object.entries(changes).forEach(([k, v]) =>
      v ? p.set(k, String(v)) : p.delete(k),
    );
    return `${route.noAds ? "/noads" : ""}/search${p.size ? `?${p}` : ""}`;
  };
  const visible = [
    ...new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2]),
  ]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  const go = (url: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    navigate(url);
  };
  return (
    <main className="search-page content">
      <div className="search-title">
        <div>
          <h1>{siteContent.search.heading}</h1>
          <p>
            {results.length} videos found · Page {page} of {pages}
          </p>
        </div>
        <LiveSearch
          initial={q}
          onSearch={(value) => navigate(href({ q: value, page: 1 }))}
        />
      </div>
      <div className="search-filters">
        <div>
          <span>Filter by</span>
          <FilterCombobox
            label="Categories"
            items={tags}
            value={tag}
            counts={tagCounts}
            onChange={(value) => navigate(href({ tag: value, page: 1 }))}
          />
          <FilterCombobox
            label="Brands"
            items={brands}
            value={brand}
            counts={brandCounts}
            onChange={(value) => navigate(href({ brand: value, page: 1 }))}
          />
        </div>
        {(tag || brand) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(href({ tag: "", brand: "", page: 1 }))}
          >
            <X /> {siteContent.search.clearFilters}
          </Button>
        )}
      </div>
      <div className="active-filters">
        {tag && (
          <Badge variant="secondary">
            Category: {tag}
            <button
              onClick={() => navigate(href({ tag: "", page: 1 }))}
              aria-label="Remove category"
            >
              <X />
            </button>
          </Badge>
        )}
        {brand && (
          <Badge variant="secondary">
            Brand: {brand}
            <button
              onClick={() => navigate(href({ brand: "", page: 1 }))}
              aria-label="Remove brand"
            >
              <X />
            </button>
          </Badge>
        )}
      </div>
      <div className="search-layout">
        <section>
          <div className="result-tools">
            <span>
              {q
                ? `${siteContent.search.resultsFor} “${q}”`
                : siteContent.search.allVideos}
            </span>
            <div>
              <Button
                asChild
                variant={sort === "latest" ? "default" : "outline"}
                size="sm"
              >
                <Link
                  href={href({ sort: "latest", page: 1 })}
                  navigate={navigate}
                >
                  Latest
                </Link>
              </Button>
              <Button
                asChild
                variant={sort === "trending" ? "default" : "outline"}
                size="sm"
              >
                <Link
                  href={href({ sort: "trending", page: 1 })}
                  navigate={navigate}
                >
                  Trending
                </Link>
              </Button>
            </div>
          </div>
          {shown.length ? (
            <div className="video-grid">
              {shown.map((v) => (
                <VideoCard key={v.id} video={v} navigate={navigate} />
              ))}
            </div>
          ) : (
            <Card className="empty">
              <h3>{siteContent.search.emptyTitle}</h3>
              <p>{siteContent.search.emptyText}</p>
            </Card>
          )}
          <Pagination className="pagination">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href={href({ page: Math.max(1, page - 1) })}
                  onClick={go(href({ page: Math.max(1, page - 1) }))}
                  aria-disabled={page === 1}
                />
              </PaginationItem>
              {visible.map((n, i) => (
                <React.Fragment key={n}>
                  {i > 0 && visible[i - 1] !== n - 1 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  <PaginationItem>
                    <PaginationLink
                      href={href({ page: n })}
                      onClick={go(href({ page: n }))}
                      isActive={n === page}
                    >
                      {n}
                    </PaginationLink>
                  </PaginationItem>
                </React.Fragment>
              ))}
              <PaginationItem>
                <PaginationNext
                  href={href({ page: Math.min(pages, page + 1) })}
                  onClick={go(href({ page: Math.min(pages, page + 1) }))}
                  aria-disabled={page === pages}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </section>
      </div>
    </main>
  );
}

function Directory({
  kind,
  navigate,
}: {
  kind: "categories" | "brands";
  navigate: (href: string) => void;
}) {
  const names = kind === "categories" ? allTags : allBrands;
  return (
    <main className="content directory-page">
      <div className="search-title">
        <h1>{kind === "categories" ? "Categories" : "Brands"}</h1>
        <p>{siteContent.directory.description}</p>
      </div>
      <div className="directory-grid">
        {names.map((name) => {
          const matches =
            kind === "categories"
              ? videos.filter((v) => v.tags?.includes(name))
              : videos.filter((v) => v.brand === name);
          return (
            <Link
              key={name}
              href={`/search?${kind === "categories" ? "tag" : "brand"}=${encodeURIComponent(name)}`}
              navigate={navigate}
              className="directory-tile"
              style={art(matches[0])}
            >
              <strong>{name}</strong>
              <small>{matches.length} releases →</small>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

function Watch({
  video,
  navigate,
}: {
  video: Video;
  navigate: (href: string) => void;
}) {
  const player = useRef<HTMLIFrameElement>(null),
    soundPlayed = useRef(false);
  useEffect(() => {
    soundPlayed.current = false;
    const detectPlayerFocus = () =>
      window.setTimeout(() => {
        if (document.activeElement === player.current && !soundPlayed.current) {
          soundPlayed.current = true;
          playRandomStartSound();
        }
      }, 0);
    window.addEventListener("blur", detectPlayerFocus);
    return () => window.removeEventListener("blur", detectPlayerFocus);
  }, [video.id]);
  const brandHref = `/search?brand=${encodeURIComponent(video.brand)}`;
  const related = useMemo(() => {
    const key = normalizedSeriesTitle(video.title);
    return videos
      .filter(
        (candidate) =>
          candidate.id !== video.id &&
          ((video.titleId && candidate.titleId === video.titleId) ||
            (video.titleSlug && candidate.titleSlug === video.titleSlug) ||
            (key.length > 2 && normalizedSeriesTitle(candidate.title) === key)),
      )
      .sort((a, b) => (a.ep ?? 0) - (b.ep ?? 0))
      .slice(0, 18);
  }, [video]);
  const latest = useMemo(
    () =>
      videos
        .filter((v) => v.id !== video.id)
        .sort((a, b) => +new Date(b.releasedAt) - +new Date(a.releasedAt))
        .slice(0, 18),
    [video.id],
  );
  const random = useMemo(
    () =>
      videos
        .filter((v) => v.id !== video.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 15),
    [video.id],
  );
  const trending = useMemo(
    () =>
      videos
        .filter((v) => v.id !== video.id)
        .sort((a, b) => b.views - a.views)
        .slice(0, 18),
    [video.id],
  );
  return (
    <main className="watch-page">
      <div className="player-shell">
        <iframe
          ref={player}
          src={video.embedUrl}
          title={video.title}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
        />
      </div>
      <section className="watch-info">
        <div className="watch-copy">
          <span className="eyebrow">{siteContent.watch.nowPlaying}</span>
          <h1>
            {video.title} <small>EP {video.ep}</small>
          </h1>
          <p>
            {compact(video.views)} views ·{" "}
            <Link href={brandHref} navigate={navigate} className="inline-brand">
              {video.brand}
            </Link>
          </p>
          <div className="video-description">
            {video.description || siteContent.watch.missingDescription}
          </div>
        </div>
        <div className="badges">
          <Button asChild variant="secondary" size="sm">
            <Link
              href={brandHref}
              navigate={navigate}
              className="video-brand-link"
            >
              Brand: {video.brand}
            </Link>
          </Button>
          {(video.tags || []).map((tag) => (
            <Button asChild key={tag} variant="outline" size="sm">
              <Link
                href={`/search?tag=${encodeURIComponent(tag)}`}
                navigate={navigate}
              >
                {tag}
              </Link>
            </Button>
          ))}
        </div>
      </section>
      <div className="watch-carousels">
        {related.length > 0 && (
          <Carousel
            title={siteContent.sections.series}
            href={`/search?q=${encodeURIComponent(normalizedSeriesTitle(video.title))}`}
            items={related}
            navigate={navigate}
          />
        )}{" "}
        {latest.length > 0 && (
          <Carousel
            title={siteContent.sections.latest}
            href="/search?sort=latest"
            items={latest}
            navigate={navigate}
          />
        )}{" "}
        {random.length > 0 && (
          <Carousel
            title={siteContent.sections.random}
            href="/random"
            items={random}
            navigate={navigate}
          />
        )}{" "}
        {trending.length > 0 && (
          <Carousel
            title={siteContent.sections.trending}
            href="/search?sort=trending"
            items={trending}
            navigate={navigate}
          />
        )}
      </div>
    </main>
  );
}

class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>{siteContent.errors.library}</h1>
        <p>{this.state.error.message}</p>
        <button onClick={() => location.reload()}>
          {siteContent.errors.reload}
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}

function App() {
  const [route, navigate] = useRoute(),
    reduced = useReducedMotion(),
    galleryImages = useGalleryImages();
  useEffect(() => {
    const pointer = () =>
      document.documentElement.classList.add("using-pointer");
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Tab")
        document.documentElement.classList.remove("using-pointer");
    };
    window.addEventListener("pointerdown", pointer, { passive: true });
    window.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("pointerdown", pointer);
      window.removeEventListener("keydown", keyboard);
    };
  }, []);
  let page: React.ReactNode;
  if (route.path === "/")
    page = <Home images={galleryImages} navigate={navigate} />;
  else if (route.path === "/search")
    page = <SearchPage route={route} navigate={navigate} />;
  else if (route.path === "/categories")
    page = <Directory kind="categories" navigate={navigate} />;
  else if (route.path === "/brands")
    page = <Directory kind="brands" navigate={navigate} />;
  else if (route.path === "/random")
    page = videos.length ? (
      <Watch
        video={videos[Math.floor(Math.random() * videos.length)]}
        navigate={navigate}
      />
    ) : null;
  else if (route.path === "/images")
    page = <ImagesPage images={galleryImages} navigate={navigate} />;
  else if (route.path.startsWith("/image/")) {
    const slug = decodeURIComponent(route.path.slice(7)),
      image = galleryImages.find((item) => item.slug === slug);
    page = image ? (
      <ImagePage image={image} images={galleryImages} navigate={navigate} />
    ) : (
      <div className="empty">
        <h1>{siteContent.errors.image}</h1>
        <Link href="/images" navigate={navigate}>
          {siteContent.gallery.viewAll}
        </Link>
      </div>
    );
  } else if (route.path === "/blurshield") page = <BlurShieldPage />;
  else if (route.path.startsWith("/video/")) {
    const slug = decodeURIComponent(route.path.slice(7));
    const video = videos.find((v) => v.slug === slug || v.id === slug);
    page = video ? (
      <Watch video={video} navigate={navigate} />
    ) : (
      <div className="empty">
        <h1>{siteContent.errors.video}</h1>
      </div>
    );
  } else
    page = (
      <div className="empty">
        <h1>{siteContent.errors.page}</h1>
        <Link href="/" navigate={navigate}>
          {siteContent.errors.returnHome}
        </Link>
      </div>
    );
  const adRouteKey = `${route.path}?${route.params.toString()}`,
    routeKey = `${route.noAds ? "noads:" : ""}${adRouteKey}`;
  return (
    <div className="app">
      <Seo route={route} />
      <Analytics route={route} />
      <Header route={route} navigate={navigate} />
      <AnimatePresence mode="wait">
        <motion.div
          className="route-motion"
          key={routeKey}
          initial={reduced ? false : { opacity: 0, y: 18, filter: "blur(5px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={
            reduced ? undefined : { opacity: 0, y: -10, filter: "blur(3px)" }
          }
          transition={{ duration: reduced ? 0 : 0.34, ease: "easeOut" }}
        >
          {page}
        </motion.div>
      </AnimatePresence>
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.18, duration: 0.45 }}
      >
        <Link href="/" navigate={navigate} className="brand">
          <span className="brand-mark">{siteContent.brand.mark}</span>
          <span>{siteContent.brand.name}</span>
        </Link>
        <p>{siteContent.footer.message}</p>
        <span>© {new Date().getFullYear()}</span>
      </motion.footer>
      <Ads key={adRouteKey} disabled={route.noAds} routeKey={adRouteKey} />
      <ClickEffects />
      <InactivityMascot />
    </div>
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Root element was not found");
createRoot(root).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
