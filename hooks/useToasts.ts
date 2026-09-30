import { useState, useCallback, useRef } from 'react';

export interface Toast {
  id: number;
  message: string;
  type: 'error' | 'info';
}

const TOAST_MS = 4000;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const addToast = useCallback((message: string, type: 'error' | 'info' = 'info') => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { message, type, id }]);
    setTimeout(() => setToasts(prev => prev.filter(toast => toast.id !== id)), TOAST_MS);
  }, []);
  return { toasts, addToast };
}
