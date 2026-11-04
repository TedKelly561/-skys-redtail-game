import * as THREE from 'three';

/**
 * Generates an authentic, high-contrast procedural skin texture for the
 * Amazonian Redtail Catfish (Phractocephalus hemioliopterus):
 * - Deep olive-charcoal / dark brown dorsal surface with natural dark spots/blotches
 * - Crisp, bold creamy-white lateral band running along the flank from snout to tail
 * - Pure creamy-ivory flat underbelly
 */
function createCatfishSkinTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base creamy white belly & flank
  ctx.fillStyle = '#fcf8ec';
  ctx.fillRect(0, 0, 512, 512);

  // In cylinder UV mapping (after rotateX(PI/2)), V or U wraps around the circumference.
  // We map vertex UVs explicitly on our sculpted body so:
  // v = 1.0 is top dorsal ridge, v = 0.5 is lateral mid-flank, v = 0.0 is bottom belly.
  // Notice Canvas Y=0 is top (v=1.0 in Three.js default flipY=true) and Y=512 is bottom (v=0.0).

  // 1. Dorsal dark charcoal-brown gradient (Y = 0 to 255)
  const dorsalGrad = ctx.createLinearGradient(0, 0, 0, 270);
  dorsalGrad.addColorStop(0.0, '#1f2426');
  dorsalGrad.addColorStop(0.45, '#2d3538');
  dorsalGrad.addColorStop(0.82, '#3d4644');
  dorsalGrad.addColorStop(0.95, '#2b3030');
  dorsalGrad.addColorStop(1.0, '#fcf8ec');
  ctx.fillStyle = dorsalGrad;
  ctx.fillRect(0, 0, 512, 265);

  // 2. Iconic Crisp Creamy-White Lateral Stripe (Y = 250 to 335)
  const stripeGrad = ctx.createLinearGradient(0, 245, 0, 345);
  stripeGrad.addColorStop(0.0, '#fffdf5');
  stripeGrad.addColorStop(0.5, '#ffffff');
  stripeGrad.addColorStop(1.0, '#f7f2e1');
  ctx.fillStyle = stripeGrad;
  ctx.fillRect(0, 250, 512, 95);

  // 3. Characteristic dark blotches & leopard-like spots along the upper dorsal & flank
  for (let i = 0; i < 110; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 235 + 8;
    const rx = Math.random() * 14 + 5;
    const ry = Math.random() * 9 + 4;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(15, 18, 20, 0.65)' : 'rgba(28, 34, 30, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, (Math.random() - 0.5) * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle dark border speckles right along the top edge of the white lateral stripe
  for (let i = 0; i < 45; i++) {
    const x = (i / 45) * 512 + (Math.random() - 0.5) * 8;
    const y = 244 + (Math.random() - 0.5) * 8;
    ctx.fillStyle = 'rgba(22, 26, 28, 0.75)';
    ctx.beginPath();
    ctx.arc(x, y, Math.random() * 6 + 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Creates a procedural fin-ray texture for the vibrant crimson-red tail and fins
 */
function createRedFinTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.0, '#d62818');
  grad.addColorStop(0.35, '#ff3b1f');
  grad.addColorStop(0.85, '#ff5938');
  grad.addColorStop(1.0, '#ff7854');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle radial fin rays
  ctx.strokeStyle = 'rgba(140, 15, 5, 0.28)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 24; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 128 + (i - 12) * 3);
    ctx.lineTo(256, (i / 23) * 256);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Sculpts the characteristic Redtail Catfish body geometry:
 * - Local +Z is FORWARD (broad, flat spade-shaped head and snout)
 * - Local -Z is BACKWARD (muscular caudal peduncle leading to the red tail)
 */
function createSculptedCatfishBodyGeometry(): THREE.BufferGeometry {
  const lengthSegments = 28;
  const radialSegments = 24;
  const totalLength = 2.45; // z from -1.20 (tail base) to +1.25 (snout tip)

  const geometry = new THREE.CylinderGeometry(0.4, 0.4, totalLength, radialSegments, lengthSegments, false);
  geometry.rotateX(Math.PI / 2);

  const pos = geometry.attributes.position;
  const uvs = geometry.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);

    // Normalized longitudinal coordinate t in [0 (tail at -1.225), 1 (snout tip at +1.225)]
    const t = THREE.MathUtils.clamp((vz + totalLength / 2) / totalLength, 0, 1);

    // Angle around cross-section
    const lenR = Math.hypot(vx, vy);
    const nx = lenR > 1e-5 ? vx / lenR : 0;
    const ny = lenR > 1e-5 ? vy / lenR : 0;

    // Determine width (half-width X) and height (half-height Y) profile along the catfish body:
    // t = 0.00..0.20: Caudal peduncle (narrow, laterally compressed)
    // t = 0.20..0.55: Mid-trunk & dorsal hump (tall, muscular, broad)
    // t = 0.55..0.82: Head & gill plates (very wide, starting to flatten dorsoventrally)
    // t = 0.82..1.00: Broad rounded spade snout (wide horizontally, flat vertically)
    let widthProfile = 0.2;
    let topHeightProfile = 0.22;
    let bottomHeightProfile = 0.18;

    if (t < 0.2) {
      const k = t / 0.2;
      widthProfile = THREE.MathUtils.lerp(0.11, 0.34, k);
      topHeightProfile = THREE.MathUtils.lerp(0.18, 0.36, k);
      bottomHeightProfile = THREE.MathUtils.lerp(0.15, 0.26, k);
    } else if (t < 0.58) {
      const k = (t - 0.2) / 0.38;
      const hump = Math.sin(k * Math.PI);
      widthProfile = THREE.MathUtils.lerp(0.34, 0.58, k) + hump * 0.05;
      topHeightProfile = THREE.MathUtils.lerp(0.36, 0.46, Math.sin(k * Math.PI * 0.65)) + hump * 0.08;
      bottomHeightProfile = THREE.MathUtils.lerp(0.26, 0.3, k);
    } else if (t < 0.86) {
      const k = (t - 0.58) / 0.28;
      // Head widens into the signature broad catfish skull while sloping down toward the snout
      widthProfile = THREE.MathUtils.lerp(0.58, 0.62, Math.sin(k * Math.PI * 0.5));
      topHeightProfile = THREE.MathUtils.lerp(0.42, 0.24, k);
      bottomHeightProfile = THREE.MathUtils.lerp(0.3, 0.2, k);
    } else {
      const k = (t - 0.86) / 0.14;
      // Rounded spade snout closure
      const roundClosure = Math.cos(k * Math.PI * 0.48);
      widthProfile = 0.62 * roundClosure;
      topHeightProfile = THREE.MathUtils.lerp(0.24, 0.09, k) * roundClosure;
      bottomHeightProfile = THREE.MathUtils.lerp(0.2, 0.09, k) * roundClosure;
    }

    // Flatten the belly (catfish are benthic bottom-dwellers with a flat underside)
    let sy = ny >= 0 ? ny * topHeightProfile : ny * bottomHeightProfile;
    if (ny < -0.55) {
      sy = Math.max(sy, -bottomHeightProfile * 0.78);
    }

    // Slight downward slope of the snout
    const snoutDrop = t > 0.6 ? -(t - 0.6) * 0.22 : 0;

    const sx = nx * widthProfile;
    const finalY = sy + snoutDrop;

    pos.setXYZ(i, sx, finalY, vz);

    // Explicit UV mapping so the lateral white stripe sits cleanly along the mid-flank
    // v = 1 at top back, v = 0.42 at lateral stripe, v = 0 at flat belly
    const vCoord = THREE.MathUtils.clamp((ny + 1.0) * 0.5, 0, 1);
    uvs.setXY(i, t, vCoord);
  }

  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Procedural Redtail Catfish 3D Character (Phractocephalus hemioliopterus)
 * Local +Z = Forward (Snout/Head)
 * Local -Z = Backward (Red Tail)
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

  // Maxillary (upper) barbels and chin barbels
  public maxillaryBarbelLeft: THREE.Line;
  public maxillaryBarbelRight: THREE.Line;
  public chinBarbels: THREE.Line[] = [];

  private barbelNodesLeft: THREE.Vector3[] = [];
  private barbelNodesRight: THREE.Vector3[] = [];

  // Sonar wave effect for barbels
  public sonarRing: THREE.Mesh;

  // Materials
  private bodyMaterial: THREE.MeshStandardMaterial;
  private redFinMaterial: THREE.MeshStandardMaterial;
  private dorsalFinMaterial: THREE.MeshStandardMaterial;
  private barbelMaterial: THREE.LineBasicMaterial;
  private eyeMaterial: THREE.MeshStandardMaterial;

  // Kinematic state
  private tailSwimPhase: number = 0;
  public swimSpeedMultiplier: number = 1.0;
  public isBoosting: boolean = false;
  public sonarPulseTimer: number = 0;

  constructor(isFriendlyNPC: boolean = false, npcColorVariation: number = 0) {
    this.group = new THREE.Group();

    // 1. Authentic Materials
    const skinTex = createCatfishSkinTexture();
    const finTex = createRedFinTexture();

    this.bodyMaterial = new THREE.MeshStandardMaterial({
      map: skinTex,
      roughness: 0.32,
      metalness: 0.08,
    });

    const finTint = isFriendlyNPC
      ? npcColorVariation === 1
        ? '#ff6d2e'
        : npcColorVariation === 2
        ? '#ff2e24'
        : '#ff491f'
      : '#ff3818';

    this.redFinMaterial = new THREE.MeshStandardMaterial({
      map: finTex,
      color: new THREE.Color(finTint),
      roughness: 0.25,
      metalness: 0.12,
      side: THREE.DoubleSide,
    });

    this.dorsalFinMaterial = new THREE.MeshStandardMaterial({
      map: finTex,
      color: new THREE.Color('#e04828'),
      roughness: 0.3,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    this.barbelMaterial = new THREE.LineBasicMaterial({
      color: 0xfff8dc,
      linewidth: 3,
    });

    this.eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0x101418,
      roughness: 0.05,
      metalness: 0.85,
    });

    // 2. Sculpted Multi-Section Redtail Catfish Body
    const bodyGeo = createSculptedCatfishBodyGeometry();
    this.bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMaterial);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.group.add(this.bodyMesh);

    // 3. Sculpted Gill Covers (Opercula) & Wide Catfish Smile Lip Ridge
    const gillGeo = new THREE.SphereGeometry(0.28, 12, 10);
    gillGeo.scale(0.45, 0.85, 1.35);
    const leftGill = new THREE.Mesh(gillGeo, this.bodyMaterial);
    leftGill.position.set(0.48, -0.02, 0.36);
    leftGill.rotation.y = 0.18;
    const rightGill = new THREE.Mesh(gillGeo, this.bodyMaterial);
    rightGill.position.set(-0.48, -0.02, 0.36);
    rightGill.rotation.y = -0.18;
    this.group.add(leftGill, rightGill);

    // Plush creamy upper lip rim around the wide flat mouth
    const lipMat = new THREE.MeshStandardMaterial({
      color: 0xf5ecd3,
      roughness: 0.4,
    });
    const mouthArcGeo = new THREE.TorusGeometry(0.44, 0.055, 8, 20, Math.PI);
    mouthArcGeo.rotateX(Math.PI / 2);
    mouthArcGeo.scale(1.18, 0.65, 1.0);
    const mouthRim = new THREE.Mesh(mouthArcGeo, lipMat);
    mouthRim.position.set(0, -0.1, 0.84);
    this.group.add(mouthRim);

    // 4. Expressive Wide-Set Dorsal-Lateral Eyes (Facing Forward +Z and slightly Outward)
    const eyeWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.15,
    });
    const goldIrisMat = new THREE.MeshStandardMaterial({
      color: 0xf4c430,
      roughness: 0.2,
    });
    const eyeGeo = new THREE.SphereGeometry(0.11, 14, 14);
    const irisGeo = new THREE.SphereGeometry(0.088, 12, 12);
    irisGeo.scale(1, 1, 0.6);
    const pupilGeo = new THREE.SphereGeometry(0.068, 12, 12);
    pupilGeo.scale(1, 1, 0.5);
    const twinkleGeo = new THREE.SphereGeometry(0.026, 8, 8);
    const twinkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Left Eye (+X side)
    const leftEyeGroup = new THREE.Group();
    const leftSclera = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    const leftIris = new THREE.Mesh(irisGeo, goldIrisMat);
    leftIris.position.set(0.02, 0.01, 0.055);
    const leftPupil = new THREE.Mesh(pupilGeo, this.eyeMaterial);
    leftPupil.position.set(0.025, 0.01, 0.075);
    const twinkleL = new THREE.Mesh(twinkleGeo, twinkleMat);
    twinkleL.position.set(0.04, 0.045, 0.1);
    leftEyeGroup.add(leftSclera, leftIris, leftPupil, twinkleL);
    leftEyeGroup.position.set(0.44, 0.14, 0.78);
    leftEyeGroup.rotation.y = 0.42;
    leftEyeGroup.rotation.x = -0.18;
    this.group.add(leftEyeGroup);

    // Right Eye (-X side)
    const rightEyeGroup = new THREE.Group();
    const rightSclera = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    const rightIris = new THREE.Mesh(irisGeo, goldIrisMat);
    rightIris.position.set(-0.02, 0.01, 0.055);
    const rightPupil = new THREE.Mesh(pupilGeo, this.eyeMaterial);
    rightPupil.position.set(-0.025, 0.01, 0.075);
    const twinkleR = new THREE.Mesh(twinkleGeo, twinkleMat);
    twinkleR.position.set(-0.04, 0.045, 0.1);
    rightEyeGroup.add(rightSclera, rightIris, rightPupil, twinkleR);
    rightEyeGroup.position.set(-0.44, 0.14, 0.78);
    rightEyeGroup.rotation.y = -0.42;
    rightEyeGroup.rotation.x = -0.18;
    this.group.add(rightEyeGroup);

    // 5. Dorsal Fin (Sweeping cleanly BACKWARD toward -Z!)
    // Note: With rotation.y = +Math.PI / 2, shape +X maps to local -Z (towards the tail).
    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(0, 0); // Front base of dorsal fin
    dorsalShape.quadraticCurveTo(0.18, 0.55, 0.48, 0.72); // Leading edge sweeping up & back
    dorsalShape.quadraticCurveTo(0.68, 0.52, 0.78, 0.12); // Trailing edge
    dorsalShape.lineTo(0.62, 0); // Rear base of dorsal fin
    dorsalShape.closePath();

    const dorsalGeo = new THREE.ExtrudeGeometry(dorsalShape, {
      depth: 0.036,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.015,
      bevelThickness: 0.015,
    });
    this.dorsalFin = new THREE.Mesh(dorsalGeo, this.dorsalFinMaterial);
    // Position at top of humped back, sweeping backward (-Z)
    this.dorsalFin.position.set(-0.018, 0.4, 0.22);
    this.dorsalFin.rotation.y = Math.PI / 2;
    this.dorsalFin.castShadow = true;
    this.group.add(this.dorsalFin);

    // 6. Signature Fleshy Crimson-Red Adipose Fin (between dorsal fin and tail at z = -0.68)
    const adiposeShape = new THREE.Shape();
    adiposeShape.moveTo(0, 0);
    adiposeShape.quadraticCurveTo(0.12, 0.26, 0.36, 0.28);
    adiposeShape.quadraticCurveTo(0.46, 0.16, 0.34, 0);
    adiposeShape.closePath();
    const adiposeGeo = new THREE.ExtrudeGeometry(adiposeShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.015,
      bevelThickness: 0.015,
    });
    this.adiposeFin = new THREE.Mesh(adiposeGeo, this.redFinMaterial);
    this.adiposeFin.position.set(-0.02, 0.24, -0.55);
    this.adiposeFin.rotation.y = Math.PI / 2;
    this.group.add(this.adiposeFin);

    // 7. Iconic Vibrant Crimson-Red Caudal (Tail) Fin at Rear (-Z)
    // Positioned at the end of the caudal peduncle (z = -1.16) and extending backward to z = -2.05!
    this.tailFin = new THREE.Group();
    this.tailFin.position.set(0, 0.02, -1.16);

    const tailShape = new THREE.Shape();
    // x = 0 is the attachment at z = -1.16; +x maps to -z (further behind the fish!)
    tailShape.moveTo(0, 0.08);
    // Broad rounded upper lobe characteristic of Redtail Catfish
    tailShape.quadraticCurveTo(0.32, 0.56, 0.78, 0.64);
    tailShape.quadraticCurveTo(0.96, 0.48, 0.84, 0.14);
    // Shallow central notch
    tailShape.quadraticCurveTo(0.7, 0.0, 0.84, -0.14);
    // Broad rounded lower lobe
    tailShape.quadraticCurveTo(0.96, -0.48, 0.78, -0.64);
    tailShape.quadraticCurveTo(0.32, -0.56, 0, -0.08);
    tailShape.closePath();

    const tailGeo = new THREE.ExtrudeGeometry(tailShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.018,
      bevelThickness: 0.018,
    });
    const tailMesh = new THREE.Mesh(tailGeo, this.redFinMaterial);
    // rotation.y = +Math.PI / 2 maps +X of tailShape strictly to -Z (extending behind the fish!)
    tailMesh.rotation.y = Math.PI / 2;
    tailMesh.position.set(-0.02, 0, 0);
    tailMesh.castShadow = true;
    this.tailFin.add(tailMesh);
    this.group.add(this.tailFin);

    // 8. Anal Fin (underneath rear peduncle, sweeping backward toward -Z)
    const analShape = new THREE.Shape();
    analShape.moveTo(0, 0);
    analShape.quadraticCurveTo(0.15, -0.34, 0.42, -0.36);
    analShape.quadraticCurveTo(0.5, -0.15, 0.35, 0);
    analShape.closePath();
    const analGeo = new THREE.ExtrudeGeometry(analShape, { depth: 0.03, bevelEnabled: false });
    this.analFin = new THREE.Mesh(analGeo, this.redFinMaterial);
    this.analFin.rotation.y = Math.PI / 2;
    this.analFin.position.set(-0.015, -0.2, -0.52);
    this.group.add(this.analFin);

    // 9. Pectoral Fins (Left & Right, sweeping outward & backward)
    const pecShape = new THREE.Shape();
    pecShape.moveTo(0, 0);
    pecShape.quadraticCurveTo(0.45, -0.05, 0.78, -0.38);
    pecShape.quadraticCurveTo(0.42, -0.52, 0, -0.18);
    pecShape.closePath();
    const pecGeo = new THREE.ExtrudeGeometry(pecShape, {
      depth: 0.03,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.01,
      bevelThickness: 0.01,
    });

    this.leftPecFin = new THREE.Mesh(pecGeo, this.redFinMaterial);
    this.leftPecFin.position.set(0.48, -0.14, 0.32);
    this.leftPecFin.rotation.set(0.28, -0.45, -0.35);
    this.leftPecFin.castShadow = true;
    this.group.add(this.leftPecFin);

    this.rightPecFin = new THREE.Mesh(pecGeo, this.redFinMaterial);
    this.rightPecFin.position.set(-0.48, -0.14, 0.32);
    this.rightPecFin.rotation.set(0.28, 0.45, 0.35);
    this.rightPecFin.scale.set(-1, 1, 1);
    this.rightPecFin.castShadow = true;
    this.group.add(this.rightPecFin);

    // 10. Pelvic (Ventral) Fins
    const pelvGeo = pecGeo.clone();
    pelvGeo.scale(0.55, 0.55, 0.55);
    this.leftPelvicFin = new THREE.Mesh(pelvGeo, this.redFinMaterial);
    this.leftPelvicFin.position.set(0.24, -0.24, -0.18);
    this.leftPelvicFin.rotation.set(0.2, -0.4, -0.45);
    this.rightPelvicFin = new THREE.Mesh(pelvGeo, this.redFinMaterial);
    this.rightPelvicFin.position.set(-0.24, -0.24, -0.18);
    this.rightPelvicFin.rotation.set(0.2, 0.4, 0.45);
    this.rightPelvicFin.scale.set(-1, 1, 1);
    this.group.add(this.leftPelvicFin, this.rightPelvicFin);

    // 11. 6 Expressive Sensory Barbels (Whiskers)
    // 2 Long Maxillary Barbels attached at corners of upper snout (z = +0.96) sweeping back toward -Z
    const pointsLeft: THREE.Vector3[] = [];
    const pointsRight: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      pointsLeft.push(
        new THREE.Vector3(0.44 + Math.sin(t * 1.4) * 0.55, -0.06 - t * 0.22, 0.96 - t * 1.65)
      );
      pointsRight.push(
        new THREE.Vector3(-0.44 - Math.sin(t * 1.4) * 0.55, -0.06 - t * 0.22, 0.96 - t * 1.65)
      );
    }
    this.barbelNodesLeft = pointsLeft;
    this.barbelNodesRight = pointsRight;

    const leftBarbelGeo = new THREE.BufferGeometry().setFromPoints(pointsLeft);
    this.maxillaryBarbelLeft = new THREE.Line(leftBarbelGeo, this.barbelMaterial);
    this.group.add(this.maxillaryBarbelLeft);

    const rightBarbelGeo = new THREE.BufferGeometry().setFromPoints(pointsRight);
    this.maxillaryBarbelRight = new THREE.Line(rightBarbelGeo, this.barbelMaterial);
    this.group.add(this.maxillaryBarbelRight);

    // 4 Mental (Chin) Barbels under the flat lower jaw
    const chinOffsets = [
      { x: -0.22, z: 0.88 },
      { x: -0.08, z: 0.95 },
      { x: 0.08, z: 0.95 },
      { x: 0.22, z: 0.88 },
    ];
    chinOffsets.forEach((ch) => {
      const chinPts = [
        new THREE.Vector3(ch.x, -0.2, ch.z),
        new THREE.Vector3(ch.x * 1.25, -0.36, ch.z - 0.22),
        new THREE.Vector3(ch.x * 1.45, -0.45, ch.z - 0.52),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(chinPts);
      const line = new THREE.Line(geo, this.barbelMaterial);
      this.chinBarbels.push(line);
      this.group.add(line);
    });

    // 12. Sonar Ring around Snout
    const sonarGeo = new THREE.RingGeometry(0.25, 0.42, 32);
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
  }

  public pulseBarbelSonar() {
    this.sonarPulseTimer = 1.0;
  }

  public update(dt: number, speed: number, turning: number, diving: number) {
    const swimFreq = (3.4 + speed * 1.45) * (this.isBoosting ? 1.55 : 1.0);
    this.tailSwimPhase += dt * swimFreq;

    // Fluid sinusoidal tail wagging
    const tailAngle = Math.sin(this.tailSwimPhase) * (0.32 + speed * 0.14) - turning * 0.35;
    this.tailFin.rotation.y = tailAngle;

    // Counter-sway of torso for authentic fish propulsion
    this.bodyMesh.rotation.y = Math.sin(this.tailSwimPhase - 0.6) * 0.055 + turning * 0.15;

    // Smooth banking into left/right turns and pitching into dives/climbs
    this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, -turning * 0.38, dt * 8);
    this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, -diving * 0.32, dt * 8);

    // Pectoral fin feathering
    const leftPecRoll =
      -0.35 + Math.sin(this.tailSwimPhase) * 0.14 - (turning > 0 ? turning * 0.3 : 0);
    const rightPecRoll =
      0.35 - Math.sin(this.tailSwimPhase) * 0.14 - (turning < 0 ? turning * 0.3 : 0);
    this.leftPecFin.rotation.z = leftPecRoll;
    this.rightPecFin.rotation.z = rightPecRoll;

    // Barbel fluid drag simulation
    const dragZ = Math.min(0.6, speed * 0.18);
    for (let i = 1; i < this.barbelNodesLeft.length; i++) {
      const t = i / 7;
      const baseX =
        0.44 + Math.sin(t * 1.4) * 0.55 + Math.sin(this.tailSwimPhase + t * 2.4) * 0.09;
      const baseY = -0.06 - t * 0.24 + diving * t * 0.2;
      const baseZ = 0.96 - t * (1.65 + dragZ);
      this.barbelNodesLeft[i].set(baseX, baseY, baseZ);
    }
    this.maxillaryBarbelLeft.geometry.setFromPoints(this.barbelNodesLeft);
    this.maxillaryBarbelLeft.geometry.attributes.position.needsUpdate = true;

    for (let i = 1; i < this.barbelNodesRight.length; i++) {
      const t = i / 7;
      const baseX =
        -0.44 - Math.sin(t * 1.4) * 0.55 - Math.sin(this.tailSwimPhase + t * 2.4) * 0.09;
      const baseY = -0.06 - t * 0.24 + diving * t * 0.2;
      const baseZ = 0.96 - t * (1.65 + dragZ);
      this.barbelNodesRight[i].set(baseX, baseY, baseZ);
    }
    this.maxillaryBarbelRight.geometry.setFromPoints(this.barbelNodesRight);
    this.maxillaryBarbelRight.geometry.attributes.position.needsUpdate = true;

    this.chinBarbels.forEach((cb, idx) => {
      cb.rotation.z = Math.sin(this.tailSwimPhase * 1.2 + idx) * 0.12;
      cb.rotation.x = -Math.cos(this.tailSwimPhase + idx) * 0.08;
    });

    // Sonar ring expand
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
