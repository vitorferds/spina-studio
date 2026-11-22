export type ArchetypeId = 'spine' | 'thorn' | 'neotribal' | 'chain' | 'fiber';

export type PathShape = 's-curve' | 'vertical' | 'helix' | 'arc' | 'whip' | 'loop';

export type MaterialFinish =
  | 'chrome'
  | 'cyber-obsidian'
  | 'organic-bone'
  | 'iridescent-oil'
  | 'frosted-crystal'
  | 'brushed-titanium';

export type BackgroundMode = 'solid' | 'radial' | 'transparent';

export type AspectPreset = 'viewport' | '9:16' | '1:1' | '4:5' | '16:9';

export type BlendModeOption =
  | 'source-over'
  | 'screen'
  | 'multiply'
  | 'overlay'
  | 'difference'
  | 'exclusion'
  | 'lighten'
  | 'color-dodge';

export interface GeometryParams {
  archetype: ArchetypeId;
  pathShape: PathShape;
  length: number;          // 3.5 .. 12
  curveAmplitude: number;  // 0 .. 3.5
  curveFrequency: number;  // 0.2 .. 3.0
  twist: number;           // -12 .. 12 radians
  thickness: number;       // 0.06 .. 0.65
  taper: number;           // 0 .. 1
  segments: number;        // 8 .. 64
  detailLength: number;    // 0 .. 1.8 (spines, thorns, tendril hooks, link ratio)
  detailAngle: number;     // -1.2 .. 1.2
  detailDensity: number;   // 1 .. 6 (thorns per node, branches, fiber strands)
  organicNoise: number;    // 0 .. 1
  seed: number;            // 1 .. 9999
}

export interface MaterialParams {
  finish: MaterialFinish;
  baseColor: string;
  accentColor: string;
  emissiveColor: string;
  emissiveIntensity: number; // 0 .. 4
  metalness: number;         // 0 .. 1
  roughness: number;         // 0 .. 1
  clearcoat: number;         // 0 .. 1
  iridescence: number;       // 0 .. 1
  envIntensity: number;      // 0 .. 3
}

export interface LightingParams {
  presetName: string;
  keyColor: string;
  keyIntensity: number;      // 0 .. 5
  keyAzimuth: number;        // -180 .. 180 deg
  keyElevation: number;      // -80 .. 80 deg
  fillColor: string;
  fillIntensity: number;     // 0 .. 3
  rimColor: string;
  rimIntensity: number;      // 0 .. 5
  rimAzimuth: number;        // -180 .. 180 deg
  softboxIntensity: number;  // 0 .. 5
  bloomStrength: number;     // 0 .. 2.5
  bloomRadius: number;       // 0 .. 1.2
  bloomThreshold: number;    // 0 .. 1
  chromaticAberration: number; // 0 .. 0.02
  bgMode: BackgroundMode;
  bgColor: string;
  bgSecondaryColor: string;
}

export interface AnimationParams {
  playing: boolean;
  spinSpeed: number;         // -2 .. 2
  waveMotion: number;        // 0 .. 1.5
  pulseSpeed: number;        // 0 .. 4
  breatheAmount: number;     // 0 .. 0.5
}

export interface BaseLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;           // 0 .. 1
  blendMode: BlendModeOption;
  x: number;                 // -100 .. 100 (% of canvas width)
  y: number;                 // -100 .. 100 (% of canvas height)
  scale: number;             // 0.1 .. 4
  rotation: number;          // -180 .. 180 deg
}

export interface Object3DLayer extends BaseLayer {
  type: 'object3d';
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;          // px at 1080 base width
  letterSpacing: number;     // em
  lineHeight: number;
  color: string;
  textTransform: 'none' | 'uppercase' | 'lowercase';
  textAlign: 'left' | 'center' | 'right';
  strokeWidth: number;
  strokeColor: string;
  glowAmount: number;
  glowColor: string;
}

export interface MediaLayer extends BaseLayer {
  type: 'image' | 'video';
  src: string;
  mediaWidth: number;
  mediaHeight: number;
  fitMode: 'contain' | 'cover' | 'free';
  filterContrast: number;    // 0.5 .. 2.0
  filterSaturation: number;  // 0 .. 2.5
  filterBlur: number;        // 0 .. 20
  useAsEnvMap?: boolean;
}

export type StudioLayer = Object3DLayer | TextLayer | MediaLayer;

export interface ExportSettings {
  aspect: AspectPreset;
  resolutionScale: '1080p' | '2k' | '4k';
  imageFormat: 'png' | 'jpeg' | 'webp';
  videoDuration: number;     // 3 .. 12 sec
  videoFps: 30 | 60;
}

export interface StudioState {
  geometry: GeometryParams;
  material: MaterialParams;
  lighting: LightingParams;
  animation: AnimationParams;
  layers: StudioLayer[];
  selectedLayerId: string;
  exportSettings: ExportSettings;
}

export const ARCHETYPE_PRESETS: Record<
  ArchetypeId,
  {
    label: string;
    geometry: GeometryParams;
    material: MaterialParams;
    lighting: Partial<LightingParams>;
  }
> = {
  spine: {
    label: 'Espinha',
    geometry: {
      archetype: 'spine',
      pathShape: 's-curve',
      length: 7.4,
      curveAmplitude: 1.55,
      curveFrequency: 1.0,
      twist: 2.4,
      thickness: 0.34,
      taper: 0.35,
      segments: 34,
      detailLength: 0.72,
      detailAngle: 0.35,
      detailDensity: 2,
      organicNoise: 0.08,
      seed: 104,
    },
    material: {
      finish: 'chrome',
      baseColor: '#d9e3d8',
      accentColor: '#9fb09e',
      emissiveColor: '#00ffd5',
      emissiveIntensity: 0.0,
      metalness: 0.98,
      roughness: 0.08,
      clearcoat: 1.0,
      iridescence: 0.15,
      envIntensity: 1.75,
    },
    lighting: {
      presetName: 'Cromo Escuro',
      keyColor: '#f6ffe8',
      keyIntensity: 2.6,
      keyAzimuth: 38,
      keyElevation: 42,
      fillColor: '#98b4c4',
      fillIntensity: 0.9,
      rimColor: '#e2fff2',
      rimIntensity: 2.4,
      rimAzimuth: -140,
      softboxIntensity: 2.2,
      bloomStrength: 0.25,
      bloomRadius: 0.45,
      bloomThreshold: 0.82,
      bgMode: 'radial',
      bgColor: '#191c1b',
      bgSecondaryColor: '#090a0b',
    },
  },
  thorn: {
    label: 'Caule',
    geometry: {
      archetype: 'thorn',
      pathShape: 'vertical',
      length: 7.8,
      curveAmplitude: 0.85,
      curveFrequency: 1.6,
      twist: 3.8,
      thickness: 0.2,
      taper: 0.25,
      segments: 12,
      detailLength: 1.15,
      detailAngle: 0.45,
      detailDensity: 3,
      organicNoise: 0.65,
      seed: 317,
    },
    material: {
      finish: 'organic-bone',
      baseColor: '#d8cfc6',
      accentColor: '#7a7582',
      emissiveColor: '#4c1d95',
      emissiveIntensity: 0.0,
      metalness: 0.06,
      roughness: 0.64,
      clearcoat: 0.15,
      iridescence: 0.0,
      envIntensity: 0.75,
    },
    lighting: {
      presetName: 'Botânico Noturno',
      keyColor: '#fff5ea',
      keyIntensity: 2.2,
      keyAzimuth: 52,
      keyElevation: 28,
      fillColor: '#4e5970',
      fillIntensity: 0.55,
      rimColor: '#b7c8e8',
      rimIntensity: 1.7,
      rimAzimuth: -135,
      softboxIntensity: 0.8,
      bloomStrength: 0.15,
      bloomRadius: 0.3,
      bloomThreshold: 0.9,
      bgMode: 'solid',
      bgColor: '#030304',
      bgSecondaryColor: '#000000',
    },
  },
  neotribal: {
    label: 'Neotribal',
    geometry: {
      archetype: 'neotribal',
      pathShape: 'whip',
      length: 7.6,
      curveAmplitude: 1.45,
      curveFrequency: 0.9,
      twist: 1.2,
      thickness: 0.24,
      taper: 0.95,
      segments: 48,
      detailLength: 1.05,
      detailAngle: 0.28,
      detailDensity: 4,
      organicNoise: 0.22,
      seed: 702,
    },
    material: {
      finish: 'chrome',
      baseColor: '#e8ecf2',
      accentColor: '#8d96a5',
      emissiveColor: '#ffffff',
      emissiveIntensity: 0.0,
      metalness: 1.0,
      roughness: 0.04,
      clearcoat: 1.0,
      iridescence: 0.25,
      envIntensity: 2.1,
    },
    lighting: {
      presetName: 'Prata Líquida',
      keyColor: '#ffffff',
      keyIntensity: 3.0,
      keyAzimuth: 45,
      keyElevation: 35,
      fillColor: '#cbd5e1',
      fillIntensity: 1.1,
      rimColor: '#f8fafc',
      rimIntensity: 2.8,
      rimAzimuth: -145,
      softboxIntensity: 2.8,
      bloomStrength: 0.2,
      bloomRadius: 0.35,
      bloomThreshold: 0.85,
      bgMode: 'radial',
      bgColor: '#15171c',
      bgSecondaryColor: '#07080a',
    },
  },
  chain: {
    label: 'Corrente',
    geometry: {
      archetype: 'chain',
      pathShape: 'arc',
      length: 7.6,
      curveAmplitude: 1.35,
      curveFrequency: 0.7,
      twist: 0.6,
      thickness: 0.19,
      taper: 0.0,
      segments: 18,
      detailLength: 0.68,
      detailAngle: 0.0,
      detailDensity: 1,
      organicNoise: 0.0,
      seed: 512,
    },
    material: {
      finish: 'chrome',
      baseColor: '#f0f2f5',
      accentColor: '#b4bac4',
      emissiveColor: '#00ffd5',
      emissiveIntensity: 0.0,
      metalness: 1.0,
      roughness: 0.06,
      clearcoat: 1.0,
      iridescence: 0.05,
      envIntensity: 2.0,
    },
    lighting: {
      presetName: 'Estúdio Neutro',
      keyColor: '#ffffff',
      keyIntensity: 2.7,
      keyAzimuth: 30,
      keyElevation: 48,
      fillColor: '#dce2ea',
      fillIntensity: 1.2,
      rimColor: '#ffffff',
      rimIntensity: 2.4,
      rimAzimuth: -150,
      softboxIntensity: 2.6,
      bloomStrength: 0.18,
      bloomRadius: 0.35,
      bloomThreshold: 0.88,
      bgMode: 'radial',
      bgColor: '#26282c',
      bgSecondaryColor: '#121316',
    },
  },
  fiber: {
    label: 'Fibra Óptica',
    geometry: {
      archetype: 'fiber',
      pathShape: 's-curve',
      length: 7.5,
      curveAmplitude: 1.15,
      curveFrequency: 0.9,
      twist: 4.5,
      thickness: 0.3,
      taper: 0.15,
      segments: 24,
      detailLength: 0.82,
      detailAngle: 0.25,
      detailDensity: 5,
      organicNoise: 0.15,
      seed: 889,
    },
    material: {
      finish: 'cyber-obsidian',
      baseColor: '#1a2026',
      accentColor: '#36414d',
      emissiveColor: '#00f7d2',
      emissiveIntensity: 2.4,
      metalness: 0.65,
      roughness: 0.26,
      clearcoat: 0.8,
      iridescence: 0.1,
      envIntensity: 1.35,
    },
    lighting: {
      presetName: 'Cyber Cyan',
      keyColor: '#e0fbfc',
      keyIntensity: 2.1,
      keyAzimuth: 42,
      keyElevation: 36,
      fillColor: '#164e63',
      fillIntensity: 0.75,
      rimColor: '#00ffd5',
      rimIntensity: 3.1,
      rimAzimuth: -125,
      softboxIntensity: 1.6,
      bloomStrength: 0.85,
      bloomRadius: 0.55,
      bloomThreshold: 0.58,
      bgMode: 'solid',
      bgColor: '#030506',
      bgSecondaryColor: '#000000',
    },
  },
};

export const MATERIAL_PRESETS: Record<
  MaterialFinish,
  { label: string; values: Omit<MaterialParams, 'finish'> }
> = {
  chrome: {
    label: 'Cromo Líquido',
    values: {
      baseColor: '#e2e8f0',
      accentColor: '#94a3b8',
      emissiveColor: '#00ffd5',
      emissiveIntensity: 0,
      metalness: 1.0,
      roughness: 0.05,
      clearcoat: 1.0,
      iridescence: 0.15,
      envIntensity: 1.95,
    },
  },
  'cyber-obsidian': {
    label: 'Obsidiana Cyber',
    values: {
      baseColor: '#181c22',
      accentColor: '#334155',
      emissiveColor: '#00f5d4',
      emissiveIntensity: 2.3,
      metalness: 0.62,
      roughness: 0.26,
      clearcoat: 0.85,
      iridescence: 0.1,
      envIntensity: 1.3,
    },
  },
  'organic-bone': {
    label: 'Osso / Orgânico',
    values: {
      baseColor: '#d9cfc5',
      accentColor: '#6f6b7a',
      emissiveColor: '#ff4d6d',
      emissiveIntensity: 0,
      metalness: 0.05,
      roughness: 0.65,
      clearcoat: 0.12,
      iridescence: 0.0,
      envIntensity: 0.7,
    },
  },
  'iridescent-oil': {
    label: 'Óleo Iridescente',
    values: {
      baseColor: '#27272a',
      accentColor: '#71717a',
      emissiveColor: '#a855f7',
      emissiveIntensity: 0.25,
      metalness: 0.94,
      roughness: 0.1,
      clearcoat: 1.0,
      iridescence: 1.0,
      envIntensity: 1.85,
    },
  },
  'frosted-crystal': {
    label: 'Resina / Vidro',
    values: {
      baseColor: '#dbeafe',
      accentColor: '#93c5fd',
      emissiveColor: '#38bdf8',
      emissiveIntensity: 0.35,
      metalness: 0.05,
      roughness: 0.14,
      clearcoat: 1.0,
      iridescence: 0.45,
      envIntensity: 1.5,
    },
  },
  'brushed-titanium': {
    label: 'Titânio Escovado',
    values: {
      baseColor: '#9ca3af',
      accentColor: '#4b5563',
      emissiveColor: '#f59e0b',
      emissiveIntensity: 0,
      metalness: 0.92,
      roughness: 0.24,
      clearcoat: 0.3,
      iridescence: 0.0,
      envIntensity: 1.55,
    },
  },
};

export const LIGHTING_PRESETS: Array<{
  name: string;
  values: Partial<LightingParams>;
}> = [
  {
    name: 'Estúdio Chrome',
    values: {
      presetName: 'Estúdio Chrome',
      keyColor: '#ffffff',
      keyIntensity: 2.8,
      keyAzimuth: 38,
      keyElevation: 42,
      fillColor: '#a5b4fc',
      fillIntensity: 0.95,
      rimColor: '#f8fafc',
      rimIntensity: 2.6,
      rimAzimuth: -142,
      softboxIntensity: 2.4,
      bloomStrength: 0.22,
      bloomRadius: 0.4,
      bloomThreshold: 0.85,
      chromaticAberration: 0.001,
      bgMode: 'radial',
      bgColor: '#191b1f',
      bgSecondaryColor: '#090a0c',
    },
  },
  {
    name: 'Cyber Cyan',
    values: {
      presetName: 'Cyber Cyan',
      keyColor: '#dff9fb',
      keyIntensity: 2.1,
      keyAzimuth: 44,
      keyElevation: 34,
      fillColor: '#164e63',
      fillIntensity: 0.8,
      rimColor: '#00f5d4',
      rimIntensity: 3.3,
      rimAzimuth: -125,
      softboxIntensity: 1.6,
      bloomStrength: 0.9,
      bloomRadius: 0.58,
      bloomThreshold: 0.55,
      chromaticAberration: 0.0025,
      bgMode: 'solid',
      bgColor: '#030506',
      bgSecondaryColor: '#000000',
    },
  },
  {
    name: 'Branco Galeria',
    values: {
      presetName: 'Branco Galeria',
      keyColor: '#ffffff',
      keyIntensity: 2.6,
      keyAzimuth: 32,
      keyElevation: 48,
      fillColor: '#e2e8f0',
      fillIntensity: 1.4,
      rimColor: '#ffffff',
      rimIntensity: 2.0,
      rimAzimuth: -150,
      softboxIntensity: 2.8,
      bloomStrength: 0.1,
      bloomRadius: 0.3,
      bloomThreshold: 0.92,
      chromaticAberration: 0,
      bgMode: 'solid',
      bgColor: '#f4f4f5',
      bgSecondaryColor: '#e4e4e7',
    },
  },
  {
    name: 'Chiaroscuro Âmbar',
    values: {
      presetName: 'Chiaroscuro Âmbar',
      keyColor: '#ffd194',
      keyIntensity: 3.2,
      keyAzimuth: 65,
      keyElevation: 22,
      fillColor: '#1e293b',
      fillIntensity: 0.4,
      rimColor: '#38bdf8',
      rimIntensity: 2.5,
      rimAzimuth: -130,
      softboxIntensity: 1.2,
      bloomStrength: 0.45,
      bloomRadius: 0.48,
      bloomThreshold: 0.72,
      chromaticAberration: 0.0018,
      bgMode: 'radial',
      bgColor: '#14110f',
      bgSecondaryColor: '#050506',
    },
  },
  {
    name: 'Infravermelho',
    values: {
      presetName: 'Infravermelho',
      keyColor: '#ffccd5',
      keyIntensity: 2.4,
      keyAzimuth: -40,
      keyElevation: 30,
      fillColor: '#3b0764',
      fillIntensity: 0.85,
      rimColor: '#ff0055',
      rimIntensity: 3.4,
      rimAzimuth: 135,
      softboxIntensity: 1.9,
      bloomStrength: 0.8,
      bloomRadius: 0.6,
      bloomThreshold: 0.6,
      chromaticAberration: 0.0035,
      bgMode: 'radial',
      bgColor: '#18080e',
      bgSecondaryColor: '#070306',
    },
  },
];

export const INITIAL_STUDIO_STATE: StudioState = {
  geometry: ARCHETYPE_PRESETS.spine.geometry,
  material: ARCHETYPE_PRESETS.spine.material,
  lighting: {
    presetName: 'Cromo Escuro',
    keyColor: '#f6ffe8',
    keyIntensity: 2.6,
    keyAzimuth: 38,
    keyElevation: 42,
    fillColor: '#98b4c4',
    fillIntensity: 0.9,
    rimColor: '#e2fff2',
    rimIntensity: 2.4,
    rimAzimuth: -140,
    softboxIntensity: 2.2,
    bloomStrength: 0.25,
    bloomRadius: 0.45,
    bloomThreshold: 0.82,
    chromaticAberration: 0.0012,
    bgMode: 'radial',
    bgColor: '#191c1b',
    bgSecondaryColor: '#090a0b',
  },
  animation: {
    playing: true,
    spinSpeed: 0.25,
    waveMotion: 0.18,
    pulseSpeed: 1.4,
    breatheAmount: 0.06,
  },
  layers: [
    {
      id: 'layer-3d-main',
      type: 'object3d',
      name: 'Objeto 3D Generativo',
      visible: true,
      opacity: 1,
      blendMode: 'source-over',
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
    },
  ],
  selectedLayerId: 'layer-3d-main',
  exportSettings: {
    aspect: 'viewport',
    resolutionScale: '2k',
    imageFormat: 'png',
    videoDuration: 5,
    videoFps: 30,
  },
};
