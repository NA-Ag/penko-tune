import React, { useRef } from 'react';
import { HardDrive, ShieldCheck, ShieldAlert, Download, Upload, FolderPlus, RefreshCw, Link2, Unlink, Loader2, Smartphone, FileJson } from 'lucide-react';
import type { LinkedFolder } from '../types';
import type { StorageStatus } from '../utils/storage';
import type { Translation } from '../translations';
import { formatBytes } from '../utils/formatters';
import { Modal, primaryButton, secondaryButton } from './Modal';

interface StorageDialogProps {
  t: Translation;
  status: StorageStatus | null;
  copiedBytes: number;
  trackCount: number;
  folders: LinkedFolder[];
  disconnectedIds: string[];
  scanningIds: string[];
  canInstall: boolean;
  busy: { label: string; progress?: number } | null;
  onProtect: () => void;
  onInstall: () => void;
  onExportZip: () => void;
  onExportJson: () => void;
  onImport: (file: File) => void;
  onLinkFolder: () => void;
  onReconnect: () => void;
  onRescan: (id: string) => void;
  onUnlink: (id: string) => void;
  onClose: () => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-3">
    <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{title}</h4>
    {children}
  </section>
);

export const StorageDialog: React.FC<StorageDialogProps> = ({
  t, status, copiedBytes, trackCount, folders, disconnectedIds, scanningIds, canInstall, busy,
  onProtect, onInstall, onExportZip, onExportJson, onImport, onLinkFolder, onReconnect, onRescan, onUnlink, onClose,
}) => {
  const importRef = useRef<HTMLInputElement>(null);
  const usagePct = status?.quota ? Math.min(100, (status.usage / status.quota) * 100) : 0;
  const protectedOk = !!status?.persisted || (!!status?.isSafari && status.installed);

  return (
    <Modal title={t.storageTitle} icon={<HardDrive size={20} className="text-cyan-500" />} onClose={onClose} closeLabel={t.close} wide>
      {/* Status */}
      <Section title={t.storageStatus}>
        <div className={`flex gap-3 p-3 rounded-lg border ${protectedOk ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
          {protectedOk
            ? <ShieldCheck size={20} className="text-emerald-400 shrink-0 mt-0.5" />
            : <ShieldAlert size={20} className="text-amber-400 shrink-0 mt-0.5" />}
          <div className="text-sm space-y-2">
            <p className="text-zinc-200 font-medium">{protectedOk ? t.storageProtected : t.storageNotProtected}</p>
            <p className="text-zinc-400 text-xs">{protectedOk ? t.storageProtectedDesc : t.storageNotProtectedDesc}</p>
            {!protectedOk && (
              <div className="flex flex-wrap gap-2 pt-1">
                {!status?.isSafari && <button onClick={onProtect} className={primaryButton}><ShieldCheck size={16} /> {t.storageProtectButton}</button>}
                {canInstall && <button onClick={onInstall} className={secondaryButton}><Smartphone size={16} /> {t.installPWA}</button>}
              </div>
            )}
            {status?.isSafari && !status.installed && <p className="text-amber-300 text-xs">{t.storageSafariHint}</p>}
          </div>
        </div>

        {status?.supported && (
          <div className="space-y-1">
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full ${usagePct > 80 ? 'bg-amber-500' : 'bg-cyan-500'}`} style={{ width: `${Math.max(usagePct, 1)}%` }} />
            </div>
            <p className="text-xs text-zinc-500 flex justify-between">
              <span>{formatBytes(status.usage, 1)} {t.storageUsedOf} {formatBytes(status.quota, 0)}</span>
              <span>{trackCount} {t.tracksInLibrary} · {formatBytes(copiedBytes, 1)} {t.storageCopied}</span>
            </p>
          </div>
        )}
      </Section>

      {/* Linked folders */}
      <Section title={t.linkedFolders}>
        <p className="text-xs text-zinc-400">{status?.canLinkFolders ? t.linkedFoldersDesc : t.linkedFoldersUnsupported}</p>
        {folders.length > 0 && (
          <ul className="space-y-1">
            {folders.map(folder => {
              const disconnected = disconnectedIds.includes(folder.id);
              const scanning = scanningIds.includes(folder.id);
              return (
                <li key={folder.id} className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 rounded-lg text-sm">
                  <Link2 size={14} className={disconnected ? 'text-amber-400' : 'text-zinc-400'} />
                  <span className="flex-1 truncate text-zinc-200">{folder.name}</span>
                  {scanning && <Loader2 size={14} className="animate-spin text-cyan-400" />}
                  {disconnected ? (
                    <button onClick={onReconnect} className="text-xs text-amber-300 hover:text-amber-200">{t.reconnect}</button>
                  ) : (
                    <button onClick={() => onRescan(folder.id)} disabled={scanning} className="p-1 text-zinc-400 hover:text-white" title={t.rescan}>
                      <RefreshCw size={14} />
                    </button>
                  )}
                  <button onClick={() => onUnlink(folder.id)} className="p-1 text-zinc-500 hover:text-red-400" title={t.unlink}>
                    <Unlink size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {status?.canLinkFolders && (
          <button onClick={onLinkFolder} className={secondaryButton}><FolderPlus size={16} /> {t.linkFolder}</button>
        )}
      </Section>

      {/* Backup */}
      <Section title={t.backupTitle}>
        <p className="text-xs text-zinc-400">{t.backupDesc}</p>
        {busy ? (
          <div className="flex items-center gap-3 text-sm text-zinc-300">
            <Loader2 size={16} className="animate-spin text-cyan-400" />
            <span>{busy.label}{busy.progress !== undefined && ` ${Math.round(busy.progress * 100)}%`}</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button onClick={onExportZip} className={primaryButton}><Download size={16} /> {t.exportZip}</button>
            <button onClick={onExportJson} className={secondaryButton}><FileJson size={16} /> {t.exportJson}</button>
            <button onClick={() => importRef.current?.click()} className={secondaryButton}><Upload size={16} /> {t.importLibrary}</button>
            <input
              ref={importRef}
              type="file"
              accept=".zip,.json,application/zip,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) onImport(file);
              }}
            />
          </div>
        )}
      </Section>
    </Modal>
  );
};
