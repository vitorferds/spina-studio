import React, { useEffect, useRef } from 'react';
import {
  AspectPreset,
  LightingParams,
  MediaLayer,
  StudioLayer,
  TextLayer,
} from '../types/studio';
import { ensureGoogleFontLoaded } from '../utils/fonts';

interface LayerCanvasOverlayProps {
  layers: StudioLayer[];
  selectedLayerId: string;
  lighting: LightingParams;
  aspect: AspectPreset;
  videoElementsRef: React.MutableRefObject<Map<string, HTMLVideoElement>>;
  onUpdateLayerPos: (id: string, x: number, y: number) => void;
  webglContainerRef: React.RefObject<HTMLDivElement | null>;
}

function getCssBlendMode(mode: StudioLayer['blendMode']): React.CSSProperties['mixBlendMode'] {
  switch (mode) {
    case 'source-over':
      return 'normal';
    case 'screen':
      return 'screen';
    case 'multiply':
      return 'multiply';
    case 'overlay':
      return 'overlay';
    case 'difference':
      return 'difference';
    case 'exclusion':
      return 'exclusion';
    case 'lighten':
      return 'lighten';
    case 'color-dodge':
      return 'color-dodge';
    default:
      return 'normal';
  }
}

function getAspectStyle(aspect: AspectPreset): React.CSSProperties {
  switch (aspect) {
    case '9:16':
      return { aspectRatio: '9 / 16', height: 'calc(100vh - 10rem)', maxWidth: '92vw' };
    case '1:1':
      return { aspectRatio: '1 / 1', height: 'calc(100vh - 10rem)', maxWidth: '92vw' };
    case '4:5':
      return { aspectRatio: '4 / 5', height: 'calc(100vh - 10rem)', maxWidth: '92vw' };
    case '16:9':
      return { aspectRatio: '16 / 9', width: 'min(92vw, 1280px)', maxHeight: 'calc(100vh - 10rem)' };
    case 'viewport':
    default:
      return { width: '100%', height: '100%' };
  }
}

export const LayerCanvasOverlay: React.FC<LayerCanvasOverlayProps> = ({
  layers,
  selectedLayerId,
  lighting,
  aspect,
  videoElementsRef,
  onUpdateLayerPos,
  webglContainerRef,
}) => {
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  // Load Google fonts for any active text layers
  useEffect(() => {
    layers.forEach((l) => {
      if (l.type === 'text') {
        void ensureGoogleFontLoaded(l.fontFamily, l.fontWeight);
      }
    });
  }, [layers]);

  const object3dIndex = layers.findIndex((l) => l.type === 'object3d');
  const object3dLayer = layers[object3dIndex];

  // layers[0] = top (foreground), layers[length - 1] = bottom (background)
  const foregroundLayers = layers.slice(0, Math.max(0, object3dIndex)).reverse();
  const backgroundLayers = layers.slice(Math.max(0, object3dIndex + 1)).reverse();

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const is2DSelected = selectedLayer && selectedLayer.type !== 'object3d';

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!is2DSelected || !selectedLayer) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      id: selectedLayer.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: selectedLayer.x,
      origY: selectedLayer.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragRef.current.startX) / Math.max(1, rect.width)) * 100;
    const dy = ((e.clientY - dragRef.current.startY) / Math.max(1, rect.height)) * 100;
    onUpdateLayerPos(
      dragRef.current.id,
      Math.max(-100, Math.min(100, Number((dragRef.current.origX + dx).toFixed(1)))),
      Math.max(-100, Math.min(100, Number((dragRef.current.origY + dy).toFixed(1))))
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      dragRef.current = null;
    }
  };

  const backdropStyle: React.CSSProperties =
    lighting.bgMode === 'transparent'
      ? {
          backgroundImage:
            'linear-gradient(45deg, #16181d 25%, transparent 25%), linear-gradient(-45deg, #16181d 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #16181d 75%), linear-gradient(-45deg, transparent 75%, #16181d 75%)',
          backgroundSize: '24px 24px',
          backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0',
          backgroundColor: '#0e1014',
        }
      : lighting.bgMode === 'radial'
      ? {
          background: `radial-gradient(circle at 50% 45%, ${lighting.bgColor} 0%, ${lighting.bgSecondaryColor} 78%)`,
        }
      : {
          backgroundColor: lighting.bgColor,
        };

  const renderLayerItem = (layer: StudioLayer) => {
    if (!layer.visible) return null;

    const commonStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${50 + layer.x}%`,
      top: `${50 + layer.y}%`,
      transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale})`,
      opacity: layer.opacity,
      mixBlendMode: getCssBlendMode(layer.blendMode),
      pointerEvents: 'none',
    };

    if (layer.type === 'text') {
      const tLayer = layer as TextLayer;
      const frameH = frameRef.current?.clientHeight || 800;
      const frameW = frameRef.current?.clientWidth || 1200;
      const scaleRatio = Math.min(frameW, frameH) / 1080;

      return (
        <div
          key={layer.id}
          style={{
            ...commonStyle,
            fontFamily: `"${tLayer.fontFamily}", sans-serif`,
            fontWeight: tLayer.fontWeight,
            fontSize: `${Math.max(10, tLayer.fontSize * scaleRatio)}px`,
            letterSpacing: `${tLayer.letterSpacing}em`,
            lineHeight: tLayer.lineHeight,
            color: tLayer.color,
            textTransform: tLayer.textTransform,
            textAlign: tLayer.textAlign,
            whiteSpace: 'pre',
            WebkitTextStroke:
              tLayer.strokeWidth > 0
                ? `${tLayer.strokeWidth * scaleRatio}px ${tLayer.strokeColor}`
                : undefined,
            textShadow:
              tLayer.glowAmount > 0
                ? `0 0 ${tLayer.glowAmount * scaleRatio * 2}px ${tLayer.glowColor}`
                : undefined,
          }}
        >
          {tLayer.text}
        </div>
      );
    }

    if (layer.type === 'image') {
      const mLayer = layer as MediaLayer;
      const filter = `contrast(${mLayer.filterContrast}) saturate(${mLayer.filterSaturation}) blur(${mLayer.filterBlur}px)`;
      const sizeClass =
        mLayer.fitMode === 'cover'
          ? 'w-full h-full object-cover'
          : mLayer.fitMode === 'contain'
          ? 'w-full h-full object-contain'
          : 'w-[65%] h-auto object-contain';

      return (
        <img
          key={layer.id}
          src={mLayer.src}
          alt={mLayer.name}
          referrerPolicy="no-referrer"
          style={{ ...commonStyle, filter }}
          className={sizeClass}
        />
      );
    }

    if (layer.type === 'video') {
      const mLayer = layer as MediaLayer;
      const filter = `contrast(${mLayer.filterContrast}) saturate(${mLayer.filterSaturation}) blur(${mLayer.filterBlur}px)`;
      const sizeClass =
        mLayer.fitMode === 'cover'
          ? 'w-full h-full object-cover'
          : mLayer.fitMode === 'contain'
          ? 'w-full h-full object-contain'
          : 'w-[65%] h-auto object-contain';

      return (
        <video
          key={layer.id}
          ref={(el) => {
            if (el) videoElementsRef.current.set(layer.id, el);
            else videoElementsRef.current.delete(layer.id);
          }}
          src={mLayer.src}
          autoPlay
          loop
          muted
          playsInline
          style={{ ...commonStyle, filter }}
          className={sizeClass}
        />
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 pt-14 flex items-center justify-center bg-[#060709] overflow-hidden">
      <div
        ref={frameRef}
        style={{
          ...getAspectStyle(aspect),
          ...backdropStyle,
        }}
        className={`relative overflow-hidden ${
          aspect !== 'viewport'
            ? 'border border-white/15 shadow-2xl'
            : ''
        }`}
      >
        {/* Background 2D / Media / Text Layers */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {backgroundLayers.map(renderLayerItem)}
        </div>

        {/* Dedicated 3D WebGL Mount Container */}
        <div
          ref={webglContainerRef}
          style={{
            opacity: object3dLayer?.visible ? object3dLayer.opacity : 0,
            mixBlendMode: object3dLayer
              ? getCssBlendMode(object3dLayer.blendMode)
              : 'normal',
          }}
          className="absolute inset-0 w-full h-full"
        />

        {/* Foreground 2D / Media / Text Layers */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {foregroundLayers.map(renderLayerItem)}
        </div>

        {/* Interactive Drag Surface when a Text or Media layer is selected */}
        {is2DSelected && (
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            title="Arraste para mover a camada selecionada"
            className="absolute inset-0 cursor-move z-10"
          />
        )}
      </div>
    </div>
  );
};
