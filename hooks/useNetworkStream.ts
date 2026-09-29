import React, { useState } from 'react';
import { Track } from '../types';
import { generateId } from '../utils/audio';

interface UseNetworkStreamProps {
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  playTrack: (track: Track) => void;
  addToast: (message: string, type?: 'error' | 'info') => void;
  onClose: () => void;
}

/** Derive a readable name from a stream URL or magnet link. */
const nameFromUrl = (url: string): { name: string; artist: string } => {
  if (url.startsWith('magnet:')) {
    const dn = new URLSearchParams(url.slice(url.indexOf('?') + 1)).get('dn');
    return { name: dn || 'Shared Track', artist: 'Peer-to-peer' };
  }
  try {
    const parsed = new URL(url);
    const file = decodeURIComponent(parsed.pathname.split('/').pop() || '');
    return { name: file || parsed.hostname, artist: parsed.hostname };
  } catch {
    return { name: 'Network Stream', artist: url };
  }
};

/**
 * Add a direct audio stream (http(s) file, internet radio) or a magnet link.
 * The URL is fetched by the browser directly — no proxies or third-party lookups.
 */
export function useNetworkStream({ setTracks, playTrack, addToast, onClose }: UseNetworkStreamProps) {
  const [networkUrl, setNetworkUrl] = useState('');

  const addNetworkStream = () => {
    const url = networkUrl.trim();
    if (!url) return;

    const isMagnet = url.startsWith('magnet:');
    if (!isMagnet && !/^https?:\/\//i.test(url)) {
      addToast('Enter an http(s) audio URL or a magnet link', 'error');
      return;
    }

    const track: Track = {
      id: generateId(),
      ...nameFromUrl(url),
      url,
      type: 'stream',
      ...(isMagnet && { torrentMagnetLink: url }),
    };

    setTracks(prev => [...prev, track]);
    setNetworkUrl('');
    onClose();
    playTrack(track);
  };

  return {
    networkUrl,
    setNetworkUrl,
    addNetworkStream,
  };
}
