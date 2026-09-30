# Penko-tune Roadmap

Penko-tune is a privacy-first player for music you own, with direct device-to-device sharing between friends. No accounts, no servers holding your data, no third parties in the middle.

---

## Phase 1: A Great Local Player

- [x] Read embedded tags (ID3, Vorbis, MP4) for title, artist, album, track number and cover art
- [x] Library search and sorting
- [x] Album / artist browse views
- [x] Play queue ("Play next", "Add to queue")
- [ ] Drag to reorder the queue
- [x] Remember volume, shuffle, repeat and last-played track between sessions
- [ ] Drag to reorder playlists
- [x] Gapless playback and crossfade
- [x] Volume normalization (ReplayGain)
- [x] Edit track info and lyrics

## Practice & Education

- [x] Playback speed with pitch preserved
- [x] A-B looping and looping between chapter markers
- [x] Synced lyrics (tags, .lrc files, pasted)
- [x] Custom trackers and STUN/TURN relays for school networks
- [x] Guides: [How it works](docs/HOW_IT_WORKS.md), [For teachers](docs/FOR_TEACHERS.md)
- [ ] Frequency axis labels on the spectrum visualizer

## Phase 2: Keeping Your Music Safe

- [x] Persistent storage request, storage meter, eviction and "install the app" warnings
- [x] Download any track's original file
- [x] Full library export/import as a `.zip` (audio + playlists + markers + settings)
- [x] Link a music folder instead of copying (Chromium desktop browsers)

## Phase 3: Sharing With Friends

- [x] Encrypted share links for tracks and playlists (key only in the `#fragment`)
- [x] "Stream only" and "Send a copy" modes; streaming with seeking via a service worker
- [x] Save received tracks and playlists to your library
- [x] Links survive restarts: shares are re-seeded automatically when Penko Tune opens
- [x] Clear messages when a friend can't be reached

## Phase 4: Listen Together

- [x] Live sessions: friends hear the host's playback over WebRTC, in stereo
- [x] Fast, reliable session discovery (Nostr relays and trackers in parallel)
- [ ] Optional self-hosted tracker for people who don't want to use public ones

## Ongoing

- [x] Complete translations for all 11 languages (enforced at compile time)
- Native-speaker review of the translations
- Accessibility: keyboard focus, screen reader labels
- [x] End-to-end tests in Chromium and Firefox (`npm run test:e2e`)

---

## Non-goals

- Streaming from commercial platforms or routing traffic through third-party proxies
- Hosted catalogs, accounts, or anything that requires trusting a central server
