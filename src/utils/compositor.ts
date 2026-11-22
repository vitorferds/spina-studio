import {
  AspectPreset,
  MediaLayer,
  StudioLayer,
  StudioState,
  TextLayer,
} from '../types/studio';
import { SceneManager } from '../engine/SceneManager';
import { ensureGoogleFontLoaded } from './fonts';

export function getExportDimensions(
  aspect: AspectPreset,
  scale: '1080p' | '2k' | '4k',
  viewportW: number,
  viewportH: number
): { width: number; height: number } {
  const base = scale === '4k' ? 2160 : scale === '2k' ? 1440 : 1080;

  switch (aspect) {
    case '9:16':
      return {
        width: base,
        height: Math.round((base * 16) / 9),
      };
    case '1:1':
      return {
        width: Math.round(base * 1.25),
        height: Math.round(base * 1.25),
      };
    case '4:5':
      return {
        width: base,
        height: Math.round((base * 5) / 4),
      };
    case '16:9':
      return {
        width: Math.round((base * 16) / 9),
        height: base,
      };
    case 'viewport':
    default: {
      const ratio = viewportW / Math.max(1, viewportH);
      if (ratio >= 1) {
        return {
          width: Math.round(base * ratio),
          height: base,
        };
      }
      return {
        width: base,
        height: Math.round(base / ratio),
      };
    }
  }
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawMediaLayer(
  ctx: CanvasRenderingContext2D,
  layer: MediaLayer,
  el: HTMLImageElement | HTMLVideoElement,
  canvasW: number,
  canvasH: number
): void {
  const naturalW =
    el instanceof HTMLVideoElement ? el.videoWidth || 1080 : el.naturalWidth || 1080;
  const naturalH =
    el instanceof HTMLVideoElement ? el.videoHeight || 1080 : el.naturalHeight || 1080;

  let drawW = naturalW;
  let drawH = naturalH;

  if (layer.fitMode === 'cover') {
    const s = Math.max(canvasW / naturalW, canvasH / naturalH);
    drawW = naturalW * s;
    drawH = naturalH * s;
  } else if (layer.fitMode === 'contain') {
    const s = Math.min(canvasW / naturalW, canvasH / naturalH);
    drawW = naturalW * s;
    drawH = naturalH * s;
  } else {
    const s = (canvasW * 0.65) / Math.max(1, naturalW);
    drawW = naturalW * s;
    drawH = naturalH * s;
  }

  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.globalCompositeOperation = layer.blendMode;

  const cx = canvasW * 0.5 + (layer.x / 100) * canvasW;
  const cy = canvasH * 0.5 + (layer.y / 100) * canvasH;
  ctx.translate(cx, cy);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.scale(layer.scale, layer.scale);

  const blurPx = (layer.filterBlur * canvasW) / 1080;
  ctx.filter = `contrast(${layer.filterContrast}) saturate(${layer.filterSaturation}) blur(${blurPx}px)`;
  ctx.drawImage(el, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
  ctx.restore();
}

function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  canvasW: number,
  canvasH: number
): void {
  if (!layer.text.trim()) return;

  const scaleFactor = Math.min(canvasW, canvasH) / 1080;
  const fontSize = Math.max(8, layer.fontSize * scaleFactor);

  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.globalCompositeOperation = layer.blendMode;

  const cx = canvasW * 0.5 + (layer.x / 100) * canvasW;
  const cy = canvasH * 0.5 + (layer.y / 100) * canvasH;
  ctx.translate(cx, cy);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.scale(layer.scale, layer.scale);

  ctx.font = `${layer.fontWeight} ${fontSize}px "${layer.fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = layer.textAlign;

  if ('letterSpacing' in ctx) {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${layer.letterSpacing}em`;
  }

  let content = layer.text;
  if (layer.textTransform === 'uppercase') content = content.toUpperCase();
  if (layer.textTransform === 'lowercase') content = content.toLowerCase();

  const lines = content.split('\n');
  const lineH = fontSize * layer.lineHeight;
  const totalH = (lines.length - 1) * lineH;

  if (layer.glowAmount > 0) {
    ctx.shadowColor = layer.glowColor;
    ctx.shadowBlur = layer.glowAmount * scaleFactor * 2.2;
  }

  lines.forEach((line, idx) => {
    const yOffset = -totalH * 0.5 + idx * lineH;
    if (layer.strokeWidth > 0) {
      ctx.lineWidth = layer.strokeWidth * scaleFactor * 2;
      ctx.strokeStyle = layer.strokeColor;
      ctx.lineJoin = 'round';
      ctx.strokeText(line, 0, yOffset);
    }
    ctx.fillStyle = layer.color;
    ctx.fillText(line, 0, yOffset);
  });

  ctx.restore();
}

function paintBackdrop(
  ctx: CanvasRenderingContext2D,
  state: StudioState,
  w: number,
  h: number,
  allowTransparent: boolean
): void {
  const { bgMode, bgColor, bgSecondaryColor } = state.lighting;
  ctx.clearRect(0, 0, w, h);

  if (bgMode === 'transparent' && allowTransparent) {
    return;
  }

  if (bgMode === 'radial') {
    const grad = ctx.createRadialGradient(
      w * 0.5,
      h * 0.45,
      w * 0.04,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.72
    );
    grad.addColorStop(0, bgColor);
    grad.addColorStop(1, bgSecondaryColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = bgMode === 'transparent' ? '#090a0c' : bgColor;
    ctx.fillRect(0, 0, w, h);
  }
}

async function prepareLayerResources(
  layers: StudioLayer[],
  liveVideoElements: Map<string, HTMLVideoElement>
): Promise<Map<string, HTMLImageElement | HTMLVideoElement>> {
  const map = new Map<string, HTMLImageElement | HTMLVideoElement>();
  for (const layer of layers) {
    if (!layer.visible) continue;
    if (layer.type === 'text') {
      await ensureGoogleFontLoaded(layer.fontFamily, layer.fontWeight);
    } else if (layer.type === 'image') {
      try {
        const img = await loadImageElement(layer.src);
        map.set(layer.id, img);
      } catch {
        // Ignore unloaded media gracefully
      }
    } else if (layer.type === 'video') {
      const vid = liveVideoElements.get(layer.id);
      if (vid) {
        map.set(layer.id, vid);
      }
    }
  }
  return map;
}

function compositeAllLayers(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: StudioState,
  sceneManager: SceneManager,
  mediaResources: Map<string, HTMLImageElement | HTMLVideoElement>,
  allowTransparent: boolean,
  timeSeconds?: number
): void {
  paintBackdrop(ctx, state, w, h, allowTransparent);

  // layers[0] is topmost, layers[length - 1] is bottommost
  for (let i = state.layers.length - 1; i >= 0; i--) {
    const layer = state.layers[i];
    if (!layer.visible) continue;

    if (layer.type === 'object3d') {
      const webglCanvas = sceneManager.renderExportFrame(w, h, timeSeconds);
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode;
      ctx.drawImage(webglCanvas, 0, 0, w, h);
      ctx.restore();
    } else if (layer.type === 'text') {
      drawTextLayer(ctx, layer, w, h);
    } else if (layer.type === 'image' || layer.type === 'video') {
      const el = mediaResources.get(layer.id);
      if (el) {
        drawMediaLayer(ctx, layer, el, w, h);
      }
    }
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function exportStaticComposition(
  state: StudioState,
  sceneManager: SceneManager,
  liveVideoElements: Map<string, HTMLVideoElement>,
  viewportW: number,
  viewportH: number
): Promise<void> {
  const { aspect, resolutionScale, imageFormat } = state.exportSettings;
  const { width, height } = getExportDimensions(aspect, resolutionScale, viewportW, viewportH);

  const mediaResources = await prepareLayerResources(state.layers, liveVideoElements);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const allowTransparent = imageFormat !== 'jpeg';

  try {
    compositeAllLayers(
      ctx,
      width,
      height,
      state,
      sceneManager,
      mediaResources,
      allowTransparent
    );
  } finally {
    sceneManager.endExportMode();
  }

  const mime =
    imageFormat === 'jpeg'
      ? 'image/jpeg'
      : imageFormat === 'webp'
      ? 'image/webp'
      : 'image/png';

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), mime, 0.96)
  );
  if (blob) {
    triggerDownload(
      blob,
      `spina-${state.geometry.archetype}-${width}x${height}.${imageFormat}`
    );
  }
}

export async function exportVideoComposition(
  state: StudioState,
  sceneManager: SceneManager,
  liveVideoElements: Map<string, HTMLVideoElement>,
  viewportW: number,
  viewportH: number,
  onProgress: (progress: number) => void
): Promise<void> {
  const { aspect, resolutionScale, videoDuration, videoFps } = state.exportSettings;
  // Cap video capture resolution smoothly to keep MediaRecorder real-time responsive
  const capScale = resolutionScale === '4k' ? '2k' : resolutionScale;
  const { width, height } = getExportDimensions(aspect, capScale, viewportW, viewportH);

  const mediaResources = await prepareLayerResources(state.layers, liveVideoElements);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const mimeCandidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  const selectedMime =
    mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';
  const ext = selectedMime.includes('mp4') ? 'mp4' : 'webm';

  const stream = canvas.captureStream(videoFps);
  const recorder = new MediaRecorder(stream, {
    mimeType: selectedMime,
    videoBitsPerSecond: 14_000_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const completionPromise = new Promise<void>((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: selectedMime });
      triggerDownload(
        blob,
        `spina-${state.geometry.archetype}-${videoDuration}s.${ext}`
      );
      resolve();
    };
  });

  recorder.start(200);

  const startMs = performance.now();
  const durationMs = videoDuration * 1000;

  await new Promise<void>((resolveFrames) => {
    const step = () => {
      const elapsedMs = performance.now() - startMs;
      const progress = Math.min(1, elapsedMs / durationMs);
      onProgress(progress);

      compositeAllLayers(
        ctx,
        width,
        height,
        state,
        sceneManager,
        mediaResources,
        false,
        elapsedMs / 1000
      );

      if (elapsedMs < durationMs) {
        requestAnimationFrame(step);
      } else {
        resolveFrames();
      }
    };
    requestAnimationFrame(step);
  });

  sceneManager.endExportMode();
  recorder.stop();
  await completionPromise;
  onProgress(1);
}
