import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FastForward, Loader2 } from 'lucide-react';
import { Track, ViewMode, VisualizerMode, ChapterMarker } from './types';
import { translations, Language } from './translations';
import PlayerControls from './components/PlayerControls';
import TrackList from './components/TrackList';
import Equalizer from './components/Equalizer';
import { Sidebar } from './components/Sidebar';
import { MobileMenu } from './components/MobileMenu';
import { NetworkStreamModal } from './components/NetworkStreamModal';
import { AppHeader } from './components/AppHeader';
import { NowPlayingView } from './components/NowPlayingView';
import { SleepTimerDialog } from './components/SleepTimerDialog';
import { saveTracksToIndexedDB, loadTracksFromIndexedDB } from './utils/persistence';
import { canLinkFolders } from './utils/storage';
import { parseShareHash, buildShareLink } from './utils/sharing';
import { tr, format, setI18nLanguage } from './utils/i18n';
import { AUDIO_FILE_PATTERN, generateId, readFileAsDataURL } from './utils/audio';
import { filterAndSortTracks, groupAlbums, groupArtists } from './utils/library';
import { AlbumGrid, ArtistList, GroupHeader } from './components/BrowseViews';
import { loadPreferences, SortKey } from './utils/preferences';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useToasts } from './hooks/useToasts';
import { usePwaInstall } from './hooks/usePwaInstall';
import { useShortcuts, noopActions, PlayerActions } from './hooks/useShortcuts';
import { useSessionMemory } from './hooks/useSessionMemory';
import { useTagScanner } from './hooks/useTagScanner';
import { Toasts } from './components/Toasts';
import { useBackup } from './hooks/useBackup';
import { useGestures } from './hooks/useGestures';
import { useTorrentStream, needsP2PResolution } from './hooks/useTorrentStream';
import { useSleepTimer } from './hooks/useSleepTimer';
import { useChapterMarkers } from './hooks/useChapterMarkers';
import { usePlaylists } from './hooks/usePlaylists';
import { useLinkedFolders } from './hooks/useLinkedFolders';
import { useSharing } from './hooks/useSharing';
import { useStorageStatus } from './hooks/useStorageStatus';
import { useListenTogether, parseRoomHash } from './hooks/useListenTogether';
import { StorageDialog } from './components/StorageDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { EditTrackDialog, TrackEdits } from './components/EditTrackDialog';
import { baseName } from './utils/lyrics';
import { StorageBanner } from './components/StorageBanner';
import { ShareDialog } from './components/ShareDialog';
import { ListenTogetherDialog } from './components/ListenTogetherDialog';
import { IncomingShareHeader, IncomingShareStatus } from './components/IncomingShareHeader';

const SKIP_SECONDS = 10;

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
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('navigation');
  const [currentLanguage, setCurrentLanguage] = useState<Language>(() => loadPreferences().language);

  const t = translations[currentLanguage];
  setI18nLanguage(currentLanguage); // tr() in hooks and toasts follows the UI language

  const { toasts, addToast } = useToasts();
  const { canInstall, install: handleInstallClick } = usePwaInstall(addToast);

  // Latest versions of actions used by long-lived listeners (keyboard, media session, audio 'ended').
  // Assigned every render below so those listeners never see stale state.
  const actionsRef = useRef<PlayerActions>(noopActions);

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
    speed,
    setSpeed,
    loop,
    cycleLoop,
    setLoop,
    preloadNext,
    audioSettings,
    updateAudioSettings,
    handleEQChange,
    resetEQ,
    getOutputStream,
  } = useAudioPlayer({
    onTrackEnd: () => actionsRef.current.playNext(),
    // The engine moved on to the preloaded track by itself (gapless/crossfade)
    onAdvance: (track) => {
      setCurrentTrack(track);
      setUpNext(prev => (prev[0] === track.id ? prev.slice(1) : prev));
    },
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
  const [shareTarget, setShareTarget] = useState<{ title: string; tracks: Track[] } | null>(null);
  const [showListen, setShowListen] = useState(false);
  const [showLyrics, setShowLyrics] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [editTarget, setEditTarget] = useState<Track | null>(null);
  const [roomInvite, setRoomInvite] = useState<{ roomId: string; password: string } | null>(null);

  // --- Library load & persistence ---
  // Imports write straight to the database and then reload; saving the in-memory library
  // meanwhile would overwrite what was imported.
  const suspendSaveRef = useRef(false);
  const lastSavedTracksRef = useRef<Track[] | null>(null);
  const unloadingRef = useRef(false); // set on pagehide; writes aborted by unload aren't errors

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
        addToast(tr('toastLoadFailed'), 'error');
      });
    return () => { cancelled = true; };
  }, [addToast, loadTrack]);

  useEffect(() => {
    if (!libraryLoaded || suspendSaveRef.current || tracks === lastSavedTracksRef.current) return;
    const save = () => {
      if (suspendSaveRef.current || tracks === lastSavedTracksRef.current) return;
      lastSavedTracksRef.current = tracks;
      saveTracksToIndexedDB(tracks).catch(err => {
        // Closing or reloading the tab aborts in-flight writes. An abort carries no error
        // (null), while real failures like a full disk do, so only those are reported.
        if (!err || unloadingRef.current || document.visibilityState === 'hidden') return;
        console.error('[App] Failed to save library:', err);
        addToast(tr('toastSaveFailed'), 'error');
      });
    };
    const timeout = setTimeout(save, 300);
    // Don't wait out the debounce if the tab is being hidden or closed
    const onHidden = () => document.visibilityState === 'hidden' && save();
    const onPageHide = () => {
      unloadingRef.current = true;
      save();
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onPageHide);
    };
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
  // Views: null = library, a playlist id, 'albums' / 'artists' (grids), 'album:<key>' / 'artist:<key>', 'share:<id>'
  const albums = useMemo(() => groupAlbums(libraryTracks), [libraryTracks]);
  const artists = useMemo(() => groupArtists(libraryTracks), [libraryTracks]);
  const openAlbum = selectedPlaylist?.startsWith('album:') ? albums.find(a => `album:${a.key}` === selectedPlaylist) : undefined;
  const openArtist = selectedPlaylist?.startsWith('artist:') ? artists.find(a => `artist:${a.key}` === selectedPlaylist) : undefined;
  const activePlaylist = selectedPlaylist ? playlists.find(p => p.id === selectedPlaylist) : undefined;
  const browsingGrid = selectedPlaylist === 'albums' || selectedPlaylist === 'artists';

  const baseList = useMemo((): Track[] => {
    if (openAlbum) return openAlbum.tracks;
    if (openArtist) return openArtist.tracks;
    if (browsingGrid) return [];
    if (selectedPlaylist?.startsWith('share:')) {
      const shareId = selectedPlaylist.slice('share:'.length);
      return tracks.filter(t => t.incomingShareId === shareId);
    }
    const playlist = selectedPlaylist ? playlists.find(p => p.id === selectedPlaylist) : null;
    if (!playlist) return libraryTracks;
    return playlist.trackIds.map(id => tracksById.get(id)).filter((t): t is Track => !!t);
  }, [tracks, libraryTracks, tracksById, playlists, selectedPlaylist, openAlbum, openArtist, browsingGrid]);

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
      addToast(tr('toastDownloadingFromFriend'));
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

  // The shuffle pick is remembered per current track, so the track we preload is the one that plays
  const shufflePickRef = useRef<{ after: string | null; id: string } | null>(null);

  /** What plays after the current track, without side effects on the queue. */
  const peekNextTrack = (): Track | null => {
    // Manually queued tracks ("Play next" / "Add to queue") take priority over the list order
    if (upNextTracks[0]) return upNextTracks[0];
    if (queue.length === 0) return null;
    const index = currentTrack ? queue.findIndex(t => t.id === currentTrack.id) : -1;

    if (playerState.isShuffle && queue.length > 1) {
      const after = currentTrack?.id ?? null;
      const planned = shufflePickRef.current;
      const plannedTrack = planned?.after === after ? queue.find(t => t.id === planned.id) : undefined;
      if (plannedTrack) return plannedTrack;
      const candidates = queue.filter((_, i) => i !== index);
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      shufflePickRef.current = { after, id: pick.id };
      return pick;
    }

    if (index === -1) return queue[0];
    if (index + 1 < queue.length) return queue[index + 1];
    return playerState.repeatMode === 'all' ? queue[0] : null;
  };

  const playNext = () => {
    const next = peekNextTrack();
    if (!next) {
      addToast(tr('toastEndOfPlaylist'));
      return;
    }
    setUpNext(prev => (prev[0] === next.id ? prev.slice(1) : prev));
    playTrack(next, true);
  };

  // Preload the upcoming track for gapless playback / crossfades (only directly playable ones)
  const upcoming = currentTrack ? peekNextTrack() : null;
  const preloadable = upcoming && upcoming.url && !needsP2PResolution(upcoming) ? upcoming : null;
  useEffect(() => {
    preloadNext(preloadable);
  }, [preloadable?.id, preloadable?.url, preloadNext]);

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

  const handleCycleLoop = () => {
    if (!currentTrack) return;
    cycleLoop();
    addToast(tr(!loop ? 'toastLoopA' : loop.b === null ? 'toastLoopOn' : 'toastLoopOff'));
  };

  /** Loop from a chapter marker to the next one (or the end of the track). */
  const loopFromMarker = (timestamp: number) => {
    const next = currentTrackMarkers.find(m => m.timestamp > timestamp + 0.1);
    setLoop({ a: timestamp, b: next ? next.timestamp : playerState.duration || timestamp + 1 });
    addToast(tr('toastLoopOn'));
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
        addToast(tr(playerState.isShuffle ? 'toastShuffleOff' : 'toastShuffleOn'));
      },
      cycleRepeat: () => {
        cycleRepeat();
        const next = playerState.repeatMode === 'off' ? 'all' : playerState.repeatMode === 'all' ? 'one' : 'off';
        addToast(tr(next === 'all' ? 'toastRepeatAll' : next === 'one' ? 'toastRepeatOne' : 'toastRepeatOff'));
      },
      stepSpeed: (direction) => {
        const steps = [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2];
        const index = steps.findIndex(v => v >= speed - 0.001);
        const next = steps[Math.max(0, Math.min(steps.length - 1, (index === -1 ? 3 : index) + direction))];
        setSpeed(next);
        addToast(tr('toastSpeed', { speed: next }));
      },
      cycleLoop: handleCycleLoop,
      focusSearch: () => {
        setViewMode(ViewMode.LIST);
        // Wait for the list view to render if we were in the visualizer
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>('input[type=search]')?.focus());
      },
    };
  });

  useShortcuts(actionsRef, SKIP_SECONDS);
  useSessionMemory({
    prefs: { language: currentLanguage, viewMode, visualizerMode, sortKey },
    currentTrack,
    isPlaying: playerState.isPlaying,
    isInLibrary: useCallback((id: string) => tracksById.has(id), [tracksById]),
    libraryLoaded,
    audioRef,
    unknownArtist: t.unknownArtist,
  });
  useTagScanner({ tracks, setTracks, setCurrentTrack, libraryLoaded, addToast });

  // --- Library actions ---
  const setTrackCover = (trackId: string, coverArtUrl: string | undefined) => {
    setTracks(prev => prev.map(t => (t.id === trackId ? { ...t, coverArtUrl } : t)));
    setCurrentTrack(prev => (prev?.id === trackId ? { ...prev, coverArtUrl } : prev));
  };

  const addFiles = async (files: File[]) => {
    const imageFile = files.find(f => f.type.startsWith('image/'));
    const audioFiles = files.filter(f => f.type.startsWith('audio/') || AUDIO_FILE_PATTERN.test(f.name));

    // Sidecar lyrics: song.lrc next to song.mp3
    const lyricsByName = new Map<string, string>();
    for (const file of files.filter(f => /\.lrc$/i.test(f.name))) {
      lyricsByName.set(baseName(file.name), await file.text());
    }
    if (lyricsByName.size && audioFiles.length === 0) {
      // Lyrics dropped on their own: attach to library tracks with the same file name
      const matches = tracks.filter(t => t.file && lyricsByName.has(baseName(t.file.name)));
      if (matches.length) {
        const ids = new Set(matches.map(m => m.id));
        const withLyrics = (t: Track) => (ids.has(t.id) ? { ...t, lyrics: lyricsByName.get(baseName(t.file!.name)) } : t);
        setTracks(prev => prev.map(withLyrics));
        setCurrentTrack(prev => (prev ? withLyrics(prev) : prev));
        addToast(tr('toastLyricsAttached', { count: matches.length }));
      } else {
        addToast(tr('toastLyricsNoMatch'), 'error');
      }
      return;
    }

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
        url: URL.createObjectURL(file),
        type: 'local',
        // A cover image dropped alongside audio (e.g. folder.jpg) belongs to those tracks
        coverArtUrl,
        addedAt: Date.now(),
        tagsRead: false, // filled in by the background tag scan
        lyrics: lyricsByName.get(baseName(file.name)),
      }));

      if (newTracks.length > 0) {
        setTracks(prev => [...prev, ...newTracks]);
        addToast(tr('toastTracksAdded', { count: newTracks.length }));
        // Copied music should be protected from eviction; ask while we have the user gesture
        if (storage.status && !storage.status.persisted) storage.protect();
      } else {
        addToast(tr('toastAllDuplicates'));
      }
    } else if (coverArtUrl) {
      if (currentTrack) {
        setTrackCover(currentTrack.id, coverArtUrl);
        addToast(tr('toastCoverUpdatedCurrent'));
      } else {
        addToast(tr('toastPlayFirstForCover'));
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
      addToast(tr('toastCoverUpdated'));
    } catch {
      addToast(tr('toastImageFailed'), 'error');
    }
  };

  const removeTrackCover = (trackId: string) => {
    setTrackCover(trackId, undefined);
    addToast(tr('toastCoverRemoved'));
  };

  // --- Up Next queue ---
  const queuePlayNext = (track: Track) => {
    setUpNext(prev => [track.id, ...prev]);
    addToast(tr('toastPlayNext', { name: track.name }));
  };

  const queueAppend = (track: Track) => {
    setUpNext(prev => [...prev, track.id]);
    addToast(tr('toastQueued', { name: track.name }));
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
    if (removed.fileHandle) addToast(tr('toastLinkedRemoved'));
  };

  const backup = useBackup({ tracks, addToast, suspendSaveRef });

  // --- Sharing ---
  const shareablePlaylist = (id: string) => {
    const playlist = playlists.find(p => p.id === id);
    if (!playlist) return;
    const shareTracks = playlist.trackIds
      .map(trackId => tracksById.get(trackId))
      .filter((t): t is Track => !!t && t.type === 'local');
    if (shareTracks.length === 0) {
      addToast(tr('toastPlaylistNotShareable'), 'error');
      return;
    }
    setShareTarget({ title: playlist.name, tracks: shareTracks });
  };

  const copyShareLink = (share: { id: string; key: string }) => {
    navigator.clipboard.writeText(buildShareLink(share))
      .then(() => addToast(tr('toastLinkCopied')))
      .catch(() => addToast(tr('toastClipboardFailed'), 'error'));
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

  const isVisualizer = viewMode === ViewMode.VISUALIZER;
  const gestures = useGestures({
    enabled: isVisualizer,
    audioRef,
    speed,
    setPlaybackRate,
    onPrev: playPrev,
    onNext: playNext,
    onSkip: skip,
    onTogglePlay: togglePlayPause,
    isPlaying: playerState.isPlaying,
    skipSeconds: SKIP_SECONDS,
    labels: { previous: t.previous, next: t.next, play: t.play, pause: t.pause },
  });
  const activeIncoming = selectedPlaylist?.startsWith('share:')
    ? sharing.incoming.find(s => `share:${s.id}` === selectedPlaylist) ?? null
    : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-white font-sans select-none overflow-hidden">
      <Toasts toasts={toasts} />

      <AppHeader
        t={t}
        canInstall={canInstall}
        onInstall={handleInstallClick}
        karaokeMode={playerState.karaokeMode}
        onToggleKaraoke={toggleKaraokeMode}
        eqOpen={showEQ}
        onToggleEQ={() => setShowEQ(!showEQ)}
        sleepTimerActive={isSleepTimerActive}
        sleepTimerOpen={showSleepTimer}
        onToggleSleepTimer={() => setShowSleepTimer(!showSleepTimer)}
        listening={listen.room.role !== 'idle'}
        onShowListen={() => setShowListen(true)}
        networkStreamOpen={showNetworkStream}
        onToggleNetworkStream={() => setShowNetworkStream(!showNetworkStream)}
        onShowSettings={() => setShowSettings(true)}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        language={currentLanguage}
        onLanguageChange={setCurrentLanguage}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        visualizerMode={visualizerMode}
        onVisualizerModeChange={setVisualizerMode}
      />

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
        onShowSettings={() => setShowSettings(true)}
        onShowView={(view) => { setSelectedPlaylist(view); setViewMode(ViewMode.LIST); }}
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
          onLoopMarker={loopFromMarker}
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
          {...gestures.handlers}
        >
          {gestures.feedback && (
            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none animate-out fade-out duration-700">
              <div className="bg-black/70 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 flex flex-col items-center">
                <span className="text-2xl font-bold text-white">{gestures.feedback}</span>
              </div>
            </div>
          )}

          {gestures.holdingFast && (
            <div className="absolute top-4 right-4 z-40 pointer-events-none">
              <div className="bg-cyan-500/20 backdrop-blur-md text-cyan-400 px-4 py-2 rounded-full flex items-center gap-2 animate-pulse border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
                <FastForward size={18} className="fill-current" />
                <span className="font-bold text-sm">{t.speed2x}</span>
              </div>
            </div>
          )}

          {isResolvingP2P && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
              <div className="bg-zinc-900/80 backdrop-blur-md text-white px-6 py-3 rounded-full flex items-center gap-3 border border-zinc-700 shadow-xl animate-in slide-in-from-top-5">
                <Loader2 size={18} className="animate-spin text-cyan-400" />
                <span className="text-sm font-medium">{t.resolvingP2P}</span>
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

          {!isVisualizer && (openAlbum || openArtist) && (
            <GroupHeader
              t={t}
              title={openAlbum ? openAlbum.name : openArtist!.name}
              subtitle={openAlbum
                ? [openAlbum.artist, openAlbum.year, format(t.tracksCount, { count: openAlbum.tracks.length })].filter(Boolean).join(' · ')
                : format(t.tracksCount, { count: openArtist!.tracks.length })}
              coverArtUrl={(openAlbum ?? openArtist)!.coverArtUrl}
              round={!openAlbum}
              backLabel={openAlbum ? t.albums : t.artists}
              onBack={() => setSelectedPlaylist(openAlbum ? 'albums' : 'artists')}
              onPlayAll={() => queue[0] && playTrack(queue[0], true)}
            />
          )}

          {!isVisualizer && browsingGrid ? (
            selectedPlaylist === 'albums'
              ? <AlbumGrid t={t} albums={albums} onOpen={key => setSelectedPlaylist(`album:${key}`)} />
              : <ArtistList t={t} artists={artists} onOpen={key => setSelectedPlaylist(`artist:${key}`)} />
          ) : !isVisualizer ? (
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
              onDownload={backup.downloadTrack}
              onShare={(track) => setShareTarget({ title: track.name, tracks: [track] })}
              onEditInfo={(track) => setEditTarget(track)}
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
              selectedPlaylist={activePlaylist ? selectedPlaylist : null}
              onRemoveFromPlaylist={removeTrackFromPlaylist}
              onUpdateCover={updateTrackCover}
              onRemoveCover={removeTrackCover}
            />
          ) : (
            <NowPlayingView
              t={t}
              track={currentTrack}
              analyser={analyser}
              isPlaying={playerState.isPlaying}
              currentTime={playerState.currentTime}
              visualizerMode={visualizerMode}
              showLyrics={showLyrics}
              onToggleLyrics={() => setShowLyrics(v => !v)}
              onSeek={seek}
            />
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
            t={t}
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
          <SleepTimerDialog
            t={t}
            active={isSleepTimerActive}
            remainingMs={sleepTimerRemainingMs}
            onStart={startSleepTimer}
            onCancel={cancelSleepTimer}
            onClose={() => setShowSleepTimer(false)}
          />
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
        t={t}
        speed={speed}
        onSpeedChange={setSpeed}
        loop={loop}
        onCycleLoop={handleCycleLoop}
        onShowLyrics={currentTrack?.lyrics ? () => { setShowLyrics(true); setViewMode(ViewMode.VISUALIZER); } : undefined}
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
          canInstall={canInstall}
          busy={backup.busy}
          onProtect={async () => {
            const granted = await storage.protect();
            addToast(tr(granted ? 'toastProtected' : 'toastProtectDeclined'), granted ? 'info' : 'error');
          }}
          onInstall={handleInstallClick}
          onExportZip={backup.exportZip}
          onExportJson={backup.exportJson}
          onImport={backup.importFile}
          onLinkFolder={linkFolder}
          onReconnect={reconnectFolders}
          onRescan={rescanFolder}
          onUnlink={unlinkFolder}
          onClose={() => setShowStorage(false)}
        />
      )}

      {showSettings && (
        <SettingsDialog t={t} audio={audioSettings} onAudioChange={updateAudioSettings} onClose={() => setShowSettings(false)} />
      )}

      {editTarget && (
        <EditTrackDialog
          t={t}
          track={editTarget}
          onSave={(edits: TrackEdits) => {
            const apply = (track: Track): Track => (track.id === editTarget.id ? { ...track, ...edits, tagsRead: true } : track);
            setTracks(prev => prev.map(apply));
            setCurrentTrack(prev => (prev ? apply(prev) : prev));
            addToast(tr('toastInfoSaved'));
          }}
          onClose={() => setEditTarget(null)}
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
            addToast(tr('toastSessionFailed'), 'error');
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
