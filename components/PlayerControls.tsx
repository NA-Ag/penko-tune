import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, RotateCcw, RotateCw, FastForward, Bookmark } from 'lucide-react';
import { PlayerState, ChapterMarker } from '../types';
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
  hasTrack?: boolean;
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
  hasTrack = false,
}) => {
  // Helper to render the seek bar to avoid duplication between mobile/desktop layouts
  const handleSeekBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hasTrack) return;

    const seekBar = e.currentTarget;
    const rect = seekBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const timestamp = percentage * (playerState.duration || 0);

    // Right-click or Ctrl+Click to add marker
    if (e.button === 2 || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onAddMarker?.(timestamp);
    } else {
      // Left-click to seek
      onSeek(timestamp);
    }
  };

  const renderSeekBar = () => (
    <div className="w-full flex items-center gap-3 text-xs text-zinc-400 font-mono">
      <span className="w-10 text-right">{formatTime(playerState.currentTime)}</span>
      <div
        className="relative flex-1 group h-4 flex items-center cursor-pointer"
        onClick={handleSeekBarClick}
        onContextMenu={(e) => {
          e.preventDefault();
          handleSeekBarClick(e as any);
        }}
        title={hasTrack ? "Click to seek • Right-click to add marker" : ""}
      >
        <div className="absolute inset-0 bg-zinc-800 rounded-full h-1 my-auto overflow-hidden pointer-events-none">
            <div
                className="h-full bg-cyan-500 rounded-full group-hover:bg-cyan-400 transition-all duration-75 ease-linear"
                style={{ width: `${(playerState.currentTime / (playerState.duration || 1)) * 100}%` }}
            ></div>
        </div>

        {/* Chapter Markers */}
        {markers.map((marker) => {
          const position = (marker.timestamp / (playerState.duration || 1)) * 100;
          return (
            <div
              key={marker.id}
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
      
      {/* Track Info Placeholder (Left) - Desktop Only */}
      <div className="w-1/4 hidden md:flex items-center gap-3">
         {playerState.playbackRate !== 1 && (
             <div className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-full text-xs font-bold animate-pulse">
                <FastForward size={14} />
                {playerState.playbackRate}x
             </div>
         )}
      </div>

      {/* Main Controls (Center) - Adaptive Layout */}
      <div className="flex flex-col items-center w-full md:w-2/4 gap-3 md:gap-2">
        
        {/* Mobile: Seek Bar on Top */}
        <div className="md:hidden w-full">
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