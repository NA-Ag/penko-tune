import { useState, useEffect, useCallback, useRef } from 'react';
import { ChapterMarker } from '../types';
import { saveMarkers, loadMarkers } from '../utils/persistence';
import { generateId } from '../utils/audio';
import { tr } from '../utils/i18n';

interface UseChapterMarkersOptions {
  addToast: (message: string, type?: 'info' | 'error') => void;
}

export function useChapterMarkers({ addToast }: UseChapterMarkersOptions) {
  const [markers, setMarkers] = useState<ChapterMarker[]>([]);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [editingMarkerLabel, setEditingMarkerLabel] = useState('');
  const loadedRef = useRef(false);

  useEffect(() => {
    loadMarkers()
      .then(saved => {
        setMarkers(prev => [...saved, ...prev.filter(m => !saved.some(s => s.id === m.id))]);
        loadedRef.current = true;
      })
      .catch(err => console.error('Failed to load markers', err));
  }, []);

  // Persist after the initial load so an empty initial state never overwrites saved data
  useEffect(() => {
    if (!loadedRef.current) return;
    saveMarkers(markers).catch(err => console.error('Failed to save markers', err));
  }, [markers]);

  const addMarker = useCallback((trackId: string, timestamp: number, label?: string) => {
    setMarkers(prev => {
      const count = prev.filter(m => m.trackId === trackId).length;
      return [...prev, { id: generateId(), trackId, timestamp, label: label || tr('markerDefaultLabel', { count: count + 1 }) }];
    });
    addToast(tr('toastMarkerAdded'));
  }, [addToast]);

  const deleteMarker = useCallback((id: string) => {
    setMarkers(prev => prev.filter(m => m.id !== id));
    addToast(tr('toastMarkerDeleted'));
  }, [addToast]);

  /** Drop all markers belonging to a deleted track. */
  const purgeTrack = useCallback((trackId: string) => {
    setMarkers(prev => (prev.some(m => m.trackId === trackId) ? prev.filter(m => m.trackId !== trackId) : prev));
  }, []);

  const updateMarkerLabel = useCallback((id: string, label: string) => {
    // Enter commits and unmounts the input, which then also fires blur; only commit once
    if (editingMarkerId !== id) return;
    const trimmed = label.trim();
    if (trimmed) {
      setMarkers(prev => prev.map(m => (m.id === id ? { ...m, label: trimmed } : m)));
    }
    setEditingMarkerId(null);
    setEditingMarkerLabel('');
  }, [editingMarkerId]);

  return {
    markers,
    editingMarkerId,
    editingMarkerLabel,
    setEditingMarkerId,
    setEditingMarkerLabel,
    addMarker,
    deleteMarker,
    purgeTrack,
    updateMarkerLabel,
  };
}
