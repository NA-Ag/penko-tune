// Small UI/player preferences kept in localStorage (never leaves the device).
import type { PlayerState } from '../types';
import { VisualizerMode, ViewMode } from '../types';
import type { Language } from '../translations';
import { languageNames } from '../translations';

export type SortKey = 'added' | 'title' | 'artist' | 'album' | 'duration';

export interface Preferences {
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: PlayerState['repeatMode'];
  language: Language;
  viewMode: ViewMode;
  visualizerMode: VisualizerMode;
  sortKey: SortKey;
  lastTrackId: string | null;
  lastPosition: number;
  dismissedWarnings: Record<string, number>; // warning id -> when it was dismissed
}

const KEY = 'penko-preferences';

const detectLanguage = (): Language => {
  const code = navigator.language?.slice(0, 2).toLowerCase();
  return code && code in languageNames ? (code as Language) : 'en';
};

const defaults = (): Preferences => ({
  volume: 1,
  isMuted: false,
  isShuffle: false,
  repeatMode: 'off',
  language: detectLanguage(),
  viewMode: ViewMode.LIST,
  visualizerMode: VisualizerMode.BARS,
  sortKey: 'added',
  lastTrackId: null,
  lastPosition: 0,
  dismissedWarnings: {},
});

let cache: Preferences | null = null;

export const loadPreferences = (): Preferences => {
  if (cache) return cache;
  try {
    cache = { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    cache = defaults();
  }
  return cache!;
};

export const savePreferences = (patch: Partial<Preferences>): void => {
  cache = { ...loadPreferences(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage full or blocked (private mode) - preferences just won't persist
  }
};
