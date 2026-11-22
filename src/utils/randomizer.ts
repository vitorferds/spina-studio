import {
  ArchetypeId,
  LIGHTING_PRESETS,
  MATERIAL_PRESETS,
  MaterialFinish,
  PathShape,
  StudioState,
} from '../types/studio';

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const PATH_SHAPES: PathShape[] = ['s-curve', 'vertical', 'helix', 'arc', 'whip', 'loop'];
const ARCHETYPES: ArchetypeId[] = ['spine', 'thorn', 'neotribal', 'chain', 'fiber'];
const FINISHES: MaterialFinish[] = [
  'chrome',
  'cyber-obsidian',
  'organic-bone',
  'iridescent-oil',
  'frosted-crystal',
  'brushed-titanium',
];

const EXPERIMENTAL_PALETTES = [
  { base: '#e2e8f0', accent: '#94a3b8', emissive: '#00ffd5', bg: '#101214', bg2: '#050607' },
  { base: '#181a1f', accent: '#334155', emissive: '#00f5d4', bg: '#030507', bg2: '#000000' },
  { base: '#d9cfc5', accent: '#6d6875', emissive: '#e11d48', bg: '#080709', bg2: '#000000' },
  { base: '#f4f4f5', accent: '#a1a1aa', emissive: '#3b82f6', bg: '#f1f5f9', bg2: '#cbd5e1' },
  { base: '#1c1917', accent: '#78716c', emissive: '#f59e0b', bg: '#120d0a', bg2: '#050403' },
  { base: '#2e1065', accent: '#7e22ce', emissive: '#d946ef', bg: '#0e0518', bg2: '#040108' },
  { base: '#064e3b', accent: '#10b981', emissive: '#a3e635', bg: '#04120d', bg2: '#010503' },
  { base: '#cbd5e1', accent: '#475569', emissive: '#ff2a5f', bg: '#16090e', bg2: '#070204' },
];

export function randomizeLight(state: StudioState): StudioState {
  const g = state.geometry;
  const m = state.material;
  const l = state.lighting;

  const nextGeometry = {
    ...g,
    curveAmplitude: clamp(g.curveAmplitude * randRange(0.78, 1.25), 0.15, 3.2),
    curveFrequency: clamp(g.curveFrequency * randRange(0.82, 1.2), 0.3, 2.8),
    twist: clamp(g.twist + randRange(-1.4, 1.4), -10, 10),
    thickness: clamp(g.thickness * randRange(0.85, 1.18), 0.08, 0.58),
    taper: clamp(g.taper + randRange(-0.18, 0.18), 0, 1),
    detailLength: clamp(g.detailLength * randRange(0.8, 1.25), 0.2, 1.6),
    detailAngle: clamp(g.detailAngle + randRange(-0.22, 0.22), -1.1, 1.1),
    organicNoise: clamp(g.organicNoise + randRange(-0.14, 0.14), 0, 1),
    seed: Math.floor(randRange(1, 9999)),
  };

  const nextMaterial = {
    ...m,
    roughness: clamp(m.roughness + randRange(-0.08, 0.08), 0.02, 0.92),
    iridescence: clamp(m.iridescence + randRange(-0.15, 0.15), 0, 1),
    envIntensity: clamp(m.envIntensity * randRange(0.88, 1.15), 0.4, 2.6),
  };

  const nextLighting = {
    ...l,
    keyAzimuth: ((l.keyAzimuth + randRange(-35, 35) + 180) % 360) - 180,
    keyElevation: clamp(l.keyElevation + randRange(-15, 15), -60, 75),
    rimAzimuth: ((l.rimAzimuth + randRange(-35, 35) + 180) % 360) - 180,
    bloomStrength: clamp(l.bloomStrength * randRange(0.8, 1.25), 0, 2.2),
  };

  return {
    ...state,
    geometry: nextGeometry,
    material: nextMaterial,
    lighting: nextLighting,
  };
}

export function randomizeAggressive(state: StudioState): StudioState {
  const nextArchetype = pick(ARCHETYPES);
  const nextPath = pick(PATH_SHAPES);
  const nextFinish = pick(FINISHES);
  const finishDefaults = MATERIAL_PRESETS[nextFinish].values;
  const palette = pick(EXPERIMENTAL_PALETTES);
  const lightPreset = pick(LIGHTING_PRESETS).values;

  const isGlowingArchetype = nextArchetype === 'fiber' || nextFinish === 'cyber-obsidian';

  const nextGeometry = {
    archetype: nextArchetype,
    pathShape: nextPath,
    length: Number(randRange(5.8, 9.2).toFixed(2)),
    curveAmplitude: Number(randRange(0.65, 2.6).toFixed(2)),
    curveFrequency: Number(randRange(0.45, 2.2).toFixed(2)),
    twist: Number(randRange(-7.5, 7.5).toFixed(2)),
    thickness: Number(
      randRange(
        nextArchetype === 'chain' ? 0.14 : 0.16,
        nextArchetype === 'chain' ? 0.28 : 0.46
      ).toFixed(2)
    ),
    taper: Number(
      (nextArchetype === 'neotribal' ? randRange(0.7, 1.0) : randRange(0.0, 0.8)).toFixed(2)
    ),
    segments:
      nextArchetype === 'thorn'
        ? Math.floor(randRange(8, 18))
        : nextArchetype === 'chain'
        ? Math.floor(randRange(12, 26))
        : Math.floor(randRange(22, 54)),
    detailLength: Number(randRange(0.45, 1.55).toFixed(2)),
    detailAngle: Number(randRange(-0.75, 0.85).toFixed(2)),
    detailDensity: Math.floor(randRange(2, 6)),
    organicNoise: Number(randRange(0.05, 0.85).toFixed(2)),
    seed: Math.floor(randRange(1, 9999)),
  };

  const nextMaterial = {
    finish: nextFinish,
    ...finishDefaults,
    baseColor: palette.base,
    accentColor: palette.accent,
    emissiveColor: palette.emissive,
    emissiveIntensity: isGlowingArchetype
      ? Number(randRange(1.4, 3.4).toFixed(2))
      : Number(randRange(0, 1.4).toFixed(2)),
    iridescence: Number(randRange(0, 1).toFixed(2)),
  };

  const nextLighting = {
    ...state.lighting,
    ...lightPreset,
    keyAzimuth: Math.round(randRange(-160, 160)),
    keyElevation: Math.round(randRange(-35, 70)),
    rimColor: palette.emissive,
    rimIntensity: Number(randRange(1.4, 3.8).toFixed(2)),
    bloomStrength: isGlowingArchetype
      ? Number(randRange(0.55, 1.4).toFixed(2))
      : Number(randRange(0.12, 0.65).toFixed(2)),
    chromaticAberration: Number(randRange(0, 0.006).toFixed(4)),
    bgMode:
      state.lighting.bgMode === 'transparent'
        ? ('transparent' as const)
        : pick(['solid', 'radial'] as const),
    bgColor: palette.bg,
    bgSecondaryColor: palette.bg2,
  };

  return {
    ...state,
    geometry: nextGeometry,
    material: nextMaterial,
    lighting: nextLighting,
  };
}
