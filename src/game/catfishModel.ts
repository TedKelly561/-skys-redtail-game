import * as THREE from 'three';

/**
 * Generates a high-resolution 1024x1024 Albedo + Bump map for the
 * Amazonian Redtail Catfish (Phractocephalus hemioliopterus)
 */
let cachedCatfishTextures: {
  skinAlbedo: THREE.CanvasTexture;
  skinBump: THREE.CanvasTexture;
  finAlbedo: THREE.CanvasTexture;
  finBump: THREE.CanvasTexture;
} | null = null;

function getSharedCatfishTextures() {
  if (cachedCatfishTextures) return cachedCatfishTextures;

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bCtx = bumpCanvas.getContext('2d')!;

  // Base creamy white belly & flank
  ctx.fillStyle = '#fcf8ec';
  ctx.fillRect(0, 0, 1024, 1024);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 512, 512);

  // 1. Dorsal olive-charcoal & dark brown gradient (Y = 0 to 530)
  const dorsalGrad = ctx.createLinearGradient(0, 0, 0, 540);
  dorsalGrad.addColorStop(0.0, '#1c2124');
  dorsalGrad.addColorStop(0.35, '#2b3336');
  dorsalGrad.addColorStop(0.72, '#3d4642');
  dorsalGrad.addColorStop(0.92, '#242929');
  dorsalGrad.addColorStop(1.0, '#fcf8ec');
  ctx.fillStyle = dorsalGrad;
  ctx.fillRect(0, 0, 1024, 535);

  // 2. Iconic Crisp Creamy-White Lateral Band (Y = 500 to 680)
  const stripeGrad = ctx.createLinearGradient(0, 495, 0, 690);
  stripeGrad.addColorStop(0.0, '#fffdf6');
  stripeGrad.addColorStop(0.5, '#ffffff');
  stripeGrad.addColorStop(1.0, '#f4efe0');
  ctx.fillStyle = stripeGrad;
  ctx.fillRect(0, 500, 1024, 185);

  // 3. Organic mottling & leopard-like dark spots on the dorsal surface and head
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 475 + 12;
    const rx = Math.random() * 26 + 8;
    const ry = Math.random() * 18 + 6;
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(14, 17, 19, 0.72)'
        : i % 3 === 1
        ? 'rgba(32, 38, 34, 0.5)'
        : 'rgba(65, 58, 45, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, (Math.random() - 0.5) * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dark irregular border blotches along the top edge of the white lateral stripe
  for (let i = 0; i < 75; i++) {
    const x = (i / 75) * 1024 + (Math.random() - 0.5) * 12;
    const y = 492 + (Math.random() - 0.5) * 14;
    ctx.fillStyle = 'rgba(18, 22, 24, 0.82)';
    ctx.beginPath();
    ctx.ellipse(x, y, Math.random() * 14 + 6, Math.random() * 9 + 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle lateral line sensory pore trace
  ctx.strokeStyle = 'rgba(180, 175, 160, 0.45)';
  ctx.setLineDash([6, 8]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(60, 525);
  ctx.lineTo(940, 520);
  ctx.stroke();
  ctx.setLineDash([]);

  // Fine organic skin grain & cranial bone plate texture in the bump map
  for (let i = 0; i < 3500; i++) {
    const bx = Math.random() * 512;
    const by = Math.random() * 512;
    bCtx.fillStyle = i % 2 === 0 ? 'rgba(145, 145, 145, 0.25)' : 'rgba(110, 110, 110, 0.25)';
    bCtx.beginPath();
    bCtx.arc(bx, by, 1 + Math.random() * 2.5, 0, Math.PI * 2);
    bCtx.fill();
  }

  const skinAlbedo = new THREE.CanvasTexture(canvas);
  skinAlbedo.colorSpace = THREE.SRGBColorSpace;
  skinAlbedo.wrapS = THREE.RepeatWrapping;
  skinAlbedo.wrapT = THREE.ClampToEdgeWrapping;

  const skinBump = new THREE.CanvasTexture(bumpCanvas);
  skinBump.wrapS = THREE.RepeatWrapping;
  skinBump.wrapT = THREE.ClampToEdgeWrapping;

  // Fin textures
  const fCanvas = document.createElement('canvas');
  fCanvas.width = 512;
  fCanvas.height = 512;
  const fCtx = fCanvas.getContext('2d')!;

  const fBumpCanvas = document.createElement('canvas');
  fBumpCanvas.width = 256;
  fBumpCanvas.height = 256;
  const fbCtx = fBumpCanvas.getContext('2d')!;

  const grad = fCtx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0.0, '#b81d10');
  grad.addColorStop(0.25, '#e82c18');
  grad.addColorStop(0.65, '#ff4726');
  grad.addColorStop(0.92, '#ff6842');
  grad.addColorStop(1.0, '#ff8a66');
  fCtx.fillStyle = grad;
  fCtx.fillRect(0, 0, 512, 512);

  fbCtx.fillStyle = '#808080';
  fbCtx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 36; i++) {
    const endY = (i / 35) * 512;
    fCtx.strokeStyle = i % 2 === 0 ? 'rgba(120, 12, 4, 0.38)' : 'rgba(255, 160, 120, 0.28)';
    fCtx.lineWidth = 3;
    fCtx.beginPath();
    fCtx.moveTo(0, 256 + (i - 18) * 4.5);
    fCtx.quadraticCurveTo(256, 256 + (i - 18) * 10, 512, endY);
    fCtx.stroke();

    fbCtx.strokeStyle = '#b8b8b8';
    fbCtx.lineWidth = 2;
    fbCtx.beginPath();
    fbCtx.moveTo(0, 128 + (i - 18) * 2.2);
    fbCtx.lineTo(256, (i / 35) * 256);
    fbCtx.stroke();
  }

  const finAlbedo = new THREE.CanvasTexture(fCanvas);
  finAlbedo.colorSpace = THREE.SRGBColorSpace;
  const finBump = new THREE.CanvasTexture(fBumpCanvas);

  cachedCatfishTextures = { skinAlbedo, skinBump, finAlbedo, finBump };
  return cachedCatfishTextures;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Sculpts the characteristic Redtail Catfish body geometry with high-polygon C2-continuous curves:
 * - Local +Z is FORWARD (broad, flat spade-shaped head and rounded snout)
 * - Local -Z is BACKWARD (muscular caudal peduncle leading to the red tail)
 */
function createSculptedCatfishBodyGeometry(): THREE.BufferGeometry {
  const lengthSegments = 60;
  const radialSegments = 48;
  const totalLength = 2.48;

  const geometry = new THREE.CylinderGeometry(
    0.4,
    0.4,
    totalLength,
    radialSegments,
    lengthSegments,
    false
  );
  geometry.rotateX(Math.PI / 2);

  const pos = geometry.attributes.position;
  const uvs = geometry.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);

    const t = THREE.MathUtils.clamp((vz + totalLength / 2) / totalLength, 0, 1);

    const lenR = Math.hypot(vx, vy);
    const nx = lenR > 1e-5 ? vx / lenR : 0;
    const ny = lenR > 1e-5 ? vy / lenR : 0;

    let widthProfile = 0.2;
    let topHeightProfile = 0.22;
    let bottomHeightProfile = 0.18;

    if (t < 0.2) {
      const k = smoothstep(0.0, 0.2, t);
      widthProfile = THREE.MathUtils.lerp(0.11, 0.35, k);
      topHeightProfile = THREE.MathUtils.lerp(0.18, 0.37, k);
      bottomHeightProfile = THREE.MathUtils.lerp(0.15, 0.26, k);
    } else if (t < 0.58) {
      const k = (t - 0.2) / 0.38;
      const sk = smoothstep(0.0, 1.0, k);
      const hump = Math.sin(k * Math.PI);
      widthProfile = THREE.MathUtils.lerp(0.35, 0.61, sk) + hump * 0.05;
      topHeightProfile =
        THREE.MathUtils.lerp(0.37, 0.46, Math.sin(k * Math.PI * 0.65)) + hump * 0.085;
      bottomHeightProfile = THREE.MathUtils.lerp(0.26, 0.3, sk);
    } else if (t < 0.86) {
      const k = (t - 0.58) / 0.28;
      const sk = smoothstep(0.0, 1.0, k);
      widthProfile = THREE.MathUtils.lerp(0.61, 0.64, Math.sin(k * Math.PI * 0.5));
      topHeightProfile = THREE.MathUtils.lerp(0.44, 0.24, sk);
      bottomHeightProfile = THREE.MathUtils.lerp(0.3, 0.2, sk);
    } else {
      const k = (t - 0.86) / 0.14;
      const roundClosure = Math.cos(k * Math.PI * 0.49);
      widthProfile = 0.64 * Math.pow(roundClosure, 0.85);
      topHeightProfile = THREE.MathUtils.lerp(0.24, 0.09, k) * roundClosure;
      bottomHeightProfile = THREE.MathUtils.lerp(0.2, 0.09, k) * roundClosure;
    }

    // Smooth belly flattening without sharp creases
    let sy = ny >= 0 ? ny * topHeightProfile : ny * bottomHeightProfile;
    if (ny < 0) {
      const flatFactor = 1.0 - 0.22 * Math.pow(-ny, 2.2);
      sy *= flatFactor;
    }

    const snoutDrop = t > 0.55 ? -smoothstep(0.55, 1.0, t) * 0.11 : 0;
    const sx = nx * widthProfile;
    const finalY = sy + snoutDrop;

    pos.setXYZ(i, sx, finalY, vz);

    const vCoord = THREE.MathUtils.clamp((ny + 1.0) * 0.5, 0, 1);
    uvs.setXY(i, t, vCoord);
  }

  geometry.computeVertexNormals();
  return geometry;
}

const _barbelTarget = new THREE.Vector3();

/**
 * Procedural 3D Redtail Catfish Character (Phractocephalus hemioliopterus)
 * With high-polygon smooth anatomy, wet clearcoat PBR skin, 3D volumetric swaying barbels, and smooth beveled fins.
 */
export class CatfishCharacter {
  public group: THREE.Group;
  public bodyMesh: THREE.Mesh;
  public tailFin: THREE.Group;
  public dorsalFin: THREE.Mesh;
  public leftPecFin: THREE.Mesh;
  public rightPecFin: THREE.Mesh;
  public leftPelvicFin: THREE.Mesh;
  public rightPelvicFin: THREE.Mesh;
  public adiposeFin: THREE.Mesh;
  public analFin: THREE.Mesh;

  // 3D Volumetric Maxillary & Chin Barbels
  private leftBarbelSegments: THREE.Mesh[] = [];
  private rightBarbelSegments: THREE.Mesh[] = [];
  private chinBarbelMeshes: THREE.Mesh[] = [];

  public sonarRing: THREE.Mesh;

  private bodyMaterial: THREE.MeshPhysicalMaterial;
  private redFinMaterial: THREE.MeshPhysicalMaterial;
  private dorsalFinMaterial: THREE.MeshPhysicalMaterial;
  private darkFinMaterial: THREE.MeshPhysicalMaterial;
  private barbelMaterial: THREE.MeshPhysicalMaterial;
  private eyeMaterial: THREE.MeshPhysicalMaterial;

  private tailSwimPhase: number = 0;
  private rainbowMode = false;
  private rainbowTime = 0;
  private rainbowMats: {
    mat: THREE.MeshStandardMaterial;
    color: THREE.Color;
    emissive: THREE.Color;
    emissiveIntensity: number;
    map: THREE.Texture | null;
    offset: number;
  }[] = [];
  public swimSpeedMultiplier: number = 1.0;
  public isBoosting: boolean = false;
  public sonarPulseTimer: number = 0;

  constructor(isFriendlyNPC: boolean = false, npcColorVariation: number = 0) {
    this.group = new THREE.Group();

    const { skinAlbedo: skinTex, skinBump, finAlbedo: finTex, finBump } = getSharedCatfishTextures();

    this.bodyMaterial = new THREE.MeshPhysicalMaterial({
      map: skinTex,
      bumpMap: skinBump,
      bumpScale: 0.015,
      roughness: 0.28,
      metalness: 0.06,
      clearcoat: 0.92,
      clearcoatRoughness: 0.12,
    });

    const finTint = isFriendlyNPC
      ? npcColorVariation === 1
        ? '#ff6d2e'
        : npcColorVariation === 2
        ? '#ff2e24'
        : '#ff491f'
      : '#ff4a1a';

    this.redFinMaterial = new THREE.MeshPhysicalMaterial({
      map: finTex,
      bumpMap: finBump,
      bumpScale: 0.02,
      color: new THREE.Color(finTint),
      roughness: 0.24,
      metalness: 0.1,
      clearcoat: 0.75,
      clearcoatRoughness: 0.18,
      side: THREE.DoubleSide,
    });

    // Real redtails have dark grey side fins; only the tail is bright red-orange.
    this.darkFinMaterial = new THREE.MeshPhysicalMaterial({
      map: finTex,
      bumpMap: finBump,
      bumpScale: 0.02,
      color: new THREE.Color('#4a535c'),
      roughness: 0.3,
      metalness: 0.08,
      clearcoat: 0.6,
      side: THREE.DoubleSide,
    });

    this.dorsalFinMaterial = new THREE.MeshPhysicalMaterial({
      map: finTex,
      bumpMap: finBump,
      bumpScale: 0.02,
      color: new THREE.Color('#8a3a2a'),
      roughness: 0.28,
      metalness: 0.08,
      clearcoat: 0.7,
      side: THREE.DoubleSide,
    });

    this.barbelMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xfff8e6,
      roughness: 0.22,
      clearcoat: 0.85,
    });

    this.eyeMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0c1014,
      roughness: 0.04,
      metalness: 0.85,
      clearcoat: 1.0,
    });

    // 1. High-Polygon Sculpted Multi-Section Body
    const bodyGeo = createSculptedCatfishBodyGeometry();
    this.bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMaterial);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.group.add(this.bodyMesh);

    // 2. Sculpted Opercula (Gill Covers)
    const gillGeo = new THREE.SphereGeometry(0.29, 24, 20);
    gillGeo.scale(0.45, 0.88, 1.38);
    const leftGill = new THREE.Mesh(gillGeo, this.bodyMaterial);
    leftGill.position.set(0.49, -0.02, 0.36);
    leftGill.rotation.y = 0.18;
    const rightGill = new THREE.Mesh(gillGeo, this.bodyMaterial);
    rightGill.position.set(-0.49, -0.02, 0.36);
    rightGill.rotation.y = -0.18;
    this.group.add(leftGill, rightGill);

    // Plush creamy upper & lower lip rims + nostrils (nares)
    const lipMat = new THREE.MeshPhysicalMaterial({
      color: 0xf7efe0,
      roughness: 0.32,
      clearcoat: 0.8,
    });
    const mouthArcGeo = new THREE.TorusGeometry(0.45, 0.058, 18, 40, Math.PI);
    mouthArcGeo.rotateX(Math.PI / 2);
    mouthArcGeo.scale(1.18, 0.65, 1.0);
    const mouthRim = new THREE.Mesh(mouthArcGeo, lipMat);
    mouthRim.position.set(0, -0.1, 0.85);
    this.group.add(mouthRim);

    const nareGeo = new THREE.CapsuleGeometry(0.022, 0.035, 8, 14);
    const leftNare = new THREE.Mesh(nareGeo, lipMat);
    leftNare.position.set(0.22, 0.04, 1.02);
    const rightNare = new THREE.Mesh(nareGeo, lipMat);
    rightNare.position.set(-0.22, 0.04, 1.02);
    this.group.add(leftNare, rightNare);

    // 3. Expressive Wide-Set Dorsal-Lateral Eyes with Golden Iris & Cornea Lens
    const eyeWhiteMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.12,
      clearcoat: 1.0,
    });
    const goldIrisMat = new THREE.MeshStandardMaterial({
      color: 0xf5c736,
      roughness: 0.18,
      metalness: 0.3,
    });
    const eyeGeo = new THREE.SphereGeometry(0.11, 22, 22);
    const irisGeo = new THREE.SphereGeometry(0.088, 18, 18);
    irisGeo.scale(1, 1, 0.6);
    const pupilGeo = new THREE.SphereGeometry(0.068, 18, 18);
    pupilGeo.scale(1, 1, 0.5);
    const twinkleGeo = new THREE.SphereGeometry(0.026, 12, 12);
    const twinkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const leftEyeGroup = new THREE.Group();
    const leftSclera = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    const leftIris = new THREE.Mesh(irisGeo, goldIrisMat);
    leftIris.position.set(0.02, 0.01, 0.055);
    const leftPupil = new THREE.Mesh(pupilGeo, this.eyeMaterial);
    leftPupil.position.set(0.025, 0.01, 0.075);
    const twinkleL = new THREE.Mesh(twinkleGeo, twinkleMat);
    twinkleL.position.set(0.04, 0.045, 0.1);
    leftEyeGroup.add(leftSclera, leftIris, leftPupil, twinkleL);
    leftEyeGroup.position.set(0.45, 0.14, 0.78);
    leftEyeGroup.rotation.y = 0.42;
    leftEyeGroup.rotation.x = -0.18;
    this.group.add(leftEyeGroup);

    const rightEyeGroup = new THREE.Group();
    const rightSclera = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    const rightIris = new THREE.Mesh(irisGeo, goldIrisMat);
    rightIris.position.set(-0.02, 0.01, 0.055);
    const rightPupil = new THREE.Mesh(pupilGeo, this.eyeMaterial);
    rightPupil.position.set(-0.025, 0.01, 0.075);
    const twinkleR = new THREE.Mesh(twinkleGeo, twinkleMat);
    twinkleR.position.set(-0.04, 0.045, 0.1);
    rightEyeGroup.add(rightSclera, rightIris, rightPupil, twinkleR);
    rightEyeGroup.position.set(-0.45, 0.14, 0.78);
    rightEyeGroup.rotation.y = -0.42;
    rightEyeGroup.rotation.x = -0.18;
    this.group.add(rightEyeGroup);

    // 4. Smooth Curved Dorsal Fin (Sweeping cleanly BACKWARD toward -Z)
    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(0, 0);
    dorsalShape.bezierCurveTo(0.12, 0.42, 0.28, 0.72, 0.54, 0.76);
    dorsalShape.bezierCurveTo(0.72, 0.62, 0.82, 0.32, 0.78, 0.08);
    dorsalShape.quadraticCurveTo(0.7, 0.0, 0.62, 0);
    dorsalShape.closePath();

    const dorsalGeo = new THREE.ExtrudeGeometry(dorsalShape, {
      depth: 0.032,
      curveSegments: 28,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: 0.016,
      bevelThickness: 0.016,
    });
    this.dorsalFin = new THREE.Mesh(dorsalGeo, this.dorsalFinMaterial);
    this.dorsalFin.position.set(-0.016, 0.41, 0.22);
    this.dorsalFin.rotation.y = Math.PI / 2;
    this.dorsalFin.castShadow = true;
    this.group.add(this.dorsalFin);

    // 5. Fleshy Crimson-Red Adipose Fin
    const adiposeShape = new THREE.Shape();
    adiposeShape.moveTo(0, 0);
    adiposeShape.bezierCurveTo(0.08, 0.22, 0.24, 0.34, 0.4, 0.3);
    adiposeShape.bezierCurveTo(0.5, 0.2, 0.46, 0.05, 0.34, 0);
    adiposeShape.closePath();
    const adiposeGeo = new THREE.ExtrudeGeometry(adiposeShape, {
      depth: 0.042,
      curveSegments: 24,
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 0.018,
      bevelThickness: 0.018,
    });
    this.adiposeFin = new THREE.Mesh(adiposeGeo, this.darkFinMaterial);
    this.adiposeFin.position.set(-0.021, 0.24, -0.55);
    this.adiposeFin.rotation.y = Math.PI / 2;
    this.group.add(this.adiposeFin);

    // 6. Vibrant Crimson-Red Caudal (Tail) Fin at Rear (-Z) with Silky Rounded Lobes
    this.tailFin = new THREE.Group();
    this.tailFin.position.set(0, 0.02, -1.16);

    // One wide, forked fan joined to the body (it used to look like two separate paddles).
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0.17);
    tailShape.bezierCurveTo(0.2, 0.42, 0.5, 0.64, 0.8, 0.62);
    tailShape.bezierCurveTo(0.95, 0.52, 0.92, 0.27, 0.76, 0.13);
    tailShape.quadraticCurveTo(0.63, 0.0, 0.76, -0.13);
    tailShape.bezierCurveTo(0.92, -0.27, 0.95, -0.52, 0.8, -0.62);
    tailShape.bezierCurveTo(0.5, -0.64, 0.2, -0.42, 0, -0.17);
    tailShape.closePath();

    const tailGeo = new THREE.ExtrudeGeometry(tailShape, {
      depth: 0.036,
      curveSegments: 32,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: 0.018,
      bevelThickness: 0.018,
    });
    const tailMesh = new THREE.Mesh(tailGeo, this.redFinMaterial);
    tailMesh.rotation.y = Math.PI / 2;
    tailMesh.position.set(-0.018, 0, 0);
    tailMesh.castShadow = true;
    this.tailFin.add(tailMesh);
    this.group.add(this.tailFin);

    // 7. Smooth Beveled Anal Fin
    const analShape = new THREE.Shape();
    analShape.moveTo(0, 0);
    analShape.bezierCurveTo(0.12, -0.28, 0.28, -0.4, 0.44, -0.36);
    analShape.bezierCurveTo(0.54, -0.22, 0.48, -0.06, 0.35, 0);
    analShape.closePath();
    const analGeo = new THREE.ExtrudeGeometry(analShape, {
      depth: 0.026,
      curveSegments: 24,
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 0.012,
      bevelThickness: 0.012,
    });
    this.analFin = new THREE.Mesh(analGeo, this.darkFinMaterial);
    this.analFin.rotation.y = Math.PI / 2;
    this.analFin.position.set(-0.013, -0.2, -0.52);
    this.group.add(this.analFin);

    // 8. Smooth Curved Pectoral & Pelvic Fins
    const pecShape = new THREE.Shape();
    pecShape.moveTo(0, 0);
    pecShape.bezierCurveTo(0.32, 0.02, 0.68, -0.14, 0.84, -0.38);
    pecShape.bezierCurveTo(0.64, -0.56, 0.28, -0.42, 0, -0.18);
    pecShape.closePath();
    const pecGeo = new THREE.ExtrudeGeometry(pecShape, {
      depth: 0.028,
      curveSegments: 28,
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 0.014,
      bevelThickness: 0.014,
    });

    this.leftPecFin = new THREE.Mesh(pecGeo, this.darkFinMaterial);
    this.leftPecFin.position.set(0.46, -0.15, 0.3);
    this.leftPecFin.rotation.set(0.28, -0.85, -0.35);
    this.leftPecFin.scale.set(0.78, 0.78, 0.78);
    this.leftPecFin.castShadow = true;
    this.group.add(this.leftPecFin);

    this.rightPecFin = new THREE.Mesh(pecGeo, this.darkFinMaterial);
    this.rightPecFin.position.set(-0.46, -0.15, 0.3);
    this.rightPecFin.rotation.set(0.28, 0.85, 0.35);
    this.rightPecFin.scale.set(-0.78, 0.78, 0.78);
    this.rightPecFin.castShadow = true;
    this.group.add(this.rightPecFin);

    const pelvGeo = pecGeo.clone();
    pelvGeo.scale(0.55, 0.55, 0.55);
    this.leftPelvicFin = new THREE.Mesh(pelvGeo, this.darkFinMaterial);
    this.leftPelvicFin.position.set(0.24, -0.24, -0.18);
    this.leftPelvicFin.rotation.set(0.2, -0.4, -0.45);
    this.rightPelvicFin = new THREE.Mesh(pelvGeo, this.darkFinMaterial);
    this.rightPelvicFin.position.set(-0.24, -0.24, -0.18);
    this.rightPelvicFin.rotation.set(0.2, 0.4, 0.45);
    this.rightPelvicFin.scale.set(-1, 1, 1);
    this.group.add(this.leftPelvicFin, this.rightPelvicFin);

    // 9. 3D Volumetric Tapered Maxillary Barbels (10 smooth overlapping capsule-like segments each)
    const segCount = 10;
    for (let i = 0; i < segCount; i++) {
      const t0 = i / segCount;
      const t1 = (i + 1) / segCount;
      const r0 = THREE.MathUtils.lerp(0.029, 0.005, t0);
      const r1 = THREE.MathUtils.lerp(0.029, 0.005, t1);
      const segGeo = new THREE.CylinderGeometry(r1, r0, 0.15, 8, 1, false);
      segGeo.rotateX(Math.PI / 2);

      const segL = new THREE.Mesh(segGeo, this.barbelMaterial);
      const segR = new THREE.Mesh(segGeo, this.barbelMaterial);
      this.leftBarbelSegments.push(segL);
      this.rightBarbelSegments.push(segR);
      this.group.add(segL, segR);
    }

    // 10. Smooth Curved 3D Mental (Chin) Barbels under the lower jaw using CatmullRomCurve3
    const chinOffsets = [
      { x: -0.24, z: 0.88, len: 0.48, flare: -0.14 },
      { x: -0.09, z: 0.95, len: 0.38, flare: -0.06 },
      { x: 0.09, z: 0.95, len: 0.38, flare: 0.06 },
      { x: 0.24, z: 0.88, len: 0.48, flare: 0.14 },
    ];
    chinOffsets.forEach((ch) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(ch.flare * 0.4, -ch.len * 0.45, -ch.len * 0.22),
        new THREE.Vector3(ch.flare, -ch.len * 0.85, -ch.len * 0.58),
      ]);
      const cGeo = new THREE.TubeGeometry(curve, 12, 0.014, 10, false);
      // Taper the tube vertices toward the tip
      const cPos = cGeo.attributes.position;
      for (let k = 0; k < cPos.count; k++) {
        const vy = cPos.getY(k);
        const prog = THREE.MathUtils.clamp(-vy / (ch.len * 0.85), 0, 1);
        const centerPt = curve.getPoint(prog);
        const scale = THREE.MathUtils.lerp(1.15, 0.3, prog);
        cPos.setXYZ(
          k,
          centerPt.x + (cPos.getX(k) - centerPt.x) * scale,
          centerPt.y + (cPos.getY(k) - centerPt.y) * scale,
          centerPt.z + (cPos.getZ(k) - centerPt.z) * scale
        );
      }
      cGeo.computeVertexNormals();
      const cMesh = new THREE.Mesh(cGeo, this.barbelMaterial);
      cMesh.position.set(ch.x, -0.17, ch.z);
      this.chinBarbelMeshes.push(cMesh);
      this.group.add(cMesh);
    });

    // 11. Smooth Sonar Ring around Snout
    const sonarGeo = new THREE.RingGeometry(0.25, 0.42, 48);
    sonarGeo.rotateX(Math.PI / 2);
    const sonarMat = new THREE.MeshBasicMaterial({
      color: 0xffea55,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    this.sonarRing = new THREE.Mesh(sonarGeo, sonarMat);
    this.sonarRing.position.set(0, -0.08, 1.05);
    this.group.add(this.sonarRing);

    this.group.scale.set(0.95, 0.95, 0.95);
    this.update(0.016, 1.0, 0, 0);
  }

  /**
   * Rainbow Whiskers: tail and fins cycle through rainbow colors. Reads the materials from the
   * meshes because they may have been swapped for cheaper ones after construction.
   */
  public setRainbow(on: boolean) {
    if (on === this.rainbowMode) return;
    this.rainbowMode = on;
    if (on) {
      const fins: THREE.Object3D[] = [
        ...this.tailFin.children,
        this.dorsalFin,
        this.adiposeFin,
        this.analFin,
        this.leftPecFin,
        this.rightPecFin,
        this.leftPelvicFin,
        this.rightPelvicFin,
      ];
      const seen = new Set<THREE.Material>();
      this.rainbowMats = [];
      fins.forEach((o) => {
        const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (!mat || !mat.color || seen.has(mat)) return;
        seen.add(mat);
        this.rainbowMats.push({
          mat,
          color: mat.color.clone(),
          emissive: mat.emissive.clone(),
          emissiveIntensity: mat.emissiveIntensity,
          map: mat.map,
          offset: this.rainbowMats.length * 0.25,
        });
        mat.map = null; // the reddish fin texture would tint every color red
        mat.needsUpdate = true;
      });
    } else {
      this.rainbowMats.forEach((r) => {
        r.mat.color.copy(r.color);
        r.mat.emissive.copy(r.emissive);
        r.mat.emissiveIntensity = r.emissiveIntensity;
        r.mat.map = r.map;
        r.mat.needsUpdate = true;
      });
      this.rainbowMats = [];
    }
  }

  public pulseBarbelSonar() {
    this.sonarPulseTimer = 1.0;
  }

  public update(dt: number, speed: number, turning: number, diving: number) {
    if (this.rainbowMode) {
      this.rainbowTime += dt;
      this.rainbowMats.forEach((r) => {
        const hue = (this.rainbowTime * 0.3 + r.offset) % 1;
        r.mat.color.setHSL(hue, 0.95, 0.55);
        r.mat.emissive.setHSL(hue, 1, 0.3);
        r.mat.emissiveIntensity = 0.7;
      });
    }

    const swimFreq = (3.4 + speed * 1.45) * (this.isBoosting ? 1.55 : 1.0);
    this.tailSwimPhase += dt * swimFreq;

    const tailAngle = Math.sin(this.tailSwimPhase) * (0.32 + speed * 0.14) - turning * 0.35;
    this.tailFin.rotation.y = tailAngle;

    this.bodyMesh.rotation.y = Math.sin(this.tailSwimPhase - 0.6) * 0.055 + turning * 0.15;

    this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, -turning * 0.38, dt * 8);
    this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, -diving * 0.32, dt * 8);

    const leftPecRoll =
      -0.35 + Math.sin(this.tailSwimPhase) * 0.14 - (turning > 0 ? turning * 0.3 : 0);
    const rightPecRoll =
      0.35 - Math.sin(this.tailSwimPhase) * 0.14 - (turning < 0 ? turning * 0.3 : 0);
    this.leftPecFin.rotation.z = leftPecRoll;
    this.rightPecFin.rotation.z = rightPecRoll;

    // Update 3D Volumetric Maxillary Barbel Chains
    const dragZ = Math.min(0.6, speed * 0.18);
    const segCount = this.leftBarbelSegments.length;

    let prevLX = 0.44;
    let prevLY = -0.06;
    let prevLZ = 0.96;

    let prevRX = -0.44;
    let prevRY = -0.06;
    let prevRZ = 0.96;

    for (let i = 0; i < segCount; i++) {
      const t = (i + 1) / segCount;
      const nextLX =
        0.44 + Math.sin(t * 1.4) * 0.36 + Math.sin(this.tailSwimPhase + t * 2.5) * 0.07;
      const nextLY = -0.06 - t * 0.2 + diving * t * 0.2;
      const nextLZ = 0.96 - t * (1.05 + dragZ * 0.6);

      const segL = this.leftBarbelSegments[i];
      segL.position.set(
        (prevLX + nextLX) * 0.5,
        (prevLY + nextLY) * 0.5,
        (prevLZ + nextLZ) * 0.5
      );
      segL.lookAt(this.group.localToWorld(_barbelTarget.set(nextLX, nextLY, nextLZ)));

      prevLX = nextLX;
      prevLY = nextLY;
      prevLZ = nextLZ;

      const nextRX =
        -0.44 - Math.sin(t * 1.4) * 0.36 - Math.sin(this.tailSwimPhase + t * 2.5) * 0.07;
      const nextRY = -0.06 - t * 0.2 + diving * t * 0.2;
      const nextRZ = 0.96 - t * (1.05 + dragZ * 0.6);

      const segR = this.rightBarbelSegments[i];
      segR.position.set(
        (prevRX + nextRX) * 0.5,
        (prevRY + nextRY) * 0.5,
        (prevRZ + nextRZ) * 0.5
      );
      segR.lookAt(this.group.localToWorld(_barbelTarget.set(nextRX, nextRY, nextRZ)));

      prevRX = nextRX;
      prevRY = nextRY;
      prevRZ = nextRZ;
    }

    this.chinBarbelMeshes.forEach((cb, idx) => {
      cb.rotation.z = Math.sin(this.tailSwimPhase * 1.3 + idx) * 0.12;
      cb.rotation.x = Math.cos(this.tailSwimPhase + idx) * 0.08;
    });

    if (this.sonarPulseTimer > 0) {
      this.sonarPulseTimer -= dt * 1.8;
      const progress = 1.0 - Math.max(0, this.sonarPulseTimer);
      const scale = 1.0 + progress * 5.5;
      this.sonarRing.scale.set(scale, scale, scale);
      (this.sonarRing.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        (1.0 - progress) * 0.85
      );
    } else {
      (this.sonarRing.material as THREE.MeshBasicMaterial).opacity = 0;
    }
  }

  public dispose() {
    this.bodyMesh.geometry.dispose();
    this.bodyMaterial.dispose();
    this.redFinMaterial.dispose();
    this.dorsalFinMaterial.dispose();
    this.barbelMaterial.dispose();
    this.eyeMaterial.dispose();
    this.tailFin.children.forEach((c) => {
      if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
    });
    this.leftPecFin.geometry.dispose();
    this.rightPecFin.geometry.dispose();
    this.leftPelvicFin.geometry.dispose();
    this.rightPelvicFin.geometry.dispose();
    this.dorsalFin.geometry.dispose();
    this.adiposeFin.geometry.dispose();
    this.analFin.geometry.dispose();
    this.sonarRing.geometry.dispose();
    (this.sonarRing.material as THREE.Material).dispose();
  }
}
