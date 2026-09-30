import { useEffect, RefObject } from 'react';
import type { Track } from '../types';
import { savePreferences, Preferences } from '../utils/preferences';

interface UseSessionMemoryProps {
  prefs: Pick<Preferences, 'language' | 'viewMode' | 'visualizerMode' | 'sortKey'>;
  currentTrack: Track | null;
  isPlaying: boolean;
  isInLibrary: (id: string) => boolean;
  libraryLoaded: boolean;
  audioRef: RefObject<HTMLAudioElement>;
  unknownArtist: string;
}

/**
 * Everything the app remembers about the session (UI choices, last track and position),
 * plus the now-playing info shown in the tab title and on the lock screen.
 */
export function useSessionMemory({ prefs, currentTrack, isPlaying, isInLibrary, libraryLoaded, audioRef, unknownArtist }: UseSessionMemoryProps) {
  const { language, viewMode, visualizerMode, sortKey } = prefs;
  useEffect(() => {
    savePreferences({ language, viewMode, visualizerMode, sortKey });
  }, [language, viewMode, visualizerMode, sortKey]);

  // Remember the current track so the next session can resume it
  useEffect(() => {
    if (!libraryLoaded) return; // don't clobber the saved session before it has been restored
    savePreferences({ lastTrackId: currentTrack && isInLibrary(currentTrack.id) ? currentTrack.id : null });
  }, [currentTrack?.id, isInLibrary, libraryLoaded]);

  // ...and the position: every few seconds while playing, on pause, and when the tab closes
  useEffect(() => {
    const savePosition = () => {
      const audio = audioRef.current;
      // readyState 0 = nothing loaded yet (e.g. while restoring), so currentTime would read 0
      if (currentTrack && audio && audio.readyState > 0) savePreferences({ lastPosition: audio.currentTime });
    };
    const interval = isPlaying ? setInterval(savePosition, 5000) : undefined;
    if (!isPlaying) savePosition();
    window.addEventListener('pagehide', savePosition);
    return () => {
      clearInterval(interval);
      window.removeEventListener('pagehide', savePosition);
    };
  }, [isPlaying, currentTrack, audioRef]);

  // Tab title and lock-screen metadata (re-applied when tags or cover art arrive)
  useEffect(() => {
    document.title = currentTrack
      ? `${currentTrack.name}${currentTrack.artist ? ` · ${currentTrack.artist}` : ''} — Penko Tune`
      : 'Penko Tune';
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = currentTrack
        ? new MediaMetadata({
            title: currentTrack.name,
            artist: currentTrack.artist || unknownArtist,
            album: currentTrack.album || '',
            artwork: currentTrack.coverArtUrl ? [{ src: currentTrack.coverArtUrl }] : [],
          })
        : null;
    }
  }, [currentTrack, unknownArtist]);

  useEffect(() => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);
}
