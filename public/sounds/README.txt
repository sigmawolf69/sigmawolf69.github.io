Add your video-start sound files to this folder.

Supported browser-friendly formats: MP3, WAV, and OGG.

Then edit src/effects-config.ts, for example:

export const videoStartSoundFiles=[
  '/sounds/start-1.mp3',
  '/sounds/start-2.ogg',
]

One listed file is chosen randomly when the embedded player is first activated.
