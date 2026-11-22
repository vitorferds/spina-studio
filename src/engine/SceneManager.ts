import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  AnimationParams,
  GeometryParams,
  LightingParams,
  MaterialParams,
  Object3DLayer,
} from '../types/studio';
import { createStudioMaterialBundle, StudioMaterialBundle } from './materials';
import { disposeObject3D, generateThreadObject } from './generators';

const ChromaticShader = {
  uniforms: {
    tDiffuse: { value: null },
    uAmount: { value: 0.0012 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    varying vec2 vUv;
    void main() {
      vec2 dir = vUv - 0.5;
      float dist = length(dir);
      vec2 offset = dir * uAmount * dist * 2.2;
      float r = texture2D(tDiffuse, vUv - offset).r;
      vec4 center = texture2D(tDiffuse, vUv);
      float b = texture2D(tDiffuse, vUv + offset).b;
      gl_FragColor = vec4(r, center.g, b, center.a);
    }
  `,
};

export type CameraPreset = 'front' | 'three-quarter' | 'detail' | 'side';

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class SceneManager {
  public readonly isSoftwareGl: boolean;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly controls: OrbitControls;

  private container: HTMLElement;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private chromaPass: ShaderPass | null = null;

  private pmremGenerator: THREE.PMREMGenerator;
  private defaultEnvTexture: THREE.Texture;
  private customEnvTexture: THREE.Texture | null = null;

  private keyLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private fillLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private softboxLeft: THREE.RectAreaLight | null = null;
  private softboxRight: THREE.RectAreaLight | null = null;

  private threadContainer: THREE.Group;
  private threadMeshGroup: THREE.Group | null = null;
  private materialBundle: StudioMaterialBundle | null = null;

  private animParams: AnimationParams;
  private clock = new THREE.Clock();
  private elapsed = 0;
  private frameId = 0;
  private isDisposed = false;
  private isExporting = false;

  // Smooth camera preset transition state
  private camTransition: {
    active: boolean;
    targetPos: THREE.Vector3;
    targetLook: THREE.Vector3;
  } = {
    active: false,
    targetPos: new THREE.Vector3(0, 0, 10.5),
    targetLook: new THREE.Vector3(0, 0, 0),
  };

  private baseLayerTransform = {
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
  };

  constructor(
    container: HTMLElement,
    initialGeo: GeometryParams,
    initialMat: MaterialParams,
    initialLight: LightingParams,
    initialAnim: AnimationParams,
    onContextLost?: () => void
  ) {
    this.container = container;
    this.animParams = { ...initialAnim };
    this.isSoftwareGl = detectSoftwareGl();

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    if (onContextLost) {
      this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        onContextLost();
      });
    }

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 150);
    this.camera.position.set(0, 0.4, 10.8);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 32;
    this.controls.addEventListener('start', () => {
      this.camTransition.active = false;
    });

    // Studio Environment Map (RoomEnvironment)
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.defaultEnvTexture = this.pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.035
    ).texture;
    this.scene.environment = this.defaultEnvTexture;

    // 3-Point Studio Lighting + RectArea Softboxes on GPU
    this.hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 0.55);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 35;
    const d = 7;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0x94a3b8, 0.9);
    this.fillLight.position.set(-7, 2, 6);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(0xffffff, 2.4);
    this.scene.add(this.rimLight);

    if (!this.isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      this.softboxLeft = new THREE.RectAreaLight(0xffffff, 2.2, 5, 11);
      this.softboxLeft.position.set(-6.5, 1.5, 4.5);
      this.softboxLeft.lookAt(0, 0, 0);
      this.scene.add(this.softboxLeft);

      this.softboxRight = new THREE.RectAreaLight(0xe2e8f0, 1.8, 4.5, 10);
      this.softboxRight.position.set(6.5, -1.0, 3.5);
      this.softboxRight.lookAt(0, 0, 0);
      this.scene.add(this.softboxRight);
    }

    // Thread container
    this.threadContainer = new THREE.Group();
    this.scene.add(this.threadContainer);

    // Post-processing Composer (GPU only; Software GL skips multi-pass bottlenecks)
    if (!this.isSoftwareGl) {
      const renderTarget = new THREE.WebGLRenderTarget(width, height, {
        type: THREE.HalfFloatType,
        samples: 4,
      });
      this.composer = new EffectComposer(this.renderer, renderTarget);
      this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.composer.setSize(width, height);

      this.composer.addPass(new RenderPass(this.scene, this.camera));

      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        initialLight.bloomStrength,
        initialLight.bloomRadius,
        initialLight.bloomThreshold
      );
      this.composer.addPass(this.bloomPass);

      this.chromaPass = new ShaderPass(ChromaticShader);
      this.chromaPass.uniforms.uAmount.value = initialLight.chromaticAberration;
      this.composer.addPass(this.chromaPass);

      this.composer.addPass(new OutputPass());
    }

    // Build initial geometry, materials, and lighting
    this.rebuildObject(initialGeo, initialMat);
    this.updateLighting(initialLight);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.startLoop();
  }

  public rebuildObject(geo: GeometryParams, mat: MaterialParams): void {
    if (this.threadMeshGroup) {
      disposeObject3D(this.threadMeshGroup);
      this.threadContainer.remove(this.threadMeshGroup);
      this.threadMeshGroup = null;
    }
    if (this.materialBundle) {
      this.materialBundle.dispose();
      this.materialBundle = null;
    }

    this.materialBundle = createStudioMaterialBundle(mat, this.isSoftwareGl);
    this.materialBundle.pulseUniforms.uPulseSpeed.value = this.animParams.pulseSpeed;
    this.threadMeshGroup = generateThreadObject(geo, this.materialBundle);
    this.threadContainer.add(this.threadMeshGroup);
  }

  public updateMaterialOnly(geo: GeometryParams, mat: MaterialParams): void {
    // Rebuilding with fresh material bundle ensures textures/clearcoat/emissive stay consistent
    this.rebuildObject(geo, mat);
  }

  public updateLighting(light: LightingParams): void {
    // Spherical coordinates for Key Light
    const az = THREE.MathUtils.degToRad(light.keyAzimuth);
    const el = THREE.MathUtils.degToRad(light.keyElevation);
    const dist = 12;
    this.keyLight.position.set(
      dist * Math.cos(el) * Math.sin(az),
      dist * Math.sin(el),
      dist * Math.cos(el) * Math.cos(az)
    );
    this.keyLight.color.set(light.keyColor);
    this.keyLight.intensity = light.keyIntensity;

    // Fill & Hemisphere
    this.fillLight.color.set(light.fillColor);
    this.fillLight.intensity = light.fillIntensity;
    this.hemiLight.color.set(light.fillColor);
    this.hemiLight.intensity = Math.max(0.15, light.fillIntensity * 0.45);

    // Rim Light
    const rimAz = THREE.MathUtils.degToRad(light.rimAzimuth);
    this.rimLight.position.set(
      11 * Math.sin(rimAz),
      4.5,
      11 * Math.cos(rimAz)
    );
    this.rimLight.color.set(light.rimColor);
    this.rimLight.intensity = light.rimIntensity;

    // Softboxes
    if (this.softboxLeft && this.softboxRight) {
      this.softboxLeft.intensity = light.softboxIntensity;
      this.softboxLeft.color.set(light.keyColor);
      this.softboxRight.intensity = light.softboxIntensity * 0.8;
      this.softboxRight.color.set(light.rimColor);
    }

    // Post-processing
    if (this.bloomPass) {
      this.bloomPass.strength = light.bloomStrength;
      this.bloomPass.radius = light.bloomRadius;
      this.bloomPass.threshold = light.bloomThreshold;
    }
    if (this.chromaPass) {
      this.chromaPass.uniforms.uAmount.value = light.chromaticAberration;
    }
  }

  public updateAnimation(anim: AnimationParams): void {
    this.animParams = { ...anim };
    if (this.materialBundle) {
      this.materialBundle.pulseUniforms.uPulseSpeed.value = anim.pulseSpeed;
    }
  }

  public updateObjectLayerTransform(layer?: Object3DLayer): void {
    if (!layer) return;
    this.baseLayerTransform = {
      x: layer.x,
      y: layer.y,
      scale: layer.scale,
      rotation: layer.rotation,
    };
  }

  public setCustomEnvMap(imageSrc: string | null): void {
    if (!imageSrc) {
      if (this.customEnvTexture) {
        this.customEnvTexture.dispose();
        this.customEnvTexture = null;
      }
      this.scene.environment = this.defaultEnvTexture;
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.load(imageSrc, (tex) => {
      if (this.isDisposed) {
        tex.dispose();
        return;
      }
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      const env = this.pmremGenerator.fromEquirectangular(tex).texture;
      tex.dispose();
      if (this.customEnvTexture) {
        this.customEnvTexture.dispose();
      }
      this.customEnvTexture = env;
      this.scene.environment = env;
    });
  }

  public resetCamera(preset: CameraPreset): void {
    this.camTransition.active = true;
    this.camTransition.targetLook.set(0, 0, 0);
    switch (preset) {
      case 'front':
        this.camTransition.targetPos.set(0, 0.3, 10.8);
        break;
      case 'three-quarter':
        this.camTransition.targetPos.set(6.2, 2.2, 8.8);
        break;
      case 'detail':
        this.camTransition.targetPos.set(1.6, 0.6, 5.2);
        break;
      case 'side':
        this.camTransition.targetPos.set(10.5, 0.4, 0.2);
        break;
    }
  }

  public resize(width?: number, height?: number): void {
    const w = Math.max(1, width ?? this.container.clientWidth);
    const h = Math.max(1, height ?? this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setSize(w, h);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(w, h);
    }
  }

  // Apply dynamic animation state for current elapsed time
  private applyFrameTransforms(elapsed: number): void {
    const t = elapsed;
    const { spinSpeed, waveMotion, breatheAmount } = this.animParams;

    // Apply layer position / scale / rotation + subtle live animation
    const offsetX = (this.baseLayerTransform.x / 100) * 6.0;
    const offsetY = -(this.baseLayerTransform.y / 100) * 6.0;
    this.threadContainer.position.set(offsetX, offsetY, 0);

    const breathe = 1 + Math.sin(t * 1.8) * breatheAmount;
    const baseScale = this.baseLayerTransform.scale;
    this.threadContainer.scale.set(
      baseScale * breathe,
      baseScale * (1 + Math.cos(t * 1.4) * breatheAmount * 0.4),
      baseScale * breathe
    );

    const baseRotZ = THREE.MathUtils.degToRad(this.baseLayerTransform.rotation);
    this.threadContainer.rotation.y = t * spinSpeed;
    this.threadContainer.rotation.x = Math.sin(t * 0.85) * waveMotion * 0.28;
    this.threadContainer.rotation.z =
      baseRotZ + Math.cos(t * 0.7) * waveMotion * 0.16;

    if (this.materialBundle) {
      this.materialBundle.pulseUniforms.uPulseTime.value = t;
    }
  }

  private renderScene(): void {
    if (this.composer && !this.isSoftwareGl) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // Synchronous high-resolution render for PNG/JPG/WebP or deterministic Video Export frames
  public renderExportFrame(
    exportW: number,
    exportH: number,
    timeSeconds?: number
  ): HTMLCanvasElement {
    this.isExporting = true;

    if (timeSeconds !== undefined) {
      this.applyFrameTransforms(timeSeconds);
    }

    this.renderer.setPixelRatio(1);
    this.resize(exportW, exportH);
    this.controls.update();
    this.renderScene();

    return this.renderer.domElement;
  }

  public endExportMode(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.resize(w, h);
    this.isExporting = false;
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.isDisposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private startLoop(): void {
    const tick = () => {
      if (this.isDisposed) return;

      const delta = Math.min(0.08, this.clock.getDelta());

      if (!this.isExporting) {
        if (this.animParams.playing) {
          this.elapsed += delta;
        }
        this.applyFrameTransforms(this.elapsed);

        if (this.camTransition.active) {
          this.camera.position.x = THREE.MathUtils.damp(
            this.camera.position.x,
            this.camTransition.targetPos.x,
            6,
            delta
          );
          this.camera.position.y = THREE.MathUtils.damp(
            this.camera.position.y,
            this.camTransition.targetPos.y,
            6,
            delta
          );
          this.camera.position.z = THREE.MathUtils.damp(
            this.camera.position.z,
            this.camTransition.targetPos.z,
            6,
            delta
          );
          this.controls.target.lerp(this.camTransition.targetLook, 0.12);
          if (this.camera.position.distanceTo(this.camTransition.targetPos) < 0.03) {
            this.camTransition.active = false;
          }
        }

        this.controls.update();
        this.renderScene();
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  public dispose(): void {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    if (this.threadMeshGroup) {
      disposeObject3D(this.threadMeshGroup);
    }
    if (this.materialBundle) {
      this.materialBundle.dispose();
    }
    this.defaultEnvTexture.dispose();
    if (this.customEnvTexture) {
      this.customEnvTexture.dispose();
    }
    this.pmremGenerator.dispose();
    this.controls.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
