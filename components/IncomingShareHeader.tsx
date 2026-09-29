import React from 'react';
import { Users, Download, X, Loader2, WifiOff } from 'lucide-react';
import type { IncomingState } from '../hooks/useSharing';
import type { Translation } from '../translations';
import { primaryButton } from './Modal';

interface IncomingShareHeaderProps {
  t: Translation;
  share: IncomingState;
  onSaveAll: () => void;
  onClose: () => void;
}

/** Shown above the track list while viewing a share someone sent you. */
export const IncomingShareHeader: React.FC<IncomingShareHeaderProps> = ({ t, share, onSaveAll, onClose }) => (
  <div className="mx-4 mt-3 flex items-center gap-3 px-4 py-3 rounded-lg border border-purple-500/30 bg-purple-500/10">
    <Users size={18} className="text-purple-300 shrink-0" />
    <div className="flex-1 min-w-0 text-sm">
      {share.status === 'ready' ? (
        <>
          <p className="text-white font-medium truncate">{share.share.title}</p>
          <p className="text-xs text-purple-200/80">
            {t.sharedWithYou} · {share.share.mode === 'copy' ? t.shareModeCopy : t.shareModeStream}
          </p>
        </>
      ) : share.status === 'connecting' ? (
        <p className="text-purple-100">{t.shareConnecting}</p>
      ) : (
        <p className="text-purple-100">{share.error === 'offline' ? t.shareOffline : t.shareInvalid}</p>
      )}
    </div>
    {share.status === 'ready' && share.share.mode === 'copy' && (
      <button onClick={onSaveAll} className={primaryButton}><Download size={16} /> {t.saveAll}</button>
    )}
    <button onClick={onClose} className="p-1 text-purple-200/70 hover:text-white" title={t.close}><X size={16} /></button>
  </div>
);

/** Large empty-state content while connecting or when the sender is unreachable. */
export const IncomingShareStatus: React.FC<{ t: Translation; share: IncomingState; timeoutSeconds: number }> = ({ t, share, timeoutSeconds }) =>
  share.status === 'connecting' ? (
    <>
      <Loader2 size={48} className="mb-4 animate-spin text-purple-400" />
      <p className="text-lg text-zinc-300">{t.shareConnecting}</p>
      <p className="text-sm mt-2 max-w-md">{t.shareConnectingHint.replace('{seconds}', String(timeoutSeconds))}</p>
    </>
  ) : share.status === 'error' ? (
    <>
      <WifiOff size={48} className="mb-4 opacity-40" />
      <p className="text-lg text-zinc-300">{share.error === 'offline' ? t.shareOffline : t.shareInvalid}</p>
      {share.error === 'offline' && <p className="text-sm mt-2 max-w-md">{t.shareOfflineHint}</p>}
    </>
  ) : null;
