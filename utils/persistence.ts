// IndexedDB / localStorage persistence for the music library, playlists, markers and EQ.
import type { Track, Playlist, ChapterMarker, EQBand, LinkedFolder, OutgoingShare } from '../types';
import { EQ_FREQUENCIES } from './audio';

const DB_NAME = 'penko-tune-library';
const TRACK_STORE_NAME = 'tracks';
const PLAYLIST_STORE_NAME = 'playlists';
const MARKER_STORE_NAME = 'markers';
const FOLDER_STORE_NAME = 'folders';
const SHARE_STORE_NAME = 'shares';
const DB_VERSION = 4;

const STORES = [TRACK_STORE_NAME, PLAYLIST_STORE_NAME, MARKER_STORE_NAME, FOLDER_STORE_NAME, SHARE_STORE_NAME] as const;
type StoreName = typeof STORES[number];

// Everything except the runtime-only File/URL, which are rebuilt on load.
// Copied tracks keep the audio in `fileBlob`; linked tracks keep only `fileHandle`.
type StoredTrack = Omit<Track, 'file' | 'url'> & {
  fileBlob?: Blob;
  streamUrl?: string;
};

const MIME_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  webm: 'audio/webm',
};

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      }
    };
  });
};

/** Read every record from a store. */
const getAll = async <T>(storeName: StoreName): Promise<T[]> => {
  const db = await openDB();
  try {
    return await new Promise<T[]>((resolve, reject) => {
      const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
};

/**
 * Write records to a store in a single transaction.
 * With `replace`, the store is cleared first; because it is the same transaction,
 * a failed write rolls the clear back instead of leaving the store empty.
 */
const putAll = async <T>(storeName: StoreName, records: T[], replace: boolean): Promise<void> => {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      if (replace) store.clear();
      for (const record of records) store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
};

// --- Tracks ---

const toStoredTrack = ({ file, url, ...rest }: Track): StoredTrack => ({
  ...rest,
  // Never copy a linked file's audio into the browser: that is what linking avoids
  fileBlob: rest.fileHandle ? undefined : file,
  streamUrl: rest.type === 'stream' ? url : undefined,
});

const fromStoredTrack = ({ fileBlob, streamUrl, ...rest }: StoredTrack): Track | null => {
  if (rest.type === 'local' && fileBlob) {
    const ext = rest.name.split('.').pop()?.toLowerCase() ?? '';
    const mimeType = fileBlob.type || MIME_TYPES[ext] || 'audio/mpeg';
    const file = fileBlob instanceof File && fileBlob.type
      ? fileBlob
      : new File([fileBlob], rest.name, { type: mimeType, lastModified: Date.now() });

    return { ...rest, artist: rest.artist || 'Local File', file, url: URL.createObjectURL(file) };
  }

  // Linked: the file is re-read from disk once folder permission is (re)granted
  if (rest.type === 'local' && rest.fileHandle) {
    return { ...rest, url: '' };
  }

  // ipfs:// entries came from the removed IPFS catalog and can no longer be played
  if (rest.type === 'stream' && streamUrl && !streamUrl.startsWith('ipfs://')) {
    return { ...rest, url: streamUrl };
  }

  return null;
};

/** Replace the stored library with `tracks`. Tracks received through share links are skipped. */
export const saveTracksToIndexedDB = (tracks: Track[]): Promise<void> =>
  putAll(TRACK_STORE_NAME, tracks.filter(t => !t.incomingShareId).map(toStoredTrack), true);

/** Add or overwrite tracks without touching the rest of the library (used by imports). */
export const mergeTracksIntoIndexedDB = (tracks: Track[]): Promise<void> =>
  putAll(TRACK_STORE_NAME, tracks.map(toStoredTrack), false);

export const loadTracksFromIndexedDB = async (): Promise<Track[]> => {
  const storedTracks = await getAll<StoredTrack>(TRACK_STORE_NAME);
  return storedTracks.map(fromStoredTrack).filter((t): t is Track => t !== null);
};

// --- Playlists & Markers ---

export const savePlaylists = (playlists: Playlist[]): Promise<void> =>
  putAll(PLAYLIST_STORE_NAME, playlists, true);

export const loadPlaylists = (): Promise<Playlist[]> => getAll<Playlist>(PLAYLIST_STORE_NAME);

export const saveMarkers = (markers: ChapterMarker[]): Promise<void> =>
  putAll(MARKER_STORE_NAME, markers, true);

export const loadMarkers = (): Promise<ChapterMarker[]> => getAll<ChapterMarker>(MARKER_STORE_NAME);

export const mergePlaylists = (playlists: Playlist[]): Promise<void> =>
  putAll(PLAYLIST_STORE_NAME, playlists, false);

export const mergeMarkers = (markers: ChapterMarker[]): Promise<void> =>
  putAll(MARKER_STORE_NAME, markers, false);

// --- Linked folders & outgoing shares ---

export const loadFolders = (): Promise<LinkedFolder[]> => getAll<LinkedFolder>(FOLDER_STORE_NAME);
export const saveFolders = (folders: LinkedFolder[]): Promise<void> => putAll(FOLDER_STORE_NAME, folders, true);

export const loadShares = (): Promise<OutgoingShare[]> => getAll<OutgoingShare>(SHARE_STORE_NAME);
export const saveShares = (shares: OutgoingShare[]): Promise<void> => putAll(SHARE_STORE_NAME, shares, true);

// --- EQ (localStorage) ---

const EQ_SETTINGS_KEY = 'eq-settings';
const EQ_PRESETS_KEY = 'eq-presets';

const readJSON = <T>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    console.error(`Failed to read ${key}:`, error);
    return fallback;
  }
};

const writeJSON = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to write ${key}:`, error);
  }
};

export const saveEQSettings = (bands: EQBand[]): void =>
  writeJSON(EQ_SETTINGS_KEY, bands.map(({ frequency, gain }) => ({ frequency, gain })));

export const loadEQSettings = (): EQBand[] | null => {
  const saved = readJSON<EQBand[] | null>(EQ_SETTINGS_KEY, null);
  return Array.isArray(saved) && saved.length === EQ_FREQUENCIES.length ? saved : null;
};

export const loadEQPresets = (): Record<string, EQBand[]> => readJSON(EQ_PRESETS_KEY, {});

export const saveEQPreset = (name: string, bands: EQBand[]): void => {
  const presets = loadEQPresets();
  presets[name] = bands.map(({ frequency, gain }) => ({ frequency, gain }));
  writeJSON(EQ_PRESETS_KEY, presets);
};

export const saveEQPresets = (presets: Record<string, EQBand[]>): void => writeJSON(EQ_PRESETS_KEY, presets);

export const deleteEQPreset = (name: string): void => {
  const presets = loadEQPresets();
  delete presets[name];
  writeJSON(EQ_PRESETS_KEY, presets);
};

const preset = (gains: number[]): EQBand[] =>
  EQ_FREQUENCIES.map((frequency, i) => ({ frequency, gain: gains[i] }));

const BUILT_IN_PRESETS: Record<string, EQBand[]> = {
  'Flat':         preset([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  'Bass Boost':   preset([8, 6, 3, 0, 0, 0, 0, 0, 0, 0]),
  'Treble Boost': preset([0, 0, 0, 0, 0, 0, 3, 6, 8, 8]),
  'Vocal Boost':  preset([-2, -1, 2, 4, 5, 4, 2, 0, 0, 0]),
  'Classical':    preset([0, 0, 0, 0, 0, -2, -2, 0, 0, 3]),
  'Rock':         preset([6, 4, -2, -3, -1, 2, 5, 7, 7, 7]),
};

export const getBuiltInPresets = (): Record<string, EQBand[]> => BUILT_IN_PRESETS;

// --- Backup & Restore ---

const deriveKey = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' } as Pbkdf2Params,
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

interface EncryptedPayload {
  iv: number[];
  salt: number[];
  data: number[];
}

const encryptData = async (data: string, password: string): Promise<EncryptedPayload> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(data));

  return {
    iv: Array.from(iv),
    salt: Array.from(salt),
    data: Array.from(new Uint8Array(encrypted)),
  };
};

const decryptData = async (payload: EncryptedPayload, password: string): Promise<string> => {
  const key = await deriveKey(password, new Uint8Array(payload.salt));
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(payload.iv) },
    key,
    new Uint8Array(payload.data)
  );
  return new TextDecoder().decode(decrypted);
};

interface BackupData {
  version: number;
  timestamp: number;
  tracks: StoredTrack[];
  playlists: Playlist[];
  markers: ChapterMarker[];
  eqSettings: EQBand[] | null;
  eqPresets: Record<string, EQBand[]>;
}

/**
 * Export library metadata as JSON (optionally AES-GCM encrypted).
 * Local audio files are not included — only their metadata, so playlists and markers keep their references.
 */
export const exportLibraryAsJSON = async (password?: string): Promise<string> => {
  const [tracks, playlists, markers] = await Promise.all([
    getAll<StoredTrack>(TRACK_STORE_NAME),
    loadPlaylists(),
    loadMarkers(),
  ]);

  const backupData: BackupData = {
    version: 1,
    timestamp: Date.now(),
    tracks: tracks.map(({ fileBlob, ...rest }) => rest),
    playlists,
    markers,
    eqSettings: loadEQSettings(),
    eqPresets: loadEQPresets(),
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  if (!password) return jsonString;

  return JSON.stringify({
    isEncrypted: true,
    version: 1,
    payload: await encryptData(jsonString, password),
  });
};

/**
 * Merge a backup into the current library. Existing tracks are never removed;
 * stream tracks from the backup are added, and playlists/markers are merged by id.
 * Throws `PASSWORD_REQUIRED` / `INVALID_PASSWORD` for encrypted backups.
 */
export const importLibraryFromJSON = async (jsonString: string, password?: string): Promise<void> => {
  let data = JSON.parse(jsonString);

  if (data.isEncrypted) {
    if (!password) throw new Error('PASSWORD_REQUIRED');
    try {
      data = JSON.parse(await decryptData(data.payload, password));
    } catch {
      throw new Error('INVALID_PASSWORD');
    }
  }

  if (!data.version || !Array.isArray(data.tracks)) {
    throw new Error('Invalid backup file format');
  }

  const backup = data as BackupData;
  // Local tracks in a backup carry no audio data, so only streams can be restored.
  const streamTracks = backup.tracks.filter(t => t.type === 'stream' && t.streamUrl);

  await putAll(TRACK_STORE_NAME, streamTracks, false);
  if (backup.playlists?.length) await putAll(PLAYLIST_STORE_NAME, backup.playlists, false);
  if (backup.markers?.length) await putAll(MARKER_STORE_NAME, backup.markers, false);

  if (backup.eqSettings) saveEQSettings(backup.eqSettings);
  if (backup.eqPresets) saveEQPresets(backup.eqPresets);
};
