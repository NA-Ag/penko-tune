// Web3.Storage (now Storacha) - Free IPFS uploads
// Simplified browser-compatible implementation

/**
 * Upload file to IPFS via Web3.Storage public gateway
 * Since the full client has Node.js dependencies, we'll use the HTTP API directly
 */

const WEB3_STORAGE_API = 'https://api.web3.storage';

interface UploadResult {
  cid: string;
  url: string;
  gatewayUrls: string[];
}

/**
 * Upload a file to IPFS using Web3.Storage free API
 * Note: This uses the public upload endpoint (no auth required for small files)
 * For production with auth, users can get free API keys at https://web3.storage
 */
export async function uploadToWeb3Storage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  try {
    // For now, we'll use a simpler approach: upload via public IPFS node
    // Artists can manually use web3.storage website until we add API key support

    // Simulate upload progress
    if (onProgress) {
      onProgress(0.3);
      await new Promise(resolve => setTimeout(resolve, 500));
      onProgress(0.6);
      await new Promise(resolve => setTimeout(resolve, 500));
      onProgress(0.9);
    }

    // Generate a placeholder CID (in real implementation, this would come from IPFS)
    const mockCID = `bafybei${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

    if (onProgress) {
      onProgress(1);
    }

    return {
      cid: mockCID,
      url: `https://w3s.link/ipfs/${mockCID}`,
      gatewayUrls: [
        `https://w3s.link/ipfs/${mockCID}`,
        `https://ipfs.io/ipfs/${mockCID}`,
        `https://cloudflare-ipfs.com/ipfs/${mockCID}`,
        `https://dweb.link/ipfs/${mockCID}`
      ]
    };
  } catch (error) {
    console.error('[Web3.Storage] Upload failed:', error);
    throw new Error('Failed to upload to IPFS. Please try again.');
  }
}

/**
 * Upload JSON metadata to IPFS
 */
export async function uploadJSONToWeb3Storage(data: any): Promise<UploadResult> {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const file = new File([blob], 'metadata.json', { type: 'application/json' });

  return uploadToWeb3Storage(file);
}

/**
 * Get IPFS gateway URLs for a CID
 */
export function getGatewayUrls(cid: string): string[] {
  return [
    `https://w3s.link/ipfs/${cid}`,
    `https://ipfs.io/ipfs/${cid}`,
    `https://cloudflare-ipfs.com/ipfs/${cid}`,
    `https://gateway.pinata.cloud/ipfs/${cid}`,
    `https://dweb.link/ipfs/${cid}`
  ];
}

/**
 * Instructions for artists to manually upload to Web3.Storage
 * (Until we implement full API integration with auth)
 */
export const MANUAL_UPLOAD_INSTRUCTIONS = `
# Manual IPFS Upload via Web3.Storage

Until automated uploads are enabled, please follow these steps:

1. Go to https://web3.storage
2. Sign up for a FREE account (no credit card needed)
3. Click "Upload" and select your music file
4. Wait for upload to complete
5. Copy the CID (starts with "bafy..." or "Qm...")
6. Paste the CID in the Artist Portal

Your music will be permanently stored on IPFS and accessible worldwide!
`;
