// End-to-end encryption for share links.
//
// Each shared file is split into 64 KiB chunks, each sealed with AES-256-GCM under the share
// key. The IV is derived from (file index, chunk index), so:
//  - any byte range can be decrypted on its own (streaming + seeking), and
//  - encryption is deterministic: re-sharing the same tracks with the same key rebuilds the
//    identical torrent, so a link keeps working after the sender restarts the app.
// (IVs never repeat under one key because every (file, chunk) pair is unique.)
// The key only ever travels in the link's #fragment, which browsers never send to servers.

export const CHUNK_SIZE = 64 * 1024;
const TAG_SIZE = 16;
const SEALED_CHUNK_SIZE = CHUNK_SIZE + TAG_SIZE;
export const MANIFEST_FILE_INDEX = 0xffffffff;

export const generateShareKey = (): Uint8Array => crypto.getRandomValues(new Uint8Array(32));

export const importShareKey = (raw: Uint8Array): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);

export const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const fromBase64Url = (text: string): Uint8Array => {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};

const ivFor = (fileIndex: number, chunkIndex: number): Uint8Array => {
  const iv = new Uint8Array(12);
  const view = new DataView(iv.buffer);
  view.setUint32(0, fileIndex);
  view.setUint32(4, Math.floor(chunkIndex / 2 ** 32));
  view.setUint32(8, chunkIndex >>> 0);
  return iv;
};

/** Plaintext size of a sealed file of `sealedSize` bytes. */
export const plainSizeOf = (sealedSize: number): number =>
  sealedSize - Math.ceil(sealedSize / SEALED_CHUNK_SIZE) * TAG_SIZE;

/** Encrypt a whole blob into a sealed File (named neutrally so peers learn nothing from it). */
export const sealFile = async (blob: Blob, key: CryptoKey, fileIndex: number, name: string): Promise<File> => {
  const parts: ArrayBuffer[] = [];
  const chunkCount = Math.max(1, Math.ceil(blob.size / CHUNK_SIZE));
  for (let i = 0; i < chunkCount; i++) {
    const plain = await blob.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE).arrayBuffer();
    parts.push(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivFor(fileIndex, i) as BufferSource }, key, plain));
  }
  return new File(parts, name, { type: 'application/octet-stream' });
};

/**
 * Decrypt plaintext bytes [start, end] (inclusive) of a sealed file, fetching only the sealed
 * chunks that cover the range via `readSealed(start, end)`.
 */
export const openRange = async (
  readSealed: (start: number, end: number) => Promise<ArrayBuffer>,
  sealedSize: number,
  key: CryptoKey,
  fileIndex: number,
  start: number,
  end: number
): Promise<Uint8Array> => {
  const firstChunk = Math.floor(start / CHUNK_SIZE);
  const lastChunk = Math.floor(end / CHUNK_SIZE);
  const sealedStart = firstChunk * SEALED_CHUNK_SIZE;
  const sealedEnd = Math.min((lastChunk + 1) * SEALED_CHUNK_SIZE, sealedSize) - 1;
  const sealed = new Uint8Array(await readSealed(sealedStart, sealedEnd));

  const plain = new Uint8Array((lastChunk - firstChunk + 1) * CHUNK_SIZE);
  let written = 0;
  for (let c = firstChunk; c <= lastChunk; c++) {
    const offset = (c - firstChunk) * SEALED_CHUNK_SIZE;
    const chunk = sealed.subarray(offset, Math.min(offset + SEALED_CHUNK_SIZE, sealed.length));
    const opened = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivFor(fileIndex, c) as BufferSource }, key, chunk as BufferSource)
    );
    plain.set(opened, written);
    written += opened.length;
  }
  const from = start - firstChunk * CHUNK_SIZE;
  return plain.slice(from, from + (end - start + 1));
};
