// Browser storage health: how much the library uses, and whether the browser may evict it.

export interface StorageStatus {
  supported: boolean;
  persisted: boolean; // browser promised not to evict our data
  usage: number; // bytes used by this site
  quota: number; // bytes this site may use
  installed: boolean; // running as an installed PWA
  isSafari: boolean; // Safari wipes storage of non-installed sites after ~7 days unused
  canLinkFolders: boolean; // File System Access API (Chromium desktop)
}

/** Copied (in-browser) library size above which we suggest linking a folder or keeping originals. */
export const LARGE_LIBRARY_BYTES = 1024 ** 3; // 1 GB
/** Share of the quota above which we warn about running out of space. */
export const HIGH_USAGE_RATIO = 0.8;

export const isInstalled = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;

const isSafari = (): boolean =>
  /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);

export const canLinkFolders = (): boolean => typeof window.showDirectoryPicker === 'function';

export const getStorageStatus = async (): Promise<StorageStatus> => {
  const storage = navigator.storage;
  const [persisted, estimate] = await Promise.all([
    storage?.persisted?.().catch(() => false) ?? false,
    storage?.estimate?.().catch(() => ({} as StorageEstimate)) ?? ({} as StorageEstimate),
  ]);
  return {
    supported: !!storage?.estimate,
    persisted,
    usage: estimate.usage ?? 0,
    quota: estimate.quota ?? 0,
    installed: isInstalled(),
    isSafari: isSafari(),
    canLinkFolders: canLinkFolders(),
  };
};

/**
 * Ask the browser not to evict our data. Chrome decides silently (installed apps and
 * engaged sites are usually granted), Firefox shows a prompt, Safari exempts installed apps.
 */
export const requestPersistentStorage = async (): Promise<boolean> => {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
};
