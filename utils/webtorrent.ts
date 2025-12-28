// WebTorrent utilities for P2P music streaming and distribution
import WebTorrent from 'webtorrent';

let client: WebTorrent.Instance | null = null;

/**
 * Initialize WebTorrent client (singleton)
 */
export const initWebTorrent = (): WebTorrent.Instance => {
  if (!client) {
    client = new WebTorrent();
    console.log('[WebTorrent] Client initialized');
  }
  return client;
};

/**
 * Get existing WebTorrent client or create new one
 */
export const getWebTorrentClient = (): WebTorrent.Instance => {
  return client || initWebTorrent();
};

/**
 * Add torrent and stream audio
 * @param magnetURI Magnet link or torrent file
 * @param onReady Callback when torrent is ready with blob URL
 * @param onProgress Progress callback (0-1)
 */
export const streamFromTorrent = (
  magnetURI: string,
  onReady: (blobUrl: string, file: File) => void,
  onProgress?: (progress: number) => void,
  onError?: (error: Error) => void
): WebTorrent.Torrent | null => {
  const wtClient = getWebTorrentClient();

  try {
    const torrent = wtClient.add(magnetURI, (torrent) => {
      console.log('[WebTorrent] Torrent ready:', torrent.name);
      console.log('[WebTorrent] Files:', torrent.files.length);

      // Find audio file (first audio file in torrent)
      const audioFile = torrent.files.find(file =>
        file.name.match(/\.(mp3|wav|ogg|flac|m4a|aac|webm)$/i)
      );

      if (!audioFile) {
        onError?.(new Error('No audio file found in torrent'));
        return;
      }

      // Create blob URL for streaming
      audioFile.getBlobURL((err, blobUrl) => {
        if (err) {
          onError?.(err);
          return;
        }

        if (blobUrl) {
          // Create File object for compatibility with existing Track interface
          audioFile.getBlob((err, blob) => {
            if (err || !blob) {
              onError?.(err || new Error('Failed to get blob'));
              return;
            }

            const file = new File([blob], audioFile.name, { type: blob.type });
            onReady(blobUrl, file);
          });
        }
      });
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
 * Seed a file via WebTorrent
 * @param file File to seed
 * @param onSeeding Callback when seeding starts with magnet link
 */
export const seedFile = (
  file: File,
  onSeeding: (magnetURI: string, torrent: WebTorrent.Torrent) => void,
  onError?: (error: Error) => void
): WebTorrent.Torrent | null => {
  const wtClient = getWebTorrentClient();

  try {
    const torrent = wtClient.seed(file, (torrent) => {
      console.log('[WebTorrent] Now seeding:', torrent.name);
      console.log('[WebTorrent] Magnet URI:', torrent.magnetURI);
      onSeeding(torrent.magnetURI, torrent);
    });

    torrent.on('error', (err) => {
      console.error('[WebTorrent] Seeding error:', err);
      onError?.(err);
    });

    return torrent;
  } catch (error) {
    console.error('[WebTorrent] Failed to seed file:', error);
    onError?.(error as Error);
    return null;
  }
};

/**
 * Remove torrent from client
 */
export const removeTorrent = (magnetURI: string): void => {
  if (client) {
    const torrent = client.get(magnetURI);
    if (torrent) {
      client.remove(magnetURI);
      console.log('[WebTorrent] Torrent removed');
    }
  }
};

/**
 * Destroy WebTorrent client
 */
export const destroyWebTorrent = (): void => {
  if (client) {
    client.destroy();
    client = null;
    console.log('[WebTorrent] Client destroyed');
  }
};
