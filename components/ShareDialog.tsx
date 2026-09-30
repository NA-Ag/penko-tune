import React, { useState } from 'react';
import { Share2, Copy, Check, Loader2, Radio, Download, Info } from 'lucide-react';
import type { ShareMode } from '../types';
import type { Translation } from '../translations';
import { Modal, primaryButton, secondaryButton } from './Modal';
import { format } from '../utils/i18n';

interface ShareDialogProps {
  t: Translation;
  title: string;
  trackCount: number;
  onCreate: (mode: ShareMode) => Promise<string | null>;
  onClose: () => void;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({ t, title, trackCount, onCreate, onClose }) => {
  const [mode, setMode] = useState<ShareMode>('stream');
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      setLink(await onCreate(mode));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is selectable in the input
    }
  };

  const nativeShare = () => link && navigator.share?.({ title: `${title} · Penko Tune`, url: link }).catch(() => {});

  const modeOption = (value: ShareMode, icon: React.ReactNode, label: string, desc: string) => (
    <button
      onClick={() => setMode(value)}
      className={`flex-1 text-left p-3 rounded-lg border transition-colors ${mode === value ? 'border-cyan-500 bg-cyan-500/10' : 'border-zinc-800 hover:border-zinc-700'}`}
    >
      <span className="flex items-center gap-2 text-sm font-medium text-white">{icon} {label}</span>
      <span className="block text-xs text-zinc-400 mt-1">{desc}</span>
    </button>
  );

  return (
    <Modal title={t.shareTitle} icon={<Share2 size={20} className="text-cyan-500" />} onClose={onClose} closeLabel={t.close}>
      <p className="text-sm text-zinc-300">
        <span className="font-medium text-white">{title}</span>
        {trackCount > 1 && <span className="text-zinc-500"> · {format(t.tracksCount, { count: trackCount })}</span>}
      </p>

      {!link ? (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            {modeOption('stream', <Radio size={16} className="text-cyan-400" />, t.shareModeStream, t.shareModeStreamDesc)}
            {modeOption('copy', <Download size={16} className="text-cyan-400" />, t.shareModeCopy, t.shareModeCopyDesc)}
          </div>
          <button onClick={create} disabled={busy} className={`${primaryButton} w-full`}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
            {busy ? t.shareEncrypting : t.shareCreateLink}
          </button>
        </>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
              className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300"
            />
            <button onClick={copy} className={primaryButton}>
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? t.copied : t.copy}
            </button>
          </div>
          {'share' in navigator && (
            <button onClick={nativeShare} className={`${secondaryButton} w-full`}><Share2 size={16} /> {t.shareVia}</button>
          )}
        </div>
      )}

      <div className="flex gap-2 text-xs text-zinc-400 bg-zinc-800/40 rounded-lg p-3">
        <Info size={14} className="shrink-0 mt-0.5 text-zinc-500" />
        <ul className="space-y-1">
          <li>{t.shareNoteEncrypted}</li>
          <li>{t.shareNoteOnline}</li>
          <li>{t.shareNotePeers}</li>
        </ul>
      </div>
    </Modal>
  );
};
