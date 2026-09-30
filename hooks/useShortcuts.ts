import { useEffect, MutableRefObject } from 'react';

/** Player actions reachable from the keyboard and hardware/lock-screen media keys. */
export interface PlayerActions {
  togglePlayPause: () => void;
  playNext: () => void;
  playPrev: () => void;
  skip: (seconds: number) => void;
  nudgeVolume: (delta: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  focusSearch: () => void;
  stepSpeed: (direction: number) => void;
  cycleLoop: () => void;
}

export const noopActions: PlayerActions = {
  togglePlayPause: () => {}, playNext: () => {}, playPrev: () => {}, skip: () => {}, nudgeVolume: () => {},
  toggleMute: () => {}, toggleShuffle: () => {}, cycleRepeat: () => {}, focusSearch: () => {}, stepSpeed: () => {}, cycleLoop: () => {},
};

/**
 * Keyboard shortcuts and Media Session handlers. They read `actions.current` at call time,
 * so the listeners are registered once and never see stale state.
 */
export function useShortcuts(actions: MutableRefObject<PlayerActions>, skipSeconds: number) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const a = actions.current;
      const keys: Record<string, [() => void, boolean?]> = {
        ' ': [a.togglePlayPause, true],
        ArrowLeft: [() => a.skip(-skipSeconds), true],
        ArrowRight: [() => a.skip(skipSeconds), true],
        ArrowUp: [() => a.nudgeVolume(0.1), true],
        ArrowDown: [() => a.nudgeVolume(-0.1), true],
        m: [a.toggleMute],
        s: [a.toggleShuffle],
        r: [a.cycleRepeat],
        n: [a.playNext],
        p: [a.playPrev],
        '/': [a.focusSearch, true],
        '<': [() => a.stepSpeed(-1)],
        '>': [() => a.stepSpeed(1)],
        l: [a.cycleLoop],
      };
      const entry = keys[e.key];
      if (!entry) return;
      if (entry[1]) e.preventDefault();
      entry[0]();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions, skipSeconds]);

  // Lock screen / hardware media keys
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => actions.current.togglePlayPause()],
      ['pause', () => actions.current.togglePlayPause()],
      ['previoustrack', () => actions.current.playPrev()],
      ['nexttrack', () => actions.current.playNext()],
      ['seekbackward', () => actions.current.skip(-skipSeconds)],
      ['seekforward', () => actions.current.skip(skipSeconds)],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Unsupported action on this platform
      }
    }
  }, [actions, skipSeconds]);
}
