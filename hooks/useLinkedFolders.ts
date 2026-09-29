import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Track, LinkedFolder } from '../types';
import { loadFolders, saveFolders } from '../utils/persistence';
import { pickMusicFolder, walkAudioFiles, hasFolderPermission, requestFolderPermission } from '../utils/folders';
import { generateId } from '../utils/audio';

interface UseLinkedFoldersProps {
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  libraryLoaded: boolean;
  addToast: (message: string, type?: 'error' | 'info') => void;
}

export function useLinkedFolders({ tracks, setTracks, libraryLoaded, addToast }: UseLinkedFoldersProps) {
  const [folders, setFolders] = useState<LinkedFolder[]>([]);
  const [disconnectedIds, setDisconnectedIds] = useState<string[]>([]);
  const [scanningIds, setScanningIds] = useState<string[]>([]);
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  /**
   * Re-read a folder: refresh file access for known tracks (matched by relative path, so
   * tags, playlists and markers survive), add new files and drop ones that were deleted.
   */
  const syncFolder = useCallback(async (folder: LinkedFolder) => {
    setScanningIds(prev => [...prev, folder.id]);
    try {
      const found = new Map<string, { handle: FileSystemFileHandle; file: File }>();
      for await (const { handle, relativePath } of walkAudioFiles(folder.handle)) {
        try {
          found.set(relativePath, { handle, file: await handle.getFile() });
        } catch {
          // unreadable file (e.g. removed mid-scan)
        }
      }

      const known = new Map(
        tracksRef.current.filter(t => t.folderId === folder.id).map(t => [t.relativePath!, t])
      );
      const refreshed = new Map<string, Track>(); // by track id
      const added: Track[] = [];
      for (const [relativePath, { handle, file }] of found) {
        const existing = known.get(relativePath);
        const url = URL.createObjectURL(file); // references the file on disk; nothing is copied
        if (existing) {
          refreshed.set(existing.id, { ...existing, file, url, fileHandle: handle });
        } else {
          added.push({
            id: generateId(),
            name: file.name.replace(/\.[^/.]+$/, ''),
            artist: 'Local File',
            type: 'local',
            file,
            url,
            fileHandle: handle,
            folderId: folder.id,
            relativePath,
            addedAt: Date.now(),
            tagsRead: false,
          });
        }
      }
      const removed = [...known.values()].filter(t => !found.has(t.relativePath!)).length;

      setTracks(prev => [
        ...prev
          .filter(t => t.folderId !== folder.id || refreshed.has(t.id))
          .map(t => {
            const next = refreshed.get(t.id);
            if (!next) return t;
            if (t.url.startsWith('blob:')) URL.revokeObjectURL(t.url);
            return next;
          }),
        ...added,
      ]);
      setDisconnectedIds(prev => prev.filter(id => id !== folder.id));
      return { added: added.length, removed };
    } finally {
      setScanningIds(prev => prev.filter(id => id !== folder.id));
    }
  }, [setTracks]);

  // Restore linked folders once the library is loaded. Chrome may keep permission across
  // visits ("allow on every visit"); otherwise the user reconnects with one click.
  useEffect(() => {
    if (!libraryLoaded) return;
    let cancelled = false;
    loadFolders().then(async saved => {
      if (cancelled) return;
      setFolders(saved);
      const needsPermission: string[] = [];
      for (const folder of saved) {
        if (await hasFolderPermission(folder.handle)) syncFolder(folder);
        else needsPermission.push(folder.id);
      }
      if (!cancelled) setDisconnectedIds(needsPermission);
    }).catch(err => console.error('[Folders] Failed to load linked folders', err));
    return () => { cancelled = true; };
  }, [libraryLoaded, syncFolder]);

  const persist = (next: LinkedFolder[]) => {
    setFolders(next);
    saveFolders(next).catch(err => console.error('[Folders] Failed to save', err));
  };

  const linkFolder = useCallback(async () => {
    let handle: FileSystemDirectoryHandle;
    try {
      handle = await pickMusicFolder();
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') addToast('Could not open that folder', 'error');
      return;
    }
    for (const folder of folders) {
      if (await folder.handle.isSameEntry(handle)) {
        addToast(`"${handle.name}" is already linked`);
        return;
      }
    }
    const folder: LinkedFolder = { id: generateId(), name: handle.name, handle, addedAt: Date.now() };
    persist([...folders, folder]);
    addToast(`Scanning "${folder.name}"...`);
    const { added } = await syncFolder(folder);
    addToast(`Linked "${folder.name}": ${added} track${added !== 1 ? 's' : ''}`);
  }, [folders, syncFolder, addToast]);

  /** Ask for access to every disconnected folder (call from a click). */
  const reconnectFolders = useCallback(async () => {
    let connected = 0;
    for (const folder of folders.filter(f => disconnectedIds.includes(f.id))) {
      if (await requestFolderPermission(folder.handle)) {
        await syncFolder(folder);
        connected++;
      }
    }
    if (connected) addToast(`Reconnected ${connected} folder${connected !== 1 ? 's' : ''}`);
    return connected > 0;
  }, [folders, disconnectedIds, syncFolder, addToast]);

  const rescanFolder = useCallback(async (id: string) => {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    if (!(await hasFolderPermission(folder.handle)) && !(await requestFolderPermission(folder.handle))) return;
    const { added, removed } = await syncFolder(folder);
    addToast(`"${folder.name}": ${added} added, ${removed} removed`);
  }, [folders, syncFolder, addToast]);

  /** Stop tracking a folder. Its files on disk are untouched. */
  const unlinkFolder = useCallback((id: string) => {
    const folder = folders.find(f => f.id === id);
    setTracks(prev => prev.filter(t => {
      if (t.folderId !== id) return true;
      if (t.url.startsWith('blob:')) URL.revokeObjectURL(t.url);
      return false;
    }));
    persist(folders.filter(f => f.id !== id));
    setDisconnectedIds(prev => prev.filter(x => x !== id));
    if (folder) addToast(`Unlinked "${folder.name}" (files on disk are untouched)`);
  }, [folders, setTracks, addToast]);

  return {
    folders,
    disconnectedIds,
    scanningIds,
    linkFolder,
    reconnectFolders,
    rescanFolder,
    unlinkFolder,
  };
}
