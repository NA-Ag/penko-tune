import { useState, useRef, useEffect, useCallback } from 'react';
import { Track, PlayerState, EQBand } from '../types';
import { loadEQSettings, saveEQSettings } from '../utils/persistence';
import { EQ_FREQUENCIES } from '../utils/audio';
import { loadPreferences, savePreferences } from '../utils/preferences';
import { tr } from '../utils/i18n';

// Two "decks" (audio elements) make gapless playback and crossfades possible: the next track
// is preloaded on the idle deck and started exactly as the current one ends (or fades in over
// it). Each deck has its own gain (fades + ReplayGain), then both feed one shared chain:
//
//   deck A ─ gain ─┐
//                  ├─ mixer ─ EQ ─ [karaoke] ─ analyser ─ speakers (+ listen-together stream)
//   deck B ─ gain ─┘

interface UseAudioPlayerProps {
  /** The track ended and nothing was preloaded: the app decides what happens next. */
  onTrackEnd: () => void;
  /** Playback moved on to the preloaded track by itself (gapless / crossfade). */
  onAdvance: (track: Track) => void;
  onError: (message: string) => void;
}

interface Deck {
  el: HTMLAudioElement;
  source?: MediaElementAudioSourceNode;
  gain?: GainNode;
  track: Track | null;
}

interface AudioGraph {
  ctx: AudioContext;
  mixer: GainNode;
  eqNodes: BiquadFilterNode[];
  analyser: AnalyserNode;
  splitter: ChannelSplitterNode;
  merger: ChannelMergerNode;
  invertGain: GainNode;
  broadcast?: MediaStreamAudioDestinationNode; // live output for "listen together"
}

export interface AudioSettings {
  crossfade: number; // seconds; 0 = gapless hand-off
  normalize: boolean; // apply ReplayGain from tags
}

export interface LoopRange {
  a: number;
  b: number | null; // null while waiting for the second point
}

const GAPLESS_LEAD = 0.04; // start the next track this many seconds before the end
const TICK_MS = 25;

/** Wire mixer -> EQ chain -> [karaoke] -> analyser -> destination. */
const connectGraph = (graph: AudioGraph, karaoke: boolean) => {
  const { ctx, mixer, eqNodes, analyser, splitter, merger, invertGain } = graph;
  [mixer, ...eqNodes, analyser, splitter, merger, invertGain].forEach(node => node.disconnect());

  let last: AudioNode = mixer;
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

const createDeck = (volume: number, muted: boolean): Deck => {
  const el = new Audio();
  el.crossOrigin = 'anonymous';
  el.preload = 'auto';
  el.volume = volume;
  el.muted = muted;
  // Speed changes keep the pitch (the default, but set explicitly for older engines)
  el.preservesPitch = true;
  (el as any).mozPreservesPitch = true;
  (el as any).webkitPreservesPitch = true;
  return { el, track: null };
};

export function useAudioPlayer({ onTrackEnd, onAdvance, onError }: UseAudioPlayerProps) {
  const decksRef = useRef<Deck[] | null>(null);
  if (!decksRef.current) {
    const { volume, isMuted } = loadPreferences();
    decksRef.current = [createDeck(volume, isMuted), createDeck(volume, isMuted)];
  }
  const decks = decksRef.current;
  const activeRef = useRef(0);
  const active = () => decks[activeRef.current];
  const idle = () => decks[1 - activeRef.current];
  /** Always the element that's currently audible. */
  const audioRef = useRef<HTMLAudioElement>(decks[0].el);

  const graphRef = useRef<AudioGraph | null>(null);
  const preloadedRef = useRef<Track | null>(null);
  const fadeUntilRef = useRef(0); // the idle deck is fading out until this time (ms)
  const transitioningRef = useRef(false);

  const onTrackEndRef = useRef(onTrackEnd);
  const onAdvanceRef = useRef(onAdvance);
  const onErrorRef = useRef(onError);
  onTrackEndRef.current = onTrackEnd;
  onAdvanceRef.current = onAdvance;
  onErrorRef.current = onError;

  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [eqBands, setEqBands] = useState<EQBand[]>(() => loadEQSettings() ?? defaultBands());
  const eqBandsRef = useRef(eqBands);
  eqBandsRef.current = eqBands;

  const [settings, setSettings] = useState<AudioSettings>(() => {
    const { crossfade, normalize } = loadPreferences();
    return { crossfade, normalize };
  });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [speed, setSpeedState] = useState(1); // chosen practice speed (the 2x hold gesture is temporary)
  const speedRef = useRef(1);
  const [loop, setLoopState] = useState<LoopRange | null>(null);
  const loopRef = useRef<LoopRange | null>(null);

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
  useEffect(() => {
    savePreferences(settings);
  }, [settings]);
  const repeatModeRef = useRef(playerState.repeatMode);
  repeatModeRef.current = playerState.repeatMode;

  /** The level a track should play at: its ReplayGain (if enabled and tagged), else unity. */
  const levelFor = (track: Track | null) => {
    if (!settingsRef.current.normalize || track?.gainDb == null) return 1;
    return Math.min(2, Math.max(0.05, Math.pow(10, track.gainDb / 20)));
  };

  const setGain = (deck: Deck, value: number, overSeconds = 0) => {
    const graph = graphRef.current;
    if (!deck.gain || !graph) return;
    const now = graph.ctx.currentTime;
    const param = deck.gain.gain;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    if (overSeconds > 0) param.linearRampToValueAtTime(value, now + overSeconds);
    else param.setValueAtTime(value, now);
  };

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
    const mixer = ctx.createGain();

    const eqNodes = EQ_FREQUENCIES.map((freq, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.4;
      filter.gain.value = eqBandsRef.current[i]?.gain ?? 0;
      return filter;
    });

    for (const deck of decks) {
      deck.source = ctx.createMediaElementSource(deck.el);
      deck.gain = ctx.createGain();
      deck.gain.gain.value = deck === active() ? levelFor(deck.track) : 0;
      deck.source.connect(deck.gain);
      deck.gain.connect(mixer);
    }

    const graph: AudioGraph = {
      ctx,
      mixer,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const clearLoop = () => {
    loopRef.current = null;
    setLoopState(null);
  };

  /** Hand playback to the preloaded track on the idle deck, optionally crossfading. */
  const advance = (fadeSeconds: number) => {
    const next = preloadedRef.current;
    const from = active();
    const to = idle();
    if (!next || to.track?.id !== next.id) return false;

    transitioningRef.current = true;
    to.el.currentTime = 0;
    to.el.playbackRate = speedRef.current;
    setGain(to, fadeSeconds > 0 ? 0 : levelFor(next));
    if (fadeSeconds > 0) setGain(to, levelFor(next), fadeSeconds);
    to.el.play().catch(() => {});

    activeRef.current = 1 - activeRef.current;
    audioRef.current = to.el;
    preloadedRef.current = null;
    clearLoop();

    setGain(from, 0, fadeSeconds);
    fadeUntilRef.current = Date.now() + fadeSeconds * 1000;
    setTimeout(() => {
      if (from !== active()) from.el.pause();
      transitioningRef.current = false;
    }, fadeSeconds * 1000 + 50);

    setPlayerState(prev => ({ ...prev, currentTime: 0, duration: to.el.duration || 0, isPlaying: true }));
    onAdvanceRef.current(next);
    return true;
  };

  // --- Audio Event Listeners (both decks; only the active one drives the UI) ---
  useEffect(() => {
    const cleanups = decks.map(deck => {
      const audio = deck.el;
      const isActive = () => deck === active();

      const updateTime = () => {
        if (!isActive()) return;
        setPlayerState(prev => ({ ...prev, currentTime: audio.currentTime, duration: audio.duration || 0 }));
      };

      const handleEnded = () => {
        if (!isActive() || transitioningRef.current) return;
        if (repeatModeRef.current === 'one') {
          audio.currentTime = 0;
          audio.play().catch(console.error);
        } else if (!advance(0)) {
          onTrackEndRef.current();
        }
      };

      const handleAudioError = () => {
        const error = audio.error;
        if (!error || !isActive()) return;
        console.error('Audio Error:', error);
        onErrorRef.current(
          error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
            ? tr('toastSourceUnsupported')
            : tr('toastPlaybackError', { message: error.message })
        );
        setPlayerState(prev => ({ ...prev, isPlaying: false }));
      };

      const handlePlay = () => isActive() && setPlayerState(prev => ({ ...prev, isPlaying: true }));
      const handlePause = () => isActive() && setPlayerState(prev => ({ ...prev, isPlaying: false }));
      const handleRateChange = () => isActive() && setPlayerState(prev => ({ ...prev, playbackRate: audio.playbackRate }));

      const events: [string, () => void][] = [
        ['timeupdate', updateTime],
        ['durationchange', updateTime],
        ['ended', handleEnded],
        ['play', handlePlay],
        ['pause', handlePause],
        ['ratechange', handleRateChange],
        ['error', handleAudioError],
      ];
      events.forEach(([name, fn]) => audio.addEventListener(name, fn));
      return () => events.forEach(([name, fn]) => audio.removeEventListener(name, fn));
    });
    return () => cleanups.forEach(fn => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Fine-grained clock while playing: A-B loop and the gapless/crossfade hand-off ---
  // (timeupdate only fires every ~250ms, far too coarse for either)
  useEffect(() => {
    if (!playerState.isPlaying) return;
    const interval = setInterval(() => {
      const el = active().el;
      const range = loopRef.current;
      if (range && range.b !== null) {
        if (el.currentTime >= range.b || el.currentTime < range.a - 0.5) el.currentTime = range.a;
        return; // never advance while looping
      }
      if (transitioningRef.current || !preloadedRef.current || repeatModeRef.current === 'one') return;
      if (!isFinite(el.duration) || el.duration <= 0) return;
      const remaining = (el.duration - el.currentTime) / (el.playbackRate || 1);
      const crossfade = Math.min(settingsRef.current.crossfade, el.duration / 3);
      if (remaining <= (crossfade > 0 ? crossfade : GAPLESS_LEAD)) advance(crossfade > 0 ? remaining : 0);
    }, TICK_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerState.isPlaying]);

  // --- Apply + persist EQ whenever bands change (sliders, presets, reset) ---
  useEffect(() => {
    graphRef.current?.eqNodes.forEach((node, i) => {
      node.gain.value = eqBands[i]?.gain ?? 0;
    });
    saveEQSettings(eqBands);
  }, [eqBands]);

  // Re-level the playing track when normalization is switched
  useEffect(() => {
    if (!transitioningRef.current) setGain(active(), levelFor(active().track), 0.3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.normalize]);

  // --- Controls ---
  /** Put a track on the active deck (cancelling any hand-off in progress). */
  const loadOnActive = (track: Track) => {
    const deck = active();
    const other = idle();
    if (transitioningRef.current || !other.el.paused) {
      other.el.pause();
      setGain(other, 0);
      transitioningRef.current = false;
    }
    if (deck.el.src !== track.url) deck.el.src = track.url;
    deck.track = track;
    deck.el.playbackRate = speedRef.current;
    setGain(deck, levelFor(track));
    clearLoop();
  };

  const playTrack = useCallback((track: Track) => {
    initAudioContext();
    loadOnActive(track);
    // Rejections (e.g. unsupported source) are reported by the 'error' listener
    active().el.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initAudioContext]);

  /** Load a track paused at `startAt` seconds (used to restore the last session). */
  const loadTrack = useCallback((track: Track, startAt = 0) => {
    loadOnActive(track);
    const audio = active().el;
    if (startAt > 0) {
      audio.addEventListener('loadedmetadata', () => {
        audio.currentTime = Math.min(startAt, audio.duration || startAt);
      }, { once: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Tell the engine what comes next so it can preload it on the idle deck.
   * Pass null when nothing should follow automatically (end of queue, or a track that
   * needs resolving first, like a magnet link).
   */
  const preloadNext = useCallback((track: Track | null) => {
    if (!track) {
      preloadedRef.current = null;
      return;
    }
    if (preloadedRef.current?.id === track.id && idle().el.src === track.url) return;
    const wait = fadeUntilRef.current - Date.now();
    if (wait > 0) {
      // The idle deck is still fading out the previous track; don't cut it off
      preloadedRef.current = null;
      setTimeout(() => preloadNext(track), wait + 60);
      return;
    }
    const deck = idle();
    deck.el.pause();
    setGain(deck, 0);
    deck.el.src = track.url;
    deck.el.load();
    deck.track = track;
    preloadedRef.current = track;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlayPause = useCallback(() => {
    const audio = active().el;
    if (audio.paused) {
      initAudioContext();
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initAudioContext]);

  const pause = useCallback(() => active().el.pause(), []);  // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => {
    for (const deck of decks) {
      deck.el.pause();
      deck.el.removeAttribute('src');
      deck.el.load();
      deck.track = null;
    }
    preloadedRef.current = null;
    clearLoop();
    setPlayerState(prev => ({ ...prev, isPlaying: false, currentTime: 0, duration: 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seek = useCallback((time: number) => {
    if (!isFinite(time)) return;
    const audio = active().el;
    const max = isFinite(audio.duration) ? audio.duration : time;
    const clamped = Math.max(0, Math.min(time, max));
    audio.currentTime = clamped;
    setPlayerState(prev => ({ ...prev, currentTime: clamped }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setVolume = useCallback((vol: number) => {
    const volume = Math.max(0, Math.min(1, vol));
    for (const deck of decks) {
      deck.el.volume = volume;
      deck.el.muted = false;
    }
    setPlayerState(prev => ({ ...prev, volume, isMuted: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = useCallback(() => {
    const isMuted = !active().el.muted;
    for (const deck of decks) deck.el.muted = isMuted;
    setPlayerState(prev => ({ ...prev, isMuted }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Temporary rate (the hold-for-2x gesture). Use setSpeed for the chosen practice speed. */
  const setPlaybackRate = useCallback((rate: number) => {
    active().el.playbackRate = rate;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Practice speed (pitch preserved). Stays in effect across tracks until changed. */
  const setSpeed = useCallback((rate: number) => {
    const clamped = Math.max(0.25, Math.min(2, Math.round(rate * 100) / 100));
    speedRef.current = clamped;
    setSpeedState(clamped);
    active().el.playbackRate = clamped;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A-B loop: first call sets A at the current time, second sets B, third clears. */
  const cycleLoop = useCallback(() => {
    const now = active().el.currentTime;
    const current = loopRef.current;
    let next: LoopRange | null;
    if (!current) next = { a: now, b: null };
    else if (current.b === null) next = now > current.a + 0.2 ? { a: current.a, b: now } : null;
    else next = null;
    loopRef.current = next;
    setLoopState(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Loop between two exact times (e.g. between chapter markers). */
  const setLoop = useCallback((range: LoopRange | null) => {
    loopRef.current = range;
    setLoopState(range);
    if (range) active().el.currentTime = range.a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSettings = useCallback((patch: Partial<AudioSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
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
    preloadNext,
    togglePlayPause,
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
    audioSettings: settings,
    updateAudioSettings: updateSettings,
    handleEQChange,
    resetEQ,
    getOutputStream,
  };
}
