import { useState, useEffect, useCallback, useRef } from 'react';
import { Playlist } from '../types';
import { savePlaylists, loadPlaylists } from '../utils/persistence';
import { generateId, readFileAsDataURL } from '../utils/audio';

interface UsePlaylistsOptions {
  addToast: (message: string, type?: 'info' | 'error') => void;
}

export function usePlaylists({ addToast }: UsePlaylistsOptions) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null); // null = "All Tracks"
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const loadedRef = useRef(false);

  useEffect(() => {
    loadPlaylists()
      .then(saved => {
        setPlaylists(prev => [...saved, ...prev.filter(p => !saved.some(s => s.id === p.id))]);
        loadedRef.current = true;
      })
      .catch(err => console.error('Failed to load playlists', err));
  }, []);

  // Persist after the initial load so an empty initial state never overwrites saved data
  useEffect(() => {
    if (!loadedRef.current) return;
    savePlaylists(playlists).catch(err => console.error('Failed to save playlists', err));
  }, [playlists]);

  const createPlaylist = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPlaylists(prev => [...prev, { id: generateId(), name: trimmed, trackIds: [], createdAt: Date.now() }]);
    setNewPlaylistName('');
    setShowCreatePlaylist(false);
    addToast(`Playlist "${trimmed}" created`);
  }, [addToast]);

  /** Create a playlist that already contains tracks (e.g. a saved shared playlist). */
  const createPlaylistWithTracks = useCallback((name: string, trackIds: string[]) => {
    setPlaylists(prev => [...prev, { id: generateId(), name, trackIds, createdAt: Date.now() }]);
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    const playlist = playlists.find(p => p.id === id);
    setPlaylists(prev => prev.filter(p => p.id !== id));
    setSelectedPlaylist(prev => (prev === id ? null : prev));
    addToast(`Playlist "${playlist?.name ?? 'Item'}" deleted`);
  }, [playlists, addToast]);

  const addTrackToPlaylist = useCallback((trackId: string, playlistId: string) => {
    setPlaylists(prev => prev.map(p =>
      p.id === playlistId && !p.trackIds.includes(trackId)
        ? { ...p, trackIds: [...p.trackIds, trackId] }
        : p
    ));
    addToast('Track added to playlist');
  }, [addToast]);

  const removeTrackFromPlaylist = useCallback((trackId: string, playlistId: string) => {
    setPlaylists(prev => prev.map(p =>
      p.id === playlistId ? { ...p, trackIds: p.trackIds.filter(id => id !== trackId) } : p
    ));
    addToast('Track removed from playlist');
  }, [addToast]);

  /** Drop a deleted track from every playlist. */
  const purgeTrack = useCallback((trackId: string) => {
    setPlaylists(prev =>
      prev.some(p => p.trackIds.includes(trackId))
        ? prev.map(p => ({ ...p, trackIds: p.trackIds.filter(id => id !== trackId) }))
        : prev
    );
  }, []);

  const updatePlaylistCover = useCallback(async (playlistId: string, imageFile: File) => {
    try {
      const coverArtUrl = await readFileAsDataURL(imageFile);
      setPlaylists(prev => prev.map(p => (p.id === playlistId ? { ...p, coverArtUrl } : p)));
      addToast('Playlist cover updated');
    } catch {
      addToast('Failed to read image', 'error');
    }
  }, [addToast]);

  return {
    playlists,
    selectedPlaylist,
    setSelectedPlaylist,
    showCreatePlaylist,
    setShowCreatePlaylist,
    newPlaylistName,
    setNewPlaylistName,
    createPlaylist,
    createPlaylistWithTracks,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    purgeTrack,
    updatePlaylistCover,
  };
}
