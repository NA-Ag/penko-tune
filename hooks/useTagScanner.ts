import React, { useEffect, useRef } from 'react';
import type { Track } from '../types';
import { readTags, mapWithConcurrency, TrackTags } from '../utils/metadata';
import { tr } from '../utils/i18n';

interface UseTagScannerProps {
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  setCurrentTrack: React.Dispatch<React.SetStateAction<Track | null>>;
  libraryLoaded: boolean;
  addToast: (message: string) => void;
}

/**
 * Reads title/artist/album/cover/lyrics/ReplayGain from local files' embedded tags in the
 * background, so adding hundreds of files stays instant. Also upgrades older libraries.
 */
export function useTagScanner({ tracks, setTracks, setCurrentTrack, libraryLoaded, addToast }: UseTagScannerProps) {
  const scanningRef = useRef(new Set<string>());

  useEffect(() => {
    if (!libraryLoaded) return;
    const pending = tracks.filter(t => t.file && !t.tagsRead && !scanningRef.current.has(t.id));
    if (pending.length === 0) return;
    pending.forEach(t => scanningRef.current.add(t.id));

    // Batch results into a few state updates instead of one re-render per file
    let buffer: [string, Partial<TrackTags>][] = [];
    const flush = () => {
      if (buffer.length === 0) return;
      const results = new Map(buffer);
      buffer = [];
      const apply = (t: Track): Track => {
        const tags = results.get(t.id);
        if (!tags) return t;
        // 'Local File' was the pre-tags placeholder; drop it so the translated fallback shows
        const artist = tags.artist ?? (t.artist === 'Local File' ? undefined : t.artist);
        // Embedded art wins over a folder image; lyrics the user already has (sidecar/edited) are kept
        return { ...t, ...tags, artist, coverArtUrl: tags.coverArtUrl ?? t.coverArtUrl, lyrics: t.lyrics ?? tags.lyrics, tagsRead: true };
      };
      setTracks(prev => prev.map(apply));
      setCurrentTrack(prev => (prev ? apply(prev) : prev));
    };
    const flushTimer = setInterval(flush, 400);

    if (pending.length > 20) addToast(`${tr('readingTags')} (${pending.length})`);
    const coverCache = new Map<string, string | undefined>();
    mapWithConcurrency(
      pending,
      track => readTags(track.file!, coverCache),
      (track, tags) => {
        scanningRef.current.delete(track.id);
        buffer.push([track.id, tags]);
      }
    ).finally(() => {
      clearInterval(flushTimer);
      flush();
    });
    // Deliberately not cancelled on re-run: each scan owns its own tracks via scanningRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, libraryLoaded]);
}
