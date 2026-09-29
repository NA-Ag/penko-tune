// Full-library export/import as a .zip: the original audio files plus library.json
// (track info, playlists, markers, EQ). Audio is stored uncompressed (it's already compressed),
// and both directions stream so memory use stays around one file at a time.
import { Zip, ZipPassThrough, ZipDeflate, Unzip, UnzipInflate, UnzipPassThrough, strToU8, strFromU8 } from 'fflate';
import type { Track, Playlist, ChapterMarker, EQBand } from '../types';
import {
  loadPlaylists, loadMarkers, loadEQSettings, loadEQPresets,
  mergeTracksIntoIndexedDB, mergePlaylists, mergeMarkers, saveEQSettings, saveEQPresets,
  importLibraryFromJSON,
} from './persistence';

const FORMAT = 'penko-tune-library';
const MANIFEST = 'library.json';

type ArchivedTrack = Omit<Track, 'file' | 'url' | 'fileHandle' | 'incomingShareId' | 'canSave'> & {
  audioPath?: string; // path of the audio inside the zip (local tracks)
  streamUrl?: string; // network streams have no audio file
};

interface LibraryManifest {
  format: typeof FORMAT;
  version: 1;
  exportedAt: number;
  tracks: ArchivedTrack[];
  playlists: Playlist[];
  markers: ChapterMarker[];
  eqSettings: EQBand[] | null;
  eqPresets: Record<string, EQBand[]>;
}

export interface ExportResult {
  exported: number;
  skipped: number; // linked tracks whose folder isn't connected
}

/** Keep zip paths portable (no separators or characters Windows rejects). */
const safeName = (name: string) => name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 150) || 'track';

/** Read the audio for a track: the copied file, or the linked file from disk. */
export const getTrackFile = async (track: Track): Promise<File | null> => {
  if (track.file) return track.file;
  if (track.fileHandle) {
    try {
      return await track.fileHandle.getFile();
    } catch {
      return null; // folder not connected (no permission) or file moved
    }
  }
  return null;
};

/** Save a single track's original file to the user's downloads. */
export const downloadTrackFile = async (track: Track): Promise<boolean> => {
  const file = await getTrackFile(track);
  if (!file) return false;
  downloadBlob(file, file.name);
  return true;
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/**
 * Export everything to a .zip. Where the browser supports it (Chrome/Edge), the zip is
 * written straight to disk so multi-GB libraries work; elsewhere it's assembled in memory.
 * Must be called from a user gesture (the save dialog requires one).
 */
export const exportLibraryZip = async (
  tracks: Track[],
  onProgress?: (done: number, total: number) => void
): Promise<ExportResult | null> => {
  const filename = `penko-tune-library-${new Date().toISOString().slice(0, 10)}.zip`;

  // Ask where to save first, while we still have the user gesture
  let writable: FileSystemWritableFileStream | null = null;
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Penko Tune library', accept: { 'application/zip': ['.zip'] } }],
      });
      writable = await handle.createWritable();
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return null; // user cancelled
      writable = null; // fall back to an in-memory download
    }
  }

  const memoryChunks: Uint8Array[] = [];
  let writeChain: Promise<void> = Promise.resolve();
  let zipError: Error | null = null;
  let finished!: () => void;
  const done = new Promise<void>(resolve => { finished = resolve; });

  const zip = new Zip((err, chunk, final) => {
    if (err) zipError = err;
    else if (writable) {
      const w = writable;
      writeChain = writeChain.then(() => w.write(chunk as Uint8Array<ArrayBuffer>));
    } else {
      memoryChunks.push(chunk);
    }
    if (final || err) finished();
  });

  const exportTracks = tracks.filter(t => !t.incomingShareId);
  const archived: ArchivedTrack[] = [];
  const files: { path: string; file: File }[] = [];
  let skipped = 0;

  for (const track of exportTracks) {
    const { file: _f, url, fileHandle: _h, incomingShareId: _s, canSave: _c, ...meta } = track;
    if (track.type === 'stream') {
      archived.push({ ...meta, streamUrl: url });
      continue;
    }
    const file = await getTrackFile(track);
    if (!file) {
      skipped++;
      continue;
    }
    const path = `audio/${track.id}/${safeName(file.name)}`;
    // Linked tracks become ordinary copied tracks when restored from an archive
    const { folderId: _fid, relativePath: _rp, ...portable } = meta;
    archived.push({ ...portable, audioPath: path });
    files.push({ path, file });
  }

  const manifest: LibraryManifest = {
    format: FORMAT,
    version: 1,
    exportedAt: Date.now(),
    tracks: archived,
    playlists: await loadPlaylists(),
    markers: await loadMarkers(),
    eqSettings: loadEQSettings(),
    eqPresets: loadEQPresets(),
  };

  // Manifest first, so imports know every track before its audio arrives
  const manifestEntry = new ZipDeflate(MANIFEST, { level: 6 });
  zip.add(manifestEntry);
  manifestEntry.push(strToU8(JSON.stringify(manifest)), true);

  for (let i = 0; i < files.length; i++) {
    const { path, file } = files[i];
    const entry = new ZipPassThrough(path);
    zip.add(entry);
    const reader = file.stream().getReader();
    for (;;) {
      const { value, done: eof } = await reader.read();
      if (eof) break;
      entry.push(value, false);
      await writeChain; // backpressure: don't read faster than we can write
      if (zipError) throw zipError;
    }
    entry.push(new Uint8Array(0), true);
    onProgress?.(i + 1, files.length);
  }

  zip.end();
  await done;
  await writeChain;
  if (zipError) throw zipError;

  if (writable) {
    await writable.close();
  } else {
    downloadBlob(new Blob(memoryChunks as BlobPart[], { type: 'application/zip' }), filename);
  }
  return { exported: files.length + archived.filter(t => t.streamUrl).length, skipped };
};

export interface ImportResult {
  tracks: number;
  playlists: number;
}

/**
 * Import a library .zip (merged into the existing library, never replacing it).
 * Each track is written to the database as soon as its audio is unpacked.
 */
export const importLibraryZip = async (
  archive: File,
  onProgress?: (done: number, total: number) => void
): Promise<ImportResult> => {
  let manifest: LibraryManifest | null = null;
  const trackByPath = new Map<string, ArchivedTrack>();
  const pendingWrites: Promise<void>[] = [];
  let imported = 0;
  let unzipError: Error | null = null;

  const unzip = new Unzip(entry => {
    const chunks: Uint8Array[] = [];
    entry.ondata = (err, data, final) => {
      if (err) { unzipError = err; return; }
      chunks.push(data);
      if (!final) return;

      if (entry.name === MANIFEST) {
        manifest = JSON.parse(strFromU8(concat(chunks)));
        if (manifest?.format !== FORMAT) {
          unzipError = new Error('This zip is not a Penko Tune library export');
          return;
        }
        manifest.tracks.forEach(t => t.audioPath && trackByPath.set(t.audioPath, t));
        return;
      }

      const meta = trackByPath.get(entry.name);
      if (!meta) return; // unknown file in the archive
      const { audioPath, streamUrl: _s, ...rest } = meta;
      const fileName = audioPath!.split('/').pop()!;
      const file = new File(chunks as BlobPart[], fileName, { type: guessMime(fileName) });
      pendingWrites.push(mergeTracksIntoIndexedDB([{ ...rest, file, url: '' }]).then(() => {
        imported++;
        onProgress?.(imported, trackByPath.size);
      }));
    };
    entry.start();
  });
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);

  const reader = archive.stream().getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    unzip.push(value, false);
    if (unzipError) throw unzipError;
  }
  unzip.push(new Uint8Array(0), true);
  if (unzipError) throw unzipError;
  if (!manifest) throw new Error('Missing library.json - not a Penko Tune library export');
  await Promise.all(pendingWrites);

  const m = manifest as LibraryManifest;
  const streams = m.tracks.filter(t => t.streamUrl);
  await mergeTracksIntoIndexedDB(streams.map(({ streamUrl, audioPath: _a, ...rest }) => ({ ...rest, url: streamUrl! })));
  if (m.playlists.length) await mergePlaylists(m.playlists);
  if (m.markers.length) await mergeMarkers(m.markers);
  if (m.eqSettings) saveEQSettings(m.eqSettings);
  if (m.eqPresets) saveEQPresets({ ...loadEQPresets(), ...m.eqPresets });

  return { tracks: imported + streams.length, playlists: m.playlists.length };
};

/** Import either a .zip library export or a legacy/metadata-only .json backup. */
export const importLibraryFile = async (
  file: File,
  password?: string,
  onProgress?: (done: number, total: number) => void
): Promise<ImportResult | null> => {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  if (head[0] === 0x50 && head[1] === 0x4b) return importLibraryZip(file, onProgress); // "PK"
  await importLibraryFromJSON(await file.text(), password);
  return null;
};

const concat = (chunks: Uint8Array[]) => {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
};

const MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac',
  ogg: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', webm: 'audio/webm',
};
const guessMime = (name: string) => MIME_BY_EXT[name.split('.').pop()?.toLowerCase() ?? ''] ?? '';
