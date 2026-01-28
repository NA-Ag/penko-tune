import React, { useState } from 'react';
import { Track } from '../types';
import { saveTracksToIndexedDB } from '../utils/persistence';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Helper to extract YouTube Video ID
const extractVideoId = (url: string): string | null => {
    const patterns = [
        /youtu\.be\/([^?&#]+)/,
        /youtube\.com\/watch\?v=([^?&#]+)/,
        /youtube\.com\/embed\/([^?&#]+)/,
        /youtube\.com\/shorts\/([^?&#]+)/,
        /youtube\.com\/v\/([^?&#]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            const id = match[1].substring(0, 11);
            if (id.length === 11) return id;
        }
    }
    return null;
};

// CORS Proxy to bypass restrictions on localhost/production
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

interface UseNetworkStreamProps {
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  playTrack: (track: Track) => void;
  addToast: (message: string, type?: 'error' | 'info') => void;
  onClose: () => void;
}

export function useNetworkStream({ setTracks, playTrack, addToast, onClose }: UseNetworkStreamProps) {
  const [networkUrl, setNetworkUrl] = useState('');
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const addNetworkStream = async () => {
      if (!networkUrl) return;

      const youtubeId = extractVideoId(networkUrl);

      if (youtubeId) {
          setIsLoadingStream(true);

          // Privacy-focused sources (based on working proof of concept)
          // Using CORS-friendly proxies and working Piped instances
          const sources = [
            // Piped instances (best for audio quality)
            `${CORS_PROXY}${encodeURIComponent(`https://pipedapi.kavin.rocks/streams/${youtubeId}`)}`,
            `${CORS_PROXY}${encodeURIComponent(`https://pipedapi.tokhmi.xyz/streams/${youtubeId}`)}`,
            `${CORS_PROXY}${encodeURIComponent(`https://api-piped.mha.fi/streams/${youtubeId}`)}`,

            // Invidious instances (fallback)
            `${CORS_PROXY}${encodeURIComponent(`https://inv.nadeko.net/api/v1/videos/${youtubeId}`)}`,
            `${CORS_PROXY}${encodeURIComponent(`https://invidious.privacyredirect.com/api/v1/videos/${youtubeId}`)}`,
            `${CORS_PROXY}${encodeURIComponent(`https://yt.artemislena.eu/api/v1/videos/${youtubeId}`)}`
          ];

          let streamData: { url: string, title?: string, author?: string, thumbnail?: string } | null = null;
          let success = false;

          for (const source of sources) {
            try {
                console.log(`Trying source: ${source}`);
                // Fetch with timeout (8 seconds for better reliability)
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);

                const response = await fetch(source, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) continue;

                const data = await response.json();
                let audioUrl = '';

                // Extract audio URL from different API formats
                if (data.audioStreams && data.audioStreams.length > 0) {
                    // Piped format - sort by bitrate (descending)
                    const bestAudio = data.audioStreams.sort((a: any, b: any) =>
                        (b.bitrate || 0) - (a.bitrate || 0)
                    )[0];
                    audioUrl = bestAudio.url;
                } else if (data.formatStreams) {
                    // Alternative format
                    const audioStream = data.formatStreams.find((s: any) =>
                        s.type && s.type.includes('audio')
                    );
                    if (audioStream) audioUrl = audioStream.url;
                } else if (data.adaptiveFormats) {
                    // YouTube format (might contain ads)
                    const audioFormat = data.adaptiveFormats.find((f: any) =>
                        f.mimeType && f.mimeType.includes('audio')
                    );
                    if (audioFormat && audioFormat.url) {
                        audioUrl = audioFormat.url;
                    }
                }

                if (audioUrl) {
                    streamData = {
                        url: audioUrl,
                        title: data.title || 'YouTube Stream',
                        author: data.uploader || data.author || 'YouTube',
                        thumbnail: data.thumbnailUrl || (data.videoThumbnails ? data.videoThumbnails[0]?.url : null)
                    };
                    success = true;
                    break;
                }
            } catch (e) {
                console.log(`Source failed: ${source}`, e);
                // Continue to next source
            }
          }

          // Fallback: Try additional Piped instances if direct sources fail
          if (!success) {
              console.log('Trying backup instances...');
              const backupSources = [
                  `${CORS_PROXY}${encodeURIComponent(`https://piped-api.garudalinux.org/streams/${youtubeId}`)}`,
                  `${CORS_PROXY}${encodeURIComponent(`https://pipedapi.esmailelbob.xyz/streams/${youtubeId}`)}`,
                  `${CORS_PROXY}${encodeURIComponent(`https://pipedapi.syncpundit.io/streams/${youtubeId}`)}`
              ];

              for (const backup of backupSources) {
                  try {
                      const controller = new AbortController();
                      const timeoutId = setTimeout(() => controller.abort(), 8000);
                      const response = await fetch(backup, { signal: controller.signal });
                      clearTimeout(timeoutId);

                      if (response.ok) {
                          const data = await response.json();
                          if (data.audioStreams && data.audioStreams.length > 0) {
                              const bestAudio = data.audioStreams.sort((a: any, b: any) =>
                                  (b.bitrate || 0) - (a.bitrate || 0)
                              )[0];
                              streamData = {
                                  url: bestAudio.url,
                                  title: data.title || 'YouTube Stream',
                                  author: data.uploader || data.author || 'YouTube',
                                  thumbnail: data.thumbnailUrl || (data.videoThumbnails ? data.videoThumbnails[0]?.url : null)
                              };
                              success = true;
                              break;
                          }
                      }
                  } catch (error) {
                      console.log(`Backup failed: ${backup}`);
                  }
              }
          }

          if (success && streamData) {
              const newTrack: Track = {
                  id: generateId(),
                  name: streamData.title || 'Network Stream',
                  artist: streamData.author || 'YouTube',
                  url: streamData.url,
                  type: 'stream',
                  coverArtUrl: streamData.thumbnail
              };

              setTracks(prev => {
                const updatedTracks = [...prev, newTrack];
                saveTracksToIndexedDB(updatedTracks).catch(err => console.error("Failed to save network stream", err));
                return updatedTracks;
              });
              setNetworkUrl('');
              onClose();
              playTrack(newTrack);
              addToast("Stream added - ad-free & privacy-focused!");
          } else {
              // Check if running on localhost and provide helpful message
              const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
              if (isLocalhost) {
                  addToast("YouTube streaming requires deployment. Works automatically on GitHub Pages/Vercel/Netlify!", "error");
              } else {
                  addToast("Could not find audio stream. Try another video or check the URL.", "error");
              }
          }

          setIsLoadingStream(false);
          return;
      }

      // Standard direct URL (for non-YouTube links)
      const newTrack: Track = {
          id: generateId(),
          name: 'Network Stream',
          artist: networkUrl,
          url: networkUrl,
          type: 'stream'
      };
      setTracks(prev => {
        const updatedTracks = [...prev, newTrack];
        saveTracksToIndexedDB(updatedTracks).catch(err => console.error("Failed to save direct stream", err));
        return updatedTracks;
      });
      setNetworkUrl('');
      onClose();
      playTrack(newTrack);
  };

  const searchNetwork = async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    
    // Piped instances to try for search
    const instances = [
      'https://pipedapi.kavin.rocks',
      'https://pipedapi.tokhmi.xyz', 
      'https://api-piped.mha.fi'
    ];

    for (const instance of instances) {
      try {
        const response = await fetch(`${CORS_PROXY}${encodeURIComponent(`${instance}/search?q=${encodeURIComponent(query)}&filter=music_songs`)}`);
        if (response.ok) {
          const data = await response.json();
          // Filter for streams only
          const items = data.items.filter((item: any) => item.type === 'stream');
          setSearchResults(items);
          break; // Stop after first successful fetch
        }
      } catch (e) {
        console.warn(`Search failed on ${instance}`, e);
      }
    }
    setIsSearching(false);
  };

  return {
    networkUrl,
    setNetworkUrl,
    isLoadingStream,
    addNetworkStream,
    searchNetwork,
    searchResults,
    isSearching
  };
}