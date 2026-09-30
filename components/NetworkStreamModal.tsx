import React from 'react';
import { Globe, X } from 'lucide-react';
import { useNetworkStream } from '../hooks/useNetworkStream';
import { Track } from '../types';
import type { Translation } from '../translations';

interface NetworkStreamModalProps {
  onClose: () => void;
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  playTrack: (track: Track) => void;
  addToast: (message: string, type?: 'error' | 'info') => void;
  t: Translation;
}

export function NetworkStreamModal({ onClose, setTracks, playTrack, addToast, t }: NetworkStreamModalProps) {
  const { networkUrl, setNetworkUrl, addNetworkStream } = useNetworkStream({
    setTracks,
    playTrack,
    addToast,
    onClose,
  });

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 flex-1">
            <Globe size={20} className="text-cyan-500" />
            {t.openNetworkStream}
          </h3>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800" title={t.close}>
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-zinc-500">{t.networkStreamDesc}</p>
          <input
            type="text"
            value={networkUrl}
            onChange={(e) => setNetworkUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addNetworkStream()}
            placeholder={t.networkPlaceholder}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">
              {t.cancel}
            </button>
            <button
              onClick={addNetworkStream}
              className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium"
            >
              {t.openStream}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
