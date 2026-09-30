export interface Track {
  id: string;
  file?: File;
  name: string;
  artist?: string;
  album?: string;
  duration?: number; // In seconds
  url: string;
  coverArtUrl?: string;
  type: 'local' | 'stream'; // Unified types
  torrentMagnetLink?: string; // WebTorrent source, resolved to a blob URL before playback
  trackNumber?: number;
  discNumber?: number;
  year?: number;
  genre?: string;
  addedAt?: number; // epoch ms
  tagsRead?: boolean; // embedded tags have been parsed (local files only)
  gainDb?: number; // ReplayGain track gain from tags, used when normalization is on
  lyrics?: string; // plain text or LRC (timestamped) lyrics

  // Linked tracks: the audio stays in a folder on the user's disk (File System Access API)
  fileHandle?: FileSystemFileHandle;
  folderId?: string;
  relativePath?: string;

  // Tracks received through a share link (never persisted unless saved)
  incomingShareId?: string;
  canSave?: boolean; // the sender allowed keeping a copy
}

export interface LinkedFolder {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
  addedAt: number;
}

export type ShareMode = 'stream' | 'copy';

/** A share this device is seeding. Re-seeded on launch; the same key and files give the same link. */
export interface OutgoingShare {
  id: string; // torrent info hash
  key: string; // base64url AES-256 key
  title: string;
  trackIds: string[];
  mode: ShareMode;
  createdAt: number;
}

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  playbackRate: number;
  karaokeMode: boolean;
}

export enum ViewMode {
  LIST = 'LIST',
  VISUALIZER = 'VISUALIZER',
}

export enum VisualizerMode {
  BARS = 'BARS',
  WAVE = 'WAVE',
  CIRCLE = 'CIRCLE',
  SPIRAL = 'SPIRAL',
  PARTICLES = 'PARTICLES',
  SPECTRUM = 'SPECTRUM',
  RINGS = 'RINGS',
  DNA = 'DNA',
}

export interface EQBand {
  frequency: number;
  gain: number;
  node?: BiquadFilterNode;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  coverArtUrl?: string;
}

export interface ChapterMarker {
  id: string;
  trackId: string;
  timestamp: number; // In seconds
  label: string;
  color?: string;
}
