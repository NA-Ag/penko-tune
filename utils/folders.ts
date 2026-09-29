// Linked music folders (File System Access API, Chromium desktop browsers).
// The audio stays on disk; the library stores only file handles.
import { AUDIO_FILE_PATTERN } from './audio';

export interface FolderEntry {
  handle: FileSystemFileHandle;
  relativePath: string;
}

export const pickMusicFolder = (): Promise<FileSystemDirectoryHandle> => {
  if (!window.showDirectoryPicker) throw new Error('Linking folders is not supported in this browser');
  return window.showDirectoryPicker({ id: 'penko-tune-music', mode: 'read', startIn: 'music' });
};

/** Recursively list audio files under a directory. Hidden entries are skipped. */
export async function* walkAudioFiles(dir: FileSystemDirectoryHandle, prefix = ''): AsyncGenerator<FolderEntry> {
  for await (const entry of dir.values()) {
    if (entry.name.startsWith('.')) continue;
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') {
      yield* walkAudioFiles(entry as FileSystemDirectoryHandle, relativePath);
    } else if (AUDIO_FILE_PATTERN.test(entry.name)) {
      yield { handle: entry as FileSystemFileHandle, relativePath };
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
