# How Penko Tune Works

A guided tour of the code for students, contributors and the curious. Penko Tune is a normal
React + TypeScript web app with no backend: everything below runs in your browser.

Each section names the files to read and one or two things worth noticing.

---

## 1. Audio in the browser: the Web Audio graph

**Files:** `hooks/useAudioPlayer.ts`

An `<audio>` element can play a file, but to shape the sound (EQ, karaoke, visualizers) the app
routes it through the **Web Audio API**, a graph of processing nodes:

```
deck A ─ gain ─┐
               ├─ mixer ─ 10 × BiquadFilter (EQ) ─ [karaoke] ─ Analyser ─ speakers
deck B ─ gain ─┘                                                    └──── listen-together stream
```

Things to notice:
- **Two decks for gapless playback and crossfades.** The next track is preloaded on the idle
  deck. A 25 ms clock watches the end of the current track and starts the next one just before
  it ends, or fades it in over the crossfade window with `linearRampToValueAtTime`.
- **EQ = ten "peaking" filters** in series, one per frequency band. Moving a slider changes
  that filter's `gain` in decibels.
- **Karaoke** splits stereo into left/right, inverts one channel and adds them back together:
  `L − R`. Vocals are usually mixed dead-centre (equal in both channels), so they cancel out.
- **The visualizer** reads the `AnalyserNode`, which runs a Fast Fourier Transform to turn the
  waveform into frequency bars.
- **Speed without chipmunks:** `playbackRate` with `preservesPitch` time-stretches the audio.
- **ReplayGain** is a loudness value stored in a track's tags; the deck's gain node applies it
  (`10^(dB/20)`) so tracks play at similar volumes.

## 2. Reading tags from files

**Files:** `utils/metadata.ts`, `hooks/useTagScanner.ts`

MP3s store metadata in ID3 frames, FLAC/OGG in Vorbis comments, M4A in MP4 atoms. The
[`music-metadata`](https://github.com/Borewit/music-metadata) library parses all of them.
Embedded cover art is decoded with `createImageBitmap`, drawn onto a 400 px canvas and saved
as a small JPEG, so a 2 MB cover doesn't bloat storage. Scanning runs in the background with a
concurrency limit of 4, and results are applied in batches to avoid re-rendering per file.

## 3. Storing a library without a server

**Files:** `utils/persistence.ts`, `utils/storage.ts`, `hooks/useLinkedFolders.ts`, `utils/folders.ts`

- **IndexedDB** stores tracks (including the audio as a `Blob`), playlists, markers, linked
  folders and shares. Writes use one transaction per save, so a failure rolls back instead of
  leaving half a library.
- **Browsers may delete site data** under storage pressure. `navigator.storage.persist()` asks
  them not to; `navigator.storage.estimate()` powers the storage meter.
- **Linked folders** (Chromium only) use the File System Access API. The app stores a
  *handle* to your folder instead of a copy of the audio. Handles can be saved in IndexedDB,
  but the browser asks for permission again after a restart.

## 4. Getting your music out: streaming zip files

**Files:** `utils/libraryArchive.ts`

Exports write a `.zip` with `library.json` first and each audio file stored uncompressed (audio
is already compressed). [`fflate`](https://github.com/101arrowz/fflate) produces the zip as a
stream, and in Chrome/Edge it's written straight to disk with `showSaveFilePicker`, so a 20 GB
library never has to fit in memory. Imports stream the other way and save each track as soon as
it's unpacked.

## 5. Sharing with friends: encrypted peer-to-peer

**Files:** `utils/shareCrypto.ts`, `utils/sharing.ts`, `hooks/useSharing.ts`, `public/share-sw.js`

1. **Encryption.** Each file is split into 64 KiB chunks and sealed with **AES-256-GCM**. The IV
   (nonce) is built from the file number and chunk number, so any chunk can be decrypted on its
   own. That is what makes seeking possible. Encryption is also deterministic, so re-sharing
   after a restart rebuilds the identical torrent and the old link keeps working.
2. **Transport.** The encrypted files are seeded with [WebTorrent](https://webtorrent.io),
   which connects browsers directly with **WebRTC**. Trackers only introduce peers; they see a
   torrent ID and IP addresses, never the music.
3. **The key never touches a server.** Links look like `…/#share=<infohash>.<key>`. Browsers
   don't send the part after `#` to anyone, and the app removes it from the address bar.
4. **Streaming with seeking.** The `<audio>` element asks for byte ranges like any web page. A
   **service worker** intercepts those requests, asks the page for exactly those bytes, and the
   page fetches and decrypts just the chunks it needs from peers.

## 6. Listening together: live WebRTC audio

**Files:** `hooks/useListenTogether.ts`

The host's audio graph feeds a `MediaStreamAudioDestinationNode`, which turns what you hear into
a live stream. [Trystero](https://github.com/dmotz/trystero) handles matchmaking and sends the stream to each
friend over WebRTC. It signals over two free networks at once, public Nostr relays and the
WebTorrent trackers, and keeps whichever connects first. In testing, the tracker handshake
between different browsers missed about a third of the time, while Nostr connected in about a
second. The room password
encrypts the connection handshake. The app edits the session description to request stereo
Opus at music bitrates instead of WebRTC's voice-call defaults.

## 7. Working offline: the PWA

**Files:** `vite.config.ts` (vite-plugin-pwa), `public/share-sw.js`

A service worker caches the app's files so it opens with no connection, and the web app
manifest lets it be installed like a native app.

## 8. Eleven languages

**Files:** `translations.ts`, `locales/*.ts`, `utils/i18n.ts`

`locales/en.ts` defines every string. Each other locale is typed as `Translation`, so
TypeScript refuses to build if a language is missing a string. Counts are written as
"Tracks added: 3" rather than "3 tracks added", which avoids needing plural rules (Russian and
Ukrainian have three plural forms).

## 9. Testing

**Files:** `tests/e2e/*.mjs`, `tests/run.mjs`

`npm run test:e2e` builds the app and drives it in real Chromium and Firefox with Playwright.
The sharing suite starts **two separate browsers** and checks that one can stream, seek and save
music from the other.

---

## Ideas for student projects

- Add a new visualizer mode (`components/Visualizer.tsx`, d3 + SVG)
- Add a new EQ preset, or a "loudness" curve (`utils/persistence.ts`)
- Show the frequency axis (Hz) on the spectrum visualizer
- Improve a translation you speak natively (`locales/`)
- Write a test for a feature that isn't covered yet (`tests/e2e/`)
