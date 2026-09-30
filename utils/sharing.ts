// Share links: tracks and playlists sent device-to-device over WebTorrent, end-to-end encrypted.
//
// A share is one torrent containing `manifest.bin` (encrypted JSON: titles, artists, covers,
// playlist name, share mode) and `0.bin`, `1.bin`, ... (the encrypted audio). Peers and trackers
// only ever see ciphertext and neutral file names. The link carries the torrent's info hash and
// the key in its #fragment: https://tune.penkosoftware.org/#share=<infohash>.<key>
import type { Instance, Torrent, TorrentFile } from 'webtorrent';
import type { Track, ShareMode, OutgoingShare } from '../types';
import { getWebTorrentClient } from './webtorrent';
import { getTrackers } from './network';
import {
  generateShareKey, importShareKey, sealFile, openRange, plainSizeOf,
  toBase64Url, fromBase64Url, MANIFEST_FILE_INDEX,
} from './shareCrypto';
import { getTrackFile } from './libraryArchive';

const TORRENT_NAME = 'penko-share';
const MANIFEST_NAME = 'manifest.bin';
export const CONNECT_TIMEOUT_MS = 60_000; // total across retries (3 x 20s)

export interface SharedTrackInfo {
  name: string;
  artist?: string;
  album?: string;
  duration?: number;
  trackNumber?: number;
  year?: number;
  genre?: string;
  coverArtUrl?: string;
  mime: string;
  fileName: string;
}

interface ShareManifest {
  v: 1;
  title: string;
  mode: ShareMode;
  tracks: SharedTrackInfo[];
}

// --- Links ---

export const buildShareLink = (share: Pick<OutgoingShare, 'id' | 'key'>): string =>
  `${location.origin}${location.pathname}#share=${share.id}.${share.key}`;

export const parseShareHash = (hash: string): { infoHash: string; key: string } | null => {
  const match = /^#share=([0-9a-f]{40})\.([A-Za-z0-9_-]{43})$/i.exec(hash);
  return match ? { infoHash: match[1].toLowerCase(), key: match[2] } : null;
};

const magnetFor = (infoHash: string) =>
  `magnet:?xt=urn:btih:${infoHash}&dn=${TORRENT_NAME}` +
  getTrackers().map(t => `&tr=${encodeURIComponent(t)}`).join('');

// --- Sending ---

const trackInfo = (track: Track, file: File): SharedTrackInfo => ({
  name: track.name,
  artist: track.artist,
  album: track.album,
  duration: track.duration,
  trackNumber: track.trackNumber,
  year: track.year,
  genre: track.genre,
  coverArtUrl: track.coverArtUrl,
  mime: file.type,
  fileName: file.name,
});

const seedFiles = (client: Instance, files: File[]): Promise<Torrent> =>
  new Promise((resolve, reject) => {
    const torrent = client.seed(files, { name: TORRENT_NAME, announce: getTrackers() }, resolve);
    torrent.once('error', (err: Error | string) => reject(typeof err === 'string' ? new Error(err) : err));
  });

/**
 * Encrypt and seed tracks. With an existing `share`, the same key rebuilds the same torrent,
 * so the old link keeps working. Returns null if none of the tracks' files are readable.
 */
export const seedShare = async (
  tracks: Track[],
  options: { title: string; mode: ShareMode; share?: OutgoingShare }
): Promise<{ share: OutgoingShare; torrent: Torrent } | null> => {
  const rawKey = options.share ? fromBase64Url(options.share.key) : generateShareKey();
  const key = await importShareKey(rawKey);

  const included: { track: Track; file: File }[] = [];
  for (const track of tracks) {
    const file = track.type === 'local' ? await getTrackFile(track) : null;
    if (file) included.push({ track, file });
  }
  if (included.length === 0) return null;

  const manifest: ShareManifest = {
    v: 1,
    title: options.title,
    mode: options.mode,
    tracks: included.map(({ track, file }) => trackInfo(track, file)),
  };
  const sealed = [
    await sealFile(new Blob([JSON.stringify(manifest)]), key, MANIFEST_FILE_INDEX, MANIFEST_NAME),
    ...(await Promise.all(included.map(({ file }, i) => sealFile(file, key, i, `${i}.bin`)))),
  ];

  const client = await getWebTorrentClient();
  const torrent = await seedFiles(client, sealed).catch(async err => {
    // Already seeding the identical share in this session
    const match = /duplicate torrent ([0-9a-f]{40})/i.exec(String(err?.message));
    const existing = match ? await client.get(match[1]) : null;
    if (existing) return existing;
    throw err;
  });

  const share: OutgoingShare = options.share ?? {
    id: torrent.infoHash,
    key: toBase64Url(rawKey),
    title: options.title,
    trackIds: included.map(({ track }) => track.id),
    mode: options.mode,
    createdAt: Date.now(),
  };
  if (share.id !== torrent.infoHash) {
    // Tracks changed since the link was made (e.g. tags edited); the old link can't be served
    console.warn('[Share] Re-seeded share no longer matches its link', share.title);
  }
  return { share, torrent };
};

export const stopSeeding = async (infoHash: string) => {
  const client = await getWebTorrentClient();
  if (await client.get(infoHash)) await client.remove(infoHash);
};

// --- Receiving ---

export interface IncomingShare {
  id: string; // info hash
  title: string;
  mode: ShareMode;
  tracks: (SharedTrackInfo & { size: number })[];
  torrent: Torrent;
  /** Decrypted bytes [start, end] of track `index`. Waits for (and prioritizes) the needed pieces. */
  readRange: (index: number, start: number, end: number) => Promise<Uint8Array>;
  /** The complete decrypted file, for saving a copy. */
  readFile: (index: number, onProgress?: (fraction: number) => void) => Promise<File>;
}

const ATTEMPT_MS = 20_000;
const ATTEMPTS = 3;

/** One attempt to reach the sender and fetch the torrent's metadata. */
const addTorrentOnce = (client: Instance, infoHash: string): Promise<Torrent> =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.remove(infoHash).catch(() => {});
      reject(new Error('TIMEOUT'));
    }, ATTEMPT_MS);
    const torrent = client.add(
      magnetFor(infoHash),
      { announce: getTrackers(), deselect: true }, // only download what gets played/saved
      t => { clearTimeout(timeout); resolve(t); }
    );
    torrent.once('error', (err: Error | string) => {
      clearTimeout(timeout);
      reject(typeof err === 'string' ? new Error(err) : err);
    });
  });

/**
 * Tracker discovery occasionally misses the first announce, and trackers may not ask for another
 * for minutes. Re-adding the torrent announces afresh, which usually connects on the next try.
 */
const addTorrent = async (client: Instance, infoHash: string): Promise<Torrent> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await addTorrentOnce(client, infoHash);
    } catch (err) {
      if ((err as Error).message !== 'TIMEOUT' || attempt >= ATTEMPTS) throw err;
      // client.remove() is async; let it finish before adding the same torrent again
      await new Promise(r => setTimeout(r, 500));
    }
  }
};

/** Read sealed bytes [start, end] of a torrent file. (end is never 0: a sealed chunk is at least 16 bytes.) */
const readSealed = (file: TorrentFile) => (start: number, end: number): Promise<ArrayBuffer> =>
  file.arrayBuffer({ start, end });

/**
 * Connect to the sender and decrypt the share's manifest.
 * Throws Error('TIMEOUT') if no peer answers (sender offline or networks can't connect).
 */
export const openIncomingShare = async (infoHash: string, keyText: string): Promise<IncomingShare> => {
  const client = await getWebTorrentClient();
  const key = await importShareKey(fromBase64Url(keyText));
  const torrent = (await client.get(infoHash)) ?? (await addTorrent(client, infoHash));

  const fileNamed = (name: string) => {
    const file = torrent.files.find((f: TorrentFile) => f.name === name);
    if (!file) throw new Error(`Share is missing ${name}`);
    return file;
  };

  const manifestFile = fileNamed(MANIFEST_NAME);
  const manifestBytes = await openRange(
    readSealed(manifestFile), manifestFile.length, key, MANIFEST_FILE_INDEX, 0, plainSizeOf(manifestFile.length) - 1
  );
  const manifest: ShareManifest = JSON.parse(new TextDecoder().decode(manifestBytes));

  const audioFiles = manifest.tracks.map((_, i) => fileNamed(`${i}.bin`));
  const readRange = (index: number, start: number, end: number) =>
    openRange(readSealed(audioFiles[index]), audioFiles[index].length, key, index, start, end);

  return {
    id: infoHash,
    title: manifest.title,
    mode: manifest.mode,
    tracks: manifest.tracks.map((t, i) => ({ ...t, size: plainSizeOf(audioFiles[i].length) })),
    torrent,
    readRange,
    readFile: async (index, onProgress) => {
      const size = plainSizeOf(audioFiles[index].length);
      const step = 4 * 1024 * 1024;
      const parts: Uint8Array[] = [];
      for (let start = 0; start < size; start += step) {
        parts.push(await readRange(index, start, Math.min(start + step, size) - 1));
        onProgress?.(Math.min(1, (start + step) / size));
      }
      const info = manifest.tracks[index];
      return new File(parts as BlobPart[], info.fileName, { type: info.mime });
    },
  };
};

/** URL the share service worker answers for track `index` of an incoming share. */
export const incomingTrackUrl = (shareId: string, index: number) =>
  new URL(`__penko_share/${shareId}/${index}`, document.baseURI).href;
