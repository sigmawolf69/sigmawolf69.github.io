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
  mascots: [
    { image: "/mascot/peek.svg", link: siteContent.links.patreon, name: "Fox" },
    {
      image: "/mascot/blob.svg",
      link: siteContent.links.patreon,
      name: "Blob",
    },
    { image: "/mascot/owl.svg", link: siteContent.links.patreon, name: "Owl" },
  ],
  quotes: siteContent.mascot.quotes,
  minIdleSeconds: 5,
  maxIdleSeconds: 10,
  stayAfterActivitySeconds: 5,
  corner: "right" as "left" | "right",
};
