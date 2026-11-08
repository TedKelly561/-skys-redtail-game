import * as THREE from 'three';

/**
 * High-Resolution Procedural PBR Texture & Bump Map Library
 * Generates zero-404, 100% procedural CanvasTextures for realistic river substrates,
 * water ripples/caustics, weathered wood bark, granite cobbles, fish scales, and turtle shells.
 */

let cachedTextures: {
  riverbedAlbedo: THREE.CanvasTexture;
  riverbedBump: THREE.CanvasTexture;
  waterNormal: THREE.CanvasTexture;
  barkAlbedo: THREE.CanvasTexture;
  barkBump: THREE.CanvasTexture;
  rockAlbedo: THREE.CanvasTexture;
  rockBump: THREE.CanvasTexture;
  lilyPadAlbedo: THREE.CanvasTexture;
  minnowScaleAlbedo: THREE.CanvasTexture;
  turtleShellAlbedo: THREE.CanvasTexture;
  dragonflyWingAlbedo: THREE.CanvasTexture;
} | null = null;

export function getGameTextures() {
  if (cachedTextures) return cachedTextures;

  // 1. Riverbed Albedo & Bump (Sand ripples, pebbles, gravel & sunlight caustics)
  const bedCanvas = document.createElement('canvas');
  bedCanvas.width = 512;
  bedCanvas.height = 512;
  const bCtx = bedCanvas.getContext('2d')!;

  const bedBumpCanvas = document.createElement('canvas');
  bedBumpCanvas.width = 512;
  bedBumpCanvas.height = 512;
  const bbCtx = bedBumpCanvas.getContext('2d')!;

  // Warm river sand base
  bCtx.fillStyle = '#d8c39e';
  bCtx.fillRect(0, 0, 512, 512);
  bbCtx.fillStyle = '#808080';
  bbCtx.fillRect(0, 0, 512, 512);

  // Current-sculpted sand ripple waves
  for (let y = 0; y < 512; y += 4) {
    const wave = Math.sin((y / 512) * Math.PI * 16) * 0.5 + 0.5;
    bCtx.fillStyle = `rgba(180, 155, 115, ${wave * 0.25})`;
    bCtx.fillRect(0, y, 512, 3);

    const bumpVal = Math.floor(110 + wave * 36);
    bbCtx.fillStyle = `rgb(${bumpVal}, ${bumpVal}, ${bumpVal})`;
    bbCtx.fillRect(0, y, 512, 3);
  }

  // Fine sediment grain
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    bCtx.fillStyle = i % 2 === 0 ? 'rgba(120, 100, 75, 0.22)' : 'rgba(245, 235, 210, 0.25)';
    bCtx.fillRect(x, y, 2, 2);
  }

  // Smooth river pebbles & gravel scattered in the sand
  const pebbleColors = ['#9c8c74', '#7d7468', '#b89f7d', '#6e7870', '#c4ab89', '#8c6d53'];
  for (let i = 0; i < 320; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const rx = 3 + Math.random() * 8;
    const ry = 2 + Math.random() * 6;
    const rot = Math.random() * Math.PI;

    bCtx.save();
    bCtx.translate(x, y);
    bCtx.rotate(rot);
    bCtx.fillStyle = pebbleColors[i % pebbleColors.length];
    bCtx.beginPath();
    bCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    bCtx.fill();
    bCtx.strokeStyle = 'rgba(60, 50, 40, 0.35)';
    bCtx.lineWidth = 1;
    bCtx.stroke();
    bCtx.restore();

    bbCtx.save();
    bbCtx.translate(x, y);
    bbCtx.rotate(rot);
    bbCtx.fillStyle = '#d8d8d8';
    bbCtx.beginPath();
    bbCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    bbCtx.fill();
    bbCtx.restore();
  }

  // Subtle golden-aqua underwater caustic lattice baked into substrate highlights
  bCtx.strokeStyle = 'rgba(235, 252, 255, 0.16)';
  bCtx.lineWidth = 2.5;
  for (let c = 0; c < 45; c++) {
    const cx = Math.random() * 512;
    const cy = Math.random() * 512;
    const r = 18 + Math.random() * 28;
    bCtx.beginPath();
    bCtx.arc(cx, cy, r, 0, Math.PI * 1.4);
    bCtx.stroke();
  }

  const riverbedAlbedo = new THREE.CanvasTexture(bedCanvas);
  riverbedAlbedo.colorSpace = THREE.SRGBColorSpace;
  riverbedAlbedo.wrapS = THREE.RepeatWrapping;
  riverbedAlbedo.wrapT = THREE.RepeatWrapping;
  // ~7m tiles both across and along the river (was stretched 9x along it)
  riverbedAlbedo.repeat.set(6, 450);

  const riverbedBump = new THREE.CanvasTexture(bedBumpCanvas);
  riverbedBump.wrapS = THREE.RepeatWrapping;
  riverbedBump.wrapT = THREE.RepeatWrapping;
  riverbedBump.repeat.set(6, 450);

  // 2. Water Surface Ripple / Caustics Shimmer Map
  const waterCanvas = document.createElement('canvas');
  waterCanvas.width = 512;
  waterCanvas.height = 512;
  const wCtx = waterCanvas.getContext('2d')!;
  wCtx.fillStyle = '#8080ff';
  wCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 180; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const rx = 16 + Math.random() * 38;
    const ry = 8 + Math.random() * 18;
    const grad = wCtx.createRadialGradient(x, y, 2, x, y, rx);
    grad.addColorStop(0, 'rgba(210, 240, 255, 0.55)');
    grad.addColorStop(0.6, 'rgba(110, 160, 240, 0.25)');
    grad.addColorStop(1, 'rgba(128, 128, 255, 0)');
    wCtx.fillStyle = grad;
    wCtx.beginPath();
    wCtx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    wCtx.fill();
  }
  const waterNormal = new THREE.CanvasTexture(waterCanvas);
  waterNormal.wrapS = THREE.RepeatWrapping;
  waterNormal.wrapT = THREE.RepeatWrapping;
  waterNormal.repeat.set(8, 28);

  // 3. Weathered Wood & Hollow Log Bark Texture + Bump
  const barkCanvas = document.createElement('canvas');
  barkCanvas.width = 512;
  barkCanvas.height = 512;
  const bkCtx = barkCanvas.getContext('2d')!;

  const barkBumpCanvas = document.createElement('canvas');
  barkBumpCanvas.width = 512;
  barkBumpCanvas.height = 512;
  const bkbCtx = barkBumpCanvas.getContext('2d')!;

  bkCtx.fillStyle = '#593e25';
  bkCtx.fillRect(0, 0, 512, 512);
  bkbCtx.fillStyle = '#808080';
  bkbCtx.fillRect(0, 0, 512, 512);

  for (let x = 0; x < 512; x += 6) {
    const shade = (Math.sin(x * 0.15) + Math.cos(x * 0.07)) * 14;
    bkCtx.fillStyle = shade > 0 ? 'rgba(115, 82, 50, 0.45)' : 'rgba(42, 28, 15, 0.55)';
    bkCtx.fillRect(x, 0, 4, 512);

    const bVal = Math.floor(128 + shade * 3);
    bkbCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
    bkbCtx.fillRect(x, 0, 4, 512);
  }
  // Mossy patches on submerged wood
  for (let m = 0; m < 35; m++) {
    const mx = Math.random() * 512;
    const my = Math.random() * 512;
    bkCtx.fillStyle = 'rgba(65, 125, 58, 0.35)';
    bkCtx.beginPath();
    bkCtx.ellipse(mx, my, 12 + Math.random() * 25, 25 + Math.random() * 45, 0, 0, Math.PI * 2);
    bkCtx.fill();
  }

  const barkAlbedo = new THREE.CanvasTexture(barkCanvas);
  barkAlbedo.colorSpace = THREE.SRGBColorSpace;
  barkAlbedo.wrapS = THREE.RepeatWrapping;
  barkAlbedo.wrapT = THREE.RepeatWrapping;
  const barkBump = new THREE.CanvasTexture(barkBumpCanvas);
  barkBump.wrapS = THREE.RepeatWrapping;
  barkBump.wrapT = THREE.RepeatWrapping;

  // 4. River Boulder & Cobble Stone Texture + Bump
  const rockCanvas = document.createElement('canvas');
  rockCanvas.width = 256;
  rockCanvas.height = 256;
  const rCtx = rockCanvas.getContext('2d')!;
  rCtx.fillStyle = '#7e7363';
  rCtx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 1600; i++) {
    const rx = Math.random() * 256;
    const ry = Math.random() * 256;
    rCtx.fillStyle =
      i % 3 === 0
        ? 'rgba(55, 50, 44, 0.35)'
        : i % 3 === 1
        ? 'rgba(165, 155, 138, 0.3)'
        : 'rgba(72, 110, 68, 0.22)';
    rCtx.beginPath();
    rCtx.arc(rx, ry, 1 + Math.random() * 3.5, 0, Math.PI * 2);
    rCtx.fill();
  }
  const rockAlbedo = new THREE.CanvasTexture(rockCanvas);
  rockAlbedo.colorSpace = THREE.SRGBColorSpace;
  const rockBump = new THREE.CanvasTexture(rockCanvas);

  // 5. Botanical Victoria Amazonica Lily Pad Texture (Radiating veins)
  const lilyCanvas = document.createElement('canvas');
  lilyCanvas.width = 512;
  lilyCanvas.height = 512;
  const lCtx = lilyCanvas.getContext('2d')!;
  const lGrad = lCtx.createRadialGradient(256, 256, 10, 256, 256, 250);
  lGrad.addColorStop(0, '#4caf50');
  lGrad.addColorStop(0.75, '#388e3c');
  lGrad.addColorStop(0.95, '#2e7d32');
  lGrad.addColorStop(1, '#5d4037');
  lCtx.fillStyle = lGrad;
  lCtx.fillRect(0, 0, 512, 512);

  // Botanical radiating ribs and cross-veins
  lCtx.strokeStyle = 'rgba(165, 225, 135, 0.45)';
  for (let v = 0; v < 24; v++) {
    const ang = (v / 24) * Math.PI * 2;
    lCtx.lineWidth = 2.5;
    lCtx.beginPath();
    lCtx.moveTo(256, 256);
    lCtx.lineTo(256 + Math.cos(ang) * 245, 256 + Math.sin(ang) * 245);
    lCtx.stroke();
  }
  for (let r = 40; r < 240; r += 36) {
    lCtx.lineWidth = 1.2;
    lCtx.beginPath();
    lCtx.arc(256, 256, r, 0, Math.PI * 2);
    lCtx.stroke();
  }
  const lilyPadAlbedo = new THREE.CanvasTexture(lilyCanvas);
  lilyPadAlbedo.colorSpace = THREE.SRGBColorSpace;

  // 6. Detailed Silver Minnow / Neon Tetra Scale Texture
  const minnowCanvas = document.createElement('canvas');
  minnowCanvas.width = 256;
  minnowCanvas.height = 256;
  const mCtx = minnowCanvas.getContext('2d')!;
  const mGrad = mCtx.createLinearGradient(0, 0, 0, 256);
  mGrad.addColorStop(0.0, '#3a5a6b'); // olive-silver dorsal back
  mGrad.addColorStop(0.38, '#a8e6ff'); // iridescent electric blue-silver lateral band
  mGrad.addColorStop(0.52, '#00e5ff'); // bright neon stripe
  mGrad.addColorStop(0.68, '#eef9ff'); // silver flank
  mGrad.addColorStop(1.0, '#ffffff'); // pearl white belly
  mCtx.fillStyle = mGrad;
  mCtx.fillRect(0, 0, 256, 256);

  // Diamond fish scale lattice
  mCtx.strokeStyle = 'rgba(40, 70, 90, 0.25)';
  mCtx.lineWidth = 1;
  for (let y = 0; y < 256; y += 14) {
    for (let x = 0; x < 256; x += 14) {
      const ox = (y / 14) % 2 === 0 ? 0 : 7;
      mCtx.beginPath();
      mCtx.arc(x + ox, y, 7, -Math.PI * 0.4, Math.PI * 0.4);
      mCtx.stroke();
    }
  }
  const minnowScaleAlbedo = new THREE.CanvasTexture(minnowCanvas);
  minnowScaleAlbedo.colorSpace = THREE.SRGBColorSpace;

  // 7. Turtle Carapace Hexagonal Scute Texture
  const turtleCanvas = document.createElement('canvas');
  turtleCanvas.width = 256;
  turtleCanvas.height = 256;
  const tCtx = turtleCanvas.getContext('2d')!;
  tCtx.fillStyle = '#3b572f';
  tCtx.fillRect(0, 0, 256, 256);

  // Scute plates with concentric growth rings
  const scuteCenters = [
    [128, 64],
    [128, 128],
    [128, 192],
    [72, 88],
    [184, 88],
    [72, 168],
    [184, 168],
  ];
  scuteCenters.forEach(([sx, sy]) => {
    for (let ring = 28; ring > 6; ring -= 7) {
      tCtx.fillStyle = ring % 14 === 0 ? '#4f703e' : '#334a28';
      tCtx.strokeStyle = '#24361c';
      tCtx.lineWidth = 2;
      tCtx.beginPath();
      tCtx.arc(sx, sy, ring, 0, Math.PI * 2);
      tCtx.fill();
      tCtx.stroke();
    }
    tCtx.fillStyle = '#eab308';
    tCtx.beginPath();
    tCtx.arc(sx, sy, 5, 0, Math.PI * 2);
    tCtx.fill();
  });
  const turtleShellAlbedo = new THREE.CanvasTexture(turtleCanvas);
  turtleShellAlbedo.colorSpace = THREE.SRGBColorSpace;

  // 8. Dragonfly Veined Translucent Wing Texture
  const wingCanvas = document.createElement('canvas');
  wingCanvas.width = 256;
  wingCanvas.height = 128;
  const wgCtx = wingCanvas.getContext('2d')!;
  wgCtx.clearRect(0, 0, 256, 128);
  wgCtx.fillStyle = 'rgba(215, 248, 255, 0.42)';
  wgCtx.beginPath();
  wgCtx.ellipse(128, 64, 120, 48, 0, 0, Math.PI * 2);
  wgCtx.fill();
  wgCtx.strokeStyle = 'rgba(40, 95, 130, 0.75)';
  wgCtx.lineWidth = 2.5;
  wgCtx.stroke();

  // Delicate wing venation grid
  wgCtx.lineWidth = 1;
  wgCtx.beginPath();
  wgCtx.moveTo(12, 64);
  wgCtx.lineTo(244, 64);
  for (let vx = 30; vx < 230; vx += 22) {
    wgCtx.moveTo(vx, 22);
    wgCtx.lineTo(vx + 8, 106);
  }
  wgCtx.stroke();
  const dragonflyWingAlbedo = new THREE.CanvasTexture(wingCanvas);
  dragonflyWingAlbedo.colorSpace = THREE.SRGBColorSpace;

  cachedTextures = {
    riverbedAlbedo,
    riverbedBump,
    waterNormal,
    barkAlbedo,
    barkBump,
    rockAlbedo,
    rockBump,
    lilyPadAlbedo,
    minnowScaleAlbedo,
    turtleShellAlbedo,
    dragonflyWingAlbedo,
  };

  return cachedTextures;
}
