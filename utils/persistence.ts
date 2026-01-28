// IndexedDB utilities for optional music library persistence

const DB_NAME = 'penko-tune-library';
const TRACK_STORE_NAME = 'tracks';
const PLAYLIST_STORE_NAME = 'playlists';
const MARKER_STORE_NAME = 'markers';
const DB_VERSION = 3;

interface StoredTrack {
  id: string;
  name: string;
  artist?: string;
  album?: string;
  duration?: number;
  type: 'local' | 'stream';
  coverArtUrl?: string;
  fileBlob?: Blob;
  streamUrl?: string;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(TRACK_STORE_NAME)) {
        db.createObjectStore(TRACK_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PLAYLIST_STORE_NAME)) {
        db.createObjectStore(PLAYLIST_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(MARKER_STORE_NAME)) {
        db.createObjectStore(MARKER_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

const waitForTx = (tx: IDBTransaction): Promise<void> => {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const saveTracksToIndexedDB = async (tracks: any[]): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(TRACK_STORE_NAME, 'readwrite');
    const store = tx.objectStore(TRACK_STORE_NAME);

    // Clear old tracks
    await store.clear();

    // Save new tracks
    for (const track of tracks) {
      const storedTrack: StoredTrack = {
        id: track.id,
        name: track.name,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        type: track.type,
        coverArtUrl: track.coverArtUrl,
        fileBlob: track.file, // Store the File/Blob object
        streamUrl: track.type === 'stream' ? track.url : undefined
      };

      await store.add(storedTrack);
    }

    await waitForTx(tx);
    db.close();
  } catch (error) {
    console.error('Failed to save tracks to IndexedDB:', error);
    throw error;
  }
};

export const loadTracksFromIndexedDB = async (): Promise<any[]> => {
  try {
    const db = await openDB();
    const tx = db.transaction(TRACK_STORE_NAME, 'readonly');
    const store = tx.objectStore(TRACK_STORE_NAME);

    const storedTracks = await new Promise<StoredTrack[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();

    console.log(`[Persistence] Loading ${storedTracks.length} tracks from IndexedDB...`);

    // Reconstruct Track objects with fresh blob URLs
    const tracks = storedTracks.map((stored, index) => {
      // Use the stored ID to maintain playlist references
      const trackId = stored.id;

      if (stored.type === 'local' && stored.fileBlob) {
        const blob = stored.fileBlob;

        // Determine MIME type
        let mimeType = blob.type;
        if (!mimeType || mimeType === '') {
          const ext = stored.name.split('.').pop()?.toLowerCase();
          const mimeTypes: Record<string, string> = {
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
            'flac': 'audio/flac',
            'm4a': 'audio/mp4',
            'aac': 'audio/aac',
            'webm': 'audio/webm'
          };
          mimeType = mimeTypes[ext || 'mp3'] || 'audio/mpeg';
        }

        // Create a fresh Blob with correct MIME type
        const freshBlob = new Blob([blob], { type: mimeType });

        // Create File from Blob
        const file = new File([freshBlob], stored.name, {
          type: mimeType,
          lastModified: Date.now()
        });

        // Create blob URL immediately - same as when first adding files
        const blobUrl = URL.createObjectURL(file);

        console.log(`[Persistence] Loaded: ${stored.name} | Type: ${mimeType} | Size: ${blob.size} bytes`);
        console.log(`[Persistence] -> Created blob URL: ${blobUrl}`);

        return {
          id: trackId,
          name: stored.name,
          artist: stored.artist || 'Local File',
          album: stored.album,
          duration: stored.duration,
          type: 'local' as const,
          file: file,
          url: blobUrl, // Same as when adding files - create blob URL from File
          coverArtUrl: stored.coverArtUrl
        };
      } else if (stored.type === 'stream' && stored.streamUrl) {
        console.log(`[Persistence] Loaded stream: ${stored.name}`);
        return {
          id: trackId,
          name: stored.name,
          artist: stored.artist,
          album: stored.album,
          duration: stored.duration,
          type: 'stream' as const,
          url: stored.streamUrl,
          coverArtUrl: stored.coverArtUrl
        };
      }
      return null;
    }).filter(Boolean);

    console.log(`[Persistence] Successfully loaded ${tracks.length} tracks`);
    return tracks;
  } catch (error) {
    console.error('Failed to load tracks from IndexedDB:', error);
    throw error;
  }
};

export const clearLibrary = async (): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(TRACK_STORE_NAME, 'readwrite');
    await tx.objectStore(TRACK_STORE_NAME).clear();
    await waitForTx(tx);
    db.close();
  } catch (error) {
    console.error('Failed to clear library:', error);
    throw error;
  }
};

export const getLibrarySize = async (): Promise<number> => {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    }
    return 0;
  } catch {
    return 0;
  }
};

export const isPersistenceEnabled = (): boolean => {
  return localStorage.getItem('persistence-enabled') === 'true';
};

export const setPersistenceEnabled = (enabled: boolean): void => {
  localStorage.setItem('persistence-enabled', enabled.toString());
};

// EQ Persistence
export const saveEQSettings = (bands: any[]): void => {
  try {
    localStorage.setItem('eq-settings', JSON.stringify(bands));
  } catch (error) {
    console.error('Failed to save EQ settings:', error);
  }
};

export const loadEQSettings = (): any[] | null => {
  try {
    const saved = localStorage.getItem('eq-settings');
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error('Failed to load EQ settings:', error);
    return null;
  }
};

// EQ Presets
interface EQPreset {
  name: string;
  bands: any[];
}

export const saveEQPreset = (name: string, bands: any[]): void => {
  try {
    const presets = loadEQPresets();
    presets[name] = bands;
    localStorage.setItem('eq-presets', JSON.stringify(presets));
  } catch (error) {
    console.error('Failed to save EQ preset:', error);
  }
};

export const loadEQPresets = (): Record<string, any[]> => {
  try {
    const saved = localStorage.getItem('eq-presets');
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error('Failed to load EQ presets:', error);
    return {};
  }
};

export const deleteEQPreset = (name: string): void => {
  try {
    const presets = loadEQPresets();
    delete presets[name];
    localStorage.setItem('eq-presets', JSON.stringify(presets));
  } catch (error) {
    console.error('Failed to delete EQ preset:', error);
  }
};

// Built-in EQ presets
export const getBuiltInPresets = (): Record<string, any[]> => {
  return {
    'Flat': [
      { frequency: 60, gain: 0 },
      { frequency: 170, gain: 0 },
      { frequency: 310, gain: 0 },
      { frequency: 600, gain: 0 },
      { frequency: 1000, gain: 0 },
      { frequency: 3000, gain: 0 },
      { frequency: 6000, gain: 0 },
      { frequency: 12000, gain: 0 },
      { frequency: 14000, gain: 0 },
      { frequency: 16000, gain: 0 }
    ],
    'Bass Boost': [
      { frequency: 60, gain: 8 },
      { frequency: 170, gain: 6 },
      { frequency: 310, gain: 3 },
      { frequency: 600, gain: 0 },
      { frequency: 1000, gain: 0 },
      { frequency: 3000, gain: 0 },
      { frequency: 6000, gain: 0 },
      { frequency: 12000, gain: 0 },
      { frequency: 14000, gain: 0 },
      { frequency: 16000, gain: 0 }
    ],
    'Treble Boost': [
      { frequency: 60, gain: 0 },
      { frequency: 170, gain: 0 },
      { frequency: 310, gain: 0 },
      { frequency: 600, gain: 0 },
      { frequency: 1000, gain: 0 },
      { frequency: 3000, gain: 0 },
      { frequency: 6000, gain: 3 },
      { frequency: 12000, gain: 6 },
      { frequency: 14000, gain: 8 },
      { frequency: 16000, gain: 8 }
    ],
    'Vocal Boost': [
      { frequency: 60, gain: -2 },
      { frequency: 170, gain: -1 },
      { frequency: 310, gain: 2 },
      { frequency: 600, gain: 4 },
      { frequency: 1000, gain: 5 },
      { frequency: 3000, gain: 4 },
      { frequency: 6000, gain: 2 },
      { frequency: 12000, gain: 0 },
      { frequency: 14000, gain: 0 },
      { frequency: 16000, gain: 0 }
    ],
    'Classical': [
      { frequency: 60, gain: 0 },
      { frequency: 170, gain: 0 },
      { frequency: 310, gain: 0 },
      { frequency: 600, gain: 0 },
      { frequency: 1000, gain: 0 },
      { frequency: 3000, gain: -2 },
      { frequency: 6000, gain: -2 },
      { frequency: 12000, gain: 0 },
      { frequency: 14000, gain: 0 },
      { frequency: 16000, gain: 3 }
    ],
    'Rock': [
      { frequency: 60, gain: 6 },
      { frequency: 170, gain: 4 },
      { frequency: 310, gain: -2 },
      { frequency: 600, gain: -3 },
      { frequency: 1000, gain: -1 },
      { frequency: 3000, gain: 2 },
      { frequency: 6000, gain: 5 },
      { frequency: 12000, gain: 7 },
      { frequency: 14000, gain: 7 },
      { frequency: 16000, gain: 7 }
    ]
  };
};

// Playlist Persistence
export const savePlaylists = async (playlists: any[]): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(PLAYLIST_STORE_NAME, 'readwrite');
    const store = tx.objectStore(PLAYLIST_STORE_NAME);
    await store.clear();
    for (const playlist of playlists) {
      await store.add(playlist);
    }
    await waitForTx(tx);
    db.close();
  } catch (error) {
    console.error('Failed to save playlists to IndexedDB:', error);
  }
};

export const loadPlaylists = async (): Promise<any[]> => {
  try {
    const db = await openDB();
    const tx = db.transaction(PLAYLIST_STORE_NAME, 'readonly');
    const store = tx.objectStore(PLAYLIST_STORE_NAME);
    const playlists = await new Promise<any[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return playlists;
  } catch (error) {
    console.error('Failed to load playlists from IndexedDB:', error);
    return [];
  }
};

// Chapter Marker Persistence
export const saveMarkers = async (markers: any[]): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(MARKER_STORE_NAME, 'readwrite');
    const store = tx.objectStore(MARKER_STORE_NAME);
    await store.clear();
    for (const marker of markers) {
      await store.add(marker);
    }
    await waitForTx(tx);
    db.close();
  } catch (error) {
    console.error('Failed to save markers to IndexedDB:', error);
  }
};

export const loadMarkers = async (): Promise<any[]> => {
  try {
    const db = await openDB();
    const tx = db.transaction(MARKER_STORE_NAME, 'readonly');
    const store = tx.objectStore(MARKER_STORE_NAME);
    const markers = await new Promise<any[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return markers;
  } catch (error) {
    console.error('Failed to load markers from IndexedDB:', error);
    return [];
  }
};

// --- Backup & Restore ---

// Crypto Helpers
const deriveKey = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    } as Pbkdf2Params,
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

const encryptData = async (data: string, password: string) => {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    enc.encode(data)
  );
  
  return {
    iv: Array.from(iv),
    salt: Array.from(salt),
    data: Array.from(new Uint8Array(encrypted))
  };
};

const decryptData = async (encryptedObj: any, password: string): Promise<string> => {
  const salt = new Uint8Array(encryptedObj.salt);
  const iv = new Uint8Array(encryptedObj.iv);
  const data = new Uint8Array(encryptedObj.data);
  const key = await deriveKey(password, salt);
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    data
  );
  return new TextDecoder().decode(decrypted);
};

export const exportLibraryAsJSON = async (password?: string): Promise<string> => {
  try {
    const [tracks, playlists, markers, eqSettings, eqPresets] = await Promise.all([
      loadTracksFromIndexedDB(),
      loadPlaylists(),
      loadMarkers(),
      Promise.resolve(loadEQSettings()),
      Promise.resolve(loadEQPresets())
    ]);

    // Filter out local file blobs to keep the backup portable and small
    // We only keep metadata for local files, and full data for streams/P2P
    const portableTracks = tracks.map(t => {
      const { file, ...rest } = t; // Remove File object
      // If it's a local blob URL, we can't export it, so we mark it
      if (rest.type === 'local') {
        return { ...rest, url: '' }; // Clear blob URL as it's session-specific
      }
      return rest;
    });

    const backupData = {
      version: 1,
      timestamp: Date.now(),
      tracks: portableTracks,
      playlists,
      markers,
      eqSettings,
      eqPresets
    };

    const jsonString = JSON.stringify(backupData, null, 2);

    if (password) {
      const encrypted = await encryptData(jsonString, password);
      return JSON.stringify({
        isEncrypted: true,
        version: 1,
        payload: encrypted
      });
    }

    return jsonString;
  } catch (error) {
    console.error('Export failed:', error);
    throw new Error('Failed to export library');
  }
};

export const importLibraryFromJSON = async (jsonString: string, password?: string): Promise<void> => {
  try {
    let data = JSON.parse(jsonString);
    
    if (data.isEncrypted) {
      if (!password) throw new Error("PASSWORD_REQUIRED");
      try {
        const decryptedString = await decryptData(data.payload, password);
        data = JSON.parse(decryptedString);
      } catch (e) {
        throw new Error("INVALID_PASSWORD");
      }
    }
    
    if (!data.version || !data.tracks) {
      throw new Error('Invalid backup file format');
    }

    // Restore data
    // Note: We don't clear existing data, we merge/overwrite
    if (data.tracks.length > 0) await saveTracksToIndexedDB(data.tracks);
    if (data.playlists?.length > 0) await savePlaylists(data.playlists);
    if (data.markers?.length > 0) await saveMarkers(data.markers);
    
    if (data.eqSettings) saveEQSettings(data.eqSettings);
    if (data.eqPresets) localStorage.setItem('eq-presets', JSON.stringify(data.eqPresets));

    console.log('Library imported successfully');
  } catch (error) {
    console.error('Import failed:', error);
    throw error;
  }
};