/**
 * "Add to home screen" support. Chrome/Edge/Android hand us an install prompt we can show
 * from a button; iPhone/iPad need the Share menu, so we explain that instead.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Keep the browser's own pop-up away from little fingers; grown-ups use the button.
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedNow = true;
    notify();
  });
}

export type InstallStatus = 'installed' | 'ready' | 'ios' | 'manual';

export function getInstallStatus(): InstallStatus {
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone || installedNow) return 'installed';
  if (deferred) return 'ready';
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios ? 'ios' : 'manual';
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  await e.prompt();
  const choice = await e.userChoice;
  notify();
  return choice.outcome === 'accepted';
}

export function onInstallChange(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
