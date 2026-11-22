import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GeometryParams, PathShape } from '../types/studio';
import { StudioMaterialBundle } from './materials';

// Deterministic seeded PRNG (Mulberry32)
function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function disposeObject3D(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
    }
  });
}

// Build the backbone 3D spline from preset + parameters
export function createBackboneCurve(params: GeometryParams): THREE.CatmullRomCurve3 {
  const rng = createRng(params.seed);
  const pts: THREE.Vector3[] = [];
  const count = 16;
  const halfLen = params.length * 0.5;
  const amp = params.curveAmplitude;
  const freq = params.curveFrequency;
  const noise = params.organicNoise;

  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const u = t * 2 - 1; // -1 .. 1
    let x = 0;
    let y = -u * halfLen;
    let z = 0;

    switch (params.pathShape as PathShape) {
      case 's-curve': {
        x = Math.sin(t * Math.PI * 2 * freq) * amp;
        z = Math.cos(t * Math.PI * 1.5 * freq) * amp * 0.45;
        y = (0.5 - t) * params.length * 0.92;
        break;
      }
      case 'vertical': {
        x = Math.sin(t * Math.PI * freq) * amp * 0.35;
        z = Math.cos(t * Math.PI * 1.2 * freq) * amp * 0.2;
        y = (0.5 - t) * params.length;
        break;
      }
      case 'helix': {
        const theta = t * Math.PI * 2.5 * freq;
        x = Math.cos(theta) * amp * 0.85;
        z = Math.sin(theta) * amp * 0.85;
        y = (0.5 - t) * params.length * 0.9;
        break;
      }
      case 'arc': {
        const angle = (t - 0.5) * Math.PI * 1.15 * Math.max(0.5, freq * 0.8);
        x = Math.sin(angle) * (amp + 1.2) - amp * 0.35;
        y = Math.cos(angle) * (params.length * 0.48) - params.length * 0.1;
        z = Math.sin(t * Math.PI) * amp * 0.35;
        break;
      }
      case 'whip': {
        x = Math.pow(t, 1.35) * amp * 1.5 - amp * 0.6 + Math.sin(t * Math.PI * 1.5 * freq) * amp * 0.55;
        y = (0.5 - t) * params.length * 0.95;
        z = Math.sin(t * Math.PI * freq) * amp * 0.45;
        break;
      }
      case 'loop': {
        const a = t * Math.PI * 1.85;
        x = Math.sin(a) * amp * 1.25;
        y = Math.cos(a) * (params.length * 0.36);
        z = Math.sin(a * 2) * amp * 0.42;
        break;
      }
    }

    if (noise > 0.01) {
      x += (rng() - 0.5) * noise * 0.7;
      z += (rng() - 0.5) * noise * 0.7;
    }

    pts.push(new THREE.Vector3(x, y, z));
  }

  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
}

// Custom Variable-Radius Swept Tube Builder (supports razor-sharp tapering, elliptical blades, and nodal bulges)
function buildTaperedTubeGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  tubularSegments: number,
  radialSegments: number,
  radiusFn: (t: number, angle: number) => number,
  squashX = 1.0,
  squashY = 1.0,
  capEnds = true
): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const v = new THREE.Vector3();
  const norm = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, P);
    N.copy(frames.normals[i]);
    B.copy(frames.binormals[i]);

    for (let j = 0; j <= radialSegments; j++) {
      const u = (j / radialSegments) * Math.PI * 2;
      const r = Math.max(0.0015, radiusFn(t, u));
      const sin = Math.sin(u) * squashY;
      const cos = -Math.cos(u) * squashX;

      norm.x = cos * N.x + sin * B.x;
      norm.y = cos * N.y + sin * B.y;
      norm.z = cos * N.z + sin * B.z;
      norm.normalize();

      v.x = P.x + r * (cos * N.x + sin * B.x);
      v.y = P.y + r * (cos * N.y + sin * B.y);
      v.z = P.z + r * (cos * N.z + sin * B.z);

      vertices.push(v.x, v.y, v.z);
      normals.push(norm.x, norm.y, norm.z);
      uvs.push(t, j / radialSegments);
    }
  }

  const rowLen = radialSegments + 1;
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * rowLen + j;
      const b = (i + 1) * rowLen + j;
      const c = (i + 1) * rowLen + (j + 1);
      const d = i * rowLen + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  if (capEnds) {
    // Start cap
    const startCenter = curve.getPointAt(0);
    const startIdx = vertices.length / 3;
    vertices.push(startCenter.x, startCenter.y, startCenter.z);
    const startTan = curve.getTangentAt(0).negate();
    normals.push(startTan.x, startTan.y, startTan.z);
    uvs.push(0, 0.5);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(startIdx, j + 1, j);
    }

    // End cap
    const endCenter = curve.getPointAt(1);
    const endIdx = vertices.length / 3;
    vertices.push(endCenter.x, endCenter.y, endCenter.z);
    const endTan = curve.getTangentAt(1);
    normals.push(endTan.x, endTan.y, endTan.z);
    uvs.push(1, 0.5);
    const lastRow = tubularSegments * rowLen;
    for (let j = 0; j < radialSegments; j++) {
      indices.push(endIdx, lastRow + j, lastRow + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Helper to create a curved spine/thorn/rib along a local 3-point curve
function buildCurvedSpikeGeometry(
  baseRadius: number,
  length: number,
  bend: number,
  radialSegments = 10
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(bend * 0.35, length * 0.45, 0),
    new THREE.Vector3(bend, length, 0),
  ]);
  return buildTaperedTubeGeometry(
    curve,
    12,
    radialSegments,
    (t) => {
      // Flared base collar tapering cleanly to a needle point
      const flare = t < 0.15 ? 1 + (1 - t / 0.15) * 0.45 : 1;
      return baseRadius * flare * Math.pow(1 - t, 1.35);
    },
    1,
    1,
    true
  );
}

// ---------------------------------------------------------------------------
// 1. BIOMECHANICAL / CYBER SPINE (Images 1 & 5)
// ---------------------------------------------------------------------------
function buildSpineThread(
  params: GeometryParams,
  materials: StudioMaterialBundle
): THREE.Group {
  const group = new THREE.Group();
  const curve = createBackboneCurve(params);
  const count = Math.max(8, Math.round(params.segments));
  const frames = curve.computeFrenetFrames(count, false);
  const rng = createRng(params.seed);

  const spacing = params.length / count;
  const baseR = params.thickness;

  // Part 1: Lathe sculpted vertebra body
  const bodyH = spacing * 0.72;
  const lathePts = [
    new THREE.Vector2(0.01, -bodyH * 0.5),
    new THREE.Vector2(baseR * 0.92, -bodyH * 0.46),
    new THREE.Vector2(baseR * 1.0, -bodyH * 0.32),
    new THREE.Vector2(baseR * 0.76, -bodyH * 0.12),
    new THREE.Vector2(baseR * 0.72, 0),
    new THREE.Vector2(baseR * 0.76, bodyH * 0.12),
    new THREE.Vector2(baseR * 1.0, bodyH * 0.32),
    new THREE.Vector2(baseR * 0.92, bodyH * 0.46),
    new THREE.Vector2(0.01, bodyH * 0.5),
  ];
  const vertebraGeo = new THREE.LatheGeometry(lathePts, 24);

  // Part 2: Intervertebral glowing / contrast disc
  const discH = spacing * 0.28;
  const discGeo = new THREE.CylinderGeometry(baseR * 0.84, baseR * 0.84, discH, 24, 1);

  // Part 3: Dorsal Spinous Process (sculpted swept blade)
  const finShape = new THREE.Shape();
  const finLen = baseR * (1.2 + params.detailLength * 1.35);
  finShape.moveTo(0, -bodyH * 0.32);
  finShape.quadraticCurveTo(finLen * 0.55, -bodyH * 0.18, finLen, -bodyH * 0.42);
  finShape.quadraticCurveTo(finLen * 0.82, bodyH * 0.12, finLen * 0.35, bodyH * 0.35);
  finShape.lineTo(0, bodyH * 0.32);
  finShape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: baseR * 0.22,
    bevelEnabled: true,
    bevelThickness: baseR * 0.06,
    bevelSize: baseR * 0.05,
    bevelSegments: 2,
  });
  finGeo.translate(0, 0, -baseR * 0.11);

  // Part 4: Bilateral Rib / Lateral Probe
  const ribLen = baseR * (1.35 + params.detailLength * 1.55);
  const ribCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(baseR * 0.55, 0, 0),
    new THREE.Vector3(baseR * 0.55 + ribLen * 0.55, -bodyH * 0.15, ribLen * 0.28),
    new THREE.Vector3(baseR * 0.55 + ribLen, -bodyH * 0.45, -ribLen * 0.22),
  ]);
  const ribRightGeo = buildTaperedTubeGeometry(
    ribCurve,
    12,
    10,
    (t) => baseR * 0.19 * (t > 0.78 ? 1.25 : 1 - t * 0.55),
    1,
    1,
    true
  );
  const ribLeftGeo = ribRightGeo.clone();
  ribLeftGeo.scale(-1, 1, 1);
  // Flip triangle winding after negative X scale
  const idx = ribLeftGeo.index;
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1);
      const c = idx.getX(i + 2);
      idx.setX(i + 1, c);
      idx.setX(i + 2, b);
    }
    ribLeftGeo.computeVertexNormals();
  }

  // Part 5: Secondary inner conduit / glowing cyber spine core
  const coreGeo = buildTaperedTubeGeometry(
    curve,
    count * 2,
    10,
    (t) => baseR * 0.26 * (1 - params.taper * 0.4 * Math.abs(t * 2 - 1)),
    1,
    1,
    true
  );
  const hasGlow = materials.emissive.emissiveIntensity > 0.25;
  const coreMesh = new THREE.Mesh(
    coreGeo,
    hasGlow ? materials.emissive : materials.secondary
  );
  group.add(coreMesh);

  // Build InstancedMeshes for vertebrae, discs, fins, and ribs
  const bodyInst = new THREE.InstancedMesh(vertebraGeo, materials.primary, count);
  const discInst = new THREE.InstancedMesh(
    discGeo,
    hasGlow ? materials.emissive : materials.secondary,
    Math.max(1, count - 1)
  );
  const finInst = new THREE.InstancedMesh(finGeo, materials.primary, count);
  const ribRInst = new THREE.InstancedMesh(ribRightGeo, materials.secondary, count);
  const ribLInst = new THREE.InstancedMesh(ribLeftGeo, materials.secondary, count);

  const dummy = new THREE.Object3D();
  const rotMat = new THREE.Matrix4();
  const twistQ = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const pt = new THREE.Vector3();
  const nextPt = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    curve.getPointAt(t, pt);

    const frameIdx = Math.min(count, Math.round(t * count));
    const T = frames.tangents[frameIdx].clone().normalize();
    const N = frames.normals[frameIdx].clone().normalize();
    const B = frames.binormals[frameIdx].clone().normalize();

    rotMat.makeBasis(N, T, B);
    dummy.position.copy(pt);
    dummy.quaternion.setFromRotationMatrix(rotMat);

    // Apply progressive twist + subtle organic noise
    const twistAngle = (t - 0.5) * params.twist + (rng() - 0.5) * params.organicNoise * 0.3;
    twistQ.setFromAxisAngle(yAxis, twistAngle);
    dummy.quaternion.multiply(twistQ);

    // Apply taper along ends
    const edgeDist = Math.abs(t * 2 - 1);
    const scaleFactor = Math.max(0.25, 1 - params.taper * 0.68 * Math.pow(edgeDist, 1.4));
    dummy.scale.setScalar(scaleFactor);
    dummy.updateMatrix();

    bodyInst.setMatrixAt(i, dummy.matrix);

    // Dorsal fin + ribs tilt
    dummy.rotateZ(params.detailAngle * 0.45);
    dummy.updateMatrix();
    finInst.setMatrixAt(i, dummy.matrix);

    if (params.detailDensity >= 2) {
      ribRInst.setMatrixAt(i, dummy.matrix);
      ribLInst.setMatrixAt(i, dummy.matrix);
    }

    // Intervertebral disc placed between i and i+1
    if (i < count - 1) {
      const tMid = (i + 1) / count;
      curve.getPointAt(tMid, nextPt);
      const midFrameIdx = Math.min(count, Math.round(tMid * count));
      rotMat.makeBasis(
        frames.normals[midFrameIdx],
        frames.tangents[midFrameIdx],
        frames.binormals[midFrameIdx]
      );
      dummy.position.copy(nextPt);
      dummy.quaternion.setFromRotationMatrix(rotMat);
      const discScale = Math.max(0.25, 1 - params.taper * 0.68 * Math.pow(Math.abs(tMid * 2 - 1), 1.4));
      dummy.scale.setScalar(discScale);
      dummy.updateMatrix();
      discInst.setMatrixAt(i, dummy.matrix);
    }
  }

  [bodyInst, discInst, finInst, ribRInst, ribLInst].forEach((inst) => {
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    inst.castShadow = true;
    inst.receiveShadow = true;
  });

  group.add(bodyInst, discInst, finInst);
  if (params.detailDensity >= 2) {
    group.add(ribRInst, ribLInst);
  } else {
    ribRightGeo.dispose();
    ribLeftGeo.dispose();
  }

  return group;
}

// ---------------------------------------------------------------------------
// 2. BOTANICAL THORN STEM (Image 2)
// ---------------------------------------------------------------------------
function buildThornStem(
  params: GeometryParams,
  materials: StudioMaterialBundle
): THREE.Group {
  const group = new THREE.Group();
  const rng = createRng(params.seed);
  const baseCurve = createBackboneCurve(params);
  const nodeCount = Math.max(5, Math.min(26, Math.round(params.segments)));

  // Build angular zig-zagging waypoints with sharp botanical deflections at nodes
  const zigPoints: THREE.Vector3[] = [];
  const zigAmp = 0.25 + params.curveAmplitude * 0.38;

  for (let i = 0; i <= nodeCount; i++) {
    const t = i / nodeCount;
    const p = baseCurve.getPointAt(t);
    if (i > 0 && i < nodeCount) {
      const side = i % 2 === 0 ? 1 : -1;
      const angle = params.twist * t + (rng() - 0.5) * params.organicNoise * 1.6;
      p.x += Math.cos(angle) * side * zigAmp * (0.6 + rng() * 0.6);
      p.z += Math.sin(angle) * side * zigAmp * (0.45 + rng() * 0.6);
    }
    zigPoints.push(p);
  }

  // Low-tension CatmullRom produces crisp angular segments with organic swollen knees
  const stemCurve = new THREE.CatmullRomCurve3(zigPoints, false, 'catmullrom', 0.16);
  const stemRadius = params.thickness * 0.62;

  const stemGeo = buildTaperedTubeGeometry(
    stemCurve,
    nodeCount * 10,
    14,
    (t, u) => {
      // Nodal swelling near each integer node i / nodeCount
      const phase = t * nodeCount;
      const distToNode = Math.abs(phase - Math.round(phase));
      const swell = distToNode < 0.22 ? Math.cos((distToNode / 0.22) * Math.PI * 0.5) * 0.42 : 0;
      // Longitudinal fibrous ridges around circumference
      const ridge = Math.sin(u * 7 + t * 8) * 0.065;
      const taperScale = 1 - params.taper * 0.55 * t;
      return stemRadius * taperScale * (1 + swell + ridge);
    },
    1,
    1,
    true
  );

  const stemMesh = new THREE.Mesh(stemGeo, materials.primary);
  stemMesh.castShadow = true;
  stemMesh.receiveShadow = true;
  group.add(stemMesh);

  // Build sharp radiating thorns at each node
  const thornGeos: THREE.BufferGeometry[] = [];
  const tipGeos: THREE.BufferGeometry[] = [];
  const thornsPerNode = Math.max(1, Math.min(4, Math.round(params.detailDensity)));
  const upVec = new THREE.Vector3(0, 1, 0);

  for (let i = 1; i < nodeCount; i++) {
    const nodePos = zigPoints[i];
    const prevPos = zigPoints[i - 1];
    const nextPos = zigPoints[i + 1];
    const tangent = nextPos.clone().sub(prevPos).normalize();
    const bendDir = prevPos
      .clone()
      .add(nextPos)
      .multiplyScalar(0.5)
      .sub(nodePos);

    if (bendDir.lengthSq() < 0.0001) {
      bendDir.set(Math.cos(i * 2.1), 0, Math.sin(i * 2.1));
    }
    bendDir.normalize().negate(); // Point outward from the elbow!

    for (let k = 0; k < thornsPerNode; k++) {
      const thornLen =
        (0.55 + params.detailLength * 0.95) *
        (0.7 + rng() * 0.55) *
        (1 - params.taper * 0.35 * (i / nodeCount));
      const thornBaseR = stemRadius * (0.48 + rng() * 0.22);
      const curvature = (rng() - 0.35) * 0.45;

      const tGeo = buildCurvedSpikeGeometry(thornBaseR, thornLen, curvature, 10);

      // Orient thorn outward from node
      const dir = bendDir.clone();
      const spreadAngle = (k - (thornsPerNode - 1) * 0.5) * 0.85 + (rng() - 0.5) * 0.35;
      dir.applyAxisAngle(tangent, spreadAngle);
      // Pitch up/down according to detailAngle
      const pitchAxis = new THREE.Vector3().crossVectors(tangent, dir).normalize();
      if (pitchAxis.lengthSq() > 0.001) {
        dir.applyAxisAngle(pitchAxis, params.detailAngle + (k % 2 === 0 ? 0.25 : -0.35));
      }
      dir.normalize();

      const q = new THREE.Quaternion().setFromUnitVectors(upVec, dir);
      const m = new THREE.Matrix4().compose(
        nodePos.clone().addScaledVector(dir, stemRadius * 0.45),
        q,
        new THREE.Vector3(1, 1, 1)
      );
      tGeo.applyMatrix4(m);
      thornGeos.push(tGeo);

      // Optional micro-bud / secondary nub at node base (like image 2's little blue/purple buds!)
      if (k === 0 && rng() > 0.25) {
        const bud = new THREE.SphereGeometry(stemRadius * 0.42, 10, 10);
        bud.translate(
          nodePos.x + bendDir.x * stemRadius * 0.72,
          nodePos.y + bendDir.y * stemRadius * 0.72,
          nodePos.z + bendDir.z * stemRadius * 0.72
        );
        tipGeos.push(bud);
      }
    }
  }

  if (thornGeos.length > 0) {
    const mergedThorns = BufferGeometryUtils.mergeGeometries(thornGeos, false);
    const thornsMesh = new THREE.Mesh(mergedThorns, materials.primary);
    thornsMesh.castShadow = true;
    thornsMesh.receiveShadow = true;
    group.add(thornsMesh);
    thornGeos.forEach((g) => g.dispose());
  }

  if (tipGeos.length > 0) {
    const mergedTips = BufferGeometryUtils.mergeGeometries(tipGeos, false);
    const tipsMesh = new THREE.Mesh(mergedTips, materials.secondary);
    group.add(tipsMesh);
    tipGeos.forEach((g) => g.dispose());
  }

  return group;
}

// ---------------------------------------------------------------------------
// 3. NEOTRIBAL LIQUID CHROME FILIGREE (Image 3)
// ---------------------------------------------------------------------------
function buildNeotribalVector(
  params: GeometryParams,
  materials: StudioMaterialBundle
): THREE.Group {
  const group = new THREE.Group();
  const rng = createRng(params.seed);
  const mainCurve = createBackboneCurve(params);
  const parts: THREE.BufferGeometry[] = [];

  const baseR = params.thickness * 0.85;
  const segs = Math.max(32, Math.round(params.segments * 1.4));

  // Primary sweeping neotribal spine: swells at branch junctions, pinches to needle tips
  const mainGeo = buildTaperedTubeGeometry(
    mainCurve,
    segs,
    18,
    (t) => {
      const endsTaper = Math.sin(Math.pow(t, 0.85) * Math.PI);
      const swellNodes = 0.75 + 0.35 * Math.sin(t * Math.PI * (2 + params.detailDensity));
      return baseR * Math.pow(endsTaper, 0.7 + params.taper * 0.5) * swellNodes;
    },
    1.15,
    0.58,
    true
  );
  parts.push(mainGeo);

  // Bifurcating negative-space loops & sharp hooked barbs along the spline
  const branchCount = Math.max(2, Math.round(params.detailDensity + 1));
  const frames = mainCurve.computeFrenetFrames(segs, false);

  for (let b = 0; b < branchCount; b++) {
    const tStart = 0.1 + (b / branchCount) * 0.72;
    const tEnd = Math.min(0.95, tStart + 0.16 + rng() * 0.12);
    const side = b % 2 === 0 ? 1 : -1;

    const pStart = mainCurve.getPointAt(tStart);
    const pMid = mainCurve.getPointAt((tStart + tEnd) * 0.5);
    const pEnd = mainCurve.getPointAt(tEnd);

    const fIdx = Math.min(segs, Math.round(((tStart + tEnd) * 0.5) * segs));
    const N = frames.normals[fIdx];
    const B = frames.binormals[fIdx];
    const T = frames.tangents[fIdx];

    const twistRad = params.twist * 0.25 * (b + 1) + params.detailAngle;
    const outDir = N.clone()
      .multiplyScalar(Math.cos(twistRad) * side)
      .addScaledVector(B, Math.sin(twistRad) * side)
      .normalize();

    const bowDist = (0.45 + params.detailLength * 0.85) * (0.75 + rng() * 0.5);

    // 1. Negative-space teardrop loop arch that re-attaches smoothly to the main spine
    const loopCurve = new THREE.CatmullRomCurve3([
      pStart.clone(),
      pStart.clone().lerp(pMid, 0.5).addScaledVector(outDir, bowDist * 0.75),
      pMid.clone().addScaledVector(outDir, bowDist),
      pMid.clone().lerp(pEnd, 0.5).addScaledVector(outDir, bowDist * 0.65),
      pEnd.clone(),
    ]);

    const loopGeo = buildTaperedTubeGeometry(
      loopCurve,
      26,
      14,
      (t) => {
        // Thick at merge points & apex, pinched sleekly in between
        const arch = 0.55 + 0.45 * Math.sin(t * Math.PI);
        return baseR * 0.58 * arch;
      },
      1.1,
      0.55,
      true
    );
    parts.push(loopGeo);

    // 2. Sweeping razor-sharp neotribal barb flaring off the outer apex of the loop
    const apex = pMid.clone().addScaledVector(outDir, bowDist * 0.85);
    const hookLen = (0.75 + params.detailLength * 1.1) * (0.8 + rng() * 0.45);
    const hookDir = outDir
      .clone()
      .multiplyScalar(0.75)
      .addScaledVector(T, (b % 2 === 0 ? -1 : 1) * (0.65 + params.detailAngle * 0.4))
      .normalize();

    const hookCurve = new THREE.CatmullRomCurve3([
      pMid.clone().addScaledVector(outDir, bowDist * 0.35),
      apex.clone().addScaledVector(hookDir, hookLen * 0.35),
      apex.clone().addScaledVector(hookDir, hookLen * 0.75).addScaledVector(T, side * 0.25),
      apex.clone().addScaledVector(hookDir, hookLen * 1.15).addScaledVector(outDir, -0.15 * hookLen),
    ]);

    const hookGeo = buildTaperedTubeGeometry(
      hookCurve,
      22,
      12,
      (t) => baseR * 0.62 * Math.pow(1 - t, 1.45),
      1.15,
      0.5,
      true
    );
    parts.push(hookGeo);
  }

  // Twin forked prongs at the top/bottom tips like Image 3's upper fork
  const topPt = mainCurve.getPointAt(0.06);
  const topTan = mainCurve.getTangentAt(0.04).negate();
  const topNorm = frames.normals[1].clone();
  const forkLen = 0.8 + params.detailLength * 0.85;
  const forkCurve = new THREE.CatmullRomCurve3([
    topPt,
    topPt.clone().addScaledVector(topTan, forkLen * 0.45).addScaledVector(topNorm, forkLen * 0.28),
    topPt.clone().addScaledVector(topTan, forkLen * 1.15).addScaledVector(topNorm, forkLen * 0.42),
  ]);
  parts.push(
    buildTaperedTubeGeometry(
      forkCurve,
      18,
      12,
      (t) => baseR * 0.55 * Math.pow(1 - t, 1.35),
      1.1,
      0.5,
      true
    )
  );

  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());

  const mesh = new THREE.Mesh(merged, materials.primary);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  return group;
}

// ---------------------------------------------------------------------------
// 4. HEAVY INDUSTRIAL CHAIN (Image 4)
// ---------------------------------------------------------------------------
function buildChainLinkGeometry(
  linkLength: number,
  linkWidth: number,
  wireRadius: number
): THREE.BufferGeometry {
  const straight = Math.max(0.05, linkLength - linkWidth);
  const halfS = straight * 0.5;
  const r = linkWidth * 0.5;
  const pts: THREE.Vector3[] = [];
  const arcSegs = 12;

  // Top semicircle
  for (let i = 0; i <= arcSegs; i++) {
    const a = (i / arcSegs) * Math.PI;
    pts.push(new THREE.Vector3(Math.cos(a) * r, halfS + Math.sin(a) * r, 0));
  }
  // Bottom semicircle
  for (let i = 0; i <= arcSegs; i++) {
    const a = Math.PI + (i / arcSegs) * Math.PI;
    pts.push(new THREE.Vector3(Math.cos(a) * r, -halfS + Math.sin(a) * r, 0));
  }

  const loopCurve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.25);
  return new THREE.TubeGeometry(loopCurve, 44, wireRadius, 16, true);
}

function buildChainThread(
  params: GeometryParams,
  materials: StudioMaterialBundle
): THREE.Group {
  const group = new THREE.Group();
  const curve = createBackboneCurve(params);
  const totalCurveLen = curve.getLength();

  const wireR = params.thickness * 0.48;
  const linkWidth = wireR * (3.6 + params.detailLength * 0.9);
  const linkLength = linkWidth * (1.45 + params.detailLength * 0.45);
  const stepDist = Math.max(0.18, linkLength - wireR * 2.25);
  const count = Math.max(4, Math.min(80, Math.floor(totalCurveLen / stepDist)));

  const linkGeo = buildChainLinkGeometry(linkLength, linkWidth, wireR);
  const inst = new THREE.InstancedMesh(linkGeo, materials.primary, count);

  // Optional spiky studs on links when detailDensity >= 3
  const hasStuds = params.detailDensity >= 3;
  const studGeo = hasStuds
    ? new THREE.ConeGeometry(wireR * 0.55, wireR * (1.4 + params.detailLength), 8)
    : null;
  const studInst = studGeo
    ? new THREE.InstancedMesh(studGeo, materials.secondary, count * 2)
    : null;

  const dummy = new THREE.Object3D();
  const studDummy = new THREE.Object3D();
  const tangent = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const rollAxis = new THREE.Vector3(0, 1, 0);
  const qAlign = new THREE.Quaternion();
  const qRoll = new THREE.Quaternion();

  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const pos = curve.getPointAt(t);
    curve.getTangentAt(t, tangent).normalize();

    qAlign.setFromUnitVectors(up, tangent);
    // Alternate 90 degrees so links interlock + continuous user twist
    const rollAngle = (i % 2) * (Math.PI * 0.5) + t * params.twist * 0.5;
    qRoll.setFromAxisAngle(rollAxis, rollAngle);

    dummy.position.copy(pos);
    dummy.quaternion.copy(qAlign).multiply(qRoll);

    const edgeDist = Math.abs(t * 2 - 1);
    const scale = Math.max(0.35, 1 - params.taper * 0.65 * edgeDist);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);

    if (studInst) {
      for (let s = 0; s < 2; s++) {
        const side = s === 0 ? 1 : -1;
        studDummy.position.set(side * (linkWidth * 0.5 + wireR * 1.1), 0, 0);
        studDummy.rotation.set(0, 0, -side * Math.PI * 0.5);
        studDummy.scale.setScalar(1);
        studDummy.updateMatrix();
        const combined = dummy.matrix.clone().multiply(studDummy.matrix);
        studInst.setMatrixAt(i * 2 + s, combined);
      }
    }
  }

  inst.instanceMatrix.needsUpdate = true;
  inst.computeBoundingSphere();
  inst.castShadow = true;
  inst.receiveShadow = true;
  group.add(inst);

  if (studInst) {
    studInst.instanceMatrix.needsUpdate = true;
    studInst.computeBoundingSphere();
    studInst.castShadow = true;
    group.add(studInst);
  }

  return group;
}

// ---------------------------------------------------------------------------
// 5. LUMINOUS OPTICAL FIBER & CYBER CONDUIT (Image 5 + Fiber Bundles)
// ---------------------------------------------------------------------------
function buildOpticalFiberThread(
  params: GeometryParams,
  materials: StudioMaterialBundle
): THREE.Group {
  const group = new THREE.Group();
  const rng = createRng(params.seed);
  const mainCurve = createBackboneCurve(params);
  const segs = 64;
  const frames = mainCurve.computeFrenetFrames(segs, false);

  const strandCount = Math.max(3, Math.min(10, Math.round(params.detailDensity + 3)));
  const bundleR = params.thickness * 0.68;
  const fiberGeos: THREE.BufferGeometry[] = [];
  const tipPositions: THREE.Vector3[] = [];

  for (let s = 0; s < strandCount; s++) {
    const strandPts: THREE.Vector3[] = [];
    const baseAngle = (s / strandCount) * Math.PI * 2;
    const isWhisker = s >= Math.ceil(strandCount * 0.6);
    const peelStart = isWhisker ? 0.45 + rng() * 0.3 : 1.0;

    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      const p = mainCurve.getPointAt(t);
      const fIdx = Math.min(segs, Math.round(t * segs));
      const N = frames.normals[fIdx];
      const B = frames.binormals[fIdx];

      const helixAngle = baseAngle + t * (params.twist + 3.2);
      let radialDist = bundleR * (0.45 + (s % 3) * 0.25) * (1 - params.taper * 0.35 * t);

      if (t > peelStart) {
        const peel = (t - peelStart) / (1 - peelStart);
        radialDist += Math.pow(peel, 1.5) * (0.6 + params.detailLength * 0.9);
      }

      p.addScaledVector(N, Math.cos(helixAngle) * radialDist);
      p.addScaledVector(B, Math.sin(helixAngle) * radialDist);
      strandPts.push(p);
    }

    const strandCurve = new THREE.CatmullRomCurve3(strandPts);
    const strandGeo = buildTaperedTubeGeometry(
      strandCurve,
      44,
      8,
      (t) => bundleR * 0.14 * (1 - t * 0.35),
      1,
      1,
      true
    );
    fiberGeos.push(strandGeo);
    tipPositions.push(strandPts[strandPts.length - 1]);
  }

  const mergedFibers = BufferGeometryUtils.mergeGeometries(fiberGeos, false);
  fiberGeos.forEach((g) => g.dispose());
  const fiberMesh = new THREE.Mesh(mergedFibers, materials.emissive);
  group.add(fiberMesh);

  // Glowing optical terminal nodes at fiber tips
  const tipGeo = new THREE.SphereGeometry(bundleR * 0.24, 12, 12);
  const tipInst = new THREE.InstancedMesh(tipGeo, materials.emissive, tipPositions.length);
  const dummy = new THREE.Object3D();
  tipPositions.forEach((pos, idx) => {
    dummy.position.copy(pos);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    tipInst.setMatrixAt(idx, dummy.matrix);
  });
  tipInst.instanceMatrix.needsUpdate = true;
  tipInst.computeBoundingSphere();
  group.add(tipInst);

  // Cybernetic armored collar cuffs along the main bundle (like Image 5)
  const collarCount = Math.max(4, Math.min(28, Math.round(params.segments * 0.65)));
  const collarH = (params.length / collarCount) * 0.48;
  const collarPts = [
    new THREE.Vector2(bundleR * 0.85, -collarH * 0.5),
    new THREE.Vector2(bundleR * 1.28, -collarH * 0.38),
    new THREE.Vector2(bundleR * 1.12, 0),
    new THREE.Vector2(bundleR * 1.28, collarH * 0.38),
    new THREE.Vector2(bundleR * 0.85, collarH * 0.5),
  ];
  const collarGeo = new THREE.LatheGeometry(collarPts, 20);
  const collarInst = new THREE.InstancedMesh(collarGeo, materials.primary, collarCount);

  const ringGeo = new THREE.TorusGeometry(bundleR * 1.22, bundleR * 0.08, 10, 24);
  ringGeo.rotateX(Math.PI * 0.5);
  const ringInst = new THREE.InstancedMesh(ringGeo, materials.emissive, collarCount);

  const rotMat = new THREE.Matrix4();
  for (let i = 0; i < collarCount; i++) {
    const t = 0.06 + (i / collarCount) * 0.72;
    const pt = mainCurve.getPointAt(t);
    const fIdx = Math.min(segs, Math.round(t * segs));
    rotMat.makeBasis(frames.normals[fIdx], frames.tangents[fIdx], frames.binormals[fIdx]);
    dummy.position.copy(pt);
    dummy.quaternion.setFromRotationMatrix(rotMat);
    const sc = Math.max(0.45, 1 - params.taper * 0.45 * t);
    dummy.scale.setScalar(sc);
    dummy.updateMatrix();
    collarInst.setMatrixAt(i, dummy.matrix);
    ringInst.setMatrixAt(i, dummy.matrix);
  }

  collarInst.instanceMatrix.needsUpdate = true;
  collarInst.computeBoundingSphere();
  collarInst.castShadow = true;
  collarInst.receiveShadow = true;

  ringInst.instanceMatrix.needsUpdate = true;
  ringInst.computeBoundingSphere();

  group.add(collarInst, ringInst);

  return group;
}

// ---------------------------------------------------------------------------
// MASTER GENERATOR DISPATCH + NORMALIZATION
// ---------------------------------------------------------------------------
export function generateThreadObject(
  params: GeometryParams,
  materials: StudioMaterialBundle
): THREE.Group {
  let root: THREE.Group;

  switch (params.archetype) {
    case 'spine':
      root = buildSpineThread(params, materials);
      break;
    case 'thorn':
      root = buildThornStem(params, materials);
      break;
    case 'neotribal':
      root = buildNeotribalVector(params, materials);
      break;
    case 'chain':
      root = buildChainThread(params, materials);
      break;
    case 'fiber':
      root = buildOpticalFiberThread(params, materials);
      break;
    default:
      root = buildSpineThread(params, materials);
  }

  // Center the generated sculpture at world origin so orbiting & framing are always balanced
  const box = new THREE.Box3().setFromObject(root);
  if (!box.isEmpty()) {
    const center = new THREE.Vector3();
    box.getCenter(center);
    root.children.forEach((child) => {
      child.position.sub(center);
    });
  }

  return root;
}
