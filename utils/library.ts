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
