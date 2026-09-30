import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Track, OutgoingShare, ShareMode } from '../types';
import { loadShares, saveShares } from '../utils/persistence';
import {
  seedShare, stopSeeding, buildShareLink, openIncomingShare, incomingTrackUrl,
  IncomingShare, CONNECT_TIMEOUT_MS,
} from '../utils/sharing';
import { getWebTorrentClient } from '../utils/webtorrent';
import { generateId } from '../utils/audio';
import { tr } from '../utils/i18n';

export type IncomingState =
  | { id: string; status: 'connecting' }
  | { id: string; status: 'ready'; share: IncomingShare }
  | { id: string; status: 'error'; error: 'offline' | 'invalid' };

interface UseSharingProps {
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  libraryLoaded: boolean;
  addToast: (message: string, type?: 'error' | 'info') => void;
  /** Create a playlist from saved tracks (used when saving a whole shared playlist). */
  onSavedPlaylist: (name: string, trackIds: string[]) => void;
}

const registerShareWorker = () => {
  // In production the Workbox worker imports share-sw.js; in dev there is no Workbox worker.
  if (import.meta.env.DEV && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/share-sw.js').catch(err => console.warn('[Share] SW registration failed', err));
  }
};

/** Resolves once a service worker controls the page, or false if none does in time. */
const waitForController = (ms = 4000): Promise<boolean> => {
  if (!('serviceWorker' in navigator)) return Promise.resolve(false);
  if (navigator.serviceWorker.controller) return Promise.resolve(true);
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(!!navigator.serviceWorker.controller), ms);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      clearTimeout(timer);
      resolve(true);
    }, { once: true });
  });
};

export function useSharing({ tracks, setTracks, libraryLoaded, addToast, onSavedPlaylist }: UseSharingProps) {
  const [outgoing, setOutgoing] = useState<OutgoingShare[]>([]);
  const [peerCounts, setPeerCounts] = useState<Record<string, number>>({});
  const [incoming, setIncoming] = useState<IncomingState[]>([]);
  const [saving, setSaving] = useState<Record<string, number>>({}); // track id -> progress 0..1

  const seededRef = useRef(new Set<string>());
  const incomingRef = useRef<Map<string, IncomingShare>>(new Map());
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  useEffect(registerShareWorker, []);

  // --- Outgoing shares ---

  useEffect(() => {
    if (!libraryLoaded) return;
    loadShares().then(setOutgoing).catch(err => console.error('[Share] Failed to load shares', err));
  }, [libraryLoaded]);

  const persistOutgoing = (next: OutgoingShare[]) => {
    setOutgoing(next);
    saveShares(next).catch(err => console.error('[Share] Failed to save shares', err));
  };

  // Keep links alive across restarts: re-seed each share once its tracks are readable
  // (linked folders may need reconnecting first).
  useEffect(() => {
    for (const share of outgoing) {
      if (seededRef.current.has(share.id)) continue;
      const shareTracks = share.trackIds.map(id => tracks.find(t => t.id === id));
      if (shareTracks.some(t => !t?.file)) continue;
      seededRef.current.add(share.id);
      seedShare(shareTracks as Track[], { title: share.title, mode: share.mode, share })
        .catch(err => {
          console.error('[Share] Re-seeding failed', err);
          seededRef.current.delete(share.id);
        });
    }
  }, [outgoing, tracks]);

  // Peer counts for the "Sharing" list
  useEffect(() => {
    if (outgoing.length === 0) return;
    const update = async () => {
      const client = await getWebTorrentClient();
      const counts: Record<string, number> = {};
      for (const share of outgoing) {
        const torrent = await client.get(share.id);
        counts[share.id] = torrent ? torrent.numPeers : 0;
      }
      setPeerCounts(counts);
    };
    update();
    const interval = setInterval(update, 3000);
    return () => clearInterval(interval);
  }, [outgoing]);

  /** Encrypt and start sharing tracks. Resolves to the share link. */
  const createShare = useCallback(async (shareTracks: Track[], title: string, mode: ShareMode): Promise<string | null> => {
    const result = await seedShare(shareTracks, { title, mode });
    if (!result) {
      addToast(tr('toastOnlyLocalShare'), 'error');
      return null;
    }
    seededRef.current.add(result.share.id);
    if (!outgoing.some(s => s.id === result.share.id)) persistOutgoing([...outgoing, result.share]);
    return buildShareLink(result.share);
  }, [outgoing, addToast]);

  const stopShare = useCallback(async (id: string) => {
    await stopSeeding(id);
    seededRef.current.delete(id);
    persistOutgoing(outgoing.filter(s => s.id !== id));
    addToast(tr('toastStoppedSharing'));
  }, [outgoing, addToast]);

  // --- Incoming shares ---

  // Answer the share service worker's range requests from the open torrents
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = async (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type !== 'penko-share-range') return;
      const port = event.ports[0];
      const share = incomingRef.current.get(msg.shareId);
      const info = share?.tracks[msg.fileIndex];
      if (!share || !info) {
        port.postMessage({ miss: true });
        return;
      }
      if (msg.start >= info.size) {
        port.postMessage({ error: 'Range not satisfiable', status: 416 });
        return;
      }
      try {
        const end = Math.min(msg.end, info.size - 1);
        const data = await share.readRange(msg.fileIndex, msg.start, end);
        port.postMessage(
          { data: data.buffer, start: msg.start, end, size: info.size, mime: info.mime },
          [data.buffer]
        );
      } catch (err) {
        console.error('[Share] Range read failed', err);
        port.postMessage({ error: 'Read failed', status: 500 });
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  const openIncoming = useCallback(async (infoHash: string, key: string) => {
    if (incomingRef.current.has(infoHash)) return;
    // Our own share: nothing to receive
    if (outgoing.some(s => s.id === infoHash)) {
      addToast(tr('toastOwnShare'));
      return;
    }
    setIncoming(prev => [...prev.filter(s => s.id !== infoHash), { id: infoHash, status: 'connecting' }]);

    try {
      const [share, streaming] = await Promise.all([openIncomingShare(infoHash, key), waitForController()]);
      incomingRef.current.set(infoHash, share);

      const received: Track[] = share.tracks.map((info, i) => ({
        id: `share-${infoHash}-${i}`,
        name: info.name,
        artist: info.artist,
        album: info.album,
        duration: info.duration,
        trackNumber: info.trackNumber,
        year: info.year,
        genre: info.genre,
        coverArtUrl: info.coverArtUrl,
        // With the service worker we stream; without one (e.g. private windows) the file
        // is fetched in full on first play (see resolveIncomingTrack)
        url: streaming ? incomingTrackUrl(infoHash, i) : '',
        type: 'stream',
        incomingShareId: infoHash,
        canSave: share.mode === 'copy',
      }));
      setTracks(prev => [...prev.filter(t => t.incomingShareId !== infoHash), ...received]);
      setIncoming(prev => prev.map(s => (s.id === infoHash ? { id: infoHash, status: 'ready', share } : s)));
    } catch (err) {
      console.error('[Share] Could not open share', err);
      const error = (err as Error)?.message === 'TIMEOUT' ? 'offline' : 'invalid';
      setIncoming(prev => prev.map(s => (s.id === infoHash ? { id: infoHash, status: 'error', error } : s)));
    }
  }, [outgoing, setTracks, addToast]);

  const closeIncoming = useCallback(async (id: string) => {
    incomingRef.current.delete(id);
    setIncoming(prev => prev.filter(s => s.id !== id));
    setTracks(prev => prev.filter(t => t.incomingShareId !== id));
    await stopSeeding(id).catch(() => {});
  }, [setTracks]);

  /** Fallback when no service worker is available: download the whole file, then play it. */
  const resolveIncomingTrack = useCallback(async (track: Track): Promise<Track | null> => {
    const share = track.incomingShareId ? incomingRef.current.get(track.incomingShareId) : null;
    if (!share) return null;
    const index = Number(track.id.split('-').pop());
    const file = await share.readFile(index);
    const resolved = { ...track, url: URL.createObjectURL(file) };
    setTracks(prev => prev.map(t => (t.id === track.id ? resolved : t)));
    return resolved;
  }, [setTracks]);

  /** Save copies of received tracks into the library (only if the sender allowed it). */
  const saveIncoming = useCallback(async (shareId: string, indexes?: number[]) => {
    const share = incomingRef.current.get(shareId);
    if (!share || share.mode !== 'copy') return;
    const which = indexes ?? share.tracks.map((_, i) => i);
    const savedIds: string[] = [];

    for (const index of which) {
      const sourceId = `share-${shareId}-${index}`;
      try {
        const file = await share.readFile(index, fraction =>
          setSaving(prev => ({ ...prev, [sourceId]: fraction }))
        );
        const info = share.tracks[index];
        const saved: Track = {
          id: generateId(),
          name: info.name,
          artist: info.artist,
          album: info.album,
          duration: info.duration,
          trackNumber: info.trackNumber,
          year: info.year,
          genre: info.genre,
          coverArtUrl: info.coverArtUrl,
          file,
          url: URL.createObjectURL(file),
          type: 'local',
          addedAt: Date.now(),
          tagsRead: true, // tags came with the share
        };
        setTracks(prev => [...prev, saved]);
        savedIds.push(saved.id);
      } catch (err) {
        console.error('[Share] Save failed', err);
        addToast(tr('toastSaveTrackFailed', { name: share.tracks[index].name }), 'error');
      } finally {
        setSaving(prev => {
          const { [sourceId]: _, ...rest } = prev;
          return rest;
        });
      }
    }

    if (savedIds.length > 1 && !indexes) onSavedPlaylist(share.title, savedIds);
    if (savedIds.length) addToast(tr('toastSavedTracks', { count: savedIds.length }));
  }, [setTracks, addToast, onSavedPlaylist]);

  return {
    outgoing,
    peerCounts,
    createShare,
    stopShare,
    incoming,
    openIncoming,
    closeIncoming,
    resolveIncomingTrack,
    saveIncoming,
    saving,
    connectTimeoutSeconds: CONNECT_TIMEOUT_MS / 1000,
  };
}
