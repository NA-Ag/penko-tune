import React from 'react';
import { AlertTriangle, Link2, X } from 'lucide-react';
import type { StorageWarning } from '../hooks/useStorageStatus';
import type { Translation } from '../translations';
import { formatBytes } from '../utils/formatters';

interface StorageBannerProps {
  t: Translation;
  warning: StorageWarning | null;
  /** Linked folders that need permission again (takes priority over storage warnings). */
  disconnectedFolders: number;
  copiedBytes: number;
  canLinkFolders: boolean;
  onReconnect: () => void;
  onOpenStorage: () => void;
  onDismiss: (warning: StorageWarning) => void;
}

export const StorageBanner: React.FC<StorageBannerProps> = ({
  t, warning, disconnectedFolders, copiedBytes, canLinkFolders, onReconnect, onOpenStorage, onDismiss,
}) => {
  if (disconnectedFolders > 0) {
    return (
      <div className="mx-4 mt-3 flex items-center gap-3 px-4 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-sm">
        <Link2 size={16} className="text-amber-400 shrink-0" />
        <span className="flex-1 text-amber-100">{t.reconnectBanner}</span>
        <button onClick={onReconnect} className="px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium text-xs">
          {t.reconnect}
        </button>
      </div>
    );
  }

  if (!warning) return null;

  const message = {
    'not-protected': t.warnNotProtected,
    'safari-not-installed': t.warnSafari,
    'almost-full': t.warnAlmostFull,
    'large-library': (canLinkFolders ? t.warnLargeLink : t.warnLargeKeepFiles).replace('{size}', formatBytes(copiedBytes, 1)),
  }[warning];

  return (
    <div className="mx-4 mt-3 flex items-center gap-3 px-4 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-sm">
      <AlertTriangle size={16} className="text-amber-400 shrink-0" />
      <span className="flex-1 text-amber-100">{message}</span>
      <button onClick={onOpenStorage} className="px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium text-xs whitespace-nowrap">
        {t.storageFix}
      </button>
      <button onClick={() => onDismiss(warning)} className="p-1 text-amber-300/70 hover:text-amber-100" title={t.close}>
        <X size={14} />
      </button>
    </div>
  );
};
