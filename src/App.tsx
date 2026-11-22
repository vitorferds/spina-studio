import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ARCHETYPE_PRESETS,
  ArchetypeId,
  INITIAL_STUDIO_STATE,
  MATERIAL_PRESETS,
  MaterialFinish,
  MediaLayer,
  Object3DLayer,
  StudioLayer,
  StudioState,
  TextLayer,
} from './types/studio';
import { CameraPreset, SceneManager } from './engine/SceneManager';
import { TopBar } from './components/TopBar';
import { LayerCanvasOverlay } from './components/LayerCanvasOverlay';
import { DockTab, StudioDock } from './components/StudioDock';
import { randomizeAggressive, randomizeLight } from './utils/randomizer';
import {
  exportStaticComposition,
  exportVideoComposition,
} from './utils/compositor';
import { ensureGoogleFontLoaded } from './utils/fonts';

export function App() {
  const [state, setState] = useState<StudioState>(INITIAL_STUDIO_STATE);
  const [activeTab, setActiveTab] = useState<DockTab>('geometry');
  const [collapsed, setCollapsed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [contextLost, setContextLost] = useState(false);

  const webglContainerRef = useRef<HTMLDivElement | null>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const objectUrlsRef = useRef<string[]>([]);

  // Initialize Three.js SceneManager once
  useEffect(() => {
    const container = webglContainerRef.current;
    if (!container) return;

    const manager = new SceneManager(
      container,
      INITIAL_STUDIO_STATE.geometry,
      INITIAL_STUDIO_STATE.material,
      INITIAL_STUDIO_STATE.lighting,
      INITIAL_STUDIO_STATE.animation,
      () => setContextLost(true)
    );
    sceneManagerRef.current = manager;

    const ro = new ResizeObserver(() => {
      if (container) {
        manager.resize(container.clientWidth, container.clientHeight);
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      manager.dispose();
      sceneManagerRef.current = null;
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, []);

  // Sync Geometry & Material changes
  useEffect(() => {
    sceneManagerRef.current?.rebuildObject(state.geometry, state.material);
  }, [state.geometry, state.material]);

  // Sync Lighting changes
  useEffect(() => {
    sceneManagerRef.current?.updateLighting(state.lighting);
  }, [state.lighting]);

  // Sync Animation changes
  useEffect(() => {
    sceneManagerRef.current?.updateAnimation(state.animation);
  }, [state.animation]);

  // Sync 3D Layer transform
  useEffect(() => {
    const objLayer = state.layers.find(
      (l): l is Object3DLayer => l.type === 'object3d'
    );
    sceneManagerRef.current?.updateObjectLayerTransform(objLayer);
  }, [state.layers]);

  // Keyboard shortcut 'H' to toggle HUD visibility
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSelectArchetype = useCallback((id: ArchetypeId) => {
    const preset = ARCHETYPE_PRESETS[id];
    setState((prev) => ({
      ...prev,
      geometry: { ...preset.geometry },
      material: { ...preset.material },
      lighting: { ...prev.lighting, ...preset.lighting },
    }));
  }, []);

  const handleSelectMaterialFinish = useCallback((finish: MaterialFinish) => {
    const preset = MATERIAL_PRESETS[finish];
    setState((prev) => ({
      ...prev,
      material: {
        finish,
        ...preset.values,
      },
    }));
  }, []);

  const handleAddTextLayer = useCallback(() => {
    const id = `layer-text-${Date.now()}`;
    void ensureGoogleFontLoaded('Syne', 700);
    const newLayer: TextLayer = {
      id,
      type: 'text',
      name: 'Texto Editorial',
      visible: true,
      opacity: 1,
      blendMode: 'difference',
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      text: 'EXPERIMENTAL',
      fontFamily: 'Syne',
      fontWeight: 700,
      fontSize: 96,
      letterSpacing: 0.08,
      lineHeight: 1.0,
      color: '#ffffff',
      textTransform: 'uppercase',
      textAlign: 'center',
      strokeWidth: 0,
      strokeColor: '#00ffd5',
      glowAmount: 0,
      glowColor: '#00ffd5',
    };
    setState((prev) => ({
      ...prev,
      layers: [newLayer, ...prev.layers],
      selectedLayerId: id,
    }));
  }, []);

  const handleUploadMedia = useCallback((files: FileList) => {
    const added: MediaLayer[] = [];
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.push(url);
      const isVideo = file.type.startsWith('video/');
      const id = `layer-media-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      added.push({
        id,
        type: isVideo ? 'video' : 'image',
        name: file.name,
        visible: true,
        opacity: 1,
        blendMode: 'source-over',
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        src: url,
        mediaWidth: 1080,
        mediaHeight: 1080,
        fitMode: 'cover',
        filterContrast: 1,
        filterSaturation: 1,
        filterBlur: 0,
        useAsEnvMap: false,
      });
    });

    if (added.length > 0) {
      setState((prev) => ({
        ...prev,
        // Insert uploaded media behind the 3D object by default so it frames nicely
        layers: [...prev.layers, ...added],
        selectedLayerId: added[0].id,
      }));
    }
  }, []);

  const handleUpdateLayer = useCallback(
    (id: string, patch: Partial<StudioLayer>) => {
      setState((prev) => ({
        ...prev,
        layers: prev.layers.map((l) =>
          l.id === id ? ({ ...l, ...patch } as StudioLayer) : l
        ),
      }));
    },
    []
  );

  const handleMoveLayer = useCallback((id: string, dir: 'up' | 'down') => {
    setState((prev) => {
      const idx = prev.layers.findIndex((l) => l.id === id);
      if (idx === -1) return prev;
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.layers.length) return prev;
      const next = [...prev.layers];
      const [item] = next.splice(idx, 1);
      next.splice(targetIdx, 0, item);
      return { ...prev, layers: next };
    });
  }, []);

  const handleDeleteLayer = useCallback((id: string) => {
    setState((prev) => {
      const target = prev.layers.find((l) => l.id === id);
      if (!target || target.type === 'object3d') return prev;
      const nextLayers = prev.layers.filter((l) => l.id !== id);
      return {
        ...prev,
        layers: nextLayers,
        selectedLayerId:
          prev.selectedLayerId === id
            ? nextLayers[0]?.id || 'layer-3d-main'
            : prev.selectedLayerId,
      };
    });
  }, []);

  const handleSetEnvMapFromLayer = useCallback(
    (src: string | null, layerId: string) => {
      sceneManagerRef.current?.setCustomEnvMap(src);
      setState((prev) => ({
        ...prev,
        layers: prev.layers.map((l) =>
          l.type === 'image'
            ? { ...l, useAsEnvMap: l.id === layerId && src !== null }
            : l
        ),
      }));
    },
    []
  );

  const handleRandomLight = useCallback(() => {
    setState((prev) => randomizeLight(prev));
  }, []);

  const handleRandomAggressive = useCallback(() => {
    setState((prev) => randomizeAggressive(prev));
  }, []);

  const handleCameraPreset = useCallback((preset: CameraPreset) => {
    sceneManagerRef.current?.resetCamera(preset);
  }, []);

  const handleExportImage = useCallback(async () => {
    const manager = sceneManagerRef.current;
    const container = webglContainerRef.current;
    if (!manager || !container || isExporting) return;
    setIsExporting(true);
    try {
      await exportStaticComposition(
        state,
        manager,
        videoElementsRef.current,
        container.clientWidth,
        container.clientHeight
      );
    } finally {
      setIsExporting(false);
    }
  }, [state, isExporting]);

  const handleExportVideo = useCallback(async () => {
    const manager = sceneManagerRef.current;
    const container = webglContainerRef.current;
    if (!manager || !container || isExporting) return;
    setIsExporting(true);
    setExportProgress(0);
    try {
      await exportVideoComposition(
        state,
        manager,
        videoElementsRef.current,
        container.clientWidth,
        container.clientHeight,
        (p) => setExportProgress(p)
      );
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [state, isExporting]);

  return (
    <div className="relative w-screen h-screen bg-[#060709] text-zinc-100 overflow-hidden select-none">
      <TopBar
        activeArchetype={state.geometry.archetype}
        onSelectArchetype={handleSelectArchetype}
        onOpenExport={() => {
          setCollapsed(false);
          setActiveTab('export');
        }}
      />

      <main className="w-full h-full">
        {contextLost ? (
          <div className="fixed inset-0 pt-14 flex flex-col items-center justify-center bg-[#090a0c] text-center px-6">
            <h1 className="font-display text-2xl font-bold text-zinc-100 mb-2">
              Contexto WebGL interrompido
            </h1>
            <p className="text-sm text-zinc-400 max-w-md mb-4">
              O navegador suspendeu a renderização 3D para liberar recursos gráficos.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold bg-cyan-400 text-zinc-950 rounded-md cursor-pointer"
            >
              Recarregar Estúdio
            </button>
          </div>
        ) : (
          <LayerCanvasOverlay
            layers={state.layers}
            selectedLayerId={state.selectedLayerId}
            lighting={state.lighting}
            aspect={state.exportSettings.aspect}
            videoElementsRef={videoElementsRef}
            onUpdateLayerPos={(id, x, y) => handleUpdateLayer(id, { x, y })}
            webglContainerRef={webglContainerRef}
          />
        )}
      </main>

      <StudioDock
        state={state}
        activeTab={activeTab}
        collapsed={collapsed}
        isExporting={isExporting}
        exportProgress={exportProgress}
        onChangeTab={setActiveTab}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        onUpdateGeometry={(patch) =>
          setState((prev) => ({
            ...prev,
            geometry: { ...prev.geometry, ...patch },
          }))
        }
        onUpdateMaterial={(patch) =>
          setState((prev) => ({
            ...prev,
            material: { ...prev.material, ...patch },
          }))
        }
        onSelectMaterialFinish={handleSelectMaterialFinish}
        onUpdateLighting={(patch) =>
          setState((prev) => ({
            ...prev,
            lighting: { ...prev.lighting, ...patch },
          }))
        }
        onUpdateAnimation={(patch) =>
          setState((prev) => ({
            ...prev,
            animation: { ...prev.animation, ...patch },
          }))
        }
        onUpdateExport={(patch) =>
          setState((prev) => ({
            ...prev,
            exportSettings: { ...prev.exportSettings, ...patch },
          }))
        }
        onSelectLayer={(id) =>
          setState((prev) => ({ ...prev, selectedLayerId: id }))
        }
        onUpdateLayer={handleUpdateLayer}
        onMoveLayer={handleMoveLayer}
        onDeleteLayer={handleDeleteLayer}
        onAddTextLayer={handleAddTextLayer}
        onUploadMedia={handleUploadMedia}
        onSetEnvMapFromLayer={handleSetEnvMapFromLayer}
        onRandomLight={handleRandomLight}
        onRandomAggressive={handleRandomAggressive}
        onCameraPreset={handleCameraPreset}
        onExportImage={handleExportImage}
        onExportVideo={handleExportVideo}
      />
    </div>
  );
}

export default App;
