import React from 'react';
import { Layout, FolderOpen, Plus, Image as ImageIcon, X, Link2, Share2, Users, Copy, HardDrive, Loader2, AlertTriangle } from 'lucide-react';
import type { OutgoingShare } from '../types';
import type { IncomingState } from '../hooks/useSharing';
import type { StorageStatus } from '../utils/storage';
import { formatBytes } from '../utils/formatters';
import { ViewMode, Playlist, Track, ChapterMarker } from '../types';
import type { Translation } from '../translations';
import { formatTime } from '../utils/formatters';

interface SidebarProps {
  t: Translation;
  tracksCount: number;
  playlists: Playlist[];
  selectedPlaylist: string | null;
  showCreatePlaylist: boolean;
  newPlaylistName: string;
  currentTrack: Track | null;
  currentTrackMarkers: ChapterMarker[];
  upNext: Track[];
  onRemoveFromQueue: (index: number) => void;
  onClearQueue: () => void;
  editingMarkerId: string | null;
  editingMarkerLabel: string;
  
  onSetSelectedPlaylist: (id: string | null) => void;
  onSetViewMode: (mode: ViewMode) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSetShowCreatePlaylist: (show: boolean) => void;
  onSetNewPlaylistName: (name: string) => void;
  onCreatePlaylist: (name: string) => void;
  onUpdatePlaylistCover: (id: string, file: File) => void;
  onDeletePlaylist: (id: string) => void;
  onUpdateMarkerLabel: (id: string, label: string) => void;
  onSetEditingMarkerId: (id: string | null) => void;
  onSetEditingMarkerLabel: (label: string) => void;
  onJumpToMarker: (timestamp: number) => void;
  onDeleteMarker: (id: string) => void;
  canLinkFolders: boolean;
  onLinkFolder: () => void;
  onSharePlaylist: (id: string) => void;
  incoming: IncomingState[];
  incomingTitles: Record<string, string>;
  onCloseIncoming: (id: string) => void;
  outgoing: OutgoingShare[];
  peerCounts: Record<string, number>;
  onCopyShareLink: (share: OutgoingShare) => void;
  onStopShare: (id: string) => void;
  storage: StorageStatus | null;
  storageNeedsAttention: boolean;
  onOpenStorage: () => void;
}

export function Sidebar({
  t,
  tracksCount,
  playlists,
  selectedPlaylist,
  showCreatePlaylist,
  newPlaylistName,
  currentTrack,
  currentTrackMarkers,
  upNext,
  onRemoveFromQueue,
  onClearQueue,
  editingMarkerId,
  editingMarkerLabel,
  onSetSelectedPlaylist,
  onSetViewMode,
  onFileUpload,
  onSetShowCreatePlaylist,
  onSetNewPlaylistName,
  onCreatePlaylist,
  onUpdatePlaylistCover,
  onDeletePlaylist,
  onUpdateMarkerLabel,
  onSetEditingMarkerId,
  onSetEditingMarkerLabel,
  onJumpToMarker,
  onDeleteMarker,
  canLinkFolders,
  onLinkFolder,
  onSharePlaylist,
  incoming,
  incomingTitles,
  onCloseIncoming,
  outgoing,
  peerCounts,
  onCopyShareLink,
  onStopShare,
  storage,
  storageNeedsAttention,
  onOpenStorage,
}: SidebarProps) {
  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-900 hidden md:flex flex-col p-4 gap-6 z-10 overflow-y-auto">
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2">Library</h3>
        <button
          onClick={() => {
            onSetSelectedPlaylist(null);
            onSetViewMode(ViewMode.LIST);
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors text-left group ${
            selectedPlaylist === null
              ? 'bg-zinc-900 text-cyan-400'
              : 'text-zinc-300 hover:bg-zinc-900'
          }`}
        >
            <Layout size={18} className={selectedPlaylist === null ? 'text-cyan-400' : 'text-zinc-500 group-hover:text-cyan-400'} />
            {t.allTracks}
        </button>
         <label className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-900 rounded-md transition-colors cursor-pointer group">
            <Plus size={18} className="text-zinc-500 group-hover:text-cyan-400" />
            {t.addFiles}
            <input 
              type="file" 
              accept="audio/*,image/*,.flac,.ogg,.m4a,.aac" 
              multiple 
              onChange={onFileUpload} 
              className="hidden" 
            />
        </label>
         <label className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-900 rounded-md transition-colors cursor-pointer group">
            <FolderOpen size={18} className="text-zinc-500 group-hover:text-cyan-400" />
            {t.importFolder}
            <input
              type="file"
              {...({ webkitdirectory: "", mozdirectory: "", directory: "" } as any)}
              multiple
              onChange={onFileUpload}
              className="hidden"
            />
        </label>
        {canLinkFolders && (
          <button
            onClick={onLinkFolder}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-900 rounded-md transition-colors text-left group"
            title={t.linkFolderHint}
          >
            <Link2 size={18} className="text-zinc-500 group-hover:text-cyan-400" />
            {t.linkFolder}
          </button>
        )}
      </div>

      {/* Shared with you (incoming share links) */}
      {incoming.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2">{t.sharedWithYou}</h3>
          <div className="space-y-1">
            {incoming.map(share => {
              const viewId = `share:${share.id}`;
              return (
                <div key={share.id} className="flex items-center gap-1 group">
                  <button
                    onClick={() => { onSetSelectedPlaylist(viewId); onSetViewMode(ViewMode.LIST); }}
                    className={`flex-1 min-w-0 flex items-center gap-2 px-3 py-2 text-sm rounded-md text-left ${selectedPlaylist === viewId ? 'bg-zinc-900 text-purple-300' : 'text-zinc-300 hover:bg-zinc-900'}`}
                  >
                    {share.status === 'connecting'
                      ? <Loader2 size={14} className="animate-spin text-purple-400 shrink-0" />
                      : share.status === 'error'
                        ? <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                        : <Users size={14} className="text-purple-400 shrink-0" />}
                    <span className="truncate">{incomingTitles[share.id] ?? t.shareConnecting}</span>
                  </button>
                  <button onClick={() => onCloseIncoming(share.id)} className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-red-400" title={t.close}>
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Up Next (manual queue) */}
      {upNext.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t.upNext}</h3>
            <button onClick={onClearQueue} className="text-[10px] text-zinc-500 hover:text-red-400">
              {t.clearQueue}
            </button>
          </div>
          <div className="space-y-1">
            {upNext.map((track, index) => (
              <div key={`${track.id}-${index}`} className="flex items-center gap-2 px-2 group">
                <span className="flex-1 min-w-0 text-xs">
                  <span className="block truncate text-zinc-300">{track.name}</span>
                  <span className="block truncate text-zinc-600">{track.artist}</span>
                </span>
                <button
                  onClick={() => onRemoveFromQueue(index)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-800 rounded text-zinc-600 hover:text-red-400"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Playlists */}
      <div className="space-y-2 pt-2 border-t border-zinc-800">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t.playlists}</h3>
          <button
            onClick={() => onSetShowCreatePlaylist(true)}
            className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-cyan-400 transition-colors"
            title={t.createPlaylist}
          >
            <Plus size={14} />
          </button>
        </div>

        {showCreatePlaylist && (
          <div className="px-2 py-2 bg-zinc-900 rounded-md space-y-2">
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => onSetNewPlaylistName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newPlaylistName.trim()) {
                  onCreatePlaylist(newPlaylistName.trim());
                } else if (e.key === 'Escape') {
                  onSetShowCreatePlaylist(false);
                  onSetNewPlaylistName('');
                }
              }}
              placeholder={t.playlistName}
              className="w-full px-2 py-1 text-sm bg-zinc-800 text-white border border-zinc-700 rounded focus:outline-none focus:border-cyan-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => newPlaylistName.trim() && onCreatePlaylist(newPlaylistName.trim())}
                className="flex-1 px-2 py-1 text-xs bg-cyan-700 hover:bg-cyan-600 text-white rounded transition-colors"
              >
                {t.create}
              </button>
              <button
                onClick={() => { onSetShowCreatePlaylist(false); onSetNewPlaylistName(''); }}
                className="flex-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {playlists.map(playlist => (
            <div
              key={playlist.id}
              className="flex items-center gap-2 group"
            >
              {/* Playlist Cover */}
              <label className="cursor-pointer shrink-0">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) onUpdatePlaylistCover(playlist.id, file);
                  }}
                />
                <div className="w-8 h-8 rounded overflow-hidden bg-zinc-800 flex items-center justify-center hover:ring-2 hover:ring-cyan-500 transition-all group/cover">
                  {playlist.coverArtUrl ? (
                    <img src={playlist.coverArtUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={14} className="text-zinc-600 group-hover/cover:text-cyan-400" />
                  )}
                </div>
              </label>

              <button
                onClick={() => {
                  onSetSelectedPlaylist(playlist.id);
                  onSetViewMode(ViewMode.LIST);
                }}
                className={`flex-1 flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors text-left ${
                  selectedPlaylist === playlist.id
                    ? 'bg-zinc-900 text-cyan-400'
                    : 'text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                <span className="flex-1 truncate">{playlist.name}</span>
                <span className="text-xs text-zinc-600">
                  {playlist.trackIds.length}
                </span>
              </button>
              {playlist.trackIds.length > 0 && (
                <button
                  onClick={() => onSharePlaylist(playlist.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-800 rounded text-zinc-600 hover:text-cyan-400 transition-all"
                  title={t.shareWithFriends}
                >
                  <Share2 size={12} />
                </button>
              )}
              <button
                onClick={() => onDeletePlaylist(playlist.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-800 rounded text-zinc-600 hover:text-red-400 transition-all"
                title={t.deletePlaylist}
              >
                <Plus size={14} className="rotate-45" />
              </button>
            </div>
          ))}

          {playlists.length === 0 && !showCreatePlaylist && (
            <p className="px-3 py-2 text-xs text-zinc-600">
              {t.noPlaylists}
            </p>
          )}
        </div>
      </div>

      {/* Chapter Markers */}
      <div className="space-y-2 pt-2 border-t border-zinc-800">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t.chapterMarkers}</h3>
          <span className="text-[10px] text-zinc-600">{t.rightClickSeekBar}</span>
        </div>

        <div className="space-y-1">
          {currentTrackMarkers.map(marker => (
            <div key={marker.id} className="flex items-center gap-1 group px-2">
              {editingMarkerId === marker.id ? (
                <input
                  type="text"
                  value={editingMarkerLabel}
                  onChange={(e) => onSetEditingMarkerLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onUpdateMarkerLabel(marker.id, editingMarkerLabel);
                    } else if (e.key === 'Escape') {
                      onSetEditingMarkerId(null);
                      onSetEditingMarkerLabel('');
                    }
                  }}
                  onBlur={() => onUpdateMarkerLabel(marker.id, editingMarkerLabel)}
                  className="flex-1 px-2 py-1 text-xs bg-zinc-800 text-white border border-cyan-500 rounded focus:outline-none"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => onJumpToMarker(marker.timestamp)}
                  onDoubleClick={() => {
                    onSetEditingMarkerId(marker.id);
                    onSetEditingMarkerLabel(marker.label);
                  }}
                  className="flex-1 flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 rounded transition-colors text-left"
                >
                  <div className="w-2 h-2 bg-yellow-500 rounded-full shrink-0" />
                  <span className="flex-1 truncate">{marker.label}</span>
                  <span className="text-zinc-600 font-mono text-[10px]">
                    {formatTime(marker.timestamp)}
                  </span>
                </button>
              )}
              <button
                onClick={() => onDeleteMarker(marker.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-800 rounded text-zinc-600 hover:text-red-400 transition-all"
                title="Delete Marker"
              >
                <Plus size={12} className="rotate-45" />
              </button>
            </div>
          ))}

          {currentTrack && currentTrackMarkers.length === 0 && (
            <p className="px-3 py-2 text-xs text-zinc-600">
              {t.noMarkers}
            </p>
          )}

          {!currentTrack && (
            <p className="px-3 py-2 text-xs text-zinc-600">
              {t.playToaddMarkers}
            </p>
          )}
        </div>
      </div>

      {/* Sharing (outgoing links this device is serving) */}
      {outgoing.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2">{t.sharing}</h3>
          <div className="space-y-1">
            {outgoing.map(share => (
              <div key={share.id} className="flex items-center gap-1 px-2 group">
                <span className="flex-1 min-w-0 text-xs">
                  <span className="block truncate text-zinc-300">{share.title}</span>
                  <span className="block text-zinc-600">
                    {share.mode === 'copy' ? t.shareModeCopy : t.shareModeStream} · {peerCounts[share.id] ?? 0} {t.peersConnected}
                  </span>
                </span>
                <button onClick={() => onCopyShareLink(share)} className="p-1 text-zinc-600 hover:text-cyan-400" title={t.copy}>
                  <Copy size={12} />
                </button>
                <button onClick={() => onStopShare(share.id)} className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-red-400" title={t.stopSharing}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <p className="px-2 text-[10px] text-zinc-600">{t.sharingKeepOpen}</p>
        </div>
      )}

      {/* Storage */}
      <div className="mt-auto pt-2 border-t border-zinc-800">
        <button onClick={onOpenStorage} className="w-full text-left px-2 py-2 rounded-md hover:bg-zinc-900 group space-y-1.5">
          <span className="flex items-center gap-2 text-xs text-zinc-400 group-hover:text-zinc-200">
            <HardDrive size={14} />
            <span className="flex-1">{t.storageTitle}</span>
            {storageNeedsAttention && <AlertTriangle size={14} className="text-amber-400" />}
          </span>
          {storage?.quota ? (
            <>
              <span className="block h-1 bg-zinc-800 rounded-full overflow-hidden">
                <span
                  className={`block h-full ${storage.usage / storage.quota > 0.8 ? 'bg-amber-500' : 'bg-cyan-600'}`}
                  style={{ width: `${Math.max(1, (storage.usage / storage.quota) * 100)}%` }}
                />
              </span>
              <span className="block text-[10px] text-zinc-600">
                {tracksCount} {t.tracksInLibrary} · {formatBytes(storage.usage, 1)}
              </span>
            </>
          ) : (
            <span className="block text-[10px] text-zinc-600">{tracksCount} {t.tracksInLibrary}</span>
          )}
        </button>
      </div>
    </aside>
  );
}