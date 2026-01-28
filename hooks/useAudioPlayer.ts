import { useState, useRef, useEffect, useCallback } from 'react';
import { Track, PlayerState, EQBand } from '../types';
import { loadEQSettings, saveEQSettings } from '../utils/persistence';

// Standard 10-Band EQ Frequencies
export const EQ_FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];

interface UseAudioPlayerProps {
  onTrackEnd: () => void;
  onError: (message: string) => void;
}

export function useAudioPlayer({ onTrackEnd, onError }: UseAudioPlayerProps) {
  // --- Refs ---
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  // Karaoke Mode Nodes
  const splitterRef = useRef<ChannelSplitterNode | null>(null);
  const mergerRef = useRef<ChannelMergerNode | null>(null);
  const invertGainRef = useRef<GainNode | null>(null);
  
  // EQ Nodes
  const eqNodesRef = useRef<BiquadFilterNode[]>([]);

  // --- State ---
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [eqBands, setEqBands] = useState<EQBand[]>(() => {
    const saved = loadEQSettings();
    return saved || EQ_FREQUENCIES.map(f => ({ frequency: f, gain: 0 }));
  });

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

  // --- Audio Event Listeners ---
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
            onTrackEnd();
        }
    };

    const handleAudioError = (e: Event) => {
        const target = e.target as HTMLAudioElement;
        if (target.error) {
             console.error("Audio Error:", target.error);
             if (target.error.code === 4) {
                 onError("Source not supported or blocked by CORS."); 
             } else {
                 onError(`Playback Error: ${target.error.message}`);
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
    audio.addEventListener('error', handleAudioError);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleAudioError);
    };
  }, [playerState.repeatMode, onTrackEnd, onError]);

  // --- Auto-save EQ settings ---
  useEffect(() => {
    saveEQSettings(eqBands);
  }, [eqBands]);

  // --- Controls ---
  const playTrack = async (track: Track) => {
    initAudioContext();
    
    // If it's a new track or we need to reload
    if (audioRef.current.src !== track.url) {
        audioRef.current.src = track.url;
        
        // Update Media Session API
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
    if (audioRef.current.paused) {
      initAudioContext();
      try {
        await audioRef.current.play();
      } catch (err) { }
    } else {
      audioRef.current.pause();
    }
  };

  const seek = (time: number) => {
    if (isFinite(time)) {
        audioRef.current.currentTime = time;
        setPlayerState(prev => ({ ...prev, currentTime: time }));
    }
  };

  const setVolume = (vol: number) => {
    audioRef.current.volume = vol;
    audioRef.current.muted = false;
    setPlayerState(prev => ({ ...prev, volume: vol, isMuted: false }));
  };

  const toggleMute = () => {
    const newMuted = !playerState.isMuted;
    audioRef.current.muted = newMuted;
    setPlayerState(prev => ({ ...prev, isMuted: newMuted }));
  };

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

  return {
    audioRef,
    playerState,
    setPlayerState,
    analyser,
    eqBands,
    setEqBands,
    initAudioContext,
    toggleKaraokeMode,
    playTrack,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    handleEQChange,
    resetEQ
  };
}