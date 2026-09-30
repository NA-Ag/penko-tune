import { useState, useCallback, MutableRefObject } from 'react';
import type { Track } from '../types';
import { exportLibraryAsJSON } from '../utils/persistence';
import { exportLibraryZip, importLibraryFile, downloadTrackFile, downloadBlob } from '../utils/libraryArchive';
import { tr } from '../utils/i18n';

interface UseBackupProps {
  tracks: Track[];
  addToast: (message: string, type?: 'error' | 'info') => void;
  /** Set while an import writes straight to the database, so the app doesn't overwrite it. */
  suspendSaveRef: MutableRefObject<boolean>;
}

export function useBackup({ tracks, addToast, suspendSaveRef }: UseBackupProps) {
  const [busy, setBusy] = useState<{ label: string; progress?: number } | null>(null);

  const exportZip = async () => {
    try {
      setBusy({ label: tr('exportZip') });
      const result = await exportLibraryZip(tracks, (done, total) => setBusy({ label: tr('exportZip'), progress: done / total }));
      if (!result) return; // cancelled
      addToast(result.skipped
        ? tr('toastExportedSkipped', { count: result.exported, skipped: result.skipped })
        : tr('toastExported', { count: result.exported }));
    } catch (err) {
      console.error('Export failed', err);
      addToast(tr('toastExportFailed'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const exportJson = async () => {
    try {
      const password = prompt(tr('promptBackupPassword'));
      if (password === null) return; // cancelled
      const json = await exportLibraryAsJSON(password || undefined);
      downloadBlob(new Blob([json], { type: 'application/json' }), `penko-tune-info-${new Date().toISOString().slice(0, 10)}.json`);
      addToast(tr('toastInfoDownloaded'));
    } catch (err) {
      console.error('Backup failed', err);
      addToast(tr('toastBackupFailed'), 'error');
    }
  };

  /** Import a .zip library or .json backup, then reload to show it. */
  const importFile = async (file: File) => {
    const run = (password?: string) =>
      importLibraryFile(file, password, (done, total) => setBusy({ label: tr('importLibrary'), progress: done / total }));
    const finish = () => {
      addToast(tr('toastImported'));
      setTimeout(() => window.location.reload(), 1200);
    };
    const fail = (key: Parameters<typeof tr>[0]) => {
      suspendSaveRef.current = false;
      addToast(tr(key), 'error');
    };

    setBusy({ label: tr('importLibrary') });
    suspendSaveRef.current = true;
    try {
      await run();
      finish();
    } catch (err: any) {
      if (err?.message !== 'PASSWORD_REQUIRED') {
        console.error('Import failed', err);
        fail(err?.message === 'NOT_LIBRARY' ? 'toastNotLibraryZip' : 'toastImportFailed');
        return;
      }
      const password = prompt(tr('promptRestorePassword'));
      if (!password) {
        suspendSaveRef.current = false;
        return;
      }
      try {
        await run(password);
        finish();
      } catch (err2: any) {
        fail(err2?.message === 'INVALID_PASSWORD' ? 'toastWrongPassword' : 'toastImportFailed');
      }
    } finally {
      setBusy(null);
    }
  };

  const downloadTrack = useCallback(async (track: Track) => {
    if (!(await downloadTrackFile(track))) {
      addToast(tr(track.fileHandle ? 'toastReconnectToDownload' : 'toastNoFile'), 'error');
    }
  }, [addToast]);

  return { busy, exportZip, exportJson, importFile, downloadTrack };
}
