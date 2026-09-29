// Reads embedded tags (ID3, Vorbis comments, MP4 atoms, ...) from local audio files.
import type { Track } from '../types';

const COVER_SIZE = 400; // px; embedded art is often 1000px+, which bloats IndexedDB
const PARSE_CONCURRENCY = 4;

export type TrackTags = Pick<Track, 'name' | 'artist' | 'album' | 'duration' | 'trackNumber' | 'discNumber' | 'year' | 'genre' | 'coverArtUrl'>;

/** Downscale an embedded picture to a compact JPEG data URL. */
const pictureToDataURL = async (data: Uint8Array, format: string): Promise<string | undefined> => {
  try {
    const bitmap = await createImageBitmap(new Blob([data as BlobPart], { type: format }));
    const scale = Math.min(1, COVER_SIZE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return undefined;
  }
};

/**
 * Parse tags from a file. Returns only the fields that were found, so callers can
 * spread the result over filename-based defaults. Never throws.
 * `coverCache` lets tracks from the same album share one decoded cover.
 */
export const readTags = async (file: File, coverCache?: Map<string, string | undefined>): Promise<Partial<TrackTags>> => {
  try {
    // Loaded on demand: keeps the parser out of the initial bundle
    const { parseBlob, selectCover } = await import('music-metadata');
    const { common, format } = await parseBlob(file, { skipCovers: false, duration: false });

    const tags: Partial<TrackTags> = {};
    if (common.title?.trim()) tags.name = common.title.trim();
    const artist = common.artist || common.albumartist;
    if (artist?.trim()) tags.artist = artist.trim();
    if (common.album?.trim()) tags.album = common.album.trim();
    if (common.track?.no) tags.trackNumber = common.track.no;
    if (common.disk?.no) tags.discNumber = common.disk.no;
    if (common.year) tags.year = common.year;
    if (common.genre?.[0]) tags.genre = common.genre[0];
    if (format.duration && isFinite(format.duration)) tags.duration = format.duration;

    const picture = selectCover(common.picture);
    if (picture) {
      const key = `${tags.artist ?? ''}\u0000${tags.album ?? file.name}`;
      if (coverCache?.has(key)) {
        tags.coverArtUrl = coverCache.get(key);
      } else {
        tags.coverArtUrl = await pictureToDataURL(picture.data, picture.format);
        coverCache?.set(key, tags.coverArtUrl);
      }
    }
    return tags;
  } catch (err) {
    console.warn(`[Metadata] Could not read tags from ${file.name}`, err);
    return {};
  }
};

/** Run `fn` over items with bounded concurrency, reporting each result as it completes. */
export const mapWithConcurrency = async <T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  onResult: (item: T, result: R) => void,
  concurrency = PARSE_CONCURRENCY
): Promise<void> => {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      onResult(item, await fn(item));
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
};
