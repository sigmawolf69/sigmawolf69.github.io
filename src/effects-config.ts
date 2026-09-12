export type StartSound = {name:string;notes:number[];duration:number;wave:OscillatorType;volume:number}

// Add images placed in public/click-effects to this list. One is chosen per click.
export const clickEffectSprites=['/click-effects/water.svg','/click-effects/fire.svg','/click-effects/spark.svg']

// Put .mp3, .wav, or .ogg files in public/sounds and list them here.
// When this list is empty, the synthesized presets below are used instead.
export const videoStartSoundFiles:string[]=[]

// Change these notes, timing, waveforms, or volume to customize video-start sounds.
export const videoStartSounds:StartSound[]=[
  {name:'soft-rise',notes:[330,440,660],duration:.34,wave:'sine',volume:.055},
  {name:'glass-pop',notes:[520,780,1040],duration:.24,wave:'triangle',volume:.045},
  {name:'warm-pulse',notes:[220,330,494],duration:.4,wave:'sine',volume:.05},
]

export const clickEffectSettings={
  duration:.72,
  minSize:54,
  maxSize:86,
  holdDelayMs:420,
  waterfallIntervalMs:95,
  waterfallDuration:1.05,
}

export const mascotSettings={
  mascots:[
    {image:'/mascot/peek.svg',link:'/random',name:'Fox'},
    {image:'/mascot/blob.svg',link:'/categories',name:'Blob'},
    {image:'/mascot/owl.svg',link:'/brands',name:'Owl'},
  ],
  quotes:[
    'Psst… still there?',
    'One more video?',
    'I found something weird.',
    'Need a random pick?',
    'Your screen missed you.',
  ],
  minIdleSeconds:5,
  maxIdleSeconds:10,
  stayAfterActivitySeconds:5,
  corner:'right' as 'left'|'right',
}
