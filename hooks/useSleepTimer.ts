import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSleepTimerOptions {
  onTimerExpired: () => void;
  addToast: (message: string, type?: 'info' | 'error') => void;
}

export function useSleepTimer({ onTimerExpired, addToast }: UseSleepTimerOptions) {
  const [endTime, setEndTime] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const onExpiredRef = useRef(onTimerExpired);
  onExpiredRef.current = onTimerExpired;

  const startSleepTimer = useCallback((minutes: number) => {
    const ms = minutes * 60 * 1000;
    setEndTime(Date.now() + ms);
    setRemainingMs(ms);
    addToast(`Sleep timer set for ${minutes} minutes`);
  }, [addToast]);

  const cancelSleepTimer = useCallback(() => {
    setEndTime(null);
    addToast('Sleep timer cancelled');
  }, [addToast]);

  useEffect(() => {
    if (!endTime) return;

    const tick = () => {
      const remaining = endTime - Date.now();
      if (remaining <= 0) {
        setEndTime(null);
        setRemainingMs(0);
        onExpiredRef.current();
        addToast('Sleep timer expired. Playback paused.');
      } else {
        setRemainingMs(remaining);
      }
    };

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endTime, addToast]);

  return {
    isSleepTimerActive: endTime !== null,
    sleepTimerRemainingMs: remainingMs,
    startSleepTimer,
    cancelSleepTimer,
  };
}
