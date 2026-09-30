import type { Instance, Torrent } from 'webtorrent';
import { AUDIO_FILE_PATTERN } from './audio';
import { getTrackers, getIceServers } from './network';

let client: Instance | null = null;

/**
 * Initialize WebTorrent client (singleton)
 */
export const initWebTorrent = async (): Promise<Instance> => {
  if (!client) {
    const { default: WebTorrent } = await import('webtorrent');
    // Browsers can only reach WebRTC peers via websocket trackers; disable the Node-only
    // UDP/TCP discovery mechanisms (the DHT is aliased to a stub in vite.config.ts).
    const iceServers = getIceServers();
    client = new WebTorrent({
      dht: false, lsd: false, utp: false, natUpnp: false, natPmp: false,
      ...(iceServers && { tracker: { rtcConfig: { iceServers } } }),
    }) as Instance;
    console.log('[WebTorrent] Client initialized');
  }
  return client;
};

/**
 * Get existing WebTorrent client or create new one
 */
export const getWebTorrentClient = async (): Promise<Instance> => {
  return client || initWebTorrent();
};

/**
 * Add torrent and stream audio
 * @param magnetURI Magnet link or torrent file
 * @param onReady Callback when torrent is ready with blob URL
 * @param onProgress Progress callback (0-1)
 */
export const streamFromTorrent = async (
  magnetURI: string,
  onReady: (blobUrl: string, file: File) => void,
  onProgress?: (progress: number) => void,
  onError?: (error: Error) => void
): Promise<Torrent | null> => {
  const wtClient = await getWebTorrentClient();

  try {
    const torrent = wtClient.add(magnetURI, { announce: getTrackers() }, async (torrent) => {
      console.log('[WebTorrent] Torrent ready:', torrent.name, `(${torrent.files.length} files)`);

      const audioFile = torrent.files.find(file => AUDIO_FILE_PATTERN.test(file.name));
      if (!audioFile) {
        onError?.(new Error('No audio file found in torrent'));
        return;
      }

      try {
        // webtorrent 2.x exposes an async blob(); the old getBlob/getBlobURL callbacks were removed
        const blob = await audioFile.blob();
        const file = new File([blob], audioFile.name, { type: blob.type });
        onReady(URL.createObjectURL(file), file);
      } catch (err) {
        onError?.(err as Error);
      }
    });

    // Progress updates
    if (onProgress) {
      torrent.on('download', () => {
        onProgress(torrent.progress);
      });
    }

    // Error handling
    torrent.on('error', (err) => {
      console.error('[WebTorrent] Error:', err);
      onError?.(err);
    });

    return torrent;
  } catch (error) {
    console.error('[WebTorrent] Failed to add torrent:', error);
    onError?.(error as Error);
    return null;
  }
};

/**
 * Seed a file via WebTorrent. Resolves with the magnet URI once hashing finishes
 * (torrent.magnetURI is not populated until then).
 */
export const seedFile = async (file: File): Promise<string> => {
  const wtClient = await getWebTorrentClient();

  return new Promise((resolve, reject) => {
    const torrent = wtClient.seed(file, { announce: getTrackers() }, (seeded) => {
      console.log('[WebTorrent] Now seeding:', seeded.name);
      resolve(seeded.magnetURI);
    });
    torrent.on('error', (err) => {
      console.error('[WebTorrent] Seeding error:', err);
      reject(typeof err === 'string' ? new Error(err) : err);
    });
  });
};

/**
 * Remove torrent from client (get/remove are async in webtorrent 2.x)
 */
export const removeTorrent = async (magnetURI: string): Promise<void> => {
  if (!client) return;
  try {
    if (await client.get(magnetURI)) {
      await client.remove(magnetURI);
      console.log('[WebTorrent] Torrent removed');
    }
  } catch (err) {
    console.warn('[WebTorrent] Failed to remove torrent', err);
  }
};
