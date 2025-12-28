import React, { useState, useEffect } from 'react';
import { Track, Playlist } from '../types';
import { Music, Play, Trash2, MoreVertical, Plus, X, Image } from 'lucide-react';
import { formatBytes } from '../utils/formatters';

interface TrackListProps {
  tracks: Track[];
  currentTrackId?: string;
  isPlaying: boolean;
  onSelectTrack: (track: Track) => void;
  onRemoveTrack: (id: string, e: React.MouseEvent) => void;
  playlists: Playlist[];
  onAddToPlaylist: (trackId: string, playlistId: string) => void;
  selectedPlaylist: string | null;
  onRemoveFromPlaylist: (trackId: string, playlistId: string) => void;
  onUpdateCover: (trackId: string, imageFile: File) => void;
  onRemoveCover: (trackId: string) => void;
}

const TrackList: React.FC<TrackListProps> = ({
  tracks,
  currentTrackId,
  isPlaying,
  onSelectTrack,
  onRemoveTrack,
  playlists,
  onAddToPlaylist,
  selectedPlaylist,
  onRemoveFromPlaylist,
  onUpdateCover,
  onRemoveCover
}) => {
  const [showPlaylistMenuForTrack, setShowPlaylistMenuForTrack] = useState<string | null>(null);
  const [showCoverMenuForTrack, setShowCoverMenuForTrack] = useState<string | null>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;

      // Close cover menu if clicking outside
      if (showCoverMenuForTrack && !target.closest('.cover-menu-container')) {
        setShowCoverMenuForTrack(null);
      }

      // Close playlist menu if clicking outside
      if (showPlaylistMenuForTrack && !target.closest('.playlist-menu-container')) {
        setShowPlaylistMenuForTrack(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCoverMenuForTrack, showPlaylistMenuForTrack]);

  const handleCoverUpload = (trackId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onUpdateCover(trackId, file);
      setShowCoverMenuForTrack(null);
    }
  };

  if (tracks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
        <Music size={64} className="mb-4 opacity-20" />
        <p className="text-xl font-medium">No tracks loaded</p>
        <p className="text-sm mt-2">Drag & drop files or use the 'Add Files' button</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-4">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-zinc-950 z-10 text-zinc-400 text-xs uppercase tracking-wider font-medium border-b border-zinc-800">
          <tr>
            <th className="py-3 pl-4 w-12">#</th>
            <th className="py-3 w-12">Cover</th>
            <th className="py-3">Title</th>
            <th className="py-3 hidden sm:table-cell">Format</th>
            <th className="py-3 hidden md:table-cell">Size</th>
            <th className="py-3 w-12"></th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {tracks.map((track, index) => {
            const isCurrent = currentTrackId === track.id;
            return (
              <tr 
                key={track.id}
                onClick={() => onSelectTrack(track)}
                className={`
                  group cursor-pointer transition-colors border-b border-zinc-900/50 hover:bg-zinc-900/60
                  ${isCurrent ? 'bg-zinc-900 text-cyan-400' : 'text-zinc-300'}
                `}
              >
                <td className="py-3 pl-4 rounded-l-md font-mono text-zinc-500 group-hover:text-zinc-300">
                  {isCurrent && isPlaying ? (
                    <div className="w-3 h-3 bg-cyan-500 animate-pulse rounded-full" />
                  ) : (
                    <span className="group-hover:hidden">{index + 1}</span>
                  )}
                  <Play size={12} className="hidden group-hover:block text-zinc-100" />
                </td>
                <td className="py-3 relative" onClick={(e) => e.stopPropagation()}>
                  <div className="relative cover-menu-container">
                    <div
                      className="relative w-10 h-10 rounded overflow-hidden bg-zinc-800 flex items-center justify-center group/cover cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCoverMenuForTrack(showCoverMenuForTrack === track.id ? null : track.id);
                      }}
                    >
                      {track.coverArtUrl ? (
                        <img src={track.coverArtUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Music size={16} className="text-zinc-600" />
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <Image size={14} className="text-white" />
                      </div>
                    </div>

                    {/* Cover Menu */}
                    {showCoverMenuForTrack === track.id && (
                      <div className="absolute left-0 top-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md shadow-xl z-20 min-w-[140px] py-1">
                        <label className="block w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleCoverUpload(track.id, e)}
                          />
                          <div className="flex items-center gap-2">
                            <Image size={14} />
                            {track.coverArtUrl ? 'Change Cover' : 'Add Cover'}
                          </div>
                        </label>
                        {track.coverArtUrl && (
                          <button
                            onClick={() => {
                              onRemoveCover(track.id);
                              setShowCoverMenuForTrack(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-800 transition-colors flex items-center gap-2"
                          >
                            <X size={14} />
                            Remove Cover
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-3 font-medium">
                  <div className="flex flex-col">
                    <span className={isCurrent ? "text-cyan-400" : "text-zinc-100"}>{track.name}</span>
                    <span className="text-xs text-zinc-500">{track.artist || 'Unknown Artist'}</span>
                  </div>
                </td>
                <td className="py-3 hidden sm:table-cell text-zinc-500 uppercase text-xs">
                  {track.file ? (track.file.type.split('/')[1] || 'Audio') : 'Stream'}
                </td>
                <td className="py-3 hidden md:table-cell text-zinc-500 font-mono text-xs">
                  {track.file ? formatBytes(track.file.size) : '--'}
                </td>
                <td className="py-3 rounded-r-md">
                  <div className="flex items-center gap-1 justify-end">
                    {/* Add to Playlist button */}
                    <div className="relative playlist-menu-container">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPlaylistMenuForTrack(showPlaylistMenuForTrack === track.id ? null : track.id);
                        }}
                        className="p-2 text-zinc-600 hover:text-cyan-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Add to playlist"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {/* Playlist dropdown menu */}
                      {showPlaylistMenuForTrack === track.id && (
                        <div className="absolute right-0 top-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md shadow-xl z-20 min-w-[200px] py-1">
                          <div className="px-3 py-2 text-xs font-semibold text-zinc-500 border-b border-zinc-800">
                            Add to Playlist
                          </div>
                          {playlists.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-zinc-600">
                              No playlists yet
                            </div>
                          ) : (
                            playlists.map(playlist => (
                              <button
                                key={playlist.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAddToPlaylist(track.id, playlist.id);
                                  setShowPlaylistMenuForTrack(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2"
                              >
                                <Plus size={14} />
                                {playlist.name}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Remove from playlist/library button */}
                    {selectedPlaylist ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFromPlaylist(track.id, selectedPlaylist);
                        }}
                        className="p-2 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove from playlist"
                      >
                        <X size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => onRemoveTrack(track.id, e)}
                        className="p-2 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove from library"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TrackList;