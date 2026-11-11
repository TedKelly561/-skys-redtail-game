/**
 * Photo mode helpers: put a snapshot in a cute instant-photo frame, and keep the last few
 * photos on this device (a little album).
 */
const ALBUM_KEY = 'whiskers_photos_v1';
const MAX_PHOTOS = 8;

export interface Photo {
  url: string;
  at: number;
}

export function loadAlbum(): Photo[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ALBUM_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((p) => p && typeof p.url === 'string' && p.url.startsWith('data:image/')) : [];
  } catch {
    return [];
  }
}

/** Saves the album, dropping the oldest photos if the device runs out of room. */
export function saveAlbum(photos: Photo[]): Photo[] {
  let list = photos.slice(0, MAX_PHOTOS);
  while (list.length > 0) {
    try {
      localStorage.setItem(ALBUM_KEY, JSON.stringify(list));
      return list;
    } catch {
      list = list.slice(0, -1);
    }
  }
  try {
    localStorage.removeItem(ALBUM_KEY);
  } catch {
    // ignore
  }
  return [];
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** White instant-photo frame with a caption and the date underneath. */
export async function framePhoto(shotUrl: string, caption: string): Promise<string> {
  const img = await loadImage(shotUrl);
  const maxW = 1000;
  const scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const pad = Math.round(w * 0.04);
  const bottom = Math.round(w * 0.13);
  const c = document.createElement('canvas');
  c.width = w + pad * 2;
  c.height = h + pad + bottom;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, pad, pad, w, h);
  ctx.fillStyle = '#334155';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(bottom * 0.34)}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(caption, c.width / 2, h + pad + bottom * 0.4);
  ctx.fillStyle = '#94a3b8';
  ctx.font = `600 ${Math.round(bottom * 0.2)}px system-ui, -apple-system, sans-serif`;
  const date = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  ctx.fillText(`Whiskers' River Journey · ${date}`, c.width / 2, h + pad + bottom * 0.75);
  return c.toDataURL('image/jpeg', 0.85);
}

async function toFile(url: string): Promise<File> {
  const blob = await (await fetch(url)).blob();
  return new File([blob], `whiskers-${Date.now()}.jpg`, { type: 'image/jpeg' });
}

/** True when this device can share a photo (iPhone/iPad/Android share sheet). */
export async function canSharePhoto(url: string): Promise<boolean> {
  try {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (!nav.share || !nav.canShare) return false;
    return nav.canShare({ files: [await toFile(url)] });
  } catch {
    return false;
  }
}

export async function sharePhoto(url: string) {
  try {
    await navigator.share({ files: [await toFile(url)], title: "Whiskers' River Journey" });
  } catch {
    // Cancelled or not allowed: nothing to do.
  }
}

export function downloadPhoto(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = `whiskers-${Date.now()}.jpg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
