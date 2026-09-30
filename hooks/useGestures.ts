import React, { useState, useRef, RefObject } from 'react';

interface UseGesturesProps {
  enabled: boolean; // gestures only apply in the visualizer view
  audioRef: RefObject<HTMLAudioElement>;
  speed: number; // chosen practice speed to return to after holding for 2x
  setPlaybackRate: (rate: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onSkip: (seconds: number) => void;
  onTogglePlay: () => void;
  isPlaying: boolean;
  skipSeconds: number;
  labels: { previous: string; next: string; play: string; pause: string };
}

/**
 * Visualizer gestures: hold for 2x speed, swipe to change track, double-tap the left/right
 * third to skip and the centre to play/pause.
 */
export function useGestures({
  enabled, audioRef, speed, setPlaybackRate, onPrev, onNext, onSkip, onTogglePlay, isPlaying, skipSeconds, labels,
}: UseGesturesProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [holdingFast, setHoldingFast] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<number | null>(null);

  const showFeedback = (text: string) => {
    setFeedback(text);
    setTimeout(() => setFeedback(null), 800);
  };

  const speedUpStart = () => {
    if (audioRef.current && audioRef.current.playbackRate !== 2) setPlaybackRate(2);
    setHoldingFast(true);
  };

  const speedUpEnd = () => {
    if (audioRef.current && audioRef.current.playbackRate !== speed) setPlaybackRate(speed);
    setHoldingFast(false);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
    holdTimeoutRef.current = window.setTimeout(() => {
      speedUpStart();
      holdTimeoutRef.current = null;
    }, 250);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    speedUpEnd();

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
        onPrev();
        showFeedback(labels.previous);
      } else {
        onNext();
        showFeedback(labels.next);
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
          onSkip(-skipSeconds);
          showFeedback(`-${skipSeconds}s`);
        } else if (endX > width * 0.7) {
          onSkip(skipSeconds);
          showFeedback(`+${skipSeconds}s`);
        } else {
          onTogglePlay();
          showFeedback(isPlaying ? labels.pause : labels.play);
        }
        lastTapRef.current = null;
      } else {
        lastTapRef.current = now;
      }
    }
  };

  const handlers = enabled
    ? { onMouseDown: speedUpStart, onMouseUp: speedUpEnd, onMouseLeave: speedUpEnd, onTouchStart, onTouchEnd }
    : {};

  return { feedback, holdingFast, handlers };
}
