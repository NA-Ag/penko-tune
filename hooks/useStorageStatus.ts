import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Track } from '../types';
import { getStorageStatus, requestPersistentStorage, StorageStatus, LARGE_LIBRARY_BYTES, HIGH_USAGE_RATIO } from '../utils/storage';
import { loadPreferences, savePreferences } from '../utils/preferences';

export type StorageWarning = 'not-protected' | 'safari-not-installed' | 'almost-full' | 'large-library';

const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000; // a dismissed warning comes back after a week

export function useStorageStatus(tracks: Track[], libraryLoaded: boolean) {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [dismissed, setDismissed] = useState<Record<string, number>>(() => loadPreferences().dismissedWarnings);

  const refresh = useCallback(() => {
    getStorageStatus().then(setStatus).catch(() => {});
  }, []);

  // Re-measure shortly after the library changes (debounced; estimate() isn't free)
  useEffect(() => {
    if (!libraryLoaded) return;
    const timeout = setTimeout(refresh, 1500);
    return () => clearTimeout(timeout);
  }, [tracks, libraryLoaded, refresh]);

  const copiedBytes = useMemo(
    () => tracks.reduce((sum, t) => sum + (t.file && !t.fileHandle && !t.incomingShareId ? t.file.size : 0), 0),
    [tracks]
  );
  const copiedCount = useMemo(() => tracks.filter(t => t.file && !t.fileHandle && !t.incomingShareId).length, [tracks]);

  /** The single most important warning to show right now, if any. */
  const warning = useMemo((): StorageWarning | null => {
    if (!status || copiedCount === 0) return null;
    const active = (w: StorageWarning) => !(dismissed[w] && Date.now() - dismissed[w] < DISMISS_FOR_MS);
    if (status.quota && status.usage / status.quota > HIGH_USAGE_RATIO && active('almost-full')) return 'almost-full';
    if (status.isSafari && !status.installed && active('safari-not-installed')) return 'safari-not-installed';
    if (!status.persisted && active('not-protected')) return 'not-protected';
    if (copiedBytes > LARGE_LIBRARY_BYTES && active('large-library')) return 'large-library';
    return null;
  }, [status, copiedBytes, copiedCount, dismissed]);

  const dismissWarning = useCallback((w: StorageWarning) => {
    const next = { ...dismissed, [w]: Date.now() };
    setDismissed(next);
    savePreferences({ dismissedWarnings: next });
  }, [dismissed]);

  const protect = useCallback(async () => {
    const granted = await requestPersistentStorage();
    refresh();
    return granted;
  }, [refresh]);

  return { status, copiedBytes, warning, dismissWarning, protect, refresh };
}
