# Penko-tune Roadmap: Alpha to Beta

**Current Status:** Alpha v0.1 - Core Features Complete
**Goal:** Become a true Spotify alternative that's free, open-source, and artist-owned

This roadmap outlines the path from the current alpha release to a production-ready beta that challenges centralized music platforms.

---

## Alpha → Beta Transition Plan

### Current Alpha Features
- Local file playback (MP3, FLAC, WAV, OGG)
- YouTube streaming (ad-free, privacy-focused via Piped/Invidious)
- Network stream support (direct audio URLs)
- 10-band professional equalizer
- 4 visualizer modes (bars, wave/mandala, circle, spiral)
- Keyboard shortcuts & gesture controls
- PWA support (offline capable)
- Zero tracking, fully privacy-focused
- Modern responsive UI

---

## Phase 1: Production Polish & Deployment

### 1.1 Deployment Infrastructure
- [x] Vite build configuration
- [ ] GitHub Actions auto-deployment
- [ ] Custom domain configuration for tune.penkosoftware.org
- [ ] SSL certificate setup via GitHub Pages
- [ ] CNAME file creation

**Deliverable:** Live production site accessible at tune.penkosoftware.org

### 1.2 PWA Enhancements
- [ ] Create proper manifest.json with app metadata
- [ ] Generate PWA icons (192x192, 512x512)
- [ ] Implement service worker for offline support
- [ ] Add install prompts for mobile devices
- [ ] Test offline functionality thoroughly

**Deliverable:** Installable PWA on mobile and desktop

### 1.3 Community Infrastructure
- [ ] Create GitHub Discussions
- [ ] Set up issue templates
- [ ] Add CONTRIBUTORS.md
- [ ] Create GitHub Projects board for roadmap tracking
- [ ] Social media presence (Mastodon, Twitter/X)

**Deliverable:** Active community channels for feedback and contributions

**Status:** Foundation for growth 
**Time Estimate:** 1-2 weeks
**Cost:** $0

---

## Phase 2: Decentralized Distribution - WebTorrent

### Why WebTorrent?
Enables P2P music distribution directly in the browser with zero server costs. Artists can distribute music independently without relying on centralized platforms.

### 2.1 Core WebTorrent Integration
- [ ] Install and configure WebTorrent library
- [ ] Implement torrent seeding from browser
- [ ] Create magnet link playback system
- [ ] Add torrent health indicators (seeders/leechers)
- [ ] Optimize for mobile bandwidth

### 2.2 Artist Upload Interface
- [ ] Build drag-and-drop upload UI
- [ ] Generate torrents client-side
- [ ] Create magnet link sharing system
- [ ] Add metadata editor (artist, album, track info)
- [ ] Implement cover art upload

### 2.3 Artist Registry System
Artists submit JSON catalogs via GitHub PR:
```json
{
  "artist": "Artist Name",
  "bio": "Artist biography",
  "albums": [{
    "title": "Album Title",
    "year": 2025,
    "magnetURI": "magnet:?xt=urn:btih:...",
    "coverArt": "ipfs://Qm...",
    "tracks": [...]
  }]
}
```

**Deliverable:** Fully functional P2P music distribution
**Status:** Critical path to artist independence 
**Time Estimate:** 3-4 weeks
**Cost:** $0

---

## Phase 3: Permanent Storage - IPFS

### Why IPFS?
Content-addressed permanent storage ensures music never disappears, with no hosting costs via public gateways.

### 3.1 IPFS Implementation
- [ ] Integrate ipfs-http-client or Helia
- [ ] Connect to public IPFS gateways
- [ ] Implement upload interface
- [ ] Add CID-based playback
- [ ] Pin important content via Pinata/web3.storage

### 3.2 Cover Art & Metadata Storage
- [ ] Store album art on IPFS
- [ ] Implement IPFS gateway fallbacks
- [ ] Add lazy loading for images
- [ ] Create metadata standards

**Deliverable:** Censorship-resistant permanent music storage
**Status:** Enhances WebTorrent for long-term availability 
**Time Estimate:** 2-3 weeks
**Cost:** $0 (public gateways)

---

## Phase 4: Direct Artist Payments (Weeks 10-14)

### 4.1 Lightning Network Integration
**Instant Bitcoin micropayments with ~$0.001 fees**

- [ ] Install and configure WebLN
- [ ] Implement one-click tipping interface
- [ ] Add Lightning Address support
- [ ] Create artist wallet setup guide
- [ ] Test with Alby, Strike, Phoenix wallets

### 4.2 Monero Privacy Donations
**Anonymous artist support**

- [ ] Display Monero wallet QR codes
- [ ] Add copy-to-clipboard functionality
- [ ] Integrate monero:// URI handling
- [ ] Create simple donation UI

### 4.3 Ethereum L2 Smart Contracts (Optional)
**Automated royalty splits for bands**

- [ ] Deploy RoyaltySplitter contract on Polygon/Base
- [ ] Integrate ethers.js/web3.js
- [ ] Add MetaMask connection
- [ ] Implement split payment UI
- [ ] Test on testnets before mainnet

**Artist Benefits:**
- 100% of payments go directly to artists
- No platform fees or intermediaries
- Support for micropayments (1 cent+)
- Automated band royalty splits

**Deliverable:** Zero-fee direct artist payments
**Status:** Core value proposition 
**Time Estimate:** 3-4 weeks
**Cost:** ~$50 (smart contract deployment only)

---

## Phase 5: Extensibility - Plugin System

### 5.1 Plugin Architecture
```typescript
interface PenkoPlugin {
  name: string;
  version: string;
  onLoad?: () => void;
  onPlay?: (track: Track) => void;
  renderPanel?: () => React.ReactNode;
}
```

### 5.2 Core Plugin Features
- [ ] Design plugin API interface
- [ ] Implement plugin manager
- [ ] Create plugin loader (CDN/GitHub)
- [ ] Build plugin settings UI
- [ ] Add plugin marketplace (static JSON catalog)

### 5.3 Example Plugins
- [ ] Last.fm scrobbler
- [ ] Lyrics fetcher
- [ ] Discord Rich Presence
- [ ] Music recommendations engine
- [ ] Custom visualizers

**Deliverable:** Extensible platform for community features
**Status:** Enables unlimited community innovation 
**Time Estimate:** 4-5 weeks
**Cost:** $0

---

## Phase 6: Social Features - Decentralized Federation 

### Why Federation?
Like Mastodon for music - decentralized, artist-owned, censorship-resistant.

### 6.1 ActivityPub Lite (Static JSON Feeds)
- [ ] Implement WebFinger for artist discovery
- [ ] Create static activity feeds (outbox.json)
- [ ] Build follow system (stored locally)
- [ ] Add federated timeline
- [ ] Support artist-to-artist interactions

### 6.2 Artist Feed System
Artists update feeds via GitHub Actions:
```json
{
  "type": "OrderedCollection",
  "items": [{
    "type": "Create",
    "object": {
      "type": "Audio",
      "name": "New Song",
      "url": "magnet:?xt=..."
    }
  }]
}
```

### 6.3 Discovery Features
- [ ] Trending artists (based on follows)
- [ ] New releases timeline
- [ ] Artist recommendations
- [ ] Collaborative playlists

**Deliverable:** Decentralized music social network
**Status:** Competes with Spotify's social features 
**Time Estimate:** 5-6 weeks
**Cost:** $0

---

## Beta Release Criteria

### Must-Have Features for Beta
- Core player functionality (done)
- YouTube streaming (done)
- WebTorrent P2P distribution
- Artist registry system
- Direct crypto payments
- Production deployment at tune.penkosoftware.org
- PWA installation working
- Mobile-optimized experience

### Quality Standards
- [ ] Zero critical bugs
- [ ] Mobile performance testing
- [ ] Cross-browser compatibility (Chrome, Firefox, Safari)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Security review
- [ ] Privacy policy and terms
- [ ] User documentation

### Success Metrics
- 100 active daily users
- 10 artists using the platform
- 1000+ tracks available via WebTorrent
- Community contributing plugins
- Zero downtime

---

## Long-Term Vision (Post-Beta)

### Advanced Features
- **Offline-first sync** - Multi-device library sync via IPFS
- **Artist analytics** - Privacy-respecting play counts & demographics
- **Live streaming** - WebRTC-based live performances
- **NFT collectibles** - Limited edition releases
- **DAO governance** - Community-owned platform decisions
- **Mobile native apps** - React Native iOS/Android apps

### Partnerships & Integrations
- Integration with existing indie music platforms
- Partnerships with artist collectives
- Integration with decentralized storage providers
- Support for music NFT platforms

---

## Development Principles

### Always Maintain
1. **Zero backend costs** - 100% static PWA architecture
2. **Privacy-first** - No tracking, analytics, or user data collection
3. **Open source** - GPL v3 licensed, fully auditable
4. **Artist-owned** - No platform fees, direct artist control
5. **Decentralized** - No single point of failure

### Technology Choices
- Frontend: React 19, Vite, Tailwind CSS
- Distribution: WebTorrent, IPFS
- Payments: Lightning (WebLN), Monero, Ethereum L2
- Hosting: GitHub Pages, Vercel, Netlify
- Storage: Local browser storage, IPFS for media

---

## Timeline Summary

| Phase | Milestone | Weeks | Cost |
|-------|-----------|-------|------|
| 1 | Production Deploy & PWA | 1-2 | $0 |
| 2 | WebTorrent Integration | 3-4 | $0 |
| 3 | IPFS Storage | 2-3 | $0 |
| 4 | Crypto Payments | 3-4 | ~$50 |
| 5 | Plugin System | 4-5 | $0 |
| 6 | Federation | 5-6 | $0 |

**Total to Beta:** ~18-24 weeks (4-6 months)
**Total Cost:** ~$50 (smart contract deployment only)

---

## How to Contribute

We welcome contributions at any skill level:

- **Developers**: Check open issues, submit PRs for features
- **Artists**: Join early and help test the platform
- **Designers**: UI/UX improvements, branding, artwork
- **Documentation**: User guides, tutorials, translations
- **Testers**: Report bugs, test on different devices

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Get Involved

- **GitHub**: [github.com/NA-Ag/penko-tune](https://github.com/NA-Ag/penko-tune)
- **Discussions**: GitHub Discussions
- **Website**: [tune.penkosoftware.org](https://tune.penkosoftware.org)

