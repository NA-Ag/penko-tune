import React from 'react';
import { Layout, FolderOpen, Plus, Image as ImageIcon, Download, Upload } from 'lucide-react';
import { ViewMode, Playlist, Track, ChapterMarker } from '../types';
import { formatTime } from '../utils/formatters';

interface SidebarProps {
  t: any;
  tracksCount: number;
  playlists: Playlist[];
  selectedPlaylist: string | null;
  showCreatePlaylist: boolean;
  newPlaylistName: string;
  currentTrack: Track | null;
  currentTrackMarkers: ChapterMarker[];
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
  onBackupLibrary: () => void;
  onRestoreLibrary: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
  onBackupLibrary,
  onRestoreLibrary
}: SidebarProps) {
  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-900 hidden md:flex flex-col p-4 gap-6 z-10">
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
      </div>

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

      {/* Library Info */}
      <div className="space-y-2 pt-2 border-t border-zinc-800">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2">{t.libraryInfo}</h3>
        <div className="px-3 py-2 text-xs text-zinc-600 space-y-1">
          <p className="flex items-center gap-2">
            <span className="text-zinc-500">{tracksCount} {t.tracksInLibrary}</span>
          </p>
          
          <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-800/50">
            <button 
              onClick={onBackupLibrary}
              className="flex-1 flex items-center justify-center gap-2 px-2 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-cyan-400 rounded text-[10px] font-medium transition-colors"
              title="Save library to file"
            >
              <Download size={12} /> {t.backupLibrary}
            </button>
            <label className="flex-1 flex items-center justify-center gap-2 px-2 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-cyan-400 rounded text-[10px] font-medium transition-colors cursor-pointer">
              <Upload size={12} /> {t.restoreLibrary}
              <input 
                type="file" 
                accept=".json" 
                onChange={onRestoreLibrary} 
                className="hidden" 
              />
            </label>
          </div>
        </div>
      </div>
    </aside>
  );
}