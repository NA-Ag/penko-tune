// Linked music folders (File System Access API, Chromium desktop browsers).
// The audio stays on disk; the library stores only file handles.
import { AUDIO_FILE_PATTERN } from './audio';
import { baseName } from './lyrics';

export interface FolderEntry {
  handle: FileSystemFileHandle;
  relativePath: string;
  lyricsHandle?: FileSystemFileHandle; // song.lrc next to song.mp3
}

export const pickMusicFolder = (): Promise<FileSystemDirectoryHandle> => {
  if (!window.showDirectoryPicker) throw new Error('Linking folders is not supported in this browser');
  return window.showDirectoryPicker({ id: 'penko-tune-music', mode: 'read', startIn: 'music' });
};

/** Recursively list audio files under a directory, with any matching .lrc. Hidden entries are skipped. */
export async function* walkAudioFiles(dir: FileSystemDirectoryHandle, prefix = ''): AsyncGenerator<FolderEntry> {
  const entries: FileSystemHandle[] = [];
  for await (const entry of dir.values()) if (!entry.name.startsWith('.')) entries.push(entry);

  const lyrics = new Map<string, FileSystemFileHandle>();
  for (const entry of entries) {
    if (entry.kind === 'file' && /\.lrc$/i.test(entry.name)) lyrics.set(baseName(entry.name), entry as FileSystemFileHandle);
  }

  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') {
      yield* walkAudioFiles(entry as FileSystemDirectoryHandle, relativePath);
    } else if (AUDIO_FILE_PATTERN.test(entry.name)) {
      yield { handle: entry as FileSystemFileHandle, relativePath, lyricsHandle: lyrics.get(baseName(entry.name)) };
    }
  }
}

/** Whether we can read the folder right now without prompting. */
export const hasFolderPermission = async (dir: FileSystemDirectoryHandle): Promise<boolean> => {
  try {
    return (await dir.queryPermission({ mode: 'read' })) === 'granted';
  } catch {
    return false;
  }
};

/** Prompt for read access (must be called from a user gesture, e.g. a click). */
export const requestFolderPermission = async (dir: FileSystemDirectoryHandle): Promise<boolean> => {
  try {
    return (await dir.requestPermission({ mode: 'read' })) === 'granted';
  } catch {
    return false;
  }
};
