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

// Phase 2: Decentralized Music Platform

export interface ArtistProfile {
  id: string;
  name: string;
  bio?: string;
  avatar?: string; // IPFS hash or URL
  coverImage?: string; // IPFS hash or URL
  genres?: string[];
  socialLinks?: {
    website?: string;
    twitter?: string;
    instagram?: string;
    bandcamp?: string;
    soundcloud?: string;
    youtube?: string;
  };
  wallets?: {
    lightning?: string; // Lightning address
    monero?: string; // XMR address
    ethereum?: string; // ETH/L2 address
    bitcoin?: string; // BTC address
  };
  verified?: boolean;
  createdAt: number;
  ipfsHash?: string; // Hash of the entire profile stored on IPFS
}

export interface Release {
  id: string;
  artistId: string;
  title: string;
  type: 'single' | 'ep' | 'album' | 'compilation';
  releaseDate: number;
  coverArt?: string; // IPFS hash
  description?: string;
  genres?: string[];
  trackIds: string[]; // References to tracks
  price?: number; // Optional price in sats/USD
  ipfsHash?: string;
  torrentMagnetLink?: string; // WebTorrent magnet link
}

export interface DecentralizedTrack extends Track {
  artistId?: string;
  releaseId?: string;
  ipfsHash?: string; // IPFS content hash
  torrentMagnetLink?: string; // WebTorrent magnet link
  price?: number; // Price in sats or smallest unit
  license?: 'cc0' | 'cc-by' | 'cc-by-sa' | 'cc-by-nc' | 'all-rights-reserved';
  bpm?: number;
  key?: string; // Musical key
  mood?: string[];
  lyrics?: string;
  credits?: {
    role: string;
    name: string;
  }[];
}
