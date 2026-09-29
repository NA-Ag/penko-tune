import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { BarChart2, Sliders, Globe, FastForward, ChevronDown, Check, Loader2, AlertCircle, Mic, Timer, X, Download, Languages, BookOpen, Menu, List, Users } from 'lucide-react';
import { Track, ViewMode, VisualizerMode, ChapterMarker } from './types';
import { translations, languageNames, Language } from './translations';
import PlayerControls from './components/PlayerControls';
import TrackList from './components/TrackList';
import Visualizer from './components/Visualizer';
import Equalizer from './components/Equalizer';
import { Sidebar } from './components/Sidebar';
import { MobileMenu } from './components/MobileMenu';
import { NetworkStreamModal } from './components/NetworkStreamModal';
import { VISUALIZER_OPTIONS } from './components/visualizerOptions';
import { PenkoTuneLogo } from './components/penko/PenkoTuneLogo';
import { saveTracksToIndexedDB, loadTracksFromIndexedDB, exportLibraryAsJSON } from './utils/persistence';
import { exportLibraryZip, importLibraryFile, downloadTrackFile, downloadBlob } from './utils/libraryArchive';
import { canLinkFolders } from './utils/storage';
import { parseShareHash, buildShareLink } from './utils/sharing';
import { formatTime } from './utils/formatters';
import { AUDIO_FILE_PATTERN, generateId, readFileAsDataURL } from './utils/audio';
import { readTags, mapWithConcurrency, TrackTags } from './utils/metadata';
import { filterAndSortTracks } from './utils/library';
import { loadPreferences, savePreferences, SortKey } from './utils/preferences';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useTorrentStream, needsP2PResolution } from './hooks/useTorrentStream';
import { useSleepTimer } from './hooks/useSleepTimer';
import { useChapterMarkers } from './hooks/useChapterMarkers';
import { usePlaylists } from './hooks/usePlaylists';
import { useLinkedFolders } from './hooks/useLinkedFolders';
import { useSharing } from './hooks/useSharing';
import { useStorageStatus } from './hooks/useStorageStatus';
import { useListenTogether, parseRoomHash } from './hooks/useListenTogether';
import { StorageDialog } from './components/StorageDialog';
import { StorageBanner } from './components/StorageBanner';
import { ShareDialog } from './components/ShareDialog';
import { ListenTogetherDialog } from './components/ListenTogetherDialog';
import { IncomingShareHeader, IncomingShareStatus } from './components/IncomingShareHeader';

interface Toast {
  message: string;
  type: 'error' | 'info';
  id: number;
}

const SKIP_SECONDS = 10;
const SLEEP_TIMER_OPTIONS = [15, 30, 45, 60, 90, 120];

function App() {
  // --- State ---
  const [tracks, setTracks] = useState<Track[]>([]);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadPreferences().viewMode);
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>(() => loadPreferences().visualizerMode);
  const [sortKey, setSortKey] = useState<SortKey>(() => loadPreferences().sortKey);
  const [searchQuery, setSearchQuery] = useState('');
  const [upNext, setUpNext] = useState<string[]>([]); // track ids queued with "Play next" / "Add to queue"

  const [showEQ, setShowEQ] = useState(false);
  const [showNetworkStream, setShowNetworkStream] = useState(false);
  const [showVisMenu, setShowVisMenu] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('navigation');
  const [currentLanguage, setCurrentLanguage] = useState<Language>(() => loadPreferences().language);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeGesture, setActiveGesture] = useState<string | null>(null);

  // PWA install prompt (BeforeInstallPromptEvent is not in the DOM typings)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const t = translations[currentLanguage];

  const toastIdRef = useRef(0);
  const addToast = useCallback((message: string, type: 'error' | 'info' = 'info') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { message, type, id }]);
    setTimeout(() => setToasts(prev => prev.filter(toast => toast.id !== id)), 4000);
  }, []);

  // Latest versions of actions used by long-lived listeners (keyboard, media session, audio 'ended').
  // Assigned every render below so those listeners never see stale state.
  const actionsRef = useRef({
    togglePlayPause: () => {},
    playNext: () => {},
    playPrev: () => {},
    skip: (_seconds: number) => {},
    nudgeVolume: (_delta: number) => {},
    toggleMute: () => {},
    toggleShuffle: () => {},
    cycleRepeat: () => {},
    focusSearch: () => {},
  });

  // --- Hooks ---
  const {
    audioRef,
    playerState,
    setPlayerState,
    analyser,
    eqBands,
    setEqBands,
    toggleKaraokeMode,
    playTrack: playTrackAudio,
    loadTrack,
    togglePlayPause: togglePlayPauseAudio,
    pause,
    stop,
    seek,
    setVolume,
    toggleMute,
    setPlaybackRate,
    handleEQChange,
    resetEQ,
    getOutputStream,
  } = useAudioPlayer({
    onTrackEnd: () => actionsRef.current.playNext(),
    onError: (msg) => addToast(msg, 'error'),
  });

  const {
    playlists,
    selectedPlaylist,
    setSelectedPlaylist,
    showCreatePlaylist,
    setShowCreatePlaylist,
    newPlaylistName,
    setNewPlaylistName,
    createPlaylist,
    createPlaylistWithTracks,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    purgeTrack: purgeTrackFromPlaylists,
    updatePlaylistCover,
  } = usePlaylists({ addToast });

  const {
    markers,
    editingMarkerId,
    editingMarkerLabel,
    setEditingMarkerId,
    setEditingMarkerLabel,
    addMarker,
    deleteMarker,
    purgeTrack: purgeTrackMarkers,
    updateMarkerLabel,
  } = useChapterMarkers({ addToast });

  const {
    isSleepTimerActive,
    sleepTimerRemainingMs,
    startSleepTimer,
    cancelSleepTimer,
  } = useSleepTimer({ onTimerExpired: pause, addToast });

  // Dialogs for storage, sharing and listening together
  const [showStorage, setShowStorage] = useState(false);
  const [storageBusy, setStorageBusy] = useState<{ label: string; progress?: number } | null>(null);
  const [shareTarget, setShareTarget] = useState<{ title: string; tracks: Track[] } | null>(null);
  const [showListen, setShowListen] = useState(false);
  const [roomInvite, setRoomInvite] = useState<{ roomId: string; password: string } | null>(null);

  // --- Library load & persistence ---
  // Imports write straight to the database and then reload; saving the in-memory library
  // meanwhile would overwrite what was imported.
  const suspendSaveRef = useRef(false);
  const lastSavedTracksRef = useRef<Track[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTracksFromIndexedDB()
      .then(saved => {
        if (cancelled) return;
        setTracks(prev => {
          const merged = [...saved, ...prev.filter(t => !saved.some(s => s.id === t.id))];
          lastSavedTracksRef.current = merged; // already on disk; no need to write it back
          return merged;
        });
        setLibraryLoaded(true);

        // Resume where the last session left off (paused)
        const { lastTrackId, lastPosition } = loadPreferences();
        const last = saved.find(t => t.id === lastTrackId);
        if (last && !needsP2PResolution(last)) {
          setCurrentTrack(prev => prev ?? last);
          loadTrack(last, lastPosition);
        }
      })
      .catch(err => {
        // Leave libraryLoaded false so a failed read never triggers an overwrite of saved data
        console.error('[App] Failed to load library:', err);
        addToast('Failed to load saved library', 'error');
      });
    return () => { cancelled = true; };
  }, [addToast, loadTrack]);

  useEffect(() => {
    if (!libraryLoaded || suspendSaveRef.current || tracks === lastSavedTracksRef.current) return;
    const timeout = setTimeout(() => {
      if (suspendSaveRef.current) return;
      lastSavedTracksRef.current = tracks;
      saveTracksToIndexedDB(tracks).catch(err => {
        console.error('[App] Failed to save library:', err);
        addToast('Error saving library', 'error');
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [tracks, libraryLoaded, addToast]);

  // --- Storage health, linked folders, sharing ---
  const storage = useStorageStatus(tracks, libraryLoaded);

  const {
    folders, disconnectedIds, scanningIds, linkFolder, reconnectFolders, rescanFolder, unlinkFolder,
  } = useLinkedFolders({ tracks, setTracks, libraryLoaded, addToast });

  const sharing = useSharing({
    tracks,
    setTracks,
    libraryLoaded,
    addToast,
    onSavedPlaylist: createPlaylistWithTracks,
  });

  const listen = useListenTogether({
    getOutputStream,
    currentTrack,
    isPlaying: playerState.isPlaying,
    onJoin: pause,
    addToast,
  });

  // --- Derived state ---
  const tracksById = useMemo(() => new Map(tracks.map(t => [t.id, t])), [tracks]);
  // Tracks received through share links live in their own view, not the library
  const libraryTracks = useMemo(() => tracks.filter(t => !t.incomingShareId), [tracks]);

  // The library or the selected playlist (in playlist order), before search/sort
  const baseList = useMemo((): Track[] => {
    if (selectedPlaylist?.startsWith('share:')) {
      const shareId = selectedPlaylist.slice('share:'.length);
      return tracks.filter(t => t.incomingShareId === shareId);
    }
    const playlist = selectedPlaylist ? playlists.find(p => p.id === selectedPlaylist) : null;
    if (!playlist) return libraryTracks;
    return playlist.trackIds.map(id => tracksById.get(id)).filter((t): t is Track => !!t);
  }, [tracks, libraryTracks, tracksById, playlists, selectedPlaylist]);

  // The play queue is exactly what's on screen: filtered by search, in the chosen sort order
  const queue = useMemo(
    () => filterAndSortTracks(baseList, searchQuery, sortKey),
    [baseList, searchQuery, sortKey]
  );

  const upNextTracks = useMemo(
    () => upNext.map(id => tracksById.get(id)).filter((t): t is Track => !!t),
    [upNext, tracksById]
  );

  const currentTrackMarkers = useMemo((): ChapterMarker[] => {
    if (!currentTrack) return [];
    return markers.filter(m => m.trackId === currentTrack.id).sort((a, b) => a.timestamp - b.timestamp);
  }, [markers, currentTrack]);

  // --- Playback ---
  const startTrack = useCallback((track: Track) => {
    setCurrentTrack(track);
    playTrackAudio(track);
  }, [playTrackAudio]);

  const { playFromTorrent, isResolving: isResolvingP2P } = useTorrentStream({
    setTracks,
    startTrack,
    addToast,
  });

  /**
   * Play a track. Selecting the current track toggles play/pause, unless `restartIfCurrent`
   * is set (queue navigation), in which case it restarts from the beginning.
   */
  const playTrack = useCallback((track: Track, restartIfCurrent = false) => {
    if (currentTrack?.id === track.id && audioRef.current.src) {
      if (restartIfCurrent) {
        seek(0);
        playTrackAudio(currentTrack);
      } else {
        togglePlayPauseAudio();
      }
      return;
    }

    // Linked track whose folder needs permission again (after a browser restart)
    if (track.fileHandle && !track.url) {
      reconnectFolders();
      return;
    }
    // Received track in a browser without the streaming service worker: download, then play
    if (track.incomingShareId && !track.url) {
      addToast('Downloading from your friend...');
      sharing.resolveIncomingTrack(track).then(resolved => resolved && startTrack(resolved));
      return;
    }

    if (needsP2PResolution(track)) {
      playFromTorrent(track);
    } else {
      startTrack(track);
    }
  }, [currentTrack, audioRef, seek, playTrackAudio, togglePlayPauseAudio, playFromTorrent, startTrack, reconnectFolders, sharing, addToast]);

  const togglePlayPause = () => {
    if (!currentTrack) {
      if (queue.length > 0) playTrack(queue[0]);
      return;
    }
    togglePlayPauseAudio();
  };

  const getNextTrack = (): Track | null => {
    if (queue.length === 0) return null;
    const index = currentTrack ? queue.findIndex(t => t.id === currentTrack.id) : -1;

    if (playerState.isShuffle && queue.length > 1) {
      const candidates = queue.filter((_, i) => i !== index);
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    if (index === -1) return queue[0];
    if (index + 1 < queue.length) return queue[index + 1];
    return playerState.repeatMode === 'all' ? queue[0] : null;
  };

  const playNext = () => {
    // Manually queued tracks ("Play next" / "Add to queue") take priority over the list order
    const [queued, ...rest] = upNextTracks;
    if (queued) {
      setUpNext(rest.map(t => t.id));
      playTrack(queued, true);
      return;
    }
    const next = getNextTrack();
    if (next) playTrack(next, true);
    else addToast('End of playlist');
  };

  const playPrev = () => {
    // Like most players: go back to the start of the song unless we're right at the beginning
    if (currentTrack && playerState.currentTime > 3) {
      seek(0);
      return;
    }
    if (queue.length === 0) return;

    const index = currentTrack ? queue.findIndex(t => t.id === currentTrack.id) : -1;
    if (index > 0) playTrack(queue[index - 1], true);
    else if (index === -1) playTrack(queue[queue.length - 1], true);
    else if (playerState.repeatMode === 'all') playTrack(queue[queue.length - 1], true);
    else seek(0);
  };

  const skip = (seconds: number) => {
    if (!currentTrack) return;
    seek(audioRef.current.currentTime + seconds);
  };

  const toggleShuffle = () => setPlayerState(prev => ({ ...prev, isShuffle: !prev.isShuffle }));

  const cycleRepeat = () => setPlayerState(prev => ({
    ...prev,
    repeatMode: prev.repeatMode === 'off' ? 'all' : prev.repeatMode === 'all' ? 'one' : 'off',
  }));

  useEffect(() => {
    actionsRef.current = {
      togglePlayPause,
      playNext,
      playPrev,
      skip,
      nudgeVolume: (delta) => setVolume(playerState.volume + delta),
      toggleMute,
      toggleShuffle: () => {
        toggleShuffle();
        addToast(`Shuffle ${playerState.isShuffle ? 'Off' : 'On'}`);
      },
      cycleRepeat: () => {
        cycleRepeat();
        const next = playerState.repeatMode === 'off' ? 'all' : playerState.repeatMode === 'all' ? 'one' : 'off';
        addToast(`Repeat: ${next}`);
      },
      focusSearch: () => {
        setViewMode(ViewMode.LIST);
        // Wait for the list view to render if we were in the visualizer
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>('input[type=search]')?.focus());
      },
    };
  });

  // --- Global listeners ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const actions = actionsRef.current;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          actions.togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          actions.skip(-SKIP_SECONDS);
          break;
        case 'ArrowRight':
          e.preventDefault();
          actions.skip(SKIP_SECONDS);
          break;
        case 'ArrowUp':
          e.preventDefault();
          actions.nudgeVolume(0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          actions.nudgeVolume(-0.1);
          break;
        case 'm':
          actions.toggleMute();
          break;
        case 's':
          actions.toggleShuffle();
          break;
        case 'r':
          actions.cycleRepeat();
          break;
        case 'n':
          actions.playNext();
          break;
        case 'p':
          actions.playPrev();
          break;
        case '/':
          e.preventDefault();
          actions.focusSearch();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Media Session API (lock screen / hardware media keys)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => actionsRef.current.togglePlayPause()],
      ['pause', () => actionsRef.current.togglePlayPause()],
      ['previoustrack', () => actionsRef.current.playPrev()],
      ['nexttrack', () => actionsRef.current.playNext()],
      ['seekbackward', () => actionsRef.current.skip(-SKIP_SECONDS)],
      ['seekforward', () => actionsRef.current.skip(SKIP_SECONDS)],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Unsupported action on this platform
      }
    }
  }, []);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playerState.isPlaying ? 'playing' : 'paused';
    }
  }, [playerState.isPlaying]);

  // Now-playing metadata (re-applied when tags or cover art arrive for the current track)
  useEffect(() => {
    document.title = currentTrack
      ? `${currentTrack.name}${currentTrack.artist ? ` · ${currentTrack.artist}` : ''} — Penko-tune`
      : 'Penko-tune';
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = currentTrack
        ? new MediaMetadata({
            title: currentTrack.name,
            artist: currentTrack.artist || 'Unknown Artist',
            album: currentTrack.album || '',
            artwork: currentTrack.coverArtUrl ? [{ src: currentTrack.coverArtUrl }] : [],
          })
        : null;
    }
  }, [currentTrack]);

  // --- Preferences ---
  useEffect(() => {
    savePreferences({ language: currentLanguage, viewMode, visualizerMode, sortKey });
  }, [currentLanguage, viewMode, visualizerMode, sortKey]);

  // Remember the current track and position so the next session can resume it
  useEffect(() => {
    if (!libraryLoaded) return; // don't clobber the saved session before it has been restored
    savePreferences({ lastTrackId: currentTrack && tracksById.has(currentTrack.id) ? currentTrack.id : null });
  }, [currentTrack?.id, tracksById, libraryLoaded]);

  useEffect(() => {
    const savePosition = () => {
      // readyState 0 = nothing loaded yet (e.g. while restoring), so currentTime would read 0
      if (currentTrack && audioRef.current.readyState > 0) {
        savePreferences({ lastPosition: audioRef.current.currentTime });
      }
    };
    const interval = playerState.isPlaying ? setInterval(savePosition, 5000) : undefined;
    if (!playerState.isPlaying) savePosition();
    window.addEventListener('pagehide', savePosition);
    return () => {
      clearInterval(interval);
      window.removeEventListener('pagehide', savePosition);
    };
  }, [playerState.isPlaying, currentTrack, audioRef]);

  // --- Tag reading ---
  // Local files get their title/artist/album/cover from embedded tags, in the background,
  // so adding hundreds of files stays instant. Also upgrades libraries saved before tag support.
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
        const artist = tags.artist ?? (t.artist === 'Local File' ? 'Unknown Artist' : t.artist);
        // Embedded art wins over a folder image; a cover set by the user later is never overwritten
        return { ...t, ...tags, artist, coverArtUrl: tags.coverArtUrl ?? t.coverArtUrl, tagsRead: true };
      };
      setTracks(prev => prev.map(apply));
      setCurrentTrack(prev => (prev ? apply(prev) : prev));
    };
    const flushTimer = setInterval(flush, 400);

    if (pending.length > 20) addToast(`${t.readingTags} (${pending.length})`);
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

  // Close header dropdowns on outside click
  useEffect(() => {
    if (!showLanguageMenu && !showVisMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.language-menu-container')) setShowLanguageMenu(false);
      if (!target.closest('#vis-menu-container')) setShowVisMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLanguageMenu, showVisMenu]);

  // PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // Suppress the mini-infobar; we show our own button
      setDeferredPrompt(e);
    };
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      addToast('Penko-tune installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [addToast]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  // --- Library actions ---
  const setTrackCover = (trackId: string, coverArtUrl: string | undefined) => {
    setTracks(prev => prev.map(t => (t.id === trackId ? { ...t, coverArtUrl } : t)));
    setCurrentTrack(prev => (prev?.id === trackId ? { ...prev, coverArtUrl } : prev));
  };

  const addFiles = async (files: File[]) => {
    const imageFile = files.find(f => f.type.startsWith('image/'));
    const audioFiles = files.filter(f => f.type.startsWith('audio/') || AUDIO_FILE_PATTERN.test(f.name));

    // Data URLs (unlike blob URLs) survive a reload once persisted
    const coverArtUrl = imageFile ? await readFileAsDataURL(imageFile).catch(() => undefined) : undefined;

    if (audioFiles.length > 0) {
      const isDuplicate = (file: File) => tracks.some(t =>
        t.file && t.file.name === file.name && t.file.size === file.size
      );
      const newTracks: Track[] = audioFiles.filter(f => !isDuplicate(f)).map(file => ({
        id: generateId(),
        file,
        name: file.name.replace(/\.[^/.]+$/, ''),
        artist: 'Local File',
        url: URL.createObjectURL(file),
        type: 'local',
        // A cover image dropped alongside audio (e.g. folder.jpg) belongs to those tracks
        coverArtUrl,
        addedAt: Date.now(),
        tagsRead: false, // filled in by the background tag scan
      }));

      if (newTracks.length > 0) {
        setTracks(prev => [...prev, ...newTracks]);
        addToast(`Added ${newTracks.length} track${newTracks.length !== 1 ? 's' : ''}`);
        // Copied music should be protected from eviction; ask while we have the user gesture
        if (storage.status && !storage.status.persisted) storage.protect();
      } else {
        addToast('All files already in library');
      }
    } else if (coverArtUrl) {
      if (currentTrack) {
        setTrackCover(currentTrack.id, coverArtUrl);
        addToast('Cover art updated for current track');
      } else {
        addToast('Play a track first to set its cover art');
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = ''; // allow re-selecting the same files
    addFiles(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  };

  const updateTrackCover = async (trackId: string, imageFile: File) => {
    try {
      setTrackCover(trackId, await readFileAsDataURL(imageFile));
      addToast('Album cover updated');
    } catch {
      addToast('Failed to read image', 'error');
    }
  };

  const removeTrackCover = (trackId: string) => {
    setTrackCover(trackId, undefined);
    addToast('Album cover removed');
  };

  // --- Up Next queue ---
  const queuePlayNext = (track: Track) => {
    setUpNext(prev => [track.id, ...prev]);
    addToast(`"${track.name}" will play next`);
  };

  const queueAppend = (track: Track) => {
    setUpNext(prev => [...prev, track.id]);
    addToast(`Added "${track.name}" to queue`);
  };

  const removeTrack = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const index = tracks.findIndex(t => t.id === id);
    if (index === -1) return;
    const removed = tracks[index];
    const remaining = tracks.filter(t => t.id !== id);

    setTracks(remaining);
    purgeTrackFromPlaylists(id);
    purgeTrackMarkers(id);
    setUpNext(prev => prev.filter(queuedId => queuedId !== id));

    if (currentTrack?.id === id) {
      const next = remaining[index] ?? remaining[0];
      if (next && playerState.isPlaying) {
        playTrack(next, true);
      } else {
        stop();
        setCurrentTrack(null);
      }
    }

    if (removed.url.startsWith('blob:')) URL.revokeObjectURL(removed.url);
    if (removed.fileHandle) addToast('Removed from library. It will return on the next folder rescan unless you delete the file.');
  };

  // --- Backup & Restore ---
  const handleExportZip = async () => {
    try {
      setStorageBusy({ label: 'Exporting...' });
      const result = await exportLibraryZip(tracks, (done, total) =>
        setStorageBusy({ label: 'Exporting...', progress: done / total })
      );
      if (!result) return; // cancelled
      addToast(
        result.skipped
          ? `Exported ${result.exported} tracks (${result.skipped} linked tracks skipped - reconnect their folder first)`
          : `Exported ${result.exported} tracks`
      );
    } catch (err) {
      console.error('Export failed', err);
      addToast('Export failed', 'error');
    } finally {
      setStorageBusy(null);
    }
  };

  const handleExportJson = async () => {
    try {
      const password = prompt('Enter a password to encrypt the backup (optional):');
      if (password === null) return; // cancelled
      const json = await exportLibraryAsJSON(password || undefined);
      downloadBlob(new Blob([json], { type: 'application/json' }), `penko-tune-info-${new Date().toISOString().slice(0, 10)}.json`);
      addToast('Library info downloaded');
    } catch (err) {
      console.error('Backup failed', err);
      addToast('Failed to create backup', 'error');
    }
  };

  const handleImport = async (file: File) => {
    const run = (password?: string) =>
      importLibraryFile(file, password, (done, total) => setStorageBusy({ label: 'Importing...', progress: done / total }));
    const finish = () => {
      addToast('Library imported! Reloading...');
      setTimeout(() => window.location.reload(), 1200);
    };

    setStorageBusy({ label: 'Importing...' });
    suspendSaveRef.current = true;
    try {
      await run();
      finish();
    } catch (err: any) {
      if (err?.message !== 'PASSWORD_REQUIRED') {
        suspendSaveRef.current = false;
        console.error('Import failed', err);
        addToast(err?.message?.includes('Penko Tune') ? err.message : 'Failed to import library', 'error');
        return;
      }
      const password = prompt('This backup is encrypted. Enter password:');
      if (!password) {
        suspendSaveRef.current = false;
        return;
      }
      try {
        await run(password);
        finish();
      } catch (err2: any) {
        suspendSaveRef.current = false;
        addToast(err2?.message === 'INVALID_PASSWORD' ? 'Incorrect password' : 'Failed to import library', 'error');
      }
    } finally {
      setStorageBusy(null);
    }
  };

  const handleDownloadTrack = async (track: Track) => {
    if (!(await downloadTrackFile(track))) {
      addToast(track.fileHandle ? 'Reconnect the linked folder to download this file' : 'This track has no file to download', 'error');
    }
  };

  // --- Sharing ---
  const shareablePlaylist = (id: string) => {
    const playlist = playlists.find(p => p.id === id);
    if (!playlist) return;
    const shareTracks = playlist.trackIds
      .map(trackId => tracksById.get(trackId))
      .filter((t): t is Track => !!t && t.type === 'local');
    if (shareTracks.length === 0) {
      addToast('This playlist has no local files to share', 'error');
      return;
    }
    setShareTarget({ title: playlist.name, tracks: shareTracks });
  };

  const copyShareLink = (share: { id: string; key: string }) => {
    navigator.clipboard.writeText(buildShareLink(share))
      .then(() => addToast('Link copied'))
      .catch(() => addToast('Could not access the clipboard', 'error'));
  };

  const closeIncomingShare = (id: string) => {
    sharing.closeIncoming(id);
    setSelectedPlaylist(prev => (prev === `share:${id}` ? null : prev));
  };

  // Open share and listen-together links (#share=... / #listen=...), then drop the key from the URL
  const openIncomingRef = useRef(sharing.openIncoming);
  openIncomingRef.current = sharing.openIncoming;
  useEffect(() => {
    if (!libraryLoaded) return;
    const handleHash = () => {
      const share = parseShareHash(location.hash);
      const room = share ? null : parseRoomHash(location.hash);
      if (!share && !room) return;
      history.replaceState(null, '', location.pathname + location.search);
      if (share) {
        openIncomingRef.current(share.infoHash, share.key);
        setSelectedPlaylist(`share:${share.infoHash}`);
        setViewMode(ViewMode.LIST);
      } else if (room) {
        setRoomInvite(room);
        setShowListen(true);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [libraryLoaded, setSelectedPlaylist]);

  // --- Chapter markers ---
  const handleAddMarker = (timestamp: number) => {
    if (currentTrack) addMarker(currentTrack.id, timestamp);
  };

  const jumpToNextMarker = () => {
    const next = currentTrackMarkers.find(m => m.timestamp > playerState.currentTime);
    if (next) seek(next.timestamp);
  };

  const jumpToPrevMarker = () => {
    // Allow a 1s grace so repeated presses step back past the marker we just jumped to
    const prev = [...currentTrackMarkers].reverse().find(m => m.timestamp < playerState.currentTime - 1);
    if (prev) seek(prev.timestamp);
  };

  // --- Gestures (visualizer view) ---
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<number | null>(null);

  const showGestureFeedback = (text: string) => {
    setActiveGesture(text);
    setTimeout(() => setActiveGesture(null), 800);
  };

  const handleSpeedUpStart = () => {
    if (audioRef.current.playbackRate !== 2) setPlaybackRate(2);
  };

  const handleSpeedUpEnd = () => {
    if (audioRef.current.playbackRate !== 1) setPlaybackRate(1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
    holdTimeoutRef.current = window.setTimeout(() => {
      handleSpeedUpStart();
      holdTimeoutRef.current = null;
    }, 250);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    handleSpeedUpEnd();

    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const endX = e.changedTouches[0].clientX;
    const dx = endX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    const dt = Date.now() - start.time;
    const dist = Math.hypot(dx, dy);

    // Horizontal swipe: change track
    if (dist > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 500) {
      if (dx > 0) {
        playPrev();
        showGestureFeedback('Prev Track');
      } else {
        playNext();
        showGestureFeedback('Next Track');
      }
      lastTapRef.current = null;
      return;
    }

    // Double tap: left/right third skips, centre toggles playback
    if (dist < 10 && dt < 250) {
      const now = Date.now();
      if (lastTapRef.current && now - lastTapRef.current < 300) {
        const width = window.innerWidth;
        if (endX < width * 0.3) {
          skip(-SKIP_SECONDS);
          showGestureFeedback(`-${SKIP_SECONDS}s`);
        } else if (endX > width * 0.7) {
          skip(SKIP_SECONDS);
          showGestureFeedback(`+${SKIP_SECONDS}s`);
        } else {
          togglePlayPause();
          showGestureFeedback(playerState.isPlaying ? 'Pause' : 'Play');
        }
        lastTapRef.current = null;
      } else {
        lastTapRef.current = now;
      }
    }
  };

  const isVisualizer = viewMode === ViewMode.VISUALIZER;
  const activeIncoming = selectedPlaylist?.startsWith('share:')
    ? sharing.incoming.find(s => `share:${s.id}` === selectedPlaylist) ?? null
    : null;
  const CurrentVisIcon = VISUALIZER_OPTIONS.find(o => o.mode === visualizerMode)?.icon ?? BarChart2;

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-white font-sans select-none overflow-hidden">
      {/* Toasts */}
      <div data-toasts className="fixed bottom-44 md:bottom-28 right-4 md:right-6 left-4 md:left-auto z-[110] flex flex-col items-end gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`bg-zinc-900 border ${toast.type === 'error' ? 'border-red-500/50 text-red-100' : 'border-zinc-700 text-zinc-100'} px-4 py-3 rounded-lg shadow-xl animate-in slide-in-from-bottom-4 fade-in duration-300 flex items-center gap-2 max-w-sm`}>
            <AlertCircle size={16} className={toast.type === 'error' ? 'text-red-500' : 'text-cyan-500'} />
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Top Bar */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950 shrink-0 relative z-20">
        <div className="flex items-center gap-2">
          <PenkoTuneLogo size={40} animated />
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent hidden sm:block">Penko Tune</h1>
        </div>

        <button className="md:hidden p-2 text-zinc-400 hover:text-white" onClick={() => setMobileMenuOpen(true)}>
          <Menu size={24} />
        </button>

        {/* Desktop Controls */}
        <div className="hidden md:flex items-center gap-4">
          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-cyan-500/20"
              title={t.installPWA}
            >
              <Download size={16} />
              <span className="hidden sm:inline">{t.installPWA}</span>
            </button>
          )}

          {/* Tools */}
          <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
            <button
              onClick={toggleKaraokeMode}
              className={`p-2 rounded-md transition-all ${playerState.karaokeMode ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              title={t.vocalReduction}
            >
              <Mic size={18} />
            </button>
            <button
              onClick={() => setShowEQ(!showEQ)}
              className={`p-2 rounded-md transition-all ${showEQ ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              title={t.equalizer}
            >
              <Sliders size={18} />
            </button>
            <button
              onClick={() => setShowSleepTimer(!showSleepTimer)}
              className={`p-2 rounded-md transition-all relative ${isSleepTimerActive || showSleepTimer ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              title={t.sleepTimer}
            >
              <Timer size={18} />
              {isSleepTimerActive && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setShowListen(true)}
              className={`p-2 rounded-md transition-all relative ${listen.room.role !== 'idle' ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              title={t.listenTogether}
            >
              <Users size={18} />
              {listen.room.role !== 'idle' && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setShowNetworkStream(!showNetworkStream)}
              className={`p-2 rounded-md transition-all ${showNetworkStream ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              title={t.networkStream}
            >
              <Globe size={18} />
            </button>
            <a
              href={`https://github.com/NA-Ag/penko-tune#readme${currentLanguage !== 'en' ? `-${currentLanguage}` : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-md transition-all text-zinc-500 hover:text-zinc-300"
              title={t.userManual}
            >
              <BookOpen size={18} />
            </a>

            {/* Language Switcher */}
            <div className="relative language-menu-container">
              <button
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                className={`p-2 rounded-md transition-all flex items-center gap-1 ${showLanguageMenu ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                title={t.changeLanguage}
              >
                <Languages size={18} />
                <span className="text-xs font-mono uppercase">{currentLanguage}</span>
              </button>
              {showLanguageMenu && (
                <div className="absolute top-full right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl p-2 z-50 min-w-[160px]">
                  {(Object.keys(languageNames) as Language[]).map(code => (
                    <button
                      key={code}
                      onClick={() => {
                        setCurrentLanguage(code);
                        setShowLanguageMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md transition-all flex items-center justify-between ${
                        currentLanguage === code ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      <span>{languageNames[code]}</span>
                      {currentLanguage === code && <Check size={16} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* View Toggles */}
          <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800 ml-2 relative">
            <button
              onClick={() => setViewMode(ViewMode.LIST)}
              className={`p-2 rounded-md transition-all ${viewMode === ViewMode.LIST ? 'bg-zinc-800 text-cyan-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              title={t.listView}
            >
              <List size={18} />
            </button>

            <div className="flex items-center border-l border-zinc-800 ml-1 pl-1 gap-1 relative" id="vis-menu-container">
              <button
                onClick={() => {
                  setViewMode(ViewMode.VISUALIZER);
                  setShowVisMenu(!showVisMenu);
                }}
                className={`p-2 rounded-md transition-all flex gap-1 items-center ${isVisualizer ? 'bg-zinc-800 text-cyan-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                title={t.visualizerMode}
              >
                <CurrentVisIcon size={18} />
                <ChevronDown size={14} className={`ml-1 transition-transform ${showVisMenu ? 'rotate-180' : ''}`} />
              </button>

              {showVisMenu && (
                <div className="absolute top-full right-0 mt-2 w-44 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col p-1 animate-in fade-in slide-in-from-top-2 duration-200">
                  {VISUALIZER_OPTIONS.map(({ mode, icon: Icon, labelKey }) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setVisualizerMode(mode);
                        setViewMode(ViewMode.VISUALIZER);
                        setShowVisMenu(false);
                      }}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${visualizerMode === mode ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                    >
                      <span className="flex items-center gap-2"><Icon size={16} /> {t[labelKey]}</span>
                      {visualizerMode === mode && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        t={t}
        expandedSection={expandedSection}
        setExpandedSection={setExpandedSection}
        onFileUpload={handleFileUpload}
        onToggleKaraoke={toggleKaraokeMode}
        playerState={playerState}
        onShowEQ={() => setShowEQ(true)}
        onShowSleepTimer={() => setShowSleepTimer(true)}
        onShowNetworkStream={() => setShowNetworkStream(true)}
        onShowStorage={() => setShowStorage(true)}
        onShowListen={() => setShowListen(true)}
        viewMode={viewMode}
        setViewMode={setViewMode}
        visualizerMode={visualizerMode}
        setVisualizerMode={setVisualizerMode}
        currentLanguage={currentLanguage}
        setCurrentLanguage={setCurrentLanguage}
      />

      {/* Main Content Area */}
      <main
        className="flex-1 flex overflow-hidden relative"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <Sidebar
          t={t}
          tracksCount={libraryTracks.length}
          playlists={playlists}
          selectedPlaylist={selectedPlaylist}
          showCreatePlaylist={showCreatePlaylist}
          newPlaylistName={newPlaylistName}
          currentTrack={currentTrack}
          currentTrackMarkers={currentTrackMarkers}
          upNext={upNextTracks}
          onRemoveFromQueue={(index) => setUpNext(prev => prev.filter((_, i) => i !== index))}
          onClearQueue={() => setUpNext([])}
          editingMarkerId={editingMarkerId}
          editingMarkerLabel={editingMarkerLabel}
          onSetSelectedPlaylist={setSelectedPlaylist}
          onSetViewMode={setViewMode}
          onFileUpload={handleFileUpload}
          onSetShowCreatePlaylist={setShowCreatePlaylist}
          onSetNewPlaylistName={setNewPlaylistName}
          onCreatePlaylist={createPlaylist}
          onUpdatePlaylistCover={updatePlaylistCover}
          onDeletePlaylist={deletePlaylist}
          onUpdateMarkerLabel={updateMarkerLabel}
          onSetEditingMarkerId={setEditingMarkerId}
          onSetEditingMarkerLabel={setEditingMarkerLabel}
          onJumpToMarker={seek}
          onDeleteMarker={deleteMarker}
          canLinkFolders={canLinkFolders()}
          onLinkFolder={linkFolder}
          onSharePlaylist={shareablePlaylist}
          incoming={sharing.incoming}
          incomingTitles={Object.fromEntries(
            sharing.incoming.flatMap(s => (s.status === 'ready' ? [[s.id, s.share.title]] : []))
          )}
          onCloseIncoming={closeIncomingShare}
          outgoing={sharing.outgoing}
          peerCounts={sharing.peerCounts}
          onCopyShareLink={copyShareLink}
          onStopShare={sharing.stopShare}
          storage={storage.status}
          storageNeedsAttention={!!storage.warning || disconnectedIds.length > 0}
          onOpenStorage={() => setShowStorage(true)}
        />

        {/* Center View - Gesture Area (gestures only active in visualizer view) */}
        <div
          className="flex-1 flex flex-col bg-zinc-950 relative overflow-hidden"
          onMouseDown={isVisualizer ? handleSpeedUpStart : undefined}
          onMouseUp={isVisualizer ? handleSpeedUpEnd : undefined}
          onMouseLeave={isVisualizer ? handleSpeedUpEnd : undefined}
          onTouchStart={isVisualizer ? handleTouchStart : undefined}
          onTouchEnd={isVisualizer ? handleTouchEnd : undefined}
        >
          {activeGesture && (
            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none animate-out fade-out duration-700">
              <div className="bg-black/70 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 flex flex-col items-center">
                <span className="text-2xl font-bold text-white">{activeGesture}</span>
              </div>
            </div>
          )}

          {playerState.playbackRate > 1 && (
            <div className="absolute top-4 right-4 z-40 pointer-events-none">
              <div className="bg-cyan-500/20 backdrop-blur-md text-cyan-400 px-4 py-2 rounded-full flex items-center gap-2 animate-pulse border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
                <FastForward size={18} className="fill-current" />
                <span className="font-bold text-sm">2x Speed</span>
              </div>
            </div>
          )}

          {isResolvingP2P && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
              <div className="bg-zinc-900/80 backdrop-blur-md text-white px-6 py-3 rounded-full flex items-center gap-3 border border-zinc-700 shadow-xl animate-in slide-in-from-top-5">
                <Loader2 size={18} className="animate-spin text-cyan-400" />
                <span className="text-sm font-medium">Resolving P2P Stream...</span>
              </div>
            </div>
          )}

          {currentTrack?.coverArtUrl && isVisualizer && (
            <div
              className="absolute inset-0 opacity-20 pointer-events-none z-0 bg-cover bg-center blur-3xl scale-110 transition-all duration-1000"
              style={{ backgroundImage: `url(${currentTrack.coverArtUrl})` }}
            />
          )}

          {!isVisualizer && (activeIncoming ? (
            <IncomingShareHeader
              t={t}
              share={activeIncoming}
              onSaveAll={() => sharing.saveIncoming(activeIncoming.id)}
              onClose={() => closeIncomingShare(activeIncoming.id)}
            />
          ) : (
            <StorageBanner
              t={t}
              warning={storage.warning}
              disconnectedFolders={disconnectedIds.length}
              copiedBytes={storage.copiedBytes}
              canLinkFolders={canLinkFolders()}
              onReconnect={reconnectFolders}
              onOpenStorage={() => setShowStorage(true)}
              onDismiss={storage.dismissWarning}
            />
          ))}

          {!isVisualizer ? (
            <TrackList
              t={t}
              tracks={queue}
              totalCount={baseList.length}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              sortKey={sortKey}
              onSortChange={setSortKey}
              onPlayNext={queuePlayNext}
              onAddToQueue={queueAppend}
              onDownload={handleDownloadTrack}
              onShare={(track) => setShareTarget({ title: track.name, tracks: [track] })}
              onSaveShared={(track) => track.incomingShareId && sharing.saveIncoming(track.incomingShareId, [Number(track.id.split('-').pop())])}
              savingProgress={sharing.saving}
              emptyMessage={activeIncoming && activeIncoming.status !== 'ready'
                ? <IncomingShareStatus t={t} share={activeIncoming} timeoutSeconds={sharing.connectTimeoutSeconds} />
                : undefined}
              currentTrackId={currentTrack?.id}
              isPlaying={playerState.isPlaying}
              onSelectTrack={(track) => playTrack(track)}
              onRemoveTrack={removeTrack}
              playlists={playlists}
              onAddToPlaylist={addTrackToPlaylist}
              selectedPlaylist={selectedPlaylist}
              onRemoveFromPlaylist={removeTrackFromPlaylist}
              onUpdateCover={updateTrackCover}
              onRemoveCover={removeTrackCover}
            />
          ) : (
            <div className="flex-1 p-6 flex flex-col items-center justify-center z-10">
              {currentTrack ? (
                <div className="w-full h-full max-w-4xl flex flex-col gap-6">
                  <div className="flex flex-col items-center gap-4 text-center select-none">
                    {currentTrack.coverArtUrl && (
                      <div className="w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden shadow-2xl border-4 border-zinc-900/50 animate-in zoom-in duration-500">
                        <img src={currentTrack.coverArtUrl} alt="Cover" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 drop-shadow-md px-4">{currentTrack.name}</h2>
                      <p className="text-zinc-400 text-lg">{currentTrack.artist}</p>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 pointer-events-none w-full">
                    <Visualizer analyser={analyser} isPlaying={playerState.isPlaying} mode={visualizerMode} />
                  </div>
                  <p className="text-center text-zinc-600 text-xs mt-2">{t.visualizerHint}</p>
                </div>
              ) : (
                <div className="text-zinc-500 flex flex-col items-center gap-2">
                  <BarChart2 size={48} className="opacity-20" />
                  <p>{t.playToStart}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modals (outside the gesture area so taps on them don't trigger gestures) */}
        {showEQ && (
          <Equalizer
            bands={eqBands}
            onBandChange={handleEQChange}
            onReset={resetEQ}
            onClose={() => setShowEQ(false)}
            onLoadPreset={setEqBands}
          />
        )}

        {showNetworkStream && (
          <NetworkStreamModal
            onClose={() => setShowNetworkStream(false)}
            setTracks={setTracks}
            playTrack={playTrack}
            addToast={addToast}
            t={t}
          />
        )}

        {showSleepTimer && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Timer size={20} className="text-cyan-500" />
                  {t.sleepTimer}
                </h3>
                <button onClick={() => setShowSleepTimer(false)} className="p-1 text-zinc-400 hover:text-white" title={t.close}>
                  <X size={18} />
                </button>
              </div>

              {isSleepTimerActive ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-zinc-400 mb-2">{t.timerActive}</p>
                    <p className="text-4xl font-bold text-cyan-400 font-mono">{formatTime(Math.ceil(sleepTimerRemainingMs / 1000))}</p>
                    <p className="text-xs text-zinc-600 mt-2">{t.timerEndsPause}</p>
                  </div>
                  <button
                    onClick={cancelSleepTimer}
                    className="w-full px-4 py-3 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <X size={16} />
                    {t.cancelTimer}
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-zinc-500 mb-4">{t.sleepTimerDesc}</p>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {SLEEP_TIMER_OPTIONS.map(minutes => (
                      <button
                        key={minutes}
                        onClick={() => startSleepTimer(minutes)}
                        className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors text-sm"
                      >
                        {minutes} min
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setShowSleepTimer(false)} className="w-full px-4 py-2 text-sm text-zinc-400 hover:text-white">
                    {t.close}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      <PlayerControls
        playerState={playerState}
        onPlayPause={togglePlayPause}
        onNext={playNext}
        onPrev={playPrev}
        onSeek={seek}
        onVolumeChange={setVolume}
        onToggleMute={toggleMute}
        onToggleShuffle={toggleShuffle}
        onToggleRepeat={cycleRepeat}
        onSkipForward={() => skip(SKIP_SECONDS)}
        onSkipBackward={() => skip(-SKIP_SECONDS)}
        markers={currentTrackMarkers}
        onJumpToMarker={seek}
        onAddMarker={handleAddMarker}
        onNextMarker={jumpToNextMarker}
        onPrevMarker={jumpToPrevMarker}
        currentTrack={currentTrack}
        nothingPlayingLabel={t.nothingPlaying}
      />
      {showStorage && (
        <StorageDialog
          t={t}
          status={storage.status}
          copiedBytes={storage.copiedBytes}
          trackCount={libraryTracks.length}
          folders={folders}
          disconnectedIds={disconnectedIds}
          scanningIds={scanningIds}
          canInstall={!!deferredPrompt}
          busy={storageBusy}
          onProtect={async () => {
            const granted = await storage.protect();
            addToast(granted ? 'Library protected' : 'The browser declined. Installing the app usually helps.', granted ? 'info' : 'error');
          }}
          onInstall={handleInstallClick}
          onExportZip={handleExportZip}
          onExportJson={handleExportJson}
          onImport={handleImport}
          onLinkFolder={linkFolder}
          onReconnect={reconnectFolders}
          onRescan={rescanFolder}
          onUnlink={unlinkFolder}
          onClose={() => setShowStorage(false)}
        />
      )}

      {shareTarget && (
        <ShareDialog
          t={t}
          title={shareTarget.title}
          trackCount={shareTarget.tracks.length}
          onCreate={(mode) => sharing.createShare(shareTarget.tracks, shareTarget.title, mode)}
          onClose={() => setShareTarget(null)}
        />
      )}

      {showListen && (
        <ListenTogetherDialog
          t={t}
          room={listen.room}
          pendingInvite={!!roomInvite}
          guestVolume={listen.guestVolume}
          onHost={() => listen.host().catch(err => {
            console.error('[Listen] Could not start session', err);
            addToast('Could not start a session', 'error');
          })}
          onJoin={() => {
            if (roomInvite) listen.join(roomInvite.roomId, roomInvite.password);
            setRoomInvite(null);
          }}
          onLeave={listen.leave}
          onGuestVolume={listen.changeGuestVolume}
          onClose={() => setShowListen(false)}
        />
      )}
    </div>
  );
}

export default App;
