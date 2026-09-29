# Penko-tune

**A privacy-first music player for the music you own — and for sharing it with friends.**

Inspired by the freedom and quality of VLC: your library lives on your device, nothing is tracked, and there are no accounts. When you want to share a track with a friend, it goes straight from your device to theirs.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## Principles

- **Local-first** - Your library, playlists and settings stay on your device (IndexedDB)
- **No middlemen** - No accounts, no analytics, no proxies between you and your music
- **Peer-to-peer sharing** - Friends get music directly from your device, end-to-end encrypted
- **Open source** - Fully auditable code (GPL v3)

---

## Features

### Playback
- **Local files** - Add files, import whole folders, or drag & drop
- **Network streams** - Direct audio URLs and internet radio, fetched by your browser directly
- **Magnet links** - Play tracks shared over WebTorrent
- **PWA + desktop app** - Install from the browser, or use the Electron build; works offline

### Audio tools
- **10-band equalizer** with built-in and custom presets
- **Vocal reduction** (karaoke mode)
- **8 visualizer modes** - Bars, spectrum, mandala, circle, spiral, particles, rings, DNA helix
- **Sleep timer**
- **Chapter markers** - Right-click the seek bar to bookmark a moment

### Your library
- **Add files, folders or drag & drop**, or **link a music folder** (Chrome, Edge, Brave, Opera on desktop): linked music stays on your disk and is read directly, so nothing is copied
- **Storage safety** - A storage meter, protection from browser clean-up (persistent storage), and clear warnings when your library is at risk or getting large
- **Get your music out any time** - Download any track's original file, or export everything (audio, playlists, markers, settings) as one `.zip` you can import on any device
- **Reads your tags** - Title, artist, album, track number, year, genre and embedded cover art (MP3, FLAC, OGG, M4A, WAV, ...), parsed on-device
- **Search & sort** - Filter by title/artist/album/genre/year; sort by title, artist, album (in track order), duration or date added
- **Up Next queue** - "Play next" and "Add to queue" from any track's menu
- **Picks up where you left off** - Last track, position, volume, shuffle/repeat, sort and language are remembered
- **Playlists** with custom covers; playback follows the list you're looking at (including search and sort)
- **Custom album art** per track
- **Library info backups** - Playlists and settings as a small `.json`, optionally password-protected (AES-GCM)

### Share with friends
- **Share links** for a track or playlist. Choose **Stream only** (friends listen while you're online) or **Send a copy** (they can save it)
  - Encrypted on your device; the key is only in the link's `#fragment`, which is never sent to any server
  - Friends start listening right away and can seek; the audio streams straight from your device over WebTorrent
- **Listen together** - Start a session and send the link; friends hear what you play, live (including your EQ)
- **Zero infrastructure** - No accounts or servers; peers find each other through free public WebTorrent trackers, which only ever see encrypted data
- Things to know: the sharer needs Penko Tune open, connections are direct (peers can see each other's IP address), and some work/school networks block direct connections

### Controls
| Key | Action |
| --- | --- |
| Space | Play / pause |
| ← / → | Seek -10s / +10s |
| ↑ / ↓ | Volume |
| M | Mute |
| S | Shuffle |
| R | Repeat (off → all → one) |
| N / P | Next / previous track |
| / | Search library |

In the visualizer view: swipe to change track, double-tap left/right to skip, hold for 2x speed. Lock-screen and hardware media keys are supported.

---

## Quick Start

**Prerequisites:** Node.js 20+

```bash
npm install
npm run dev          # http://localhost:3000
```

No API keys, no sign-up, no configuration.

```bash
npm run build        # static site in dist/
npm run electron:dev # desktop app against the dev server
npm run electron:build
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting guides.

---

## Roadmap

See **[ROADMAP.md](ROADMAP.md)**. Next up:

1. Album / artist browse views
2. Reorder the queue and playlists by dragging
3. Complete translations for the newest features

---

## License

GPL v3 - See [LICENSE.md](LICENSE.md) for details.

---

## Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines and [ROADMAP.md](ROADMAP.md) for feature ideas.
