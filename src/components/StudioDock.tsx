import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  Film,
  Image as ImageIcon,
  Layers,
  Pause,
  Play,
  RefreshCw,
  Shuffle,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  Type,
  Video,
  Zap,
} from 'lucide-react';
import {
  AnimationParams,
  AspectPreset,
  BackgroundMode,
  BlendModeOption,
  ExportSettings,
  GeometryParams,
  LIGHTING_PRESETS,
  LightingParams,
  MATERIAL_PRESETS,
  MaterialFinish,
  MaterialParams,
  MediaLayer,
  PathShape,
  StudioLayer,
  StudioState,
  TextLayer,
} from '../types/studio';
import { CameraPreset } from '../engine/SceneManager';
import { CURATED_GOOGLE_FONTS, ensureGoogleFontLoaded } from '../utils/fonts';

export type DockTab =
  | 'geometry'
  | 'material'
  | 'lighting'
  | 'layers'
  | 'animation'
  | 'export';

interface StudioDockProps {
  state: StudioState;
  activeTab: DockTab;
  collapsed: boolean;
  isExporting: boolean;
  exportProgress: number;
  onChangeTab: (tab: DockTab) => void;
  onToggleCollapse: () => void;
  onUpdateGeometry: (patch: Partial<GeometryParams>) => void;
  onUpdateMaterial: (patch: Partial<MaterialParams>) => void;
  onSelectMaterialFinish: (finish: MaterialFinish) => void;
  onUpdateLighting: (patch: Partial<LightingParams>) => void;
  onUpdateAnimation: (patch: Partial<AnimationParams>) => void;
  onUpdateExport: (patch: Partial<ExportSettings>) => void;
  onSelectLayer: (id: string) => void;
  onUpdateLayer: (id: string, patch: Partial<StudioLayer>) => void;
  onMoveLayer: (id: string, dir: 'up' | 'down') => void;
  onDeleteLayer: (id: string) => void;
  onAddTextLayer: () => void;
  onUploadMedia: (files: FileList) => void;
  onSetEnvMapFromLayer: (src: string | null, layerId: string) => void;
  onRandomLight: () => void;
  onRandomAggressive: () => void;
  onCameraPreset: (preset: CameraPreset) => void;
  onExportImage: () => void;
  onExportVideo: () => void;
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  unit = '',
  onChange,
}) => (
  <label className="flex flex-col gap-1.5 min-w-0">
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-zinc-400 truncate">{label}</span>
      <span className="font-mono-tabular text-zinc-200 shrink-0">
        {Number.isInteger(step) ? value.toFixed(0) : value.toFixed(2)}
        {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="studio-slider"
    />
  </label>
);

const PATH_OPTIONS: Array<{ id: PathShape; label: string }> = [
  { id: 's-curve', label: 'Curva S' },
  { id: 'vertical', label: 'Vertical' },
  { id: 'helix', label: 'Hélice' },
  { id: 'arc', label: 'Arco' },
  { id: 'whip', label: 'Chicote' },
  { id: 'loop', label: 'Loop' },
];

const BLEND_MODES: Array<{ id: BlendModeOption; label: string }> = [
  { id: 'source-over', label: 'Normal' },
  { id: 'screen', label: 'Screen' },
  { id: 'multiply', label: 'Multiply' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'difference', label: 'Difference' },
  { id: 'exclusion', label: 'Exclusion' },
  { id: 'lighten', label: 'Lighten' },
  { id: 'color-dodge', label: 'Color Dodge' },
];

const ASPECT_OPTIONS: Array<{ id: AspectPreset; label: string }> = [
  { id: 'viewport', label: 'Tela' },
  { id: '9:16', label: '9:16' },
  { id: '4:5', label: '4:5' },
  { id: '1:1', label: '1:1' },
  { id: '16:9', label: '16:9' },
];

export const StudioDock: React.FC<StudioDockProps> = ({
  state,
  activeTab,
  collapsed,
  isExporting,
  exportProgress,
  onChangeTab,
  onToggleCollapse,
  onUpdateGeometry,
  onUpdateMaterial,
  onSelectMaterialFinish,
  onUpdateLighting,
  onUpdateAnimation,
  onUpdateExport,
  onSelectLayer,
  onUpdateLayer,
  onMoveLayer,
  onDeleteLayer,
  onAddTextLayer,
  onUploadMedia,
  onSetEnvMapFromLayer,
  onRandomLight,
  onRandomAggressive,
  onCameraPreset,
  onExportImage,
  onExportVideo,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customFontInput, setCustomFontInput] = useState('');
  const selectedLayer = state.layers.find((l) => l.id === state.selectedLayerId);

  const tabs: Array<{ id: DockTab; label: string; icon: React.ReactNode }> = [
    { id: 'geometry', label: 'Geometria', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'material', label: 'Material', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'lighting', label: 'Iluminação', icon: <Sun className="w-3.5 h-3.5" /> },
    { id: 'layers', label: 'Camadas', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'animation', label: 'Animação', icon: <Film className="w-3.5 h-3.5" /> },
    { id: 'export', label: 'Exportar', icon: <Download className="w-3.5 h-3.5" /> },
  ];

  if (collapsed) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-2 bg-[#0d0e12]/95 border border-white/15 rounded-lg shadow-2xl">
        <button
          type="button"
          onClick={onRandomLight}
          className="px-3 py-1.5 text-xs font-medium text-zinc-200 bg-white/5 hover:bg-white/10 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Shuffle className="w-3.5 h-3.5 text-cyan-300" />
          Random Leve
        </button>
        <button
          type="button"
          onClick={onRandomAggressive}
          className="px-3 py-1.5 text-xs font-medium text-zinc-950 bg-cyan-400 hover:bg-cyan-300 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5" />
          Random Agressivo
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ChevronUp className="w-3.5 h-3.5" />
          Mostrar Controles (H)
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label="Painel de Parâmetros do Estúdio"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[min(1080px,96vw)] bg-[#0d0e12]/95 border border-white/12 rounded-xl shadow-2xl overflow-hidden"
    >
      {/* Dock Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-white/10 bg-[#12141a]">
        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChangeTab(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  active
                    ? 'bg-zinc-100 text-zinc-950'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Randomize & Collapse Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onUpdateAnimation({ playing: !state.animation.playing })}
            title={state.animation.playing ? 'Pausar animação' : 'Reproduzir animação'}
            className="p-1.5 text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-md cursor-pointer"
          >
            {state.animation.playing ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onRandomLight}
            className="px-3 py-1.5 text-xs font-medium text-zinc-200 bg-white/6 hover:bg-white/12 border border-white/10 rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5 text-cyan-300" />
            Random Leve
          </button>

          <button
            type="button"
            onClick={onRandomAggressive}
            className="px-3 py-1.5 text-xs font-semibold text-zinc-950 bg-cyan-400 hover:bg-cyan-300 rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            Random Agressivo
          </button>

          <button
            type="button"
            onClick={onToggleCollapse}
            title="Ocultar painel (H)"
            className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 bg-white/5 hover:bg-white/10 rounded-md flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            Ocultar
          </button>
        </div>
      </div>

      {/* Tab Content Body */}
      <div className="p-4 max-h-[250px] overflow-y-auto studio-scroll">
        {/* 1. GEOMETRY TAB */}
        {activeTab === 'geometry' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/8">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-zinc-400 mr-2">Trajetória:</span>
                {PATH_OPTIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onUpdateGeometry({ pathShape: p.id })}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      state.geometry.pathShape === p.id
                        ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-400/40'
                        : 'bg-white/5 text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">
                  Seed <span className="font-mono-tabular text-zinc-200">{state.geometry.seed}</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateGeometry({ seed: Math.floor(1 + Math.random() * 9998) })
                  }
                  className="px-2.5 py-1 text-xs bg-white/6 hover:bg-white/12 text-zinc-200 rounded-md flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Nova Seed
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-3">
              <SliderRow
                label="Comprimento"
                value={state.geometry.length}
                min={3.5}
                max={12}
                step={0.1}
                onChange={(v) => onUpdateGeometry({ length: v })}
              />
              <SliderRow
                label="Amplitude Curva"
                value={state.geometry.curveAmplitude}
                min={0}
                max={3.5}
                step={0.05}
                onChange={(v) => onUpdateGeometry({ curveAmplitude: v })}
              />
              <SliderRow
                label="Frequência"
                value={state.geometry.curveFrequency}
                min={0.2}
                max={3.0}
                step={0.05}
                onChange={(v) => onUpdateGeometry({ curveFrequency: v })}
              />
              <SliderRow
                label="Torção (Twist)"
                value={state.geometry.twist}
                min={-12}
                max={12}
                step={0.1}
                onChange={(v) => onUpdateGeometry({ twist: v })}
              />
              <SliderRow
                label="Espessura"
                value={state.geometry.thickness}
                min={0.06}
                max={0.65}
                step={0.01}
                onChange={(v) => onUpdateGeometry({ thickness: v })}
              />
              <SliderRow
                label="Afunilamento"
                value={state.geometry.taper}
                min={0}
                max={1}
                step={0.02}
                onChange={(v) => onUpdateGeometry({ taper: v })}
              />
              <SliderRow
                label="Segmentos / Nós"
                value={state.geometry.segments}
                min={6}
                max={64}
                step={1}
                onChange={(v) => onUpdateGeometry({ segments: v })}
              />
              <SliderRow
                label="Tam. Espinhos / Elos"
                value={state.geometry.detailLength}
                min={0.1}
                max={1.8}
                step={0.02}
                onChange={(v) => onUpdateGeometry({ detailLength: v })}
              />
              <SliderRow
                label="Ângulo Detalhe"
                value={state.geometry.detailAngle}
                min={-1.2}
                max={1.2}
                step={0.02}
                onChange={(v) => onUpdateGeometry({ detailAngle: v })}
              />
              <SliderRow
                label="Densidade / Ramos"
                value={state.geometry.detailDensity}
                min={1}
                max={6}
                step={1}
                onChange={(v) => onUpdateGeometry({ detailDensity: v })}
              />
              <SliderRow
                label="Ruído Orgânico"
                value={state.geometry.organicNoise}
                min={0}
                max={1}
                step={0.02}
                onChange={(v) => onUpdateGeometry({ organicNoise: v })}
              />
            </div>
          </div>
        )}

        {/* 2. MATERIAL TAB */}
        {activeTab === 'material' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-white/8">
              {(Object.keys(MATERIAL_PRESETS) as MaterialFinish[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onSelectMaterialFinish(f)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    state.material.finish === f
                      ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-400/40'
                      : 'bg-white/5 text-zinc-400 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  {MATERIAL_PRESETS[f].label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-5 gap-y-3 items-center">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="color"
                    value={state.material.baseColor}
                    onChange={(e) => onUpdateMaterial({ baseColor: e.target.value })}
                    className="w-7 h-7 rounded bg-transparent border border-white/15 cursor-pointer"
                  />
                  Cor Base
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="color"
                    value={state.material.accentColor}
                    onChange={(e) => onUpdateMaterial({ accentColor: e.target.value })}
                    className="w-7 h-7 rounded bg-transparent border border-white/15 cursor-pointer"
                  />
                  Detalhe
                </label>
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="color"
                  value={state.material.emissiveColor}
                  onChange={(e) => onUpdateMaterial({ emissiveColor: e.target.value })}
                  className="w-7 h-7 rounded bg-transparent border border-white/15 cursor-pointer"
                />
                Cor Emissiva / Neon
              </label>

              <SliderRow
                label="Metalicidade"
                value={state.material.metalness}
                min={0}
                max={1}
                step={0.02}
                onChange={(v) => onUpdateMaterial({ metalness: v })}
              />
              <SliderRow
                label="Rugosidade"
                value={state.material.roughness}
                min={0.02}
                max={1}
                step={0.02}
                onChange={(v) => onUpdateMaterial({ roughness: v })}
              />
              <SliderRow
                label="Verniz (Clearcoat)"
                value={state.material.clearcoat}
                min={0}
                max={1}
                step={0.02}
                onChange={(v) => onUpdateMaterial({ clearcoat: v })}
              />
              <SliderRow
                label="Iridescência"
                value={state.material.iridescence}
                min={0}
                max={1}
                step={0.02}
                onChange={(v) => onUpdateMaterial({ iridescence: v })}
              />
              <SliderRow
                label="Brilho Emissivo"
                value={state.material.emissiveIntensity}
                min={0}
                max={4}
                step={0.05}
                onChange={(v) => onUpdateMaterial({ emissiveIntensity: v })}
              />
              <SliderRow
                label="Reflexo de Estúdio"
                value={state.material.envIntensity}
                min={0.1}
                max={3}
                step={0.05}
                onChange={(v) => onUpdateMaterial({ envIntensity: v })}
              />
            </div>
          </div>
        )}

        {/* 3. LIGHTING TAB */}
        {activeTab === 'lighting' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/8">
              <div className="flex flex-wrap items-center gap-1.5">
                {LIGHTING_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => onUpdateLighting(preset.values)}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      state.lighting.presetName === preset.name
                        ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-400/40'
                        : 'bg-white/5 text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-400">Fundo:</span>
                {(
                  [
                    { id: 'solid', label: 'Sólido' },
                    { id: 'radial', label: 'Radial' },
                    { id: 'transparent', label: 'Transparente' },
                  ] as Array<{ id: BackgroundMode; label: string }>
                ).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onUpdateLighting({ bgMode: b.id })}
                    className={`px-2.5 py-1 text-xs rounded-md cursor-pointer ${
                      state.lighting.bgMode === b.id
                        ? 'bg-zinc-100 text-zinc-950 font-medium'
                        : 'bg-white/5 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-5 gap-y-3 items-center">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="color"
                    value={state.lighting.keyColor}
                    onChange={(e) => onUpdateLighting({ keyColor: e.target.value })}
                    className="w-6 h-6 rounded bg-transparent border border-white/15 cursor-pointer"
                  />
                  Key
                </label>
                <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="color"
                    value={state.lighting.fillColor}
                    onChange={(e) => onUpdateLighting({ fillColor: e.target.value })}
                    className="w-6 h-6 rounded bg-transparent border border-white/15 cursor-pointer"
                  />
                  Fill
                </label>
                <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="color"
                    value={state.lighting.rimColor}
                    onChange={(e) => onUpdateLighting({ rimColor: e.target.value })}
                    className="w-6 h-6 rounded bg-transparent border border-white/15 cursor-pointer"
                  />
                  Rim
                </label>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="color"
                    value={state.lighting.bgColor}
                    onChange={(e) => onUpdateLighting({ bgColor: e.target.value })}
                    className="w-6 h-6 rounded bg-transparent border border-white/15 cursor-pointer"
                  />
                  Fundo 1
                </label>
                <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="color"
                    value={state.lighting.bgSecondaryColor}
                    onChange={(e) =>
                      onUpdateLighting({ bgSecondaryColor: e.target.value })
                    }
                    className="w-6 h-6 rounded bg-transparent border border-white/15 cursor-pointer"
                  />
                  Fundo 2
                </label>
              </div>

              <SliderRow
                label="Luz Principal (Key)"
                value={state.lighting.keyIntensity}
                min={0}
                max={5}
                step={0.1}
                onChange={(v) => onUpdateLighting({ keyIntensity: v })}
              />
              <SliderRow
                label="Azimute Key"
                value={state.lighting.keyAzimuth}
                min={-180}
                max={180}
                step={1}
                unit="°"
                onChange={(v) => onUpdateLighting({ keyAzimuth: v })}
              />
              <SliderRow
                label="Elevação Key"
                value={state.lighting.keyElevation}
                min={-80}
                max={80}
                step={1}
                unit="°"
                onChange={(v) => onUpdateLighting({ keyElevation: v })}
              />
              <SliderRow
                label="Luz Fill"
                value={state.lighting.fillIntensity}
                min={0}
                max={3}
                step={0.05}
                onChange={(v) => onUpdateLighting({ fillIntensity: v })}
              />
              <SliderRow
                label="Contraluz (Rim)"
                value={state.lighting.rimIntensity}
                min={0}
                max={5}
                step={0.1}
                onChange={(v) => onUpdateLighting({ rimIntensity: v })}
              />
              <SliderRow
                label="Ângulo Rim"
                value={state.lighting.rimAzimuth}
                min={-180}
                max={180}
                step={1}
                unit="°"
                onChange={(v) => onUpdateLighting({ rimAzimuth: v })}
              />
              <SliderRow
                label="Softboxes"
                value={state.lighting.softboxIntensity}
                min={0}
                max={5}
                step={0.1}
                onChange={(v) => onUpdateLighting({ softboxIntensity: v })}
              />
              <SliderRow
                label="Bloom (Glow)"
                value={state.lighting.bloomStrength}
                min={0}
                max={2.5}
                step={0.02}
                onChange={(v) => onUpdateLighting({ bloomStrength: v })}
              />
              <SliderRow
                label="Raio Bloom"
                value={state.lighting.bloomRadius}
                min={0}
                max={1.2}
                step={0.02}
                onChange={(v) => onUpdateLighting({ bloomRadius: v })}
              />
              <SliderRow
                label="Aberração Cromática"
                value={state.lighting.chromaticAberration}
                min={0}
                max={0.015}
                step={0.0005}
                onChange={(v) => onUpdateLighting({ chromaticAberration: v })}
              />
            </div>
          </div>
        )}

        {/* 4. LAYERS & MEDIA / GOOGLE FONTS TAB */}
        {activeTab === 'layers' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Layer Stack */}
            <div className="md:col-span-5 space-y-2 pr-2 border-r border-white/8">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onAddTextLayer}
                  className="flex-1 px-2.5 py-1.5 text-xs font-medium bg-white/8 hover:bg-white/14 text-zinc-100 rounded-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Type className="w-3.5 h-3.5 text-cyan-300" />
                  Adicionar Texto
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 px-2.5 py-1.5 text-xs font-medium bg-white/8 hover:bg-white/14 text-zinc-100 rounded-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-cyan-300" />
                  Upload Mídia
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      onUploadMedia(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />
              </div>

              <div className="space-y-1 max-h-[160px] overflow-y-auto studio-scroll">
                {state.layers.map((layer, index) => {
                  const isSel = layer.id === state.selectedLayerId;
                  return (
                    <div
                      key={layer.id}
                      onClick={() => onSelectLayer(layer.id)}
                      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                        isSel
                          ? 'bg-cyan-400/18 text-zinc-100 border border-cyan-400/40'
                          : 'bg-white/4 text-zinc-400 hover:bg-white/8 hover:text-zinc-200 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {layer.type === 'object3d' && (
                          <Sparkles className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                        )}
                        {layer.type === 'text' && (
                          <Type className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                        )}
                        {layer.type === 'image' && (
                          <ImageIcon className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                        )}
                        {layer.type === 'video' && (
                          <Video className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                        )}
                        <span className="truncate font-medium">{layer.name}</span>
                      </div>

                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => onMoveLayer(layer.id, 'up')}
                          title="Mover para frente"
                          className="p-1 hover:bg-white/10 rounded disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={index === state.layers.length - 1}
                          onClick={() => onMoveLayer(layer.id, 'down')}
                          title="Mover para trás"
                          className="p-1 hover:bg-white/10 rounded disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateLayer(layer.id, { visible: !layer.visible })
                          }
                          title="Alternar visibilidade"
                          className="p-1 hover:bg-white/10 rounded cursor-pointer"
                        >
                          {layer.visible ? (
                            <Eye className="w-3 h-3" />
                          ) : (
                            <EyeOff className="w-3 h-3 text-zinc-500" />
                          )}
                        </button>
                        {layer.type !== 'object3d' && (
                          <button
                            type="button"
                            onClick={() => onDeleteLayer(layer.id)}
                            title="Remover camada"
                            className="p-1 hover:bg-red-500/20 text-zinc-400 hover:text-red-300 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Layer Properties */}
            <div className="md:col-span-7 space-y-3">
              {selectedLayer ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <SliderRow
                      label="Opacidade"
                      value={selectedLayer.opacity}
                      min={0}
                      max={1}
                      step={0.02}
                      onChange={(v) =>
                        onUpdateLayer(selectedLayer.id, { opacity: v })
                      }
                    />
                    <SliderRow
                      label="Escala"
                      value={selectedLayer.scale}
                      min={0.1}
                      max={3.5}
                      step={0.05}
                      onChange={(v) =>
                        onUpdateLayer(selectedLayer.id, { scale: v })
                      }
                    />
                    <SliderRow
                      label="Rotação"
                      value={selectedLayer.rotation}
                      min={-180}
                      max={180}
                      step={1}
                      unit="°"
                      onChange={(v) =>
                        onUpdateLayer(selectedLayer.id, { rotation: v })
                      }
                    />
                    <SliderRow
                      label="Posição X"
                      value={selectedLayer.x}
                      min={-80}
                      max={80}
                      step={0.5}
                      unit="%"
                      onChange={(v) => onUpdateLayer(selectedLayer.id, { x: v })}
                    />
                    <SliderRow
                      label="Posição Y"
                      value={selectedLayer.y}
                      min={-80}
                      max={80}
                      step={0.5}
                      unit="%"
                      onChange={(v) => onUpdateLayer(selectedLayer.id, { y: v })}
                    />
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-zinc-400">Modo de Mesclagem</span>
                      <select
                        value={selectedLayer.blendMode}
                        onChange={(e) =>
                          onUpdateLayer(selectedLayer.id, {
                            blendMode: e.target.value as BlendModeOption,
                          })
                        }
                        className="bg-[#181a20] border border-white/15 rounded px-2 py-1 text-xs text-zinc-100"
                      >
                        {BLEND_MODES.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Text Layer Specific Controls (Google Fonts) */}
                  {selectedLayer.type === 'text' && (
                    <div className="pt-2 border-t border-white/8 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <textarea
                          rows={2}
                          value={(selectedLayer as TextLayer).text}
                          onChange={(e) =>
                            onUpdateLayer(selectedLayer.id, { text: e.target.value })
                          }
                          placeholder="Digite o texto da camada..."
                          className="w-full bg-[#181a20] border border-white/15 rounded-md px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-400"
                        />

                        <div className="space-y-1.5">
                          <select
                            value={(selectedLayer as TextLayer).fontFamily}
                            onChange={(e) => {
                              const fam = e.target.value;
                              void ensureGoogleFontLoaded(
                                fam,
                                (selectedLayer as TextLayer).fontWeight
                              );
                              onUpdateLayer(selectedLayer.id, { fontFamily: fam });
                            }}
                            className="w-full bg-[#181a20] border border-white/15 rounded px-2 py-1.5 text-xs text-zinc-100"
                          >
                            {CURATED_GOOGLE_FONTS.map((f) => (
                              <option key={f.family} value={f.family}>
                                {f.family} — {f.category}
                              </option>
                            ))}
                            {!CURATED_GOOGLE_FONTS.some(
                              (f) => f.family === (selectedLayer as TextLayer).fontFamily
                            ) && (
                              <option value={(selectedLayer as TextLayer).fontFamily}>
                                {(selectedLayer as TextLayer).fontFamily}
                              </option>
                            )}
                          </select>

                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={customFontInput}
                              onChange={(e) => setCustomFontInput(e.target.value)}
                              placeholder="Outra Google Font (ex: Michroma)"
                              className="flex-1 bg-[#181a20] border border-white/15 rounded px-2 py-1 text-xs text-zinc-100"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const fam = customFontInput.trim();
                                if (!fam) return;
                                void ensureGoogleFontLoaded(fam, 400);
                                onUpdateLayer(selectedLayer.id, { fontFamily: fam });
                                setCustomFontInput('');
                              }}
                              className="px-2.5 py-1 text-xs bg-white/10 hover:bg-white/20 text-zinc-100 rounded cursor-pointer"
                            >
                              Usar
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
                        <SliderRow
                          label="Tamanho"
                          value={(selectedLayer as TextLayer).fontSize}
                          min={16}
                          max={240}
                          step={2}
                          onChange={(v) =>
                            onUpdateLayer(selectedLayer.id, { fontSize: v })
                          }
                        />
                        <SliderRow
                          label="Tracking"
                          value={(selectedLayer as TextLayer).letterSpacing}
                          min={-0.1}
                          max={0.8}
                          step={0.02}
                          onChange={(v) =>
                            onUpdateLayer(selectedLayer.id, { letterSpacing: v })
                          }
                        />
                        <SliderRow
                          label="Contorno"
                          value={(selectedLayer as TextLayer).strokeWidth}
                          min={0}
                          max={8}
                          step={0.5}
                          onChange={(v) =>
                            onUpdateLayer(selectedLayer.id, { strokeWidth: v })
                          }
                        />
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                            <input
                              type="color"
                              value={(selectedLayer as TextLayer).color}
                              onChange={(e) =>
                                onUpdateLayer(selectedLayer.id, { color: e.target.value })
                              }
                              className="w-6 h-6 rounded bg-transparent border border-white/15"
                            />
                            Cor
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                            <input
                              type="color"
                              value={(selectedLayer as TextLayer).strokeColor}
                              onChange={(e) =>
                                onUpdateLayer(selectedLayer.id, {
                                  strokeColor: e.target.value,
                                })
                              }
                              className="w-6 h-6 rounded bg-transparent border border-white/15"
                            />
                            Borda
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateLayer(selectedLayer.id, {
                                textTransform:
                                  (selectedLayer as TextLayer).textTransform ===
                                  'uppercase'
                                    ? 'none'
                                    : 'uppercase',
                              })
                            }
                            className={`px-2 py-1 text-xs rounded cursor-pointer ${
                              (selectedLayer as TextLayer).textTransform ===
                              'uppercase'
                                ? 'bg-cyan-400/20 text-cyan-200'
                                : 'bg-white/6 text-zinc-400'
                            }`}
                          >
                            AA
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Image / Video Layer Specific Controls */}
                  {(selectedLayer.type === 'image' ||
                    selectedLayer.type === 'video') && (
                    <div className="pt-2 border-t border-white/8 grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="text-zinc-400">Enquadramento</span>
                        <select
                          value={(selectedLayer as MediaLayer).fitMode}
                          onChange={(e) =>
                            onUpdateLayer(selectedLayer.id, {
                              fitMode: e.target.value as MediaLayer['fitMode'],
                            })
                          }
                          className="bg-[#181a20] border border-white/15 rounded px-2 py-1 text-xs text-zinc-100"
                        >
                          <option value="cover">Preencher (Cover)</option>
                          <option value="contain">Conter (Contain)</option>
                          <option value="free">Livre</option>
                        </select>
                      </label>
                      <SliderRow
                        label="Contraste"
                        value={(selectedLayer as MediaLayer).filterContrast}
                        min={0.5}
                        max={2}
                        step={0.05}
                        onChange={(v) =>
                          onUpdateLayer(selectedLayer.id, { filterContrast: v })
                        }
                      />
                      <SliderRow
                        label="Saturação"
                        value={(selectedLayer as MediaLayer).filterSaturation}
                        min={0}
                        max={2.5}
                        step={0.05}
                        onChange={(v) =>
                          onUpdateLayer(selectedLayer.id, { filterSaturation: v })
                        }
                      />
                      {selectedLayer.type === 'image' && (
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = !(selectedLayer as MediaLayer)
                              .useAsEnvMap;
                            onSetEnvMapFromLayer(
                              nextVal ? (selectedLayer as MediaLayer).src : null,
                              selectedLayer.id
                            );
                          }}
                          className={`px-2.5 py-1.5 text-xs rounded-md cursor-pointer ${
                            (selectedLayer as MediaLayer).useAsEnvMap
                              ? 'bg-cyan-400 text-zinc-950 font-semibold'
                              : 'bg-white/8 text-zinc-300 hover:bg-white/14'
                          }`}
                        >
                          {(selectedLayer as MediaLayer).useAsEnvMap
                            ? 'Reflexo 3D Ativo'
                            : 'Usar como Reflexo 3D'}
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-zinc-400">
                  Selecione uma camada à esquerda para editar.
                </p>
              )}
            </div>
          </div>
        )}

        {/* 5. ANIMATION & CAMERA TAB */}
        {activeTab === 'animation' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-white/8">
              <span className="text-xs text-zinc-400 mr-1">Câmera:</span>
              {(
                [
                  { id: 'front', label: 'Frontal' },
                  { id: 'three-quarter', label: '3/4 Estúdio' },
                  { id: 'detail', label: 'Detalhe Close' },
                  { id: 'side', label: 'Perfil Lateral' },
                ] as Array<{ id: CameraPreset; label: string }>
              ).map((cam) => (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => onCameraPreset(cam.id)}
                  className="px-3 py-1.5 text-xs bg-white/6 hover:bg-white/12 text-zinc-200 rounded-md cursor-pointer"
                >
                  {cam.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
              <SliderRow
                label="Rotação Contínua"
                value={state.animation.spinSpeed}
                min={-2}
                max={2}
                step={0.05}
                onChange={(v) => onUpdateAnimation({ spinSpeed: v })}
              />
              <SliderRow
                label="Oscilação Orgânica"
                value={state.animation.waveMotion}
                min={0}
                max={1.5}
                step={0.02}
                onChange={(v) => onUpdateAnimation({ waveMotion: v })}
              />
              <SliderRow
                label="Pulso Fibra / Emissivo"
                value={state.animation.pulseSpeed}
                min={0}
                max={4}
                step={0.1}
                onChange={(v) => onUpdateAnimation({ pulseSpeed: v })}
              />
              <SliderRow
                label="Respiração (Escala)"
                value={state.animation.breatheAmount}
                min={0}
                max={0.4}
                step={0.01}
                onChange={(v) => onUpdateAnimation({ breatheAmount: v })}
              />
            </div>
          </div>
        )}

        {/* 6. EXPORT TAB */}
        {activeTab === 'export' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
            <div className="md:col-span-5 space-y-3">
              <div>
                <span className="block text-xs text-zinc-400 mb-1.5">
                  Proporção da Prancheta
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {ASPECT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdateExport({ aspect: opt.id })}
                      className={`px-3 py-1.5 text-xs rounded-md cursor-pointer ${
                        state.exportSettings.aspect === opt.id
                          ? 'bg-cyan-400 text-zinc-950 font-semibold'
                          : 'bg-white/6 text-zinc-300 hover:bg-white/12'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <span className="block text-xs text-zinc-400 mb-1">Resolução</span>
                  <div className="flex gap-1.5">
                    {(['1080p', '2k', '4k'] as const).map((res) => (
                      <button
                        key={res}
                        type="button"
                        onClick={() => onUpdateExport({ resolutionScale: res })}
                        className={`px-2.5 py-1 text-xs uppercase rounded cursor-pointer ${
                          state.exportSettings.resolutionScale === res
                            ? 'bg-zinc-100 text-zinc-950 font-semibold'
                            : 'bg-white/6 text-zinc-300'
                        }`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-xs text-zinc-400 mb-1">Formato Estático</span>
                  <div className="flex gap-1.5">
                    {(['png', 'jpeg', 'webp'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => onUpdateExport({ imageFormat: fmt })}
                        className={`px-2.5 py-1 text-xs uppercase rounded cursor-pointer ${
                          state.exportSettings.imageFormat === fmt
                            ? 'bg-zinc-100 text-zinc-950 font-semibold'
                            : 'bg-white/6 text-zinc-300'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-4 space-y-3">
              <SliderRow
                label="Duração do Vídeo"
                value={state.exportSettings.videoDuration}
                min={3}
                max={12}
                step={1}
                unit="s"
                onChange={(v) => onUpdateExport({ videoDuration: v })}
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Taxa de Quadros</span>
                <div className="flex gap-1.5">
                  {([30, 60] as const).map((fps) => (
                    <button
                      key={fps}
                      type="button"
                      onClick={() => onUpdateExport({ videoFps: fps })}
                      className={`px-2.5 py-1 text-xs rounded cursor-pointer ${
                        state.exportSettings.videoFps === fps
                          ? 'bg-zinc-100 text-zinc-950 font-semibold'
                          : 'bg-white/6 text-zinc-300'
                      }`}
                    >
                      {fps} FPS
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="md:col-span-3 flex flex-col gap-2">
              <button
                type="button"
                disabled={isExporting}
                onClick={onExportImage}
                className="w-full px-4 py-2 text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 rounded-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar Imagem ({state.exportSettings.resolutionScale.toUpperCase()})
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={onExportVideo}
                className="w-full px-4 py-2 text-xs font-semibold bg-cyan-400 hover:bg-cyan-300 text-zinc-950 rounded-md flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                <Video className="w-3.5 h-3.5" />
                {isExporting
                  ? `Gravando ${Math.round(exportProgress * 100)}%`
                  : `Exportar Vídeo (${state.exportSettings.videoDuration}s)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
