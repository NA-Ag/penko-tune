// Serves tracks received through share links to the <audio> element as normal HTTP range
// responses, so playback can start immediately and seeking works while the file is still
// arriving from the sender. The page holds the torrent and the decryption key; this worker
// just asks it for the decrypted bytes of each requested range.
//
// Loaded via importScripts() from the Workbox service worker in production builds, and
// registered directly in development.

const SHARE_PATH = '/__penko_share/';
const MAX_RANGE = 1024 * 1024; // answer at most 1 MiB per request; the media element asks for more

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const at = url.pathname.indexOf(SHARE_PATH);
  if (at === -1) return;
  const [shareId, fileIndex] = url.pathname.slice(at + SHARE_PATH.length).split('/');
  event.respondWith(serveRange(event, shareId, Number(fileIndex)));
});

const askClient = (client, message) =>
  new Promise(resolve => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve({ miss: true }), 120000);
    channel.port1.onmessage = e => {
      clearTimeout(timer);
      resolve(e.data);
    };
    client.postMessage(message, [channel.port2]);
  });

async function serveRange(event, shareId, fileIndex) {
  const match = /bytes=(\d*)-(\d*)/.exec(event.request.headers.get('range') || '');
  const start = match && match[1] ? Number(match[1]) : 0;
  const requestedEnd = match && match[2] ? Number(match[2]) : Infinity;
  const end = Math.min(requestedEnd, start + MAX_RANGE - 1);

  // Ask the tab that played the track first, then any other open Penko Tune tab
  const clients = await self.clients.matchAll({ type: 'window' });
  const own = event.clientId && (await self.clients.get(event.clientId));
  const ordered = own ? [own, ...clients.filter(c => c.id !== own.id)] : clients;

  for (const client of ordered) {
    const reply = await askClient(client, { type: 'penko-share-range', shareId, fileIndex, start, end });
    if (reply.miss) continue;
    if (reply.error) return new Response(reply.error, { status: reply.status || 500 });
    return new Response(reply.data, {
      status: 206,
      headers: {
        'Content-Type': reply.mime || 'application/octet-stream',
        'Content-Range': `bytes ${reply.start}-${reply.end}/${reply.size}`,
        'Content-Length': String(reply.data.byteLength),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
      },
    });
  }
  return new Response('Share not open in any tab', { status: 404 });
}
