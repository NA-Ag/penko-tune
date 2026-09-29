import { useState, useRef, useEffect, useCallback } from 'react';
import { Track, PlayerState, EQBand } from '../types';
import { loadEQSettings, saveEQSettings } from '../utils/persistence';
import { EQ_FREQUENCIES } from '../utils/audio';
import { loadPreferences, savePreferences } from '../utils/preferences';

interface UseAudioPlayerProps {
  onTrackEnd: () => void;
  onError: (message: string) => void;
}

interface AudioGraph {
  ctx: AudioContext;
  source: MediaElementAudioSourceNode;
  eqNodes: BiquadFilterNode[];
  analyser: AnalyserNode;
  splitter: ChannelSplitterNode;
  merger: ChannelMergerNode;
  invertGain: GainNode;
  broadcast?: MediaStreamAudioDestinationNode; // live output for "listen together"
}

/** Wire source -> EQ chain -> [karaoke] -> analyser -> destination. */
const connectGraph = (graph: AudioGraph, karaoke: boolean) => {
  const { ctx, source, eqNodes, analyser, splitter, merger, invertGain } = graph;
  [source, ...eqNodes, analyser, splitter, merger, invertGain].forEach(node => node.disconnect());

  let last: AudioNode = source;
  for (const node of eqNodes) {
    last.connect(node);
    last = node;
  }

  if (karaoke) {
    // Centre-channel cancellation: both outputs become L - R, which removes
    // anything panned dead centre (usually the lead vocal).
    last.connect(splitter);
    splitter.connect(merger, 0, 0);
    splitter.connect(merger, 0, 1);
    splitter.connect(invertGain, 1);
    invertGain.connect(merger, 0, 0);
    invertGain.connect(merger, 0, 1);
    last = merger;
  }

  last.connect(analyser);
  analyser.connect(ctx.destination);
  if (graph.broadcast) analyser.connect(graph.broadcast);
};

const defaultBands = (): EQBand[] => EQ_FREQUENCIES.map(frequency => ({ frequency, gain: 0 }));

export function useAudioPlayer({ onTrackEnd, onError }: UseAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null as unknown as HTMLAudioElement);
  if (!audioRef.current) {
    const { volume, isMuted } = loadPreferences();
    audioRef.current = new Audio();
    audioRef.current.volume = volume;
    audioRef.current.muted = isMuted;
  }
  const graphRef = useRef<AudioGraph | null>(null);

  // Keep the latest callbacks without re-binding audio listeners on every render
  const onTrackEndRef = useRef(onTrackEnd);
  const onErrorRef = useRef(onError);
  onTrackEndRef.current = onTrackEnd;
  onErrorRef.current = onError;

  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [eqBands, setEqBands] = useState<EQBand[]>(() => loadEQSettings() ?? defaultBands());
  const eqBandsRef = useRef(eqBands);
  eqBandsRef.current = eqBands;

  const [playerState, setPlayerState] = useState<PlayerState>(() => {
    const { volume, isMuted, isShuffle, repeatMode } = loadPreferences();
    return {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume,
      isMuted,
      isShuffle,
      repeatMode,
      playbackRate: 1,
      karaokeMode: false,
    };
  });

  const { volume, isMuted, isShuffle, repeatMode } = playerState;
  useEffect(() => {
    savePreferences({ volume, isMuted, isShuffle, repeatMode });
  }, [volume, isMuted, isShuffle, repeatMode]);
  const repeatModeRef = useRef(playerState.repeatMode);
  repeatModeRef.current = playerState.repeatMode;

  // --- Initialization (must run from a user gesture) ---
  const initAudioContext = useCallback((): AudioGraph => {
    if (graphRef.current) {
      if (graphRef.current.ctx.state === 'suspended') graphRef.current.ctx.resume();
      return graphRef.current;
    }

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new AudioCtx();

    const analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 256;

    const invertGain = ctx.createGain();
    invertGain.gain.value = -1;

    const eqNodes = EQ_FREQUENCIES.map((freq, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.4;
      filter.gain.value = eqBandsRef.current[i]?.gain ?? 0;
      return filter;
    });

    const graph: AudioGraph = {
      ctx,
      source: ctx.createMediaElementSource(audioRef.current),
      eqNodes,
      analyser: analyserNode,
      splitter: ctx.createChannelSplitter(2),
      merger: ctx.createChannelMerger(2),
      invertGain,
    };
    connectGraph(graph, false);

    graphRef.current = graph;
    setAnalyser(analyserNode);
    return graph;
  }, []);

  // --- Karaoke Mode Toggle ---
  const toggleKaraokeMode = useCallback(() => {
    const graph = initAudioContext();
    setPlayerState(prev => {
      const karaokeMode = !prev.karaokeMode;
      connectGraph(graph, karaokeMode);
      return { ...prev, karaokeMode };
    });
  }, [initAudioContext]);

  // --- Audio Event Listeners ---
  useEffect(() => {
    const audio = audioRef.current;
    audio.crossOrigin = 'anonymous';

    const updateTime = () => {
      setPlayerState(prev => ({
        ...prev,
        currentTime: audio.currentTime,
        duration: audio.duration || 0,
      }));
    };

    const handleEnded = () => {
      if (repeatModeRef.current === 'one') {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      } else {
        onTrackEndRef.current();
      }
    };

    const handleAudioError = () => {
      const error = audio.error;
      if (!error) return;
      console.error('Audio Error:', error);
      onErrorRef.current(
        error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
          ? 'Source not supported or blocked by CORS.'
          : `Playback Error: ${error.message}`
      );
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
    };

    const handlePlay = () => setPlayerState(prev => ({ ...prev, isPlaying: true }));
    const handlePause = () => setPlayerState(prev => ({ ...prev, isPlaying: false }));
    const handleRateChange = () => setPlayerState(prev => ({ ...prev, playbackRate: audio.playbackRate }));

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('durationchange', updateTime);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ratechange', handleRateChange);
    audio.addEventListener('error', handleAudioError);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('durationchange', updateTime);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ratechange', handleRateChange);
      audio.removeEventListener('error', handleAudioError);
    };
  }, []);

  // --- Apply + persist EQ whenever bands change (sliders, presets, reset) ---
  useEffect(() => {
    graphRef.current?.eqNodes.forEach((node, i) => {
      node.gain.value = eqBands[i]?.gain ?? 0;
    });
    saveEQSettings(eqBands);
  }, [eqBands]);

  // --- Controls ---
  const setSource = (track: Track) => {
    const audio = audioRef.current;
    if (audio.src !== track.url) audio.src = track.url;
  };

  const playTrack = useCallback((track: Track) => {
    initAudioContext();
    setSource(track);
    // Rejections (e.g. unsupported source) are reported by the 'error' listener
    audioRef.current.play().catch(() => {});
  }, [initAudioContext]);

  /** Load a track paused at `startAt` seconds (used to restore the last session). */
  const loadTrack = useCallback((track: Track, startAt = 0) => {
    const audio = audioRef.current;
    setSource(track);
    if (startAt > 0) {
      audio.addEventListener('loadedmetadata', () => {
        audio.currentTime = Math.min(startAt, audio.duration || startAt);
      }, { once: true });
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (audio.paused) {
      initAudioContext();
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [initAudioContext]);

  const pause = useCallback(() => audioRef.current.pause(), []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    setPlayerState(prev => ({ ...prev, isPlaying: false, currentTime: 0, duration: 0 }));
  }, []);

  const seek = useCallback((time: number) => {
    if (!isFinite(time)) return;
    const audio = audioRef.current;
    const max = isFinite(audio.duration) ? audio.duration : time;
    const clamped = Math.max(0, Math.min(time, max));
    audio.currentTime = clamped;
    setPlayerState(prev => ({ ...prev, currentTime: clamped }));
  }, []);

  const setVolume = useCallback((vol: number) => {
    const volume = Math.max(0, Math.min(1, vol));
    audioRef.current.volume = volume;
    audioRef.current.muted = false;
    setPlayerState(prev => ({ ...prev, volume, isMuted: false }));
  }, []);

  const toggleMute = useCallback(() => {
    const isMuted = !audioRef.current.muted;
    audioRef.current.muted = isMuted;
    setPlayerState(prev => ({ ...prev, isMuted }));
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    audioRef.current.playbackRate = rate;
  }, []);

  const handleEQChange = useCallback((index: number, gain: number) => {
    setEqBands(prev => prev.map((band, i) => (i === index ? { ...band, gain } : band)));
  }, []);

  const resetEQ = useCallback(() => setEqBands(defaultBands()), []);

  /** A live stream of exactly what's playing (after EQ/karaoke), for listen-together rooms. */
  const getOutputStream = useCallback((): MediaStream => {
    const graph = initAudioContext();
    if (!graph.broadcast) {
      graph.broadcast = graph.ctx.createMediaStreamDestination();
      graph.analyser.connect(graph.broadcast);
    }
    return graph.broadcast.stream;
  }, [initAudioContext]);

  return {
    audioRef,
    playerState,
    setPlayerState,
    analyser,
    eqBands,
    setEqBands,
    toggleKaraokeMode,
    playTrack,
    loadTrack,
    togglePlayPause,
    pause,
    stop,
    seek,
    setVolume,
    toggleMute,
    setPlaybackRate,
    handleEQChange,
    resetEQ,
    getOutputStream,
  };
}
