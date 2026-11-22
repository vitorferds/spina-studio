import * as THREE from 'three';
import { MaterialParams } from '../types/studio';

export interface PulseShaderUniforms {
  uPulseTime: { value: number };
  uPulseSpeed: { value: number };
}

export interface StudioMaterialBundle {
  primary: THREE.MeshPhysicalMaterial;
  secondary: THREE.MeshPhysicalMaterial;
  emissive: THREE.MeshPhysicalMaterial;
  pulseUniforms: PulseShaderUniforms;
  dispose: () => void;
}

// Generate a procedural longitudinal fibrous texture (like organic bone/thorn stem or brushed metal)
function createStriatedTextures(): {
  fibrousBump: THREE.CanvasTexture;
  fibrousAlbedo: THREE.CanvasTexture;
} {
  const w = 256;
  const h = 512;

  // Bump map (linear data)
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = w;
  bumpCanvas.height = h;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, w, h);

  // Albedo variation map (sRGB)
  const colCanvas = document.createElement('canvas');
  colCanvas.width = w;
  colCanvas.height = h;
  const cCtx = colCanvas.getContext('2d')!;
  cCtx.fillStyle = '#ffffff';
  cCtx.fillRect(0, 0, w, h);

  // Draw organic longitudinal striations
  for (let i = 0; i < 160; i++) {
    const x = (i / 160) * w + (Math.sin(i * 3.1) * 2);
    const width = 0.8 + (i % 4) * 0.7;
    const shade = 95 + Math.floor(Math.sin(i * 1.7) * 55 + Math.cos(i * 4.3) * 35);
    bCtx.strokeStyle = `rgb(${shade},${shade},${shade})`;
    bCtx.lineWidth = width;
    bCtx.beginPath();
    bCtx.moveTo(x, 0);
    for (let y = 0; y <= h; y += 32) {
      bCtx.lineTo(x + Math.sin(y * 0.03 + i) * 2.2, y);
    }
    bCtx.stroke();

    const tint = 215 + Math.floor(Math.sin(i * 2.3) * 30);
    cCtx.strokeStyle = `rgba(${tint},${tint - 4},${tint - 8},0.35)`;
    cCtx.lineWidth = width;
    cCtx.beginPath();
    cCtx.moveTo(x, 0);
    for (let y = 0; y <= h; y += 32) {
      cCtx.lineTo(x + Math.sin(y * 0.03 + i) * 2.2, y);
    }
    cCtx.stroke();
  }

  const fibrousBump = new THREE.CanvasTexture(bumpCanvas);
  fibrousBump.wrapS = THREE.RepeatWrapping;
  fibrousBump.wrapT = THREE.RepeatWrapping;
  fibrousBump.repeat.set(2, 3);
  fibrousBump.colorSpace = THREE.NoColorSpace;

  const fibrousAlbedo = new THREE.CanvasTexture(colCanvas);
  fibrousAlbedo.wrapS = THREE.RepeatWrapping;
  fibrousAlbedo.wrapT = THREE.RepeatWrapping;
  fibrousAlbedo.repeat.set(2, 3);
  fibrousAlbedo.colorSpace = THREE.SRGBColorSpace;

  return { fibrousBump, fibrousAlbedo };
}

export function createStudioMaterialBundle(
  params: MaterialParams,
  isSoftwareGl: boolean
): StudioMaterialBundle {
  const { fibrousBump, fibrousAlbedo } = createStriatedTextures();
  const isOrganic = params.finish === 'organic-bone';
  const isGlass = params.finish === 'frosted-crystal';
  const isBrushed = params.finish === 'brushed-titanium';

  const pulseUniforms: PulseShaderUniforms = {
    uPulseTime: { value: 0 },
    uPulseSpeed: { value: 1.4 },
  };

  const primary = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(params.baseColor),
    metalness: isGlass ? 0.05 : params.metalness,
    roughness: params.roughness,
    clearcoat: params.clearcoat,
    clearcoatRoughness: Math.max(0.03, params.roughness * 0.4),
    iridescence: params.iridescence,
    iridescenceIOR: 1.42,
    envMapIntensity: params.envIntensity,
    anisotropy: isBrushed ? 0.85 : 0.15,
    anisotropyRotation: Math.PI / 2,
    map: isOrganic ? fibrousAlbedo : null,
    bumpMap: isOrganic || isBrushed ? fibrousBump : null,
    bumpScale: isOrganic ? 0.028 : isBrushed ? 0.008 : 0,
    transmission: isGlass && !isSoftwareGl ? 0.88 : 0,
    transparent: isGlass,
    opacity: isGlass ? (isSoftwareGl ? 0.42 : 1.0) : 1.0,
    ior: isGlass ? 1.65 : 1.5,
    thickness: isGlass ? 1.4 : 0,
    attenuationColor: new THREE.Color(params.accentColor),
    attenuationDistance: 1.8,
  });

  // Secondary contrast material (for joints, collars, inner ribs, thorn tips)
  const secondary = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(params.accentColor),
    metalness: isGlass ? 0.15 : Math.min(1, params.metalness + 0.08),
    roughness: Math.min(1, Math.max(0.04, params.roughness + (isOrganic ? -0.15 : 0.12))),
    clearcoat: params.clearcoat * 0.8,
    iridescence: params.iridescence * 0.7,
    envMapIntensity: params.envIntensity * 1.1,
    bumpMap: isOrganic ? fibrousBump : null,
    bumpScale: isOrganic ? 0.02 : 0,
  });

  // Emissive material with traveling optical energy wave via onBeforeCompile
  const emissive = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(params.emissiveColor).multiplyScalar(0.35),
    emissive: new THREE.Color(params.emissiveColor),
    emissiveIntensity: Math.max(0.15, params.emissiveIntensity),
    metalness: 0.2,
    roughness: 0.18,
    clearcoat: 1.0,
    envMapIntensity: params.envIntensity,
  });

  emissive.onBeforeCompile = (shader) => {
    shader.uniforms.uPulseTime = pulseUniforms.uPulseTime;
    shader.uniforms.uPulseSpeed = pulseUniforms.uPulseSpeed;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec2 vFiberUv;
         varying vec3 vLocalPos;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vFiberUv = uv;
         vLocalPos = position;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uPulseTime;
         uniform float uPulseSpeed;
         varying vec2 vFiberUv;
         varying vec3 vLocalPos;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         float waveCoord = vFiberUv.x * 12.0 + vLocalPos.y * 1.4;
         float pulse = 0.65 + 0.55 * sin(waveCoord - uPulseTime * uPulseSpeed * 3.0);
         totalEmissiveRadiance *= pulse;`
      );
  };
  emissive.customProgramCacheKey = () => 'spina-pulse-emissive-v1';

  return {
    primary,
    secondary,
    emissive,
    pulseUniforms,
    dispose: () => {
      fibrousBump.dispose();
      fibrousAlbedo.dispose();
      primary.dispose();
      secondary.dispose();
      emissive.dispose();
    },
  };
}
