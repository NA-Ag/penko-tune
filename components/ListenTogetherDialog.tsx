import React, { useState } from 'react';
import { Users, Copy, Check, Loader2, Music, Radio, Info, Volume2 } from 'lucide-react';
import type { RoomState } from '../hooks/useListenTogether';
import type { Translation } from '../translations';
import { Modal, primaryButton, secondaryButton } from './Modal';
import { format } from '../utils/i18n';

interface ListenTogetherDialogProps {
  t: Translation;
  room: RoomState;
  /** Set when opened from an invite link and not yet joined. */
  pendingInvite: boolean;
  guestVolume: number;
  onHost: () => void;
  onJoin: () => void;
  onLeave: () => void;
  onGuestVolume: (volume: number) => void;
  onClose: () => void;
}

export const ListenTogetherDialog: React.FC<ListenTogetherDialogProps> = ({
  t, room, pendingInvite, guestVolume, onHost, onJoin, onLeave, onGuestVolume, onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // selectable in the input instead
    }
  };

  const notes = (
    <div className="flex gap-2 text-xs text-zinc-400 bg-zinc-800/40 rounded-lg p-3">
      <Info size={14} className="shrink-0 mt-0.5 text-zinc-500" />
      <ul className="space-y-1">
        <li>{t.listenNoteHow}</li>
        <li>{t.shareNotePeers}</li>
      </ul>
    </div>
  );

  let body: React.ReactNode;
  if (room.role === 'hosting') {
    body = (
      <>
        <p className="text-sm text-zinc-300">{t.listenHostingDesc}</p>
        <div className="flex gap-2">
          <input
            readOnly
            value={room.link}
            onFocus={(e) => e.target.select()}
            className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300"
          />
          <button onClick={() => copy(room.link)} className={primaryButton}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? t.copied : t.copy}
          </button>
        </div>
        <p className="text-sm text-zinc-400 flex items-center gap-2">
          <Users size={16} className="text-cyan-400" />
          {format(t.listenListeners, { count: room.listeners })}
        </p>
        <button onClick={onLeave} className={`${secondaryButton} w-full`}>{t.listenEnd}</button>
      </>
    );
  } else if (room.role === 'joining' || room.role === 'listening') {
    const np = room.role === 'listening' ? room.nowPlaying : null;
    const hostGone = room.role === 'listening' && !room.hostConnected;
    body = (
      <>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-lg bg-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
            {np?.coverArtUrl ? <img src={np.coverArtUrl} alt="" className="w-full h-full object-cover" /> : <Music size={28} className="text-zinc-600" />}
          </div>
          <div className="min-w-0">
            {room.role === 'joining' ? (
              <p className="text-sm text-zinc-300 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> {t.listenConnecting}</p>
            ) : hostGone ? (
              <p className="text-sm text-amber-300">{t.listenHostLeft}</p>
            ) : np ? (
              <>
                <p className="text-white font-medium truncate">{np.name}</p>
                <p className="text-sm text-zinc-400 truncate">{np.artist}</p>
                {!np.isPlaying && <p className="text-xs text-zinc-500 mt-1">{t.listenPaused}</p>}
              </>
            ) : (
              <p className="text-sm text-zinc-400">{t.listenWaiting}</p>
            )}
          </div>
        </div>
        <label className="flex items-center gap-3 text-sm text-zinc-400">
          <Volume2 size={16} />
          <input
            type="range" min={0} max={1} step={0.01} value={guestVolume}
            onChange={(e) => onGuestVolume(parseFloat(e.target.value))}
            className="flex-1 accent-cyan-500"
          />
        </label>
        <button onClick={onLeave} className={`${secondaryButton} w-full`}>{t.listenLeave}</button>
      </>
    );
  } else if (pendingInvite) {
    body = (
      <>
        <p className="text-sm text-zinc-300">{t.listenInvited}</p>
        <button onClick={onJoin} className={`${primaryButton} w-full`}><Radio size={16} /> {t.listenJoin}</button>
        {notes}
      </>
    );
  } else {
    body = (
      <>
        <p className="text-sm text-zinc-300">{t.listenIntro}</p>
        <button onClick={onHost} className={`${primaryButton} w-full`}><Radio size={16} /> {t.listenStart}</button>
        {notes}
      </>
    );
  }

  return (
    <Modal title={t.listenTogether} icon={<Users size={20} className="text-cyan-500" />} onClose={onClose} closeLabel={t.close}>
      {body}
    </Modal>
  );
};
