import React from 'react';
import { Disc3, User, Play, ArrowLeft } from 'lucide-react';
import type { AlbumGroup, ArtistGroup } from '../utils/library';
import type { Translation } from '../translations';
import { format } from '../utils/i18n';

const Cover: React.FC<{ url?: string; round?: boolean; icon: React.ReactNode }> = ({ url, round, icon }) => (
  <div className={`aspect-square w-full overflow-hidden bg-zinc-800 flex items-center justify-center shadow-lg ${round ? 'rounded-full' : 'rounded-lg'}`}>
    {url ? <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" /> : icon}
  </div>
);

export const AlbumGrid: React.FC<{ t: Translation; albums: AlbumGroup[]; onOpen: (key: string) => void }> = ({ t, albums, onOpen }) =>
  albums.length === 0 ? (
    <div className="flex-1 flex items-center justify-center text-zinc-500 px-6 text-center">{t.noAlbums}</div>
  ) : (
    <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 content-start" data-album-grid>
      {albums.map(album => (
        <button key={album.key} onClick={() => onOpen(album.key)} className="text-left group">
          <Cover url={album.coverArtUrl} icon={<Disc3 size={40} className="text-zinc-600" />} />
          <p className="mt-2 text-sm font-medium text-zinc-100 truncate group-hover:text-cyan-400">{album.name}</p>
          <p className="text-xs text-zinc-500 truncate">
            {album.artist ?? t.unknownArtist}
            {album.year ? ` · ${album.year}` : ''}
          </p>
        </button>
      ))}
    </div>
  );

export const ArtistList: React.FC<{ t: Translation; artists: ArtistGroup[]; onOpen: (key: string) => void }> = ({ t, artists, onOpen }) =>
  artists.length === 0 ? (
    <div className="flex-1 flex items-center justify-center text-zinc-500 px-6 text-center">{t.noArtists}</div>
  ) : (
    <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-5 content-start" data-artist-list>
      {artists.map(artist => (
        <button key={artist.key} onClick={() => onOpen(artist.key)} className="text-center group">
          <Cover url={artist.coverArtUrl} round icon={<User size={40} className="text-zinc-600" />} />
          <p className="mt-2 text-sm font-medium text-zinc-100 truncate group-hover:text-cyan-400">{artist.name}</p>
          <p className="text-xs text-zinc-500">
            {format(t.tracksCount, { count: artist.tracks.length })}
          </p>
        </button>
      ))}
    </div>
  );

/** Header above an album's or artist's track list. */
export const GroupHeader: React.FC<{
  t: Translation;
  title: string;
  subtitle?: string;
  coverArtUrl?: string;
  round?: boolean;
  backLabel: string;
  onBack: () => void;
  onPlayAll: () => void;
}> = ({ t, title, subtitle, coverArtUrl, round, backLabel, onBack, onPlayAll }) => (
  <div className="px-4 pt-4 flex items-end gap-4">
    <div className="w-24 h-24 md:w-32 md:h-32 shrink-0">
      <Cover url={coverArtUrl} round={round} icon={round ? <User size={32} className="text-zinc-600" /> : <Disc3 size={32} className="text-zinc-600" />} />
    </div>
    <div className="min-w-0 flex-1 space-y-2">
      <button onClick={onBack} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1">
        <ArrowLeft size={12} /> {backLabel}
      </button>
      <h2 className="text-2xl md:text-3xl font-bold text-white truncate">{title}</h2>
      {subtitle && <p className="text-sm text-zinc-400 truncate">{subtitle}</p>}
      <button onClick={onPlayAll} className="px-4 py-1.5 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium flex items-center gap-2" data-play-all>
        <Play size={14} fill="currentColor" /> {t.playAll}
      </button>
    </div>
  </div>
);
