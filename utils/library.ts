import type { Track } from '../types';
import type { SortKey } from './preferences';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const text = (value?: string) => value ?? '';
const num = (value?: number) => value ?? Number.MAX_SAFE_INTEGER; // untagged sorts last

/** Album order: album, then disc, then track number, then title. */
const byAlbumPosition = (a: Track, b: Track) =>
  collator.compare(text(a.album), text(b.album)) ||
  num(a.discNumber) - num(b.discNumber) ||
  num(a.trackNumber) - num(b.trackNumber) ||
  collator.compare(a.name, b.name);

const COMPARATORS: Record<Exclude<SortKey, 'added'>, (a: Track, b: Track) => number> = {
  title: (a, b) => collator.compare(a.name, b.name),
  artist: (a, b) => collator.compare(text(a.artist), text(b.artist)) || byAlbumPosition(a, b),
  album: byAlbumPosition,
  duration: (a, b) => (a.duration ?? 0) - (b.duration ?? 0),
};

const matches = (track: Track, terms: string[]) => {
  const haystack = [track.name, track.artist, track.album, track.genre, track.year?.toString()]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return terms.every(term => haystack.includes(term));
};

/**
 * Filter by a free-text query (every word must match title/artist/album/genre/year)
 * and sort. 'added' keeps the incoming order (library add order or playlist order).
 */
export const filterAndSortTracks = (tracks: Track[], query: string, sortKey: SortKey): Track[] => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = terms.length ? tracks.filter(t => matches(t, terms)) : tracks;
  return sortKey === 'added' ? filtered : [...filtered].sort(COMPARATORS[sortKey]);
};

// --- Album & artist grouping ---

export interface AlbumGroup {
  key: string;
  name: string;
  artist?: string;
  year?: number;
  coverArtUrl?: string;
  tracks: Track[];
}

export interface ArtistGroup {
  key: string;
  name: string;
  albumCount: number;
  coverArtUrl?: string;
  tracks: Track[];
}

export const albumKey = (track: Track) => `${(track.artist ?? '').toLowerCase()}\u0000${(track.album ?? '').toLowerCase()}`;
export const artistKey = (track: Track) => (track.artist ?? '').toLowerCase();

/** Albums (tracks without an album tag are left out), sorted by artist then album. */
export const groupAlbums = (tracks: Track[]): AlbumGroup[] => {
  const groups = new Map<string, AlbumGroup>();
  for (const track of tracks) {
    if (!track.album) continue;
    const key = albumKey(track);
    const group = groups.get(key) ?? { key, name: track.album, artist: track.artist, tracks: [] };
    group.tracks.push(track);
    group.year ??= track.year;
    group.coverArtUrl ??= track.coverArtUrl;
    groups.set(key, group);
  }
  return [...groups.values()]
    .map(g => ({ ...g, tracks: [...g.tracks].sort(COMPARATORS.album) }))
    .sort((a, b) => collator.compare(a.artist ?? '', b.artist ?? '') || collator.compare(a.name, b.name));
};

/** Artists with their tracks in album order. Tracks without an artist are left out. */
export const groupArtists = (tracks: Track[]): ArtistGroup[] => {
  const groups = new Map<string, ArtistGroup>();
  for (const track of tracks) {
    if (!track.artist) continue;
    const key = artistKey(track);
    const group = groups.get(key) ?? { key, name: track.artist, albumCount: 0, tracks: [] };
    group.tracks.push(track);
    group.coverArtUrl ??= track.coverArtUrl;
    groups.set(key, group);
  }
  return [...groups.values()]
    .map(g => ({
      ...g,
      albumCount: new Set(g.tracks.map(t => t.album).filter(Boolean)).size,
      tracks: [...g.tracks].sort(COMPARATORS.album),
    }))
    .sort((a, b) => collator.compare(a.name, b.name));
};
