// IPFS/Helia utilities for decentralized storage
import { createHelia } from 'helia';
import { unixfs } from '@helia/unixfs';
import type { Helia } from 'helia';
import type { UnixFS } from '@helia/unixfs';

let helia: Helia | null = null;
let fs: UnixFS | null = null;

/**
 * Initialize Helia (IPFS) node
 */
export const initIPFS = async (): Promise<{ helia: Helia; fs: UnixFS }> => {
  if (helia && fs) {
    return { helia, fs };
  }

  try {
    console.log('[IPFS] Initializing Helia node...');
    helia = await createHelia();
    fs = unixfs(helia);
    console.log('[IPFS] Helia node ready');
    console.log('[IPFS] Peer ID:', helia.libp2p.peerId.toString());
    return { helia, fs };
  } catch (error) {
    console.error('[IPFS] Failed to initialize:', error);
    throw error;
  }
};

/**
 * Upload file to IPFS
 * @param file File to upload
 * @param onProgress Progress callback
 * @returns CID (Content Identifier) hash
 */
export const uploadToIPFS = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> => {
  const { fs: unixFs } = await initIPFS();

  try {
    console.log('[IPFS] Uploading file:', file.name);

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Add file to IPFS
    const cid = await unixFs.addBytes(bytes, {
      onProgress: (evt) => {
        if (onProgress && evt.detail && typeof evt.detail === 'number') {
          // Calculate progress based on bytes transferred
          const progress = Math.min(1, evt.detail / file.size);
          onProgress(progress);
        }
      }
    });

    const cidString = cid.toString();
    console.log('[IPFS] File uploaded:', cidString);
    return cidString;
  } catch (error) {
    console.error('[IPFS] Upload failed:', error);
    throw error;
  }
};

/**
 * Upload JSON metadata to IPFS
 * @param data JSON object to upload
 * @returns CID hash
 */
export const uploadJSONToIPFS = async (data: any): Promise<string> => {
  const { fs: unixFs } = await initIPFS();

  try {
    console.log('[IPFS] Uploading JSON metadata');
    const jsonString = JSON.stringify(data);
    const bytes = new TextEncoder().encode(jsonString);

    const cid = await unixFs.addBytes(bytes);
    const cidString = cid.toString();
    console.log('[IPFS] Metadata uploaded:', cidString);
    return cidString;
  } catch (error) {
    console.error('[IPFS] JSON upload failed:', error);
    throw error;
  }
};

/**
 * Download file from IPFS
 * @param cid Content Identifier (IPFS hash)
 * @param onProgress Progress callback
 * @returns Uint8Array of file data
 */
export const downloadFromIPFS = async (
  cid: string,
  onProgress?: (progress: number) => void
): Promise<Uint8Array> => {
  const { fs: unixFs } = await initIPFS();

  try {
    console.log('[IPFS] Downloading from CID:', cid);

    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    for await (const chunk of unixFs.cat(cid as any)) {
      chunks.push(chunk);
      totalSize += chunk.length;

      // Progress is approximate since we don't know total size upfront
      if (onProgress) {
        onProgress(totalSize / (1024 * 1024)); // Report MB downloaded
      }
    }

    // Combine chunks
    const combined = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    console.log('[IPFS] Download complete:', totalSize, 'bytes');
    return combined;
  } catch (error) {
    console.error('[IPFS] Download failed:', error);
    throw error;
  }
};

/**
 * Download and parse JSON from IPFS
 * @param cid Content Identifier
 * @returns Parsed JSON object
 */
export const downloadJSONFromIPFS = async (cid: string): Promise<any> => {
  const bytes = await downloadFromIPFS(cid);
  const jsonString = new TextDecoder().decode(bytes);
  return JSON.parse(jsonString);
};

/**
 * Get IPFS gateway URL for a CID
 * @param cid Content Identifier
 * @param gateway Gateway URL (defaults to public gateway)
 * @returns Full URL to access content
 */
export const getIPFSUrl = (
  cid: string,
  gateway: string = 'https://ipfs.io/ipfs/'
): string => {
  return `${gateway}${cid}`;
};

/**
 * Get multiple gateway URLs for redundancy
 */
export const getIPFSGateways = (cid: string): string[] => {
  return [
    `https://ipfs.io/ipfs/${cid}`,
    `https://cloudflare-ipfs.com/ipfs/${cid}`,
    `https://gateway.pinata.cloud/ipfs/${cid}`,
    `https://dweb.link/ipfs/${cid}`
  ];
};

/**
 * Stop IPFS node
 */
export const stopIPFS = async (): Promise<void> => {
  if (helia) {
    await helia.stop();
    helia = null;
    fs = null;
    console.log('[IPFS] Node stopped');
  }
};
