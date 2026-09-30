import React, { useEffect, useMemo, useRef } from 'react';
import { parseLyrics, activeLineIndex } from '../utils/lyrics';
import type { Translation } from '../translations';

interface LyricsPanelProps {
  t: Translation;
  lyrics: string;
  currentTime: number;
  onSeek: (time: number) => void;
}

/** Synced lyrics follow playback (click a line to jump there); plain lyrics just scroll. */
export const LyricsPanel: React.FC<LyricsPanelProps> = ({ t, lyrics, currentTime, onSeek }) => {
  const parsed = useMemo(() => parseLyrics(lyrics), [lyrics]);
  const active = activeLineIndex(parsed, currentTime);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active < 0) return;
    const line = containerRef.current?.querySelector<HTMLElement>(`[data-line="${active}"]`);
    line?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [active]);

  return (
    <div ref={containerRef} data-lyrics className="h-full overflow-y-auto px-4 py-8 space-y-3 text-center scroll-smooth">
      {!parsed.synced && <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-4">{t.lyricsUnsynced}</p>}
      {parsed.lines.map((line, i) => (
        <p
          key={i}
          data-line={i}
          onClick={() => line.time !== null && onSeek(line.time)}
          className={`transition-all duration-300 ${
            line.time !== null ? 'cursor-pointer hover:text-white' : ''
          } ${i === active ? 'text-white text-xl md:text-2xl font-semibold' : parsed.synced ? 'text-zinc-500 text-base md:text-lg' : 'text-zinc-300 text-base'}`}
        >
          {line.text || '♪'}
        </p>
      ))}
    </div>
  );
};
