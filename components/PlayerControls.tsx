import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, RotateCcw, RotateCw, FastForward, Bookmark, Music, Gauge, Repeat1, MicVocal } from 'lucide-react';
import { PlayerState, ChapterMarker, Track } from '../types';
import type { LoopRange } from '../hooks/useAudioPlayer';
import { formatTime } from '../utils/formatters';
import type { Translation } from '../translations';

interface PlayerControlsProps {
  playerState: PlayerState;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
  markers?: ChapterMarker[];
  onJumpToMarker?: (timestamp: number) => void;
  onAddMarker?: (timestamp: number) => void;
  onNextMarker?: () => void;
  onPrevMarker?: () => void;
  currentTrack: Track | null;
  t: Translation;
  speed: number;
  onSpeedChange: (speed: number) => void;
  loop: LoopRange | null;
  onCycleLoop: () => void;
  onShowLyrics?: () => void;
}

const SPEEDS = [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2];

const PlayerControls: React.FC<PlayerControlsProps> = ({
  playerState,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onToggleRepeat,
  onSkipForward,
  onSkipBackward,
  markers = [],
  onJumpToMarker,
  onAddMarker,
  onNextMarker,
  onPrevMarker,
  currentTrack,
  t,
  speed,
  onSpeedChange,
  loop,
  onCycleLoop,
  onShowLyrics,
}) => {
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  useEffect(() => {
    if (!speedMenuOpen) return;
    const close = (e: MouseEvent) => !(e.target as Element).closest('[data-speed-menu]') && setSpeedMenuOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [speedMenuOpen]);

  const pct = (time: number) => `${(time / (playerState.duration || 1)) * 100}%`;
  const loopLabel = !loop ? 'A-B' : loop.b === null ? 'A-…' : 'A-B';
  const loopTitle = !loop ? t.loopSetA : loop.b === null ? t.loopSetB : t.loopClear;

  const practiceButtons = (compact: boolean) => (
    <>
      <div className="relative" data-speed-menu>
        <button
          onClick={() => setSpeedMenuOpen(o => !o)}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono transition-colors ${speed !== 1 ? 'text-cyan-400 bg-cyan-500/10' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
          title={t.speedTitle}
          data-speed-button
        >
          {!compact && <Gauge size={14} />}
          {speed}x
        </button>
        {speedMenuOpen && (
          <div className={`absolute bottom-full mb-2 ${compact ? 'left-0' : 'right-0'} bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl p-1 z-50 min-w-[96px]`}>
            <p className="px-2 py-1 text-[10px] text-zinc-500 uppercase tracking-wider">{t.speedTitle}</p>
            {SPEEDS.map(s => (
              <button
                key={s}
                onClick={() => { onSpeedChange(s); setSpeedMenuOpen(false); }}
                className={`w-full text-left px-2 py-1 rounded text-sm font-mono ${s === speed ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-300 hover:bg-zinc-800'}`}
              >
                {s}x
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onCycleLoop}
        disabled={!hasTrack}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono transition-colors disabled:opacity-40 ${loop ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
        title={loopTitle}
        data-loop-button
      >
        {!compact && <Repeat1 size={14} />}
        {loopLabel}
      </button>
      {onShowLyrics && (
        <button
          onClick={onShowLyrics}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          title={t.showLyrics}
          data-lyrics-button
        >
          <MicVocal size={14} />
          {compact && t.lyrics}
        </button>
      )}
    </>
  );
  const hasTrack = !!currentTrack;
  // While dragging, show the drag position instead of the playback position
  const [dragTime, setDragTime] = useState<number | null>(null);
  const shownTime = dragTime ?? playerState.currentTime;

  const timeAt = (e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return pct * (playerState.duration || 0);
  };

  // Drag to seek (mouse, touch and pen); commits on release
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasTrack || e.button !== 0 || e.ctrlKey || e.metaKey) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragTime(timeAt(e));
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragTime !== null) setDragTime(timeAt(e));
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragTime === null) return;
    onSeek(timeAt(e));
    setDragTime(null);
  };

  // Right-click or Ctrl/Cmd+click adds a chapter marker
  const handleAddMarker = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (hasTrack) onAddMarker?.(timeAt(e));
  };

  const renderSeekBar = () => (
    <div className="w-full flex items-center gap-3 text-xs text-zinc-400 font-mono">
      <span className="w-10 text-right">{formatTime(shownTime)}</span>
      <div
        data-seekbar
        className="relative flex-1 group h-4 flex items-center cursor-pointer touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setDragTime(null)}
        onClick={(e) => (e.ctrlKey || e.metaKey) && handleAddMarker(e)}
        onContextMenu={handleAddMarker}
        title={hasTrack ? t.seekHint : ""}
      >
        <div className="absolute inset-0 bg-zinc-800 rounded-full h-1 my-auto overflow-hidden pointer-events-none">
            <div
                className="h-full bg-cyan-500 rounded-full group-hover:bg-cyan-400"
                style={{ width: `${(shownTime / (playerState.duration || 1)) * 100}%` }}
            ></div>
        </div>
        {hasTrack && (
          <div
            className={`absolute w-3 h-3 bg-white rounded-full shadow pointer-events-none -translate-x-1/2 transition-opacity ${dragTime !== null ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            style={{ left: `${(shownTime / (playerState.duration || 1)) * 100}%` }}
          />
        )}

        {/* A-B loop region */}
        {loop && (
          <div
            className="absolute h-2 my-auto inset-y-0 bg-amber-400/40 border-x-2 border-amber-400 rounded-sm pointer-events-none"
            style={{ left: pct(loop.a), width: loop.b !== null ? `calc(${pct(loop.b)} - ${pct(loop.a)})` : '0px' }}
          />
        )}

        {/* Chapter Markers */}
        {markers.map((marker) => {
          const position = (marker.timestamp / (playerState.duration || 1)) * 100;
          return (
            <div
              key={marker.id}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onJumpToMarker?.(marker.timestamp);
              }}
              className="absolute w-2 h-2 -translate-x-1 cursor-pointer z-10 group/marker"
              style={{ left: `${position}%`, top: '50%', transform: `translateY(-50%) translateX(-50%)` }}
              title={`${marker.label} (${formatTime(marker.timestamp)})`}
            >
              <div className="w-full h-full bg-yellow-500 rounded-full group-hover/marker:bg-yellow-400 group-hover/marker:scale-150 transition-all shadow-lg" />
            </div>
          );
        })}
      </div>
      <span className="w-10">{formatTime(playerState.duration)}</span>
    </div>
  );

  return (
    <div className="bg-zinc-900 border-t border-zinc-800 flex flex-col md:flex-row items-center justify-between px-4 md:px-6 py-3 md:py-0 md:h-24 shrink-0 z-50 select-none gap-3 md:gap-0">
      
      {/* Now Playing (Left) - Desktop Only */}
      <div className="w-1/4 hidden md:flex items-center gap-3 min-w-0">
        <div className="w-14 h-14 rounded-md overflow-hidden bg-zinc-800 flex items-center justify-center shrink-0">
          {currentTrack?.coverArtUrl ? (
            <img src={currentTrack.coverArtUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Music size={20} className="text-zinc-600" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{currentTrack?.name ?? t.nothingPlaying}</p>
          {currentTrack && <p className="text-xs text-zinc-400 truncate">{currentTrack.artist || t.unknownArtist}</p>}
        </div>
        {playerState.playbackRate !== 1 && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded-full text-xs font-bold animate-pulse shrink-0">
            <FastForward size={12} />
            {playerState.playbackRate}x
          </div>
        )}
      </div>

      {/* Main Controls (Center) - Adaptive Layout */}
      <div className="flex flex-col items-center w-full md:w-2/4 gap-3 md:gap-2">
        
        {/* Mobile: Now Playing + Seek Bar on Top */}
        <div className="md:hidden w-full space-y-1">
          {currentTrack && (
            <p className="text-sm text-center truncate">
              <span className="text-white font-medium">{currentTrack.name}</span>
              {currentTrack.artist && <span className="text-zinc-500"> · {currentTrack.artist}</span>}
            </p>
          )}
          {renderSeekBar()}
          <div className="flex justify-center gap-2 pt-1">{practiceButtons(true)}</div>
        </div>

        <div className="flex items-center justify-between md:justify-center w-full md:w-auto gap-2 md:gap-4">
          <button 
            onClick={onToggleShuffle}
            className={`transition-colors p-2 rounded-full hover:bg-zinc-800 ${playerState.isShuffle ? 'text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            title={t.ctlShuffle}
          >
            <Shuffle size={18} />
          </button>
          
          <div className="flex items-center gap-1 md:gap-4">
            <button onClick={onPrev} className="text-zinc-300 hover:text-white transition-colors p-2 hover:bg-zinc-800 rounded-full" title={t.ctlPrevious}>
              <SkipBack size={20} fill="currentColor" />
            </button>

            {markers.length > 0 && (
              <button
                onClick={onPrevMarker}
                className="text-yellow-500 hover:text-yellow-400 transition-colors p-2 hover:bg-zinc-800 rounded-full"
                title={t.ctlPrevMarker}
              >
                <Bookmark size={16} className="rotate-180" />
              </button>
            )}

            <button onClick={onSkipBackward} className="hidden sm:block text-zinc-400 hover:text-white transition-colors p-2 hover:bg-zinc-800 rounded-full" title={t.ctlBack10}>
              <RotateCcw size={18} />
            </button>
          </div>
          
          <button 
            onClick={onPlayPause}
            data-play-toggle
            className="w-12 h-12 md:w-14 md:h-14 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform shadow-lg shadow-white/10"
            title={t.ctlPlayPause}
          >
            {playerState.isPlaying ? (
              <Pause size={24} fill="currentColor" className="md:w-7 md:h-7" />
            ) : (
              <Play size={24} fill="currentColor" className="ml-1 md:w-7 md:h-7" />
            )}
          </button>

          <div className="flex items-center gap-1 md:gap-4">
            <button onClick={onSkipForward} className="hidden sm:block text-zinc-400 hover:text-white transition-colors p-2 hover:bg-zinc-800 rounded-full" title={t.ctlForward10}>
              <RotateCw size={18} />
            </button>

            {markers.length > 0 && (
              <button
                onClick={onNextMarker}
                className="text-yellow-500 hover:text-yellow-400 transition-colors p-2 hover:bg-zinc-800 rounded-full"
                title={t.ctlNextMarker}
              >
                <Bookmark size={16} />
              </button>
            )}

            <button onClick={onNext} className="text-zinc-300 hover:text-white transition-colors p-2 hover:bg-zinc-800 rounded-full" title={t.ctlNext}>
              <SkipForward size={20} fill="currentColor" />
            </button>
          </div>

          <button 
            onClick={onToggleRepeat}
            className={`transition-colors relative p-2 rounded-full hover:bg-zinc-800 ${playerState.repeatMode !== 'off' ? 'text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            title={t.ctlRepeat}
          >
            <Repeat size={18} />
            {playerState.repeatMode === 'one' && (
              <span className="absolute top-1 right-1 text-[8px] font-bold bg-zinc-900 rounded-full px-0.5 border border-cyan-400">1</span>
            )}
          </button>
        </div>

        {/* Desktop: Seek Bar on Bottom */}
        <div className="hidden md:block w-full">
          {renderSeekBar()}
        </div>
      </div>

      {/* Volume Controls (Right) - Desktop Only */}
      <div className="w-1/4 hidden md:flex justify-end items-center gap-2">
        {practiceButtons(false)}
        <button onClick={onToggleMute} className="text-zinc-400 hover:text-zinc-200 p-2 rounded-full hover:bg-zinc-800" title={t.mute}>
          {playerState.isMuted || playerState.volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <div className="w-24 relative group h-4 flex items-center">
           <div className="absolute inset-0 bg-zinc-800 rounded-full h-1 my-auto overflow-hidden">
                <div 
                    className="h-full bg-zinc-200 rounded-full group-hover:bg-cyan-400"
                    style={{ width: `${playerState.isMuted ? 0 : playerState.volume * 100}%` }}
                ></div>
           </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={playerState.isMuted ? 0 : playerState.volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};

export default PlayerControls;