import React, { useState, useCallback, useRef } from 'react';
import { Track, DecentralizedTrack } from '../types';
import { streamFromTorrent, removeTorrent } from '../utils/webtorrent';
import { getIPFSUrl } from '../utils/ipfs';
import { saveTracksToIndexedDB } from '../utils/persistence';

interface UseDecentralizedStreamProps {
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  playTrack: (track: Track) => void;
  addToast: (message: string, type?: 'error' | 'info') => void;
}

export function useDecentralizedStream({ setTracks, playTrack, addToast }: UseDecentralizedStreamProps) {
  const [isResolving, setIsResolving] = useState(false);
  const currentMagnetRef = useRef<string | null>(null);

  const playDecentralized = useCallback(async (track: DecentralizedTrack | Track) => {
    // Cast to DecentralizedTrack to access optional properties safely
    const dTrack = track as DecentralizedTrack;

    // 1. Handle WebTorrent (Magnet Links)
    if (dTrack.torrentMagnetLink || (dTrack.url && dTrack.url.startsWith('magnet:'))) {
        const magnet = dTrack.torrentMagnetLink || dTrack.url;
        
        // If switching tracks, clean up the previous torrent to save bandwidth
        if (currentMagnetRef.current && currentMagnetRef.current !== magnet) {
            removeTorrent(currentMagnetRef.current);
        }
        currentMagnetRef.current = magnet;

        setIsResolving(true);
        addToast("Resolving P2P stream from peers...");

        await streamFromTorrent(
            magnet,
            (blobUrl, file) => {
                setIsResolving(false);
                // Create a playable track with the Blob URL
                const playableTrack: Track = {
                    ...track,
                    url: blobUrl,
                    type: 'local', // Treat as local since it's a blob now
                    file: file // Store file for metadata/download
                };

                // "Steam-like" behavior: Auto-save to library for offline use
                setTracks(prev => {
                    const updated = [...prev, playableTrack];
                    saveTracksToIndexedDB(updated).catch(e => console.error("Failed to persist P2P track", e));
                    return updated;
                });
                playTrack(playableTrack);
                addToast("Streaming from WebTorrent swarm");
            },
            (progress) => {
                // Future: Update UI with buffering progress
            },
            (err) => {
                setIsResolving(false);
                console.error(err);
                addToast("Failed to resolve torrent stream", "error");
            }
        );
        return;
    }

    // 2. Handle IPFS
    if (dTrack.ipfsHash) {
        // Use public gateway for playback (fastest for streaming)
        const gatewayUrl = getIPFSUrl(dTrack.ipfsHash);
        const playableTrack: Track = {
            ...track,
            url: gatewayUrl,
            type: 'stream'
        };
        playTrack(playableTrack);
        addToast("Streaming from IPFS Gateway");
        return;
    }

    // 3. Standard HTTP/Local Track
    playTrack(track);

  }, [playTrack, addToast]);

  return {
    playDecentralized,
    isResolving
  };
}