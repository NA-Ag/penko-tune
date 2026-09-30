import React, { useState, useEffect } from 'react';
import { Track, Playlist } from '../types';
import { Music, Play, Trash2, MoreVertical, Plus, X, Image, Cloud, Search, ListStart, ListEnd, Download, Share2, Link2, Users, Loader2, Pencil } from 'lucide-react';
import { formatTime } from '../utils/formatters';
import type { SortKey } from '../utils/preferences';
import type { Translation } from '../translations';

interface TrackListProps {
  t: Translation;
  tracks: Track[];
  /** Number of tracks before the search filter, to tell "empty" from "no matches". */
  totalCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortKey: SortKey;
  onSortChange: (key: SortKey) => void;
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
  onPlayNext: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onDownload: (track: Track) => void;
  onShare: (track: Track) => void;
  onSaveShared: (track: Track) => void;
  onEditInfo: (track: Track) => void;
  /** Save progress (0..1) for received tracks being saved. */
  savingProgress: Record<string, number>;
  /** Replaces the default empty-state message (e.g. while connecting to a share). */
  emptyMessage?: React.ReactNode;
}

const SORT_OPTIONS: { key: SortKey; label: keyof Translation }[] = [
  { key: 'added', label: 'sortAdded' },
  { key: 'title', label: 'sortTitle' },
  { key: 'artist', label: 'sortArtist' },
  { key: 'album', label: 'sortAlbum' },
  { key: 'duration', label: 'sortDuration' },
];

const menuItemClass = 'w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2';

const TrackList: React.FC<TrackListProps> = ({
  t,
  tracks,
  totalCount,
  searchQuery,
  onSearchChange,
  sortKey,
  onSortChange,
  currentTrackId,
  isPlaying,
  onSelectTrack,
  onRemoveTrack,
  playlists,
  onAddToPlaylist,
  selectedPlaylist,
  onRemoveFromPlaylist,
  onUpdateCover,
  onRemoveCover,
  onPlayNext,
  onAddToQueue,
  onDownload,
  onShare,
  onSaveShared,
  onEditInfo,
  savingProgress,
  emptyMessage,
}) => {
  const [menuForTrack, setMenuForTrack] = useState<string | null>(null);
  const [coverMenuForTrack, setCoverMenuForTrack] = useState<string | null>(null);

  // Close menus when clicking outside
  useEffect(() => {
    if (!menuForTrack && !coverMenuForTrack) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.cover-menu-container')) setCoverMenuForTrack(null);
      if (!target.closest('.track-menu-container')) setMenuForTrack(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuForTrack, coverMenuForTrack]);

  const handleCoverUpload = (trackId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow picking the same file again
    if (file && file.type.startsWith('image/')) {
      onUpdateCover(trackId, file);
      setCoverMenuForTrack(null);
    }
  };

  const runMenuAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
    setMenuForTrack(null);
  };

  if (totalCount === 0 && emptyMessage) {
    return <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 px-6 text-center">{emptyMessage}</div>;
  }

  if (totalCount === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 px-6 text-center">
        <Music size={64} className="mb-4 opacity-20" />
        <p className="text-xl font-medium">{selectedPlaylist ? t.emptyPlaylist : t.noTracks}</p>
        {!selectedPlaylist && <p className="text-sm mt-2">{t.noTracksHint}</p>}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-900">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onSearchChange('')}
            placeholder={t.searchLibrary}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <select
          value={sortKey}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-sm text-zinc-300 focus:outline-none focus:border-cyan-500"
          title={t.sortBy}
        >
          {SORT_OPTIONS.map(({ key, label }) => (
            <option key={key} value={key}>{t[label]}</option>
          ))}
        </select>
      </div>

      {tracks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
          <Search size={48} className="mb-4 opacity-20" />
          <p>{t.noResults}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="sticky top-0 bg-zinc-950 z-10 text-zinc-400 text-xs uppercase tracking-wider font-medium border-b border-zinc-800">
              <tr>
                <th className="py-3 pl-4 w-12">#</th>
                <th className="py-3 w-14"></th>
                <th className="py-3">{t.colTitle}</th>
                <th className="py-3 hidden md:table-cell">{t.colAlbum}</th>
                <th className="py-3 hidden sm:table-cell w-16 text-right pr-4">{t.colDuration}</th>
                <th className="py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {tracks.map((track, index) => {
                const isCurrent = currentTrackId === track.id;
                return (
                  <tr
                    key={track.id}
                    onClick={() => onSelectTrack(track)}
                    className={`group cursor-pointer transition-colors border-b border-zinc-900/50 hover:bg-zinc-900/60 ${isCurrent ? 'bg-zinc-900 text-cyan-400' : 'text-zinc-300'}`}
                  >
                    <td className="py-3 pl-4 rounded-l-md font-mono text-zinc-500 group-hover:text-zinc-300">
                      {isCurrent && isPlaying ? (
                        <div className="w-3 h-3 bg-cyan-500 animate-pulse rounded-full" />
                      ) : (
                        <span className="group-hover:hidden">{index + 1}</span>
                      )}
                      <Play size={12} className="hidden group-hover:block text-zinc-100" />
                    </td>

                    {/* Cover (click to change) */}
                    <td className="py-2 relative" onClick={(e) => e.stopPropagation()}>
                      <div className="relative cover-menu-container">
                        <div
                          className="relative w-10 h-10 rounded overflow-hidden bg-zinc-800 flex items-center justify-center group/cover cursor-pointer"
                          onClick={() => setCoverMenuForTrack(coverMenuForTrack === track.id ? null : track.id)}
                        >
                          {track.coverArtUrl ? (
                            <img src={track.coverArtUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                          ) : (
                            <Music size={16} className="text-zinc-600" />
                          )}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <Image size={14} className="text-white" />
                          </div>
                        </div>

                        {coverMenuForTrack === track.id && (
                          <div className="absolute left-0 top-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md shadow-xl z-20 min-w-[140px] py-1">
                            <label className={`${menuItemClass} cursor-pointer`}>
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverUpload(track.id, e)} />
                              <Image size={14} />
                              {track.coverArtUrl ? t.changeCover : t.addCover}
                            </label>
                            {track.coverArtUrl && (
                              <button
                                onClick={() => { onRemoveCover(track.id); setCoverMenuForTrack(null); }}
                                className={`${menuItemClass} text-red-400`}
                              >
                                <X size={14} />
                                {t.removeCover}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3 font-medium pr-2">
                      <div className="flex flex-col min-w-0">
                        <span className={`truncate ${isCurrent ? 'text-cyan-400' : 'text-zinc-100'}`}>{track.name}</span>
                        <span className="text-xs text-zinc-500 truncate flex items-center gap-1">
                          {track.incomingShareId ? (
                            <Users size={12} className="text-purple-400 shrink-0" />
                          ) : track.type === 'stream' ? (
                            <Cloud size={12} className="text-cyan-500 shrink-0" />
                          ) : track.fileHandle ? (
                            <Link2 size={12} className={`shrink-0 ${track.url ? 'text-zinc-500' : 'text-amber-500'}`} />
                          ) : null}
                          {track.artist || t.unknownArtist}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 hidden md:table-cell text-zinc-500 truncate pr-2">{track.album || ''}</td>
                    <td className="py-3 hidden sm:table-cell text-zinc-500 font-mono text-xs text-right pr-4">
                      {track.duration ? formatTime(track.duration) : '--'}
                    </td>

                    <td className="py-3 rounded-r-md">
                      <div className="flex items-center gap-1 justify-end">
                        <div className="relative track-menu-container">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuForTrack(menuForTrack === track.id ? null : track.id);
                            }}
                            className="p-2 text-zinc-600 hover:text-cyan-400 transition-colors md:opacity-0 md:group-hover:opacity-100"
                            title={t.addToPlaylist}
                          >
                            <MoreVertical size={16} />
                          </button>

                          {menuForTrack === track.id && (
                            <div className="absolute right-0 top-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md shadow-xl z-20 min-w-[200px] py-1">
                              <button onClick={(e) => runMenuAction(e, () => onPlayNext(track))} className={menuItemClass}>
                                <ListStart size={14} /> {t.playNext}
                              </button>
                              <button onClick={(e) => runMenuAction(e, () => onAddToQueue(track))} className={menuItemClass}>
                                <ListEnd size={14} /> {t.addToQueue}
                              </button>
                              {track.incomingShareId ? (
                                track.canSave && (
                                  <button onClick={(e) => runMenuAction(e, () => onSaveShared(track))} className={menuItemClass}>
                                    <Download size={14} /> {t.saveToLibrary}
                                  </button>
                                )
                              ) : (
                                <>
                                  <button onClick={(e) => runMenuAction(e, () => onEditInfo(track))} className={menuItemClass}>
                                    <Pencil size={14} /> {t.editInfo}
                                  </button>
                                  {track.type === 'local' && (
                                    <>
                                      <button onClick={(e) => runMenuAction(e, () => onShare(track))} className={menuItemClass}>
                                        <Share2 size={14} /> {t.shareWithFriends}
                                      </button>
                                      <button onClick={(e) => runMenuAction(e, () => onDownload(track))} className={menuItemClass}>
                                        <Download size={14} /> {t.downloadFile}
                                      </button>
                                    </>
                                  )}
                                  <div className="px-3 py-2 mt-1 text-xs font-semibold text-zinc-500 border-t border-zinc-800">
                                    {t.addToPlaylist}
                                  </div>
                                  {playlists.length === 0 ? (
                                    <div className="px-3 py-2 text-xs text-zinc-600">{t.noPlaylists}</div>
                                  ) : (
                                    playlists.map(playlist => (
                                      <button
                                        key={playlist.id}
                                        onClick={(e) => runMenuAction(e, () => onAddToPlaylist(track.id, playlist.id))}
                                        className={menuItemClass}
                                      >
                                        <Plus size={14} />
                                        <span className="truncate">{playlist.name}</span>
                                      </button>
                                    ))
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {savingProgress[track.id] !== undefined ? (
                          <span className="p-2 text-purple-400 flex items-center gap-1 text-xs font-mono" title={t.saveToLibrary}>
                            <Loader2 size={14} className="animate-spin" />
                            {Math.round(savingProgress[track.id] * 100)}%
                          </span>
                        ) : track.incomingShareId ? null : selectedPlaylist ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveFromPlaylist(track.id, selectedPlaylist);
                            }}
                            className="p-2 text-zinc-600 hover:text-red-400 transition-colors md:opacity-0 md:group-hover:opacity-100"
                            title={t.removeFromPlaylist}
                          >
                            <X size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => onRemoveTrack(track.id, e)}
                            className="p-2 text-zinc-600 hover:text-red-400 transition-colors md:opacity-0 md:group-hover:opacity-100"
                            title={t.removeFromLibrary}
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
      )}
    </div>
  );
};

export default TrackList;
