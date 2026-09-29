import React, { useState, useCallback, useRef } from 'react';
import { Track } from '../types';
import { streamFromTorrent, removeTorrent } from '../utils/webtorrent';

interface UseTorrentStreamProps {
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  /** Load and play a track that already has a directly playable URL. */
  startTrack: (track: Track) => void;
  addToast: (message: string, type?: 'error' | 'info') => void;
}

const DIRECTLY_PLAYABLE = /^(blob:|data:|https?:)/;
const TORRENT_TIMEOUT_MS = 30_000;

const getMagnet = (track: Track): string | null =>
  track.torrentMagnetLink || (track.url.startsWith('magnet:') ? track.url : null);

/** True when the track is a magnet link that must be downloaded before playback. */
export const needsP2PResolution = (track: Track): boolean =>
  !DIRECTLY_PLAYABLE.test(track.url) && getMagnet(track) !== null;

export function useTorrentStream({ setTracks, startTrack, addToast }: UseTorrentStreamProps) {
  const [isResolving, setIsResolving] = useState(false);
  const currentMagnetRef = useRef<string | null>(null);

  const playFromTorrent = useCallback(async (track: Track) => {
    const magnet = getMagnet(track);
    if (!magnet) {
      addToast('Could not resolve this track', 'error');
      return;
    }

    if (currentMagnetRef.current && currentMagnetRef.current !== magnet) {
      removeTorrent(currentMagnetRef.current);
    }
    currentMagnetRef.current = magnet;

    setIsResolving(true);
    addToast('Resolving P2P stream from peers...');

    let settled = false;
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      setIsResolving(false);
      console.error(err);
      addToast('Could not reach any peers for this track', 'error');
    };
    // A torrent with no reachable peers never errors, it just waits forever
    const timeout = setTimeout(() => {
      removeTorrent(magnet);
      fail(new Error('Timed out waiting for WebTorrent peers'));
    }, TORRENT_TIMEOUT_MS);

    await streamFromTorrent(
      magnet,
      (blobUrl, file) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        setIsResolving(false);
        const playableTrack: Track = { ...track, url: blobUrl, type: 'local', file };
        // Replace any existing entry (same id) with the now-downloaded version
        setTracks(prev =>
          prev.some(t => t.id === track.id)
            ? prev.map(t => (t.id === track.id ? playableTrack : t))
            : [...prev, playableTrack]
        );
        startTrack(playableTrack);
        addToast('Downloaded from peers');
      },
      undefined,
      fail
    );
  }, [setTracks, startTrack, addToast]);

  return {
    playFromTorrent,
    isResolving,
  };
}
