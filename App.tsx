import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FolderOpen, Layout, List, BarChart2, Plus, Sliders, Globe, FastForward, Activity, Waves, Image as ImageIcon, ChevronDown, Check, Loader2, AlertCircle, Disc, Music, Bookmark, Mic, Timer, X, Download, Sparkles, TrendingUp, Radio, Dna, Upload, Compass, Languages, BookOpen } from 'lucide-react';
import { Track, PlayerState, ViewMode, EQBand, VisualizerMode, Playlist, ChapterMarker } from './types';
import { translations, Language } from './translations';
import PlayerControls from './components/PlayerControls';
import TrackList from './components/TrackList';
import Visualizer from './components/Visualizer';
import Equalizer from './components/Equalizer';
import { ArtistPortal } from './components/ArtistPortal';
import { BrowseMusic } from './components/BrowseMusic';
import { saveTracksToIndexedDB, loadTracksFromIndexedDB, isPersistenceEnabled, setPersistenceEnabled, clearLibrary, saveEQSettings, loadEQSettings, savePlaylists, loadPlaylists, saveMarkers, loadMarkers } from './utils/persistence';
import { formatTime } from './utils/formatters';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Standard 10-Band EQ Frequencies
const EQ_FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];

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

  // Translation helper
  const t = translations[currentLanguage];
  const [networkUrl, setNetworkUrl] = useState('');
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Audio & Analyzer
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  // Karaoke Mode Nodes
  const splitterRef = useRef<ChannelSplitterNode | null>(null);
  const mergerRef = useRef<ChannelMergerNode | null>(null);
  const invertGainRef = useRef<GainNode | null>(null);
  
  // EQ State
  const eqNodesRef = useRef<BiquadFilterNode[]>([]);
  const [eqBands, setEqBands] = useState<EQBand[]>(() => {
    // Load saved EQ settings on startup
    const saved = loadEQSettings();
    return saved || EQ_FREQUENCIES.map(f => ({ frequency: f, gain: 0 }));
  });

  // Player State
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    isShuffle: false,
    repeatMode: 'off',
    playbackRate: 1,
    karaokeMode: false,
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

  // --- Initialization ---

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaElementSource(audioRef.current);
      sourceNodeRef.current = source;

      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 256;
      analyserRef.current = analyserNode;
      setAnalyser(analyserNode);

      // Karaoke processing nodes
      const splitter = ctx.createChannelSplitter(2);
      const merger = ctx.createChannelMerger(2);
      const invertGain = ctx.createGain();
      invertGain.gain.value = -1; // Invert phase for center channel cancellation

      splitterRef.current = splitter;
      mergerRef.current = merger;
      invertGainRef.current = invertGain;

      // EQ bands
      const bands: BiquadFilterNode[] = EQ_FREQUENCIES.map(freq => {
          const filter = ctx.createBiquadFilter();
          filter.type = 'peaking';
          filter.frequency.value = freq;
          filter.Q.value = 1.4;
          filter.gain.value = 0;
          return filter;
      });
      eqNodesRef.current = bands;

      // Build audio graph: source -> EQ chain -> analyser -> destination
      // (Karaoke mode will be toggled by reconnecting nodes)
      let previousNode: AudioNode = source;
      bands.forEach(node => {
          previousNode.connect(node);
          previousNode = node;
      });
      previousNode.connect(analyserNode);
      analyserNode.connect(ctx.destination);

    } else if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  // --- Karaoke Mode Toggle ---
  const toggleKaraokeMode = useCallback(() => {
    if (!audioContextRef.current || !sourceNodeRef.current || !analyserRef.current) return;

    const ctx = audioContextRef.current;
    const source = sourceNodeRef.current;
    const analyser = analyserRef.current;
    const eqChain = eqNodesRef.current;

    // Disconnect everything
    source.disconnect();
    eqChain.forEach(node => node.disconnect());
    analyser.disconnect();
    splitterRef.current?.disconnect();
    mergerRef.current?.disconnect();
    invertGainRef.current?.disconnect();

    const newKaraokeMode = !playerState.karaokeMode;

    if (newKaraokeMode && splitterRef.current && mergerRef.current && invertGainRef.current) {
      // Karaoke mode: split stereo, subtract right from left (vocal cancellation)
      const splitter = splitterRef.current;
      const merger = mergerRef.current;
      const invertGain = invertGainRef.current;

      // Connect source through EQ chain first
      let previousNode: AudioNode = source;
      eqChain.forEach(node => {
        previousNode.connect(node);
        previousNode = node;
      });

      // Then apply karaoke processing
      previousNode.connect(splitter);
      splitter.connect(merger, 0, 0); // Left channel to left output
      splitter.connect(invertGain, 1); // Right channel to inverter
      invertGain.connect(merger, 0, 0); // Inverted right to left (cancels center)
      splitter.connect(merger, 1, 1); // Right channel to right output
      splitter.connect(invertGain, 0); // Left channel to inverter
      invertGain.connect(merger, 0, 1); // Inverted left to right (cancels center)

      merger.connect(analyser);
      analyser.connect(ctx.destination);
    } else {
      // Normal mode: simple chain
      let previousNode: AudioNode = source;
      eqChain.forEach(node => {
        previousNode.connect(node);
        previousNode = node;
      });
      previousNode.connect(analyser);
      analyser.connect(ctx.destination);
    }

    setPlayerState(prev => ({ ...prev, karaokeMode: newKaraokeMode }));
  }, [playerState.karaokeMode]);

  // --- Helpers ---
  const addToast = (message: string, type: 'error' | 'info' = 'info') => {
      const id = Date.now();
      setToasts(prev => [...prev, { message, type, id }]);
      setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);
  };

  // --- Audio Event Handlers ---
  useEffect(() => {
    const audio = audioRef.current;
    audio.crossOrigin = "anonymous";

    const updateTime = () => {
      setPlayerState(prev => ({
        ...prev,
        currentTime: audio.currentTime,
        duration: audio.duration || 0,
        playbackRate: audio.playbackRate
      }));
    };

    const handleEnded = () => {
        if (playerState.repeatMode === 'one') {
            audio.currentTime = 0;
            audio.play().catch(e => console.error(e));
        } else {
            playNext();
        }
    };

    const handleError = (e: Event) => {
        const target = e.target as HTMLAudioElement;
        if (target.error) {
             console.error("Audio Error:", target.error);
             if (target.error.code === 4) {
                 addToast("Source not supported or blocked by CORS.", 'error'); 
             } else {
                 addToast(`Playback Error: ${target.error.message}`, 'error');
             }
             setPlayerState(prev => ({ ...prev, isPlaying: false }));
        }
    };

    const handlePlay = () => setPlayerState(prev => ({ ...prev, isPlaying: true }));
    const handlePause = () => setPlayerState(prev => ({ ...prev, isPlaying: false }));

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
    };
  }, [tracks, currentTrack, playerState.repeatMode, playerState.isShuffle]);

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

  // --- Auto-save EQ settings when they change ---
  useEffect(() => {
    // Save EQ settings to localStorage
    saveEQSettings(eqBands);
  }, [eqBands]);

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

  const addNetworkStream = async () => {
      if (!networkUrl) return;

      const youtubeId = extractVideoId(networkUrl);

      if (youtubeId) {
          setIsLoadingStream(true);

          // Privacy-focused sources (based on working proof of concept)
          // Using CORS-friendly proxies and working Piped instances
          const sources = [
            // Piped instances (best for audio quality)
            `https://pipedapi.kavin.rocks/streams/${youtubeId}`,
            `https://pipedapi.tokhmi.xyz/streams/${youtubeId}`,
            `https://api-piped.mha.fi/streams/${youtubeId}`,

            // Invidious instances (fallback)
            `https://inv.nadeko.net/api/v1/videos/${youtubeId}`,
            `https://invidious.privacyredirect.com/api/v1/videos/${youtubeId}`,
            `https://yt.artemislena.eu/api/v1/videos/${youtubeId}`
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
                  `https://piped-api.garudalinux.org/streams/${youtubeId}`,
                  `https://pipedapi.esmailelbob.xyz/streams/${youtubeId}`,
                  `https://pipedapi.syncpundit.io/streams/${youtubeId}`
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
              setShowNetworkStream(false);
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
      setShowNetworkStream(false);
      playTrack(newTrack);
  };

  const playTrack = async (track: Track) => {
    initAudioContext();

    if (currentTrack?.id !== track.id) {
      console.log(`[Play] Playing ${track.type}: ${track.name}`);
      console.log(`[Play] -> URL: ${track.url}`);

      if (track.type === 'local' && track.file) {
        console.log(`[Play] -> File size: ${track.file.size} bytes | Type: ${track.file.type}`);
      }

      audioRef.current.src = track.url;
      setCurrentTrack(track);

      // Update Media Session API for lock screen controls
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.name,
          artist: track.artist || 'Unknown Artist',
          album: track.album || 'Penko-tune',
          artwork: track.coverArtUrl ? [
            { src: track.coverArtUrl, sizes: '512x512', type: 'image/jpeg' }
          ] : []
        });
      }
    }

    // Slight delay to allow audio context to stabilize
    setTimeout(async () => {
        try {
            await audioRef.current.play();
        } catch (err) {
            // Errors handled by listener
        }
    }, 50);
  };

  const togglePlayPause = async () => {
    if (!currentTrack && tracks.length === 0) return;
    if (!currentTrack && tracks.length > 0) {
      playTrack(tracks[0]);
      return;
    }
    
    if (audioRef.current.paused) {
      initAudioContext();
      try {
        await audioRef.current.play();
      } catch (err) { }
    } else {
      audioRef.current.pause();
    }
  };

  const getNextTrack = (): Track | null => {
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
  };

  const getPrevTrack = (): Track | null => {
    if (tracks.length === 0) return null;
    if (!currentTrack) return tracks[tracks.length - 1];
    
    if (audioRef.current.currentTime > 3) {
        handleSeek(0);
        return currentTrack;
    }
    const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) return tracks[prevIndex];
    if (playerState.repeatMode === 'all') return tracks[tracks.length - 1];
    return tracks[0];
  };

  const playNext = () => {
      const next = getNextTrack();
      if (next) playTrack(next);
      else addToast("End of playlist");
      showGestureFeedback('Next Track');
  };

  const playPrev = () => {
      const prev = getPrevTrack();
      if (prev) {
        if (prev.id === currentTrack?.id) { } 
        else playTrack(prev);
      }
      showGestureFeedback('Prev Track');
  };

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

  const startEditingMarker = (marker: ChapterMarker) => {
    setEditingMarkerId(marker.id);
    setEditingMarkerLabel(marker.label);
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

  // --- Control Handlers ---

  const handleSeek = (time: number) => {
    if (isFinite(time)) {
        audioRef.current.currentTime = time;
        setPlayerState(prev => ({ ...prev, currentTime: time }));
    }
  };

  const skip = (seconds: number) => {
      if (audioRef.current) {
          handleSeek(audioRef.current.currentTime + seconds);
          showGestureFeedback(seconds > 0 ? '+10s' : '-10s');
      }
  };

  const handleVolume = (vol: number) => {
    audioRef.current.volume = vol;
    audioRef.current.muted = false;
    setPlayerState(prev => ({ ...prev, volume: vol, isMuted: false }));
  };

  const toggleMute = () => {
    const newMuted = !playerState.isMuted;
    audioRef.current.muted = newMuted;
    setPlayerState(prev => ({ ...prev, isMuted: newMuted }));
  };

  // --- EQ Handlers ---
  const handleEQChange = (index: number, value: number) => {
      setEqBands(prev => {
          const next = [...prev];
          next[index].gain = value;
          return next;
      });
      if (eqNodesRef.current[index]) {
          eqNodesRef.current[index].gain.value = value;
      }
  };

  const resetEQ = () => {
      setEqBands(prev => prev.map(b => ({ ...b, gain: 0 })));
      eqNodesRef.current.forEach(node => node.gain.value = 0);
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
      if (audioRef.current.playbackRate !== 2.0) {
        audioRef.current.playbackRate = 2.0;
        setPlayerState(prev => ({...prev, playbackRate: 2.0}));
      }
  };

  const handleSpeedUpEnd = () => {
      if (audioRef.current.playbackRate !== 1.0) {
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
            <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                <img src="/penguin-logo.svg" alt="Penko" className="w-8 h-8" style={{ imageRendering: 'pixelated' }} />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent hidden sm:block">Penko-tune</h1>
        </div>
        
        <div className="flex items-center gap-4">
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

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <aside className="w-64 bg-zinc-950 border-r border-zinc-900 hidden md:flex flex-col p-4 gap-6 z-10">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2">Library</h3>
            <button
              onClick={() => {
                setSelectedPlaylist(null);
                setViewMode(ViewMode.LIST);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors text-left group ${
                selectedPlaylist === null
                  ? 'bg-zinc-900 text-cyan-400'
                  : 'text-zinc-300 hover:bg-zinc-900'
              }`}
            >
                <Layout size={18} className={selectedPlaylist === null ? 'text-cyan-400' : 'text-zinc-500 group-hover:text-cyan-400'} />
                {t.allTracks}
            </button>
             <label className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-900 rounded-md transition-colors cursor-pointer group">
                <Plus size={18} className="text-zinc-500 group-hover:text-cyan-400" />
                {t.addFiles}
                <input 
                  type="file" 
                  accept="audio/*,image/*,.flac,.ogg,.m4a,.aac" 
                  multiple 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
            </label>
             <label className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-900 rounded-md transition-colors cursor-pointer group">
                <FolderOpen size={18} className="text-zinc-500 group-hover:text-cyan-400" />
                Import Folder
                <input
                  type="file"
                  {...({ webkitdirectory: "", mozdirectory: "", directory: "" } as any)}
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
            </label>
          </div>

          {/* Playlists */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t.playlists}</h3>
              <button
                onClick={() => setShowCreatePlaylist(true)}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-cyan-400 transition-colors"
                title={t.createPlaylist}
              >
                <Plus size={14} />
              </button>
            </div>

            {showCreatePlaylist && (
              <div className="px-2 py-2 bg-zinc-900 rounded-md space-y-2">
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newPlaylistName.trim()) {
                      createPlaylist(newPlaylistName.trim());
                    } else if (e.key === 'Escape') {
                      setShowCreatePlaylist(false);
                      setNewPlaylistName('');
                    }
                  }}
                  placeholder={t.playlistName}
                  className="w-full px-2 py-1 text-sm bg-zinc-800 text-white border border-zinc-700 rounded focus:outline-none focus:border-cyan-500"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => newPlaylistName.trim() && createPlaylist(newPlaylistName.trim())}
                    className="flex-1 px-2 py-1 text-xs bg-cyan-700 hover:bg-cyan-600 text-white rounded transition-colors"
                  >
                    {t.create}
                  </button>
                  <button
                    onClick={() => { setShowCreatePlaylist(false); setNewPlaylistName(''); }}
                    className="flex-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                  >
                    {t.cancel}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              {playlists.map(playlist => (
                <div
                  key={playlist.id}
                  className="flex items-center gap-2 group"
                >
                  {/* Playlist Cover */}
                  <label className="cursor-pointer shrink-0">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) updatePlaylistCover(playlist.id, file);
                      }}
                    />
                    <div className="w-8 h-8 rounded overflow-hidden bg-zinc-800 flex items-center justify-center hover:ring-2 hover:ring-cyan-500 transition-all group/cover">
                      {playlist.coverArtUrl ? (
                        <img src={playlist.coverArtUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon size={14} className="text-zinc-600 group-hover/cover:text-cyan-400" />
                      )}
                    </div>
                  </label>

                  <button
                    onClick={() => {
                      setSelectedPlaylist(playlist.id);
                      setViewMode(ViewMode.LIST);
                    }}
                    className={`flex-1 flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors text-left ${
                      selectedPlaylist === playlist.id
                        ? 'bg-zinc-900 text-cyan-400'
                        : 'text-zinc-300 hover:bg-zinc-900'
                    }`}
                  >
                    <span className="flex-1 truncate">{playlist.name}</span>
                    <span className="text-xs text-zinc-600">
                      {playlist.trackIds.length}
                    </span>
                  </button>
                  <button
                    onClick={() => deletePlaylist(playlist.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-800 rounded text-zinc-600 hover:text-red-400 transition-all"
                    title={t.deletePlaylist}
                  >
                    <Plus size={14} className="rotate-45" />
                  </button>
                </div>
              ))}

              {playlists.length === 0 && !showCreatePlaylist && (
                <p className="px-3 py-2 text-xs text-zinc-600">
                  No playlists yet. Click + to create one.
                </p>
              )}
            </div>
          </div>

          {/* Chapter Markers */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t.chapterMarkers}</h3>
              <span className="text-[10px] text-zinc-600">Right-click seek bar</span>
            </div>

            <div className="space-y-1">
              {getCurrentTrackMarkers().map(marker => (
                <div key={marker.id} className="flex items-center gap-1 group px-2">
                  {editingMarkerId === marker.id ? (
                    <input
                      type="text"
                      value={editingMarkerLabel}
                      onChange={(e) => setEditingMarkerLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          updateMarkerLabel(marker.id, editingMarkerLabel);
                        } else if (e.key === 'Escape') {
                          setEditingMarkerId(null);
                          setEditingMarkerLabel('');
                        }
                      }}
                      onBlur={() => updateMarkerLabel(marker.id, editingMarkerLabel)}
                      className="flex-1 px-2 py-1 text-xs bg-zinc-800 text-white border border-cyan-500 rounded focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => jumpToMarker(marker.timestamp)}
                      onDoubleClick={() => startEditingMarker(marker)}
                      className="flex-1 flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 rounded transition-colors text-left"
                    >
                      <div className="w-2 h-2 bg-yellow-500 rounded-full shrink-0" />
                      <span className="flex-1 truncate">{marker.label}</span>
                      <span className="text-zinc-600 font-mono text-[10px]">
                        {formatTime(marker.timestamp)}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => deleteMarker(marker.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-800 rounded text-zinc-600 hover:text-red-400 transition-all"
                    title="Delete Marker"
                  >
                    <Plus size={12} className="rotate-45" />
                  </button>
                </div>
              ))}

              {currentTrack && getCurrentTrackMarkers().length === 0 && (
                <p className="px-3 py-2 text-xs text-zinc-600">
                  No markers yet. Right-click on the seek bar to add one.
                </p>
              )}

              {!currentTrack && (
                <p className="px-3 py-2 text-xs text-zinc-600">
                  Play a track to add markers.
                </p>
              )}
            </div>
          </div>

          {/* Library Info */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2">{t.libraryInfo}</h3>
            <div className="px-3 py-2 text-xs text-zinc-600 space-y-1">
              <p className="flex items-center gap-2">
                <span className="text-zinc-500">{tracks.length} {t.tracksInLibrary}</span>
              </p>
            </div>
          </div>
        </aside>

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
                           Double-tap L/R to skip • Swipe to change track • Hold for 2x
                        </p>
                    </div>
                ) : (
                    <div className="text-zinc-500 flex flex-col items-center gap-2">
                        <BarChart2 size={48} className="opacity-20" />
                        <p>Play a track to start</p>
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
             <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                 <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-2xl w-full max-w-md">
                     <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                         <Globe size={20} className="text-cyan-500" />
                         Open Network Stream
                     </h3>
                     <p className="text-xs text-zinc-500 mb-4">
                         Paste any YouTube link - just like listening on YouTube, but ad-free and privacy-focused. Also works with direct audio URLs.
                     </p>
                     <div className="relative mb-4">
                        <input 
                            type="text"
                            value={networkUrl}
                            onChange={(e) => setNetworkUrl(e.target.value)}
                            placeholder="https://youtube.com/watch?v=... or .mp3 link"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-4 pr-4 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                            autoFocus
                            disabled={isLoadingStream}
                        />
                     </div>
                     <div className="flex justify-end gap-2">
                         <button 
                            onClick={() => setShowNetworkStream(false)}
                            className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
                            disabled={isLoadingStream}
                         >
                             Cancel
                         </button>
                         <button 
                            onClick={addNetworkStream}
                            className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isLoadingStream}
                         >
                             {isLoadingStream ? (
                                 <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Resolving...
                                 </>
                             ) : (
                                 'Open Stream'
                             )}
                         </button>
                     </div>
                 </div>
             </div>
          )}

          {/* Sleep Timer Modal */}
          {showSleepTimer && (
             <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                 <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-2xl w-full max-w-md">
                     <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                         <Timer size={20} className="text-cyan-500" />
                         Sleep Timer
                     </h3>

                     {sleepTimerMinutes ? (
                       <div className="space-y-4">
                         <div className="text-center">
                           <p className="text-sm text-zinc-400 mb-2">Timer Active</p>
                           <p className="text-4xl font-bold text-cyan-400 font-mono">{getRemainingTime()}</p>
                           <p className="text-xs text-zinc-600 mt-2">Playback will pause when timer ends</p>
                         </div>
                         <button
                           onClick={() => {
                             clearSleepTimer();
                             addToast('Sleep timer cancelled');
                           }}
                           className="w-full px-4 py-3 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                         >
                           <X size={16} />
                           Cancel Timer
                         </button>
                       </div>
                     ) : (
                       <>
                         <p className="text-xs text-zinc-500 mb-4">
                           Automatically pause playback after a set time. Perfect for falling asleep!
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
                           Close
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
          onPlayTrack={playTrack}
          addToast={addToast}
        />
      )}
    </div>
  );
}

export default App;
