import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, RotateCcw, RotateCw, FastForward, Bookmark, Music } from 'lucide-react';
import { PlayerState, ChapterMarker, Track } from '../types';
import { formatTime } from '../utils/formatters';

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
  nothingPlayingLabel: string;
}

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
  nothingPlayingLabel,
}) => {
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
        className="relative flex-1 group h-4 flex items-center cursor-pointer touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setDragTime(null)}
        onClick={(e) => (e.ctrlKey || e.metaKey) && handleAddMarker(e)}
        onContextMenu={handleAddMarker}
        title={hasTrack ? "Click or drag to seek • Right-click to add marker" : ""}
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
          <p className="text-sm font-medium text-white truncate">{currentTrack?.name ?? nothingPlayingLabel}</p>
          {currentTrack && <p className="text-xs text-zinc-400 truncate">{currentTrack.artist || 'Unknown Artist'}</p>}
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
        </div>

        <div className="flex items-center justify-between md:justify-center w-full md:w-auto gap-2 md:gap-4">
          <button 
            onClick={onToggleShuffle}
            className={`transition-colors p-2 rounded-full hover:bg-zinc-800 ${playerState.isShuffle ? 'text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            title="Shuffle (s)"
          >
            <Shuffle size={18} />
          </button>
          
          <div className="flex items-center gap-1 md:gap-4">
            <button onClick={onPrev} className="text-zinc-300 hover:text-white transition-colors p-2 hover:bg-zinc-800 rounded-full" title="Previous Track">
              <SkipBack size={20} fill="currentColor" />
            </button>

            {markers.length > 0 && (
              <button
                onClick={onPrevMarker}
                className="text-yellow-500 hover:text-yellow-400 transition-colors p-2 hover:bg-zinc-800 rounded-full"
                title="Previous Marker"
              >
                <Bookmark size={16} className="rotate-180" />
              </button>
            )}

            <button onClick={onSkipBackward} className="hidden sm:block text-zinc-400 hover:text-white transition-colors p-2 hover:bg-zinc-800 rounded-full" title="-10s (Left Arrow)">
              <RotateCcw size={18} />
            </button>
          </div>
          
          <button 
            onClick={onPlayPause}
            className="w-12 h-12 md:w-14 md:h-14 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform shadow-lg shadow-white/10"
            title="Play/Pause (Space)"
          >
            {playerState.isPlaying ? (
              <Pause size={24} fill="currentColor" className="md:w-7 md:h-7" />
            ) : (
              <Play size={24} fill="currentColor" className="ml-1 md:w-7 md:h-7" />
            )}
          </button>

          <div className="flex items-center gap-1 md:gap-4">
            <button onClick={onSkipForward} className="hidden sm:block text-zinc-400 hover:text-white transition-colors p-2 hover:bg-zinc-800 rounded-full" title="+10s (Right Arrow)">
              <RotateCw size={18} />
            </button>

            {markers.length > 0 && (
              <button
                onClick={onNextMarker}
                className="text-yellow-500 hover:text-yellow-400 transition-colors p-2 hover:bg-zinc-800 rounded-full"
                title="Next Marker"
              >
                <Bookmark size={16} />
              </button>
            )}

            <button onClick={onNext} className="text-zinc-300 hover:text-white transition-colors p-2 hover:bg-zinc-800 rounded-full" title="Next Track">
              <SkipForward size={20} fill="currentColor" />
            </button>
          </div>

          <button 
            onClick={onToggleRepeat}
            className={`transition-colors relative p-2 rounded-full hover:bg-zinc-800 ${playerState.repeatMode !== 'off' ? 'text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            title="Repeat (r)"
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
        <button onClick={onToggleMute} className="text-zinc-400 hover:text-zinc-200 p-2 rounded-full hover:bg-zinc-800">
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