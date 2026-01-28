import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FolderOpen, Layout, List, BarChart2, Plus, Sliders, Globe, FastForward, Activity, Waves, Image as ImageIcon, ChevronDown, Check, Loader2, AlertCircle, Disc, Music, Bookmark, Mic, Timer, X, Download, Sparkles, TrendingUp, Radio, Dna, Upload, Compass, Languages, BookOpen, Menu } from 'lucide-react';
import { Track, PlayerState, ViewMode, EQBand, VisualizerMode, Playlist, ChapterMarker, DecentralizedTrack } from './types';
import { translations, Language } from './translations';
import PlayerControls from './components/PlayerControls';
import TrackList from './components/TrackList';
import Visualizer from './components/Visualizer';
import Equalizer from './components/Equalizer';
import { ArtistPortal } from './components/ArtistPortal';
import { BrowseMusic } from './components/BrowseMusic';
import { saveTracksToIndexedDB, loadTracksFromIndexedDB, isPersistenceEnabled, setPersistenceEnabled, clearLibrary, saveEQSettings, loadEQSettings, savePlaylists, loadPlaylists, saveMarkers, loadMarkers, exportLibraryAsJSON, importLibraryFromJSON } from './utils/persistence';
import { formatTime } from './utils/formatters';
import { useAudioPlayer, EQ_FREQUENCIES } from './hooks/useAudioPlayer';
import { Sidebar } from './components/Sidebar';
import { MobileMenu } from './components/MobileMenu';
import { useDecentralizedStream } from './hooks/useDecentralizedStream';
import { NetworkStreamModal } from './components/NetworkStreamModal';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

interface Toast {
  message: string;
  type: 'error' | 'info';
  id: number;
}

function App() {
  // --- State ---
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.LIST);
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>(VisualizerMode.BARS);

  // Playlist State
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null); // null = "All Tracks"
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  // Chapter Marker State
  const [markers, setMarkers] = useState<ChapterMarker[]>([]);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [editingMarkerLabel, setEditingMarkerLabel] = useState('');

  const [showEQ, setShowEQ] = useState(false);
  const [showNetworkStream, setShowNetworkStream] = useState(false);
  const [showVisMenu, setShowVisMenu] = useState(false);
  const [showCoverBackground, setShowCoverBackground] = useState(true);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<Language>('en');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('navigation');

  // Translation helper
  const t = translations[currentLanguage];
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Helpers
  const addToast = useCallback((message: string, type: 'error' | 'info' = 'info') => {
      const id = Date.now();
      setToasts(prev => [...prev, { message, type, id }]);
      setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);
  }, []);
  
  // --- Audio Player Hook ---
  const playNextRef = useRef<() => void>(() => {});

  const {
    audioRef,
    playerState,
    setPlayerState,
    analyser,
    eqBands,
    setEqBands,
    initAudioContext,
    toggleKaraokeMode,
    playTrack: playTrackAudio,
    togglePlayPause: togglePlayPauseAudio,
    seek: handleSeek,
    setVolume: handleVolume,
    toggleMute,
    handleEQChange,
    resetEQ
  } = useAudioPlayer({
    onTrackEnd: () => playNextRef.current(),
    onError: (msg) => addToast(msg, 'error')
  });

  // Gestures State
  const touchStartRef = useRef<{x: number, y: number, time: number} | null>(null);
  const lastTapRef = useRef<{time: number, x: number} | null>(null);
  const holdTimeoutRef = useRef<number | null>(null);
  const [activeGesture, setActiveGesture] = useState<string | null>(null);

  // Sleep Timer State
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerEndTime, setSleepTimerEndTime] = useState<number | null>(null);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const sleepTimerIntervalRef = useRef<number | null>(null);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);

  // Artist Portal State
  const [showArtistPortal, setShowArtistPortal] = useState(false);

  // Browse Music State
  const [showBrowseMusic, setShowBrowseMusic] = useState(false);

  // Persistence State
  const hasLoadedLibraryRef = useRef(false);

  // --- Close language menu on click outside ---
  useEffect(() => {
    if (!showLanguageMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Close if clicking outside the language menu
      if (!target.closest('.language-menu-container')) {
        setShowLanguageMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showLanguageMenu]);

  // --- PWA Install Prompt Handler ---
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      // Show the install button
      setShowInstallButton(true);
    };

    const handleAppInstalled = () => {
      // Hide the install button after successful installation
      setShowInstallButton(false);
      setDeferredPrompt(null);
      addToast('Penko-tune installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallButton(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      addToast('App is already installed or install prompt not available', 'info');
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
  };

  // --- Media Session API for lock screen controls ---
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        togglePlayPause();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        togglePlayPause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        playPrev();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        playNext();
      });
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        skip(-10);
      });
      navigator.mediaSession.setActionHandler('seekforward', () => {
        skip(10);
      });
    }
  }, []);

  // --- Auto-load saved library on startup (ALWAYS) ---
  useEffect(() => {
    const loadSavedLibrary = async () => {
      if (hasLoadedLibraryRef.current) {
        console.log('[App] Skipping library load - already loaded');
        return;
      }
      console.log('[App] Starting library and playlist load...');
      hasLoadedLibraryRef.current = true;

      try {
        const [savedTracks, savedPlaylists, savedMarkers] = await Promise.all([
          loadTracksFromIndexedDB(),
          loadPlaylists(),
          loadMarkers()
        ]);

        if (savedTracks.length > 0) {
          console.log(`[App] Setting ${savedTracks.length} tracks to state`);
          setTracks(savedTracks);
          addToast(`Loaded ${savedTracks.length} track${savedTracks.length !== 1 ? 's' : ''} from library`);
        }
        if (savedPlaylists.length > 0) {
          console.log(`[App] Setting ${savedPlaylists.length} playlists to state`);
          setPlaylists(savedPlaylists);
        }
        if (savedMarkers.length > 0) {
          console.log(`[App] Setting ${savedMarkers.length} markers to state`);
          setMarkers(savedMarkers);
        }
      } catch (error) {
        console.error('[App] Failed to load library, playlists, or markers:', error);
        hasLoadedLibraryRef.current = false; // Reset on error
      }
    };

    loadSavedLibrary();
  }, []); // Run once on startup

  // --- Auto-save playlists when they change ---
  useEffect(() => {
    // Don't save on the initial render before playlists are loaded
    if (!hasLoadedLibraryRef.current) return;
    savePlaylists(playlists).catch(err => console.error("Failed to save playlists", err));
  }, [playlists]);

  // --- Auto-save markers when they change ---
  useEffect(() => {
    if (!hasLoadedLibraryRef.current) return;
    saveMarkers(markers).catch(err => console.error("Failed to save markers", err));
  }, [markers]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        switch(e.key) {
            case ' ':
                e.preventDefault();
                togglePlayPause();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                skip(-10);
                break;
            case 'ArrowRight':
                e.preventDefault();
                skip(10);
                break;
            case 'ArrowUp':
                e.preventDefault();
                handleVolume(Math.min(1, playerState.volume + 0.1));
                break;
            case 'ArrowDown':
                e.preventDefault();
                handleVolume(Math.max(0, playerState.volume - 0.1));
                break;
            case 'm':
                toggleMute();
                break;
            case 's':
                setPlayerState(prev => ({ ...prev, isShuffle: !prev.isShuffle }));
                addToast(`Shuffle ${!playerState.isShuffle ? 'On' : 'Off'}`);
                break;
            case 'r':
                setPlayerState(prev => {
                    const next = prev.repeatMode === 'off' ? 'all' : prev.repeatMode === 'all' ? 'one' : 'off';
                    addToast(`Repeat: ${next}`);
                    return { ...prev, repeatMode: next };
                });
                break;
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playerState, currentTrack]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (showVisMenu && !(event.target as Element).closest('#vis-menu-container')) {
            setShowVisMenu(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showVisMenu]);

  // --- Actions ---

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files) as File[];
      
      const imageFile = files.find(f => f.type.startsWith('image/'));
      const audioFiles = files.filter(f => f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|ogg|flac|m4a|aac)$/i));
      let tracksAddedCount = 0;

      if (imageFile) {
        const coverUrl = URL.createObjectURL(imageFile);
        if (currentTrack) {
          const updatedTrack = { ...currentTrack, coverArtUrl: coverUrl };
          setCurrentTrack(updatedTrack);
          setTracks(prev => prev.map(t => t.id === updatedTrack.id ? updatedTrack : t));
          addToast("Cover art updated for current track");
        } else {
             setTracks(prev => prev.map(t => t.coverArtUrl ? t : { ...t, coverArtUrl: coverUrl }));
             addToast("Cover art loaded");
        }
      }

      if (audioFiles.length > 0) {
        // Filter out duplicates based on file name, size, and last modified time
        const newTracks: Track[] = audioFiles
          .filter(file => {
            // Check if file already exists in library
            const isDuplicate = tracks.some(track =>
              track.type === 'local' &&
              track.file &&
              track.file.name === file.name &&
              track.file.size === file.size &&
              track.file.lastModified === file.lastModified
            );
            if (isDuplicate) {
              console.log(`Skipping duplicate: ${file.name}`);
            }
            return !isDuplicate;
          })
          .map(file => ({
            id: generateId(),
            file,
            name: file.name.replace(/\.[^/.]+$/, ""),
            artist: 'Local File',
            url: URL.createObjectURL(file),
            type: 'local'
          }));

        if (newTracks.length > 0) {
          setTracks(prev => {
            const updatedTracks = [...prev, ...newTracks];
            saveTracksToIndexedDB(updatedTracks).catch(err => {
              console.error("Failed to save after file upload", err);
              addToast("Error saving library", "error");
            });
            return updatedTracks;
          });
          tracksAddedCount = newTracks.length;
          addToast(`Added ${tracksAddedCount} track${tracksAddedCount !== 1 ? 's' : ''}`);
        } else if (audioFiles.length > 0) {
          addToast('All files already in library');
        }
      }
    }
  };

  const playTrack = async (track: Track) => {
    // Check if this is a decentralized track that needs resolution (Magnet/IPFS)
    // If the URL is not a blob (local) and not http (standard stream), it's likely a P2P protocol
    const isP2P = (track as DecentralizedTrack).torrentMagnetLink || 
                  (track as DecentralizedTrack).ipfsHash || 
                  track.url.startsWith('magnet:') || 
                  track.url.startsWith('ipfs://');

    // If it's P2P and NOT yet resolved to a blob/http URL, resolve it first
    if (isP2P && !track.url.startsWith('blob:') && !track.url.startsWith('http')) {
        console.log('[Play] Intercepting P2P track for resolution...');
        playDecentralized(track);
        return;
    }

    if (currentTrack?.id !== track.id) {
      console.log(`[Play] Playing ${track.type}: ${track.name}`);
      setCurrentTrack(track);
      playTrackAudio(track);
    } else {
      // If same track, just ensure it plays
      togglePlayPauseAudio();
    }
  };

  const togglePlayPause = async () => {
    if (!currentTrack && tracks.length === 0) return;
    if (!currentTrack && tracks.length > 0) {
      playTrack(tracks[0]);
      return;
    }
    togglePlayPauseAudio();
  };

  // --- Decentralized Stream Hook ---
  const { playDecentralized, isResolving: isResolvingP2P } = useDecentralizedStream({
    setTracks,
    playTrack,
    addToast
  });

  // Add track to library without playing (Steam-like "Install" later)
  const addTrackToLibrary = (track: Track) => {
    setTracks(prev => {
      // Check for duplicates
      if (prev.some(t => t.id === track.id)) return prev;
      const updated = [...prev, track];
      saveTracksToIndexedDB(updated).catch(err => console.error("Failed to save to library", err));
      return updated;
    });
    addToast("Added to library");
  };

  const getNextTrack = useCallback((): Track | null => {
    if (tracks.length === 0) return null;
    if (!currentTrack) return tracks[0];

    if (playerState.isShuffle) {
        const remaining = tracks.filter(t => t.id !== currentTrack.id);
        const randomIdx = Math.floor(Math.random() * remaining.length);
        return remaining[randomIdx];
    }

    const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
    const nextIndex = currentIndex + 1;
    if (nextIndex < tracks.length) return tracks[nextIndex];
    if (playerState.repeatMode === 'all') return tracks[0];
    return null;
  }, [tracks, currentTrack, playerState.isShuffle, playerState.repeatMode]);

  const getPrevTrack = useCallback((): Track | null => {
    if (tracks.length === 0) return null;
    if (!currentTrack) return tracks[tracks.length - 1];
    
    if (playerState.currentTime > 3) {
        handleSeek(0);
        return currentTrack;
    }
    const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) return tracks[prevIndex];
    if (playerState.repeatMode === 'all') return tracks[tracks.length - 1];
    return tracks[0];
  }, [tracks, currentTrack, playerState.currentTime, playerState.repeatMode, handleSeek]);

  const playNext = useCallback(() => {
      const next = getNextTrack();
      if (next) playTrack(next);
      else addToast("End of playlist");
      showGestureFeedback('Next Track');
  }, [getNextTrack, addToast]);

  const playPrev = useCallback(() => {
      const prev = getPrevTrack();
      if (prev) {
        if (prev.id === currentTrack?.id) { } 
        else playTrack(prev);
      }
      showGestureFeedback('Prev Track');
  }, [getPrevTrack, currentTrack]);

  // Update the ref for the hook
  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  // --- Playlist Functions ---

  const createPlaylist = (name: string) => {
    const newPlaylist: Playlist = {
      id: generateId(),
      name,
      trackIds: [],
      createdAt: Date.now()
    };
    setPlaylists(prev => [...prev, newPlaylist]);
    setShowCreatePlaylist(false);
    setNewPlaylistName('');
    addToast(`Created playlist: ${name}`);
  };

  const deletePlaylist = (playlistId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (playlist) {
      setPlaylists(prev => prev.filter(p => p.id !== playlistId));
      if (selectedPlaylist === playlistId) {
        setSelectedPlaylist(null); // Go back to All Tracks
      }
      addToast(`Deleted playlist: ${playlist.name}`);
    }
  };

  const updatePlaylistCover = (playlistId: string, imageFile: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const coverArtUrl = e.target?.result as string;
      setPlaylists(prev => prev.map(p =>
        p.id === playlistId ? { ...p, coverArtUrl } : p
      ));
      addToast('Playlist cover updated');
    };
    reader.readAsDataURL(imageFile);
  };

  const addTrackToPlaylist = (trackId: string, playlistId: string) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId && !p.trackIds.includes(trackId)) {
        return { ...p, trackIds: [...p.trackIds, trackId] };
      }
      return p;
    }));
    const playlist = playlists.find(p => p.id === playlistId);
    if (playlist) {
      addToast(`Added to ${playlist.name}`);
    }
  };

  const removeTrackFromPlaylist = (trackId: string, playlistId: string) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        return { ...p, trackIds: p.trackIds.filter(id => id !== trackId) };
      }
      return p;
    }));
  };

  // Get filtered tracks based on selected playlist
  const getFilteredTracks = (): Track[] => {
    if (!selectedPlaylist) {
      return tracks; // All Tracks
    }
    const playlist = playlists.find(p => p.id === selectedPlaylist);
    if (!playlist) return tracks;

    return tracks.filter(t => playlist.trackIds.includes(t.id));
  };

  // --- Chapter Marker Functions ---

  const addMarker = (timestamp: number, label?: string) => {
    if (!currentTrack) return;

    // Auto-generate label if not provided
    const currentTrackMarkers = markers.filter(m => m.trackId === currentTrack.id);
    const markerNumber = currentTrackMarkers.length + 1;
    const markerLabel = label || `Marker ${markerNumber}`;

    const newMarker: ChapterMarker = {
      id: generateId(),
      trackId: currentTrack.id,
      timestamp,
      label: markerLabel,
      color: '#06b6d4' // Cyan default
    };
    setMarkers(prev => [...prev, newMarker]);
  };

  const updateMarkerLabel = (markerId: string, newLabel: string) => {
    if (newLabel.trim()) {
      setMarkers(prev => prev.map(m => m.id === markerId ? { ...m, label: newLabel.trim() } : m));
    }
    setEditingMarkerId(null);
    setEditingMarkerLabel('');
  };

  const deleteMarker = (markerId: string) => {
    setMarkers(prev => prev.filter(m => m.id !== markerId));
  };

  const jumpToMarker = (timestamp: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = timestamp;
    }
  };

  const jumpToNextMarker = () => {
    const currentMarkers = getCurrentTrackMarkers();
    if (currentMarkers.length === 0) return;

    const nextMarker = currentMarkers.find(m => m.timestamp > playerState.currentTime);
    if (nextMarker) {
      jumpToMarker(nextMarker.timestamp);
    }
  };

  const jumpToPrevMarker = () => {
    const currentMarkers = getCurrentTrackMarkers();
    if (currentMarkers.length === 0) return;

    // Find the last marker before current time
    const prevMarker = [...currentMarkers].reverse().find(m => m.timestamp < playerState.currentTime - 1);
    if (prevMarker) {
      jumpToMarker(prevMarker.timestamp);
    }
  };

  // Get markers for current track
  const getCurrentTrackMarkers = (): ChapterMarker[] => {
    if (!currentTrack) return [];
    return markers.filter(m => m.trackId === currentTrack.id).sort((a, b) => a.timestamp - b.timestamp);
  };

  // --- Custom Album Cover ---
  const updateTrackCover = (trackId: string, imageFile: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const coverArtUrl = e.target?.result as string;
      setTracks(prev => prev.map(t =>
        t.id === trackId ? { ...t, coverArtUrl } : t
      ));

      // Update current track if it's the one being modified
      if (currentTrack?.id === trackId) {
        setCurrentTrack(prev => prev ? { ...prev, coverArtUrl } : null);
      }

      // Persist the change
      const updatedTracks = tracks.map(t =>
        t.id === trackId ? { ...t, coverArtUrl } : t
      );
      saveTracksToIndexedDB(updatedTracks).catch(err => console.error("Failed to save cover art", err));

      addToast('Album cover updated');
    };
    reader.readAsDataURL(imageFile);
  };

  const removeTrackCover = (trackId: string) => {
    setTracks(prev => prev.map(t =>
      t.id === trackId ? { ...t, coverArtUrl: undefined } : t
    ));

    if (currentTrack?.id === trackId) {
      setCurrentTrack(prev => prev ? { ...prev, coverArtUrl: undefined } : null);
    }

    const updatedTracks = tracks.map(t =>
      t.id === trackId ? { ...t, coverArtUrl: undefined } : t
    );
    saveTracksToIndexedDB(updatedTracks).catch(err => console.error("Failed to remove cover art", err));

    addToast('Album cover removed');
  };

  const removeTrack = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();

      const trackToRemove = tracks.find(t => t.id === id);
      if (!trackToRemove) return;

      // Revoke blob URL for the track being removed to clean up memory
      if (trackToRemove.type === 'local' && trackToRemove.url.startsWith('blob:')) {
        URL.revokeObjectURL(trackToRemove.url);
      }

      const tracksAfterRemoval = tracks.filter(t => t.id !== id);

      // Persist the change
      if (tracksAfterRemoval.length > 0) {
        saveTracksToIndexedDB(tracksAfterRemoval).catch(err => console.error("Failed to save after track removal", err));
      } else {
        clearLibrary().catch(err => console.error("Failed to clear library", err));
      }

      // Update state
      setTracks(tracksAfterRemoval);

      // Handle playback transition
      if (currentTrack?.id === id) {
        const currentIndex = tracks.findIndex(t => t.id === id);
        const nextTrack = tracksAfterRemoval[currentIndex] ?? tracksAfterRemoval[0];

        if (nextTrack) {
          playTrack(nextTrack);
        } else {
          // Library is now empty, stop the player
          audioRef.current.pause();
          audioRef.current.removeAttribute('src');
          audioRef.current.load();
          setCurrentTrack(null);
          setPlayerState(prev => ({ ...prev, isPlaying: false, currentTime: 0, duration: 0 }));
        }
      }
  };

  // --- Backup & Restore Handlers ---
  const handleBackupLibrary = async () => {
    try {
      const password = prompt("Enter a password to encrypt the backup (optional):");
      const json = await exportLibraryAsJSON(password || undefined);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `penko-library-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('Library backup downloaded');
    } catch (e) {
      addToast('Failed to create backup', 'error');
    }
  };

  const handleRestoreLibrary = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const json = event.target?.result as string;
      try {
        await importLibraryFromJSON(json);
        addToast('Library restored! Please refresh.', 'info');
        // Optional: Trigger a reload or state refresh here
        setTimeout(() => window.location.reload(), 1500);
      } catch (err: any) {
        if (err.message === "PASSWORD_REQUIRED") {
           const password = prompt("This backup is encrypted. Enter password:");
           if (password) {
             try {
               await importLibraryFromJSON(json, password);
               addToast('Library restored! Please refresh.', 'info');
               setTimeout(() => window.location.reload(), 1500);
             } catch (e2: any) {
               addToast(e2.message === "INVALID_PASSWORD" ? "Incorrect password" : "Failed to restore", 'error');
             }
           }
        } else {
           addToast('Failed to restore library', 'error');
        }
      }
    };
    reader.readAsText(file);
  };

  // --- Control Handlers ---

  const skip = (seconds: number) => {
      if (audioRef.current) {
          handleSeek(audioRef.current.currentTime + seconds);
          showGestureFeedback(seconds > 0 ? '+10s' : '-10s');
      }
  };

  // --- Gesture & Touch Handlers ---
  const showGestureFeedback = (text: string) => {
      setActiveGesture(text);
      setTimeout(() => setActiveGesture(null), 800);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;

    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    };

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

    if (!touchStartRef.current) return;
    
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const endTime = Date.now();
    const startTime = touchStartRef.current.time;
    
    const dx = endX - touchStartRef.current.x;
    const dy = endY - touchStartRef.current.y;
    const dt = endTime - startTime;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 500) {
        if (dx > 0) playPrev();
        else playNext();
        
        touchStartRef.current = null;
        lastTapRef.current = null;
        return;
    }

    if (dist < 10 && dt < 250) {
        const now = Date.now();
        const width = window.innerWidth;
        const tapX = endX;

        if (lastTapRef.current && (now - lastTapRef.current.time) < 300) {
             if (tapX < width * 0.3) {
                 skip(-10);
             } else if (tapX > width * 0.7) {
                 skip(10);
             } else {
                 togglePlayPause();
                 showGestureFeedback(playerState.isPlaying ? 'Pause' : 'Play');
             }
             lastTapRef.current = null; 
        } else {
            lastTapRef.current = { time: now, x: tapX };
        }
    }
  };

  const handleSpeedUpStart = () => {
      if (audioRef.current && audioRef.current.playbackRate !== 2.0) {
        audioRef.current.playbackRate = 2.0;
        setPlayerState(prev => ({...prev, playbackRate: 2.0}));
      }
  };

  const handleSpeedUpEnd = () => {
      if (audioRef.current && audioRef.current.playbackRate !== 1.0) {
        audioRef.current.playbackRate = 1.0;
        setPlayerState(prev => ({...prev, playbackRate: 1.0}));
      }
  };

  // --- Sleep Timer Functions ---
  const startSleepTimer = (minutes: number) => {
    const endTime = Date.now() + (minutes * 60 * 1000);
    setSleepTimerMinutes(minutes);
    setSleepTimerEndTime(endTime);
    setShowSleepTimer(false);
    addToast(`Sleep timer set for ${minutes} minutes`);

    // Clear any existing timer
    if (sleepTimerIntervalRef.current) {
      clearInterval(sleepTimerIntervalRef.current);
    }

    // Check every second if timer has expired
    sleepTimerIntervalRef.current = window.setInterval(() => {
      if (Date.now() >= endTime) {
        // Timer expired - pause playback
        audioRef.current.pause();
        setPlayerState(prev => ({ ...prev, isPlaying: false }));
        clearSleepTimer();
        addToast('Sleep timer ended - playback paused');
      }
    }, 1000);
  };

  const clearSleepTimer = () => {
    if (sleepTimerIntervalRef.current) {
      clearInterval(sleepTimerIntervalRef.current);
      sleepTimerIntervalRef.current = null;
    }
    setSleepTimerMinutes(null);
    setSleepTimerEndTime(null);
  };

  const getRemainingTime = (): string => {
    if (!sleepTimerEndTime) return '';
    const remaining = Math.max(0, sleepTimerEndTime - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Update remaining time display every second
  useEffect(() => {
    if (sleepTimerEndTime) {
      const interval = setInterval(() => {
        // Force re-render to update remaining time display
        setSleepTimerEndTime(prev => prev);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [sleepTimerEndTime]);

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-white font-sans select-none overflow-hidden">
      {/* Toast Notification Container */}
      <div className="fixed top-20 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
          {toasts.map(toast => (
              <div key={toast.id} className={`bg-zinc-900 border ${toast.type === 'error' ? 'border-red-500/50 text-red-100' : 'border-zinc-700 text-zinc-100'} px-4 py-3 rounded-lg shadow-xl animate-in slide-in-from-right-10 fade-in duration-300 flex items-center gap-2 max-w-sm`}>
                  <AlertCircle size={16} className={toast.type === 'error' ? 'text-red-500' : 'text-cyan-500'} />
                  <span className="text-sm font-medium">{toast.message}</span>
              </div>
          ))}
      </div>

      {/* Top Bar */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950 shrink-0 relative z-20">
        <div className="flex items-center gap-2">
            <div className="flex items-center justify-center">
                <img src="./penguin-tune-logo.svg" alt="Penko" className="w-14 h-14" style={{ imageRendering: 'pixelated' }} />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent hidden sm:block">Penko-tune</h1>
        </div>
        
        {/* Mobile Menu Button */}
        <button 
          className="md:hidden p-2 text-zinc-400 hover:text-white"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu size={24} />
        </button>

        {/* Desktop Controls */}
        <div className="hidden md:flex items-center gap-4">
           {/* Browse Music Button */}
           <button
             onClick={() => setShowBrowseMusic(true)}
             className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-600 rounded-lg text-sm font-medium transition-colors"
             title={t.browseMusic}
           >
             <Compass size={16} />
             <span className="hidden sm:inline">{t.browseMusic.split(' - ')[0]}</span>
           </button>

           {/* Artist Portal Button */}
           <button
             onClick={() => setShowArtistPortal(true)}
             className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-600 rounded-lg text-sm font-medium transition-colors"
             title={t.artistPortal}
           >
             <Upload size={16} />
             <span className="hidden sm:inline">{t.artistPortal.split(' - ')[0]}</span>
           </button>

           {/* PWA Install Button (only shown when installable) */}
           {showInstallButton && (
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
               className={`p-2 rounded-md transition-all relative ${sleepTimerMinutes ? 'bg-zinc-800 text-cyan-400' : showSleepTimer ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
               title={t.sleepTimer}
             >
                <Timer size={18} />
                {sleepTimerMinutes && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full animate-pulse" />
                )}
             </button>
             {/* YouTube Streaming - Works on deployed version (CORS restriction on localhost only) */}
             <button
               onClick={() => setShowNetworkStream(!showNetworkStream)}
               className={`p-2 rounded-md transition-all ${showNetworkStream ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
               title={t.networkStream}
             >
                <Globe size={18} />
             </button>
             {/* Manual/Documentation */}
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
                   {[
                     { code: 'en', name: 'English' },
                     { code: 'es', name: 'Español' },
                     { code: 'pt', name: 'Português' },
                     { code: 'fr', name: 'Français' },
                     { code: 'de', name: 'Deutsch' },
                     { code: 'it', name: 'Italiano' },
                     { code: 'ru', name: 'Русский' },
                     { code: 'uk', name: 'Українська' },
                     { code: 'ja', name: '日本語' },
                     { code: 'ko', name: '한국어' },
                     { code: 'zh', name: '中文' },
                   ].map(lang => (
                     <button
                       key={lang.code}
                       onClick={() => {
                         setCurrentLanguage(lang.code);
                         setShowLanguageMenu(false);
                         // TODO: Implement actual translation logic
                         console.log(`Language changed to: ${lang.name}`);
                       }}
                       className={`w-full text-left px-3 py-2 rounded-md transition-all flex items-center justify-between ${
                         currentLanguage === lang.code
                           ? 'bg-zinc-800 text-cyan-400'
                           : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                       }`}
                     >
                       <span>{lang.name}</span>
                       {currentLanguage === lang.code && <Check size={16} />}
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

             {/* Visualizer Dropdown Group */}
             <div className="flex items-center border-l border-zinc-800 ml-1 pl-1 gap-1 relative" id="vis-menu-container">
                 <button
                   onClick={() => {
                       setViewMode(ViewMode.VISUALIZER);
                       setShowVisMenu(!showVisMenu);
                   }}
                   className={`p-2 rounded-md transition-all flex gap-1 items-center ${viewMode === ViewMode.VISUALIZER ? 'bg-zinc-800 text-cyan-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                   title={t.visualizerMode}
                 >
                    {visualizerMode === VisualizerMode.BARS && <BarChart2 size={18} />}
                    {visualizerMode === VisualizerMode.WAVE && <Waves size={18} />}
                    {visualizerMode === VisualizerMode.CIRCLE && <Activity size={18} />}
                    {visualizerMode === VisualizerMode.SPIRAL && <Disc size={18} />}
                    {visualizerMode === VisualizerMode.PARTICLES && <Sparkles size={18} />}
                    {visualizerMode === VisualizerMode.SPECTRUM && <TrendingUp size={18} />}
                    {visualizerMode === VisualizerMode.RINGS && <Radio size={18} />}
                    {visualizerMode === VisualizerMode.DNA && <Dna size={18} />}
                    <ChevronDown size={14} className={`ml-1 transition-transform ${showVisMenu ? 'rotate-180' : ''}`} />
                 </button>

                 {/* Dropdown Menu */}
                 {showVisMenu && (
                    <div className="absolute top-full right-0 mt-2 w-44 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col p-1 animate-in fade-in slide-in-from-top-2 duration-200">
                        <button
                            onClick={() => { setVisualizerMode(VisualizerMode.BARS); setViewMode(ViewMode.VISUALIZER); setShowVisMenu(false); }}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${visualizerMode === VisualizerMode.BARS ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                        >
                            <span className="flex items-center gap-2"><BarChart2 size={16} /> Bars</span>
                            {visualizerMode === VisualizerMode.BARS && <Check size={14} />}
                        </button>
                        <button
                            onClick={() => { setVisualizerMode(VisualizerMode.SPECTRUM); setViewMode(ViewMode.VISUALIZER); setShowVisMenu(false); }}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${visualizerMode === VisualizerMode.SPECTRUM ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                        >
                            <span className="flex items-center gap-2"><TrendingUp size={16} /> Spectrum</span>
                            {visualizerMode === VisualizerMode.SPECTRUM && <Check size={14} />}
                        </button>
                        <button
                            onClick={() => { setVisualizerMode(VisualizerMode.WAVE); setViewMode(ViewMode.VISUALIZER); setShowVisMenu(false); }}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${visualizerMode === VisualizerMode.WAVE ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                        >
                            <span className="flex items-center gap-2"><Waves size={16} /> Mandala</span>
                            {visualizerMode === VisualizerMode.WAVE && <Check size={14} />}
                        </button>
                        <button
                            onClick={() => { setVisualizerMode(VisualizerMode.CIRCLE); setViewMode(ViewMode.VISUALIZER); setShowVisMenu(false); }}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${visualizerMode === VisualizerMode.CIRCLE ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                        >
                            <span className="flex items-center gap-2"><Activity size={16} /> Circle</span>
                            {visualizerMode === VisualizerMode.CIRCLE && <Check size={14} />}
                        </button>
                        <button
                            onClick={() => { setVisualizerMode(VisualizerMode.SPIRAL); setViewMode(ViewMode.VISUALIZER); setShowVisMenu(false); }}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${visualizerMode === VisualizerMode.SPIRAL ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                        >
                            <span className="flex items-center gap-2"><Disc size={16} /> Spiral</span>
                            {visualizerMode === VisualizerMode.SPIRAL && <Check size={14} />}
                        </button>
                        <button
                            onClick={() => { setVisualizerMode(VisualizerMode.PARTICLES); setViewMode(ViewMode.VISUALIZER); setShowVisMenu(false); }}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${visualizerMode === VisualizerMode.PARTICLES ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                        >
                            <span className="flex items-center gap-2"><Sparkles size={16} /> Particles</span>
                            {visualizerMode === VisualizerMode.PARTICLES && <Check size={14} />}
                        </button>
                        <button
                            onClick={() => { setVisualizerMode(VisualizerMode.RINGS); setViewMode(ViewMode.VISUALIZER); setShowVisMenu(false); }}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${visualizerMode === VisualizerMode.RINGS ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                        >
                            <span className="flex items-center gap-2"><Radio size={16} /> Rings</span>
                            {visualizerMode === VisualizerMode.RINGS && <Check size={14} />}
                        </button>
                        <button
                            onClick={() => { setVisualizerMode(VisualizerMode.DNA); setViewMode(ViewMode.VISUALIZER); setShowVisMenu(false); }}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${visualizerMode === VisualizerMode.DNA ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                        >
                            <span className="flex items-center gap-2"><Dna size={16} /> DNA</span>
                            {visualizerMode === VisualizerMode.DNA && <Check size={14} />}
                        </button>
                    </div>
                 )}
             </div>
           </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        t={t}
        expandedSection={expandedSection}
        setExpandedSection={setExpandedSection}
        onShowBrowseMusic={() => setShowBrowseMusic(true)}
        onShowArtistPortal={() => setShowArtistPortal(true)}
        onToggleKaraoke={toggleKaraokeMode}
        playerState={playerState}
        onShowEQ={() => setShowEQ(true)}
        onShowSleepTimer={() => setShowSleepTimer(true)}
        onShowNetworkStream={() => setShowNetworkStream(true)}
        viewMode={viewMode}
        setViewMode={setViewMode}
        visualizerMode={visualizerMode}
        setVisualizerMode={setVisualizerMode}
        currentLanguage={currentLanguage}
        setCurrentLanguage={setCurrentLanguage}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <Sidebar
          t={t}
          tracksCount={tracks.length}
          playlists={playlists}
          selectedPlaylist={selectedPlaylist}
          showCreatePlaylist={showCreatePlaylist}
          newPlaylistName={newPlaylistName}
          currentTrack={currentTrack}
          currentTrackMarkers={getCurrentTrackMarkers()}
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
          onJumpToMarker={jumpToMarker}
          onDeleteMarker={deleteMarker}
          onBackupLibrary={handleBackupLibrary}
          onRestoreLibrary={handleRestoreLibrary}
        />

        {/* Center View - Gesture Area */}
        <div
            className="flex-1 flex flex-col bg-zinc-950 relative overflow-hidden"
            onMouseDown={viewMode === ViewMode.VISUALIZER ? handleSpeedUpStart : undefined}
            onMouseUp={viewMode === ViewMode.VISUALIZER ? handleSpeedUpEnd : undefined}
            onMouseLeave={viewMode === ViewMode.VISUALIZER ? handleSpeedUpEnd : undefined}
            onTouchStart={viewMode === ViewMode.VISUALIZER ? handleTouchStart : undefined}
            onTouchEnd={viewMode === ViewMode.VISUALIZER ? handleTouchEnd : undefined}
        >
          {/* Gesture Feedback Overlay */}
          {activeGesture && (
              <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none animate-out fade-out duration-700">
                  <div className="bg-black/70 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 flex flex-col items-center">
                     <span className="text-2xl font-bold text-white">{activeGesture}</span>
                  </div>
              </div>
          )}

          {/* 2x Speed Overlay */}
          {playerState.playbackRate > 1 && (
              <div className="absolute top-4 right-4 z-40 pointer-events-none">
                   <div className="bg-cyan-500/20 backdrop-blur-md text-cyan-400 px-4 py-2 rounded-full flex items-center gap-2 animate-pulse border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
                        <FastForward size={18} className="fill-current" />
                        <span className="font-bold text-sm">2x Speed</span>
                   </div>
              </div>
          )}

          {/* P2P Resolving Overlay */}
          {isResolvingP2P && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
                   <div className="bg-zinc-900/80 backdrop-blur-md text-white px-6 py-3 rounded-full flex items-center gap-3 border border-zinc-700 shadow-xl animate-in slide-in-from-top-5">
                        <Loader2 size={18} className="animate-spin text-cyan-400" />
                        <span className="text-sm font-medium">Resolving P2P Stream...</span>
                   </div>
              </div>
          )}

          {/* Background Cover Art Blur */}
          {currentTrack?.coverArtUrl && viewMode === ViewMode.VISUALIZER && (
              <div 
                className="absolute inset-0 opacity-20 pointer-events-none z-0 bg-cover bg-center blur-3xl scale-110 transition-all duration-1000"
                style={{ backgroundImage: `url(${currentTrack.coverArtUrl})` }}
              />
          )}

          {viewMode === ViewMode.LIST ? (
            <TrackList
              tracks={getFilteredTracks()}
              currentTrackId={currentTrack?.id}
              isPlaying={playerState.isPlaying}
              onSelectTrack={playTrack}
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
                            {/* Album Art Circle */}
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
                        <p className="text-center text-zinc-600 text-xs mt-2">
                           {t.visualizerHint}
                        </p>
                    </div>
                ) : (
                    <div className="text-zinc-500 flex flex-col items-center gap-2">
                        <BarChart2 size={48} className="opacity-20" />
                        <p>{t.playToStart}</p>
                    </div>
                )}
            </div>
          )}
          
          {/* Modals Layer */}
          {showEQ && (
              <Equalizer
                bands={eqBands}
                onBandChange={handleEQChange}
                onReset={resetEQ}
                onClose={() => setShowEQ(false)}
                onLoadPreset={(presetBands) => setEqBands(presetBands)}
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

          {/* Sleep Timer Modal */}
          {showSleepTimer && (
             <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                 <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-2xl w-full max-w-md">
                     <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                         <Timer size={20} className="text-cyan-500" />
                         {t.sleepTimer}
                     </h3>

                     {sleepTimerMinutes ? (
                       <div className="space-y-4">
                         <div className="text-center">
                           <p className="text-sm text-zinc-400 mb-2">{t.timerActive}</p>
                           <p className="text-4xl font-bold text-cyan-400 font-mono">{getRemainingTime()}</p>
                           <p className="text-xs text-zinc-600 mt-2">{t.timerEndsPause}</p>
                         </div>
                         <button
                           onClick={() => {
                             clearSleepTimer();
                             addToast('Sleep timer cancelled');
                           }}
                           className="w-full px-4 py-3 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                         >
                           <X size={16} />
                           {t.cancelTimer}
                         </button>
                       </div>
                     ) : (
                       <>
                         <p className="text-xs text-zinc-500 mb-4">
                           {t.sleepTimerDesc}
                         </p>
                         <div className="grid grid-cols-3 gap-2 mb-4">
                           {[15, 30, 45, 60, 90, 120].map(minutes => (
                             <button
                               key={minutes}
                               onClick={() => startSleepTimer(minutes)}
                               className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors text-sm"
                             >
                               {minutes} min
                             </button>
                           ))}
                         </div>
                         <button
                           onClick={() => setShowSleepTimer(false)}
                           className="w-full px-4 py-2 text-sm text-zinc-400 hover:text-white"
                         >
                           {t.close}
                         </button>
                       </>
                     )}
                 </div>
             </div>
          )}
        </div>
      </main>

      {/* Controls */}
      <PlayerControls
        playerState={playerState}
        onPlayPause={togglePlayPause}
        onNext={playNext}
        onPrev={playPrev}
        onSeek={handleSeek}
        onVolumeChange={handleVolume}
        onToggleMute={toggleMute}
        onToggleShuffle={() => setPlayerState(prev => ({ ...prev, isShuffle: !prev.isShuffle }))}
        onToggleRepeat={() => setPlayerState(prev => {
            if (prev.repeatMode === 'off') return { ...prev, repeatMode: 'all' };
            if (prev.repeatMode === 'all') return { ...prev, repeatMode: 'one' };
            return { ...prev, repeatMode: 'off' };
        })}
        onSkipForward={() => skip(10)}
        onSkipBackward={() => skip(-10)}
        markers={getCurrentTrackMarkers()}
        onJumpToMarker={jumpToMarker}
        onAddMarker={addMarker}
        onNextMarker={jumpToNextMarker}
        onPrevMarker={jumpToPrevMarker}
        hasTrack={!!currentTrack}
      />

      {/* Artist Portal Modal */}
      {showArtistPortal && (
        <ArtistPortal
          onClose={() => setShowArtistPortal(false)}
          addToast={addToast}
        />
      )}

      {/* Browse Music Modal */}
      {showBrowseMusic && (
        <BrowseMusic
          onClose={() => setShowBrowseMusic(false)}
          onPlayTrack={playTrack} // Use main playTrack which now handles routing
          onAddToLibrary={addTrackToLibrary}
          addToast={addToast}
        />
      )}
    </div>
  );
}

export default App;
