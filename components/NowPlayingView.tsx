import React from 'react';
import { BarChart2 } from 'lucide-react';
import type { Track, VisualizerMode } from '../types';
import type { Translation } from '../translations';
import Visualizer from './Visualizer';
import { LyricsPanel } from './LyricsPanel';

interface NowPlayingViewProps {
  t: Translation;
  track: Track | null;
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  currentTime: number;
  visualizerMode: VisualizerMode;
  showLyrics: boolean;
  onToggleLyrics: () => void;
  onSeek: (time: number) => void;
}

// Lyrics and their toggle are clickable: keep those clicks from triggering the hold-for-2x gesture
const stop = { onMouseDown: (e: React.SyntheticEvent) => e.stopPropagation(), onTouchStart: (e: React.SyntheticEvent) => e.stopPropagation(), onTouchEnd: (e: React.SyntheticEvent) => e.stopPropagation() };

/** Cover, title, visualizer and (when available) synced lyrics for the current track. */
export const NowPlayingView: React.FC<NowPlayingViewProps> = ({
  t, track, analyser, isPlaying, currentTime, visualizerMode, showLyrics, onToggleLyrics, onSeek,
}) => (
  <div className="flex-1 p-6 flex flex-col items-center justify-center z-10">
    {track ? (
      <div className="w-full h-full max-w-4xl flex flex-col gap-6">
        <div className="flex flex-col items-center gap-4 text-center select-none">
          {track.coverArtUrl && (
            <div className="w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden shadow-2xl border-4 border-zinc-900/50 animate-in zoom-in duration-500">
              <img src={track.coverArtUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 drop-shadow-md px-4">{track.name}</h2>
            <p className="text-zinc-400 text-lg">{track.artist}</p>
          </div>
        </div>
        <div className="flex-1 min-h-0 w-full flex flex-col md:flex-row gap-4">
          <div className={`${track.lyrics && showLyrics ? 'hidden md:block md:w-1/2' : 'w-full'} min-h-0 h-full pointer-events-none`}>
            <Visualizer analyser={analyser} isPlaying={isPlaying} mode={visualizerMode} />
          </div>
          {track.lyrics && showLyrics && (
            <div className="flex-1 min-h-0 md:w-1/2" {...stop}>
              <LyricsPanel t={t} lyrics={track.lyrics} currentTime={currentTime} onSeek={onSeek} />
            </div>
          )}
        </div>
        {track.lyrics && (
          <button onClick={onToggleLyrics} {...stop} className="self-center text-xs text-zinc-500 hover:text-zinc-300">
            {showLyrics ? t.hideLyrics : t.showLyrics}
          </button>
        )}
        <p className="text-center text-zinc-600 text-xs mt-2">{t.visualizerHint}</p>
      </div>
    ) : (
      <div className="text-zinc-500 flex flex-col items-center gap-2">
        <BarChart2 size={48} className="opacity-20" />
        <p>{t.playToStart}</p>
      </div>
    )}
  </div>
);
