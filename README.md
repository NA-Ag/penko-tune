# Penko-tune

**An open-source, privacy-focused alternative to modern music platforms.**

Inspired by the freedom and quality of VLC, Penko-tune aims to democratize access to music platforms while providing users with an exceptional listening experience. We empower artists with the tools necessary to build and control their platforms in a completely independent manner—no middlemen, no platform fees, no compromises.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](UPGRADE_PROPOSAL.md)

---

## Mission

**For Listeners:**
- Privacy-first music experience without tracking or ads
- Full control over your music library and data
- Professional-grade audio tools (equalizer, visualizers, effects)
- Freedom to listen how you want, where you want

**For Artists:**
- 100% ownership of your music and distribution
- Zero platform fees—you keep everything
- Direct connection with your fans
- Tools to build sustainable, independent careers

**Inspired by VLC's principles:** Free, open, community-driven, no strings attached.

---

## Features

### Music Playback
- **Local Files** - Import individual files or entire folders
- **YouTube Streaming** - Ad-free, privacy-focused streaming (works on deployed version)
- **Network Streams** - Support for direct audio URLs
- **PWA Support** - Install as app, works offline

### Professional Audio Tools
- **10-Band Equalizer** - Fine-tune your sound with professional-grade EQ
- **4 Visualizer Modes** - Bars, wave/mandala, circle, spiral
- **Audio Controls** - Volume, shuffle, repeat, playback rate
- **Keyboard Shortcuts** - Full keyboard navigation for power users
- **Gesture Controls** - Swipe, double-tap, hold for 2x speed

### Privacy & Freedom
- **Zero Tracking** - No analytics, cookies, or surveillance
- **Local-First** - Your data stays on your device
- **Open Source** - Fully auditable code (GPL v3)
- **No Accounts** - No sign-up, no email, no personal data required

### User Experience
- **Modern UI** - Clean, dark theme built with Tailwind CSS
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Touch & Mouse** - Optimized for all input methods
- **Fast & Lightweight** - Powered by Vite and React 19

---

## Quick Start

### Local Development

**Prerequisites:** Node.js 18+

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

**That's it!** No API keys, no sign-up, no configuration needed.

> **Note:** YouTube streaming requires a deployed version due to CORS restrictions. When deployed on GitHub Pages, Vercel, Netlify, etc., the feature works automatically with privacy-focused Piped/Invidious APIs. See [UPGRADE_PROPOSAL.md](UPGRADE_PROPOSAL.md) for deployment guides.

### Deployment (YouTube Streaming Enabled)

Deploy to any static hosting platform:

**GitHub Pages:**
```bash
npm run build
# Deploy /dist folder to GitHub Pages
```

**Vercel/Netlify:**
- Connect your GitHub repo
- Build command: `npm run build`
- Output directory: `dist`
- YouTube streaming will work automatically

Once deployed, all features including YouTube ad-free streaming are fully functional.

---

## Roadmap

See **[UPGRADE_PROPOSAL.md](UPGRADE_PROPOSAL.md)** for the full vision:
- WebTorrent/IPFS music distribution
- Crypto payments (Lightning, Monero, Ethereum L2)
- Mastodon-style federation
- Plugin ecosystem
- Artist platform (zero platform fees!)

**Goal:** A true Spotify alternative that's free, open, and artist-owned.

---

## License

GPL v3 - See [LICENSE](LICENSE) for details.

**Why GPL v3?** Keeps Penko-tune free forever, prevents corporate takeovers.

---

## Contributing

PRs welcome! Check out the [UPGRADE_PROPOSAL.md](UPGRADE_PROPOSAL.md) for ideas.

---

**Built by the community. Music for the people, by the people.**
