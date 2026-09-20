import siteContent from "./site-content.json";

export type StartSound = {
  name: string;
  notes: number[];
  duration: number;
  wave: OscillatorType;
  volume: number;
};

// Add images placed in public/click-effects to this list. One is chosen per click.
export const clickEffectSprites = [
  "/click-effects/water.svg",
  "/click-effects/fire.svg",
  "/click-effects/spark.svg",
];

// Put .mp3, .wav, or .ogg files in public/sounds and list them here.
// When this list is empty, the synthesized presets below are used instead.
export const videoStartSoundFiles: string[] = [];

// Change these notes, timing, waveforms, or volume to customize video-start sounds.
export const videoStartSounds: StartSound[] = [
  {
    name: "soft-rise",
    notes: [330, 440, 660],
    duration: 0.34,
    wave: "sine",
    volume: 0.055,
  },
  {
    name: "glass-pop",
    notes: [520, 780, 1040],
    duration: 0.24,
    wave: "triangle",
    volume: 0.045,
  },
  {
    name: "warm-pulse",
    notes: [220, 330, 494],
    duration: 0.4,
    wave: "sine",
    volume: 0.05,
  },
];

export const clickEffectSettings = {
  duration: 0.72,
  minSize: 54,
  maxSize: 86,
  holdDelayMs: 420,
  waterfallIntervalMs: 95,
  waterfallDuration: 1.05,
};

export const mascotSettings = {
  enabled: true,
  mascots: [
    // { image: "/mascot/peek.svg", link: siteContent.links.patreon, name: "Fox" },
    // {
    //   image: "/mascot/blob.svg",
    //   link: siteContent.links.patreon,
    //   name: "Blob",
    // },
    // { image: "/mascot/owl.svg", link: siteContent.links.patreon, name: "Owl" },
    {
      image: "/mascot/image-Photoroom.png",
      link: siteContent.links.patreon,
      name: "Owl",
    },
  ],
  quotes: siteContent.mascot.quotes,
  minIdleSeconds: 5,
  maxIdleSeconds: 6,
  stayAfterActivitySeconds: 2,
  corner: "right" as "left" | "right",
};

export type EdgePeekMedia = {
  name: string;
  type: "auto" | "image" | "video" | "frames";
  sources: string[];
  link: string;
};

// Replace the sample with a PNG, GIF, WebP, MP4/WebM, or a list of animation
// frames. A frames entry advances through every source in order and loops.
// Video example: { name: "Luna", type: "video", sources: ["/edge-peek/luna.webm"], link: "..." }
// Frame example: { name: "Luna", type: "frames", sources: ["/edge-peek/luna-01.webp", "/edge-peek/luna-02.webp"], link: "..." }
export const edgePeekSettings = {
  enabled: true,
  media: [
    {
      name: "Luna",
      type: "image" as const,
      sources: ["/edge-peek/image-Photoroom.png"],
      link: siteContent.links.patreon,
    },
  ] satisfies EdgePeekMedia[],
  positions: [
    "right",
    "left",
    "bottom-right",
    "bottom-left",
    "top-right",
    "top-left",
  ] as const,
  minIdleSeconds: 4,
  maxIdleSeconds: 5,
  visibleSeconds: 3,
  hideAfterActivitySeconds: 1,
  frameDurationMs: 140,
};
