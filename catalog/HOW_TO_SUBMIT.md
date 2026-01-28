# 🎵 How to Submit Your Music to Penko-tune

Welcome! Submitting your music is simple and **100% free**. Here's the process:

---

## Quick Overview

1. Upload your music to IPFS (free, takes 5 minutes)
2. Create a GitHub Pull Request with your metadata
3. Automated system validates and publishes
4. Your music goes live within 5 minutes!

**No approval needed from us - it's fully automated!**

---

## Step 1: Upload Your Music to IPFS (5 minutes)

### Option A: Web3.Storage (Easiest)

1. Go to **https://web3.storage** (free, no credit card)
2. Sign up with email
3. Click **"Upload"**
4. Select your music file (MP3, FLAC, WAV, etc.)
5. Wait for upload to complete
6. **Copy the CID** (looks like: `bafybeig...` or `Qm...`)

### Option B: Pinata

1. Go to **https://pinata.cloud** (free tier available)
2. Sign up
3. Upload your music file
4. Copy the CID

### Option C: Your Own IPFS Node

If you run your own IPFS node:
```bash
ipfs add your-song.mp3
# Copy the returned CID
```

---

## Step 2: Prepare Your Metadata

Create a folder structure like this:

```
catalog/artists/YOUR_ARTIST_ID/
├── profile.json           # Your artist info
├── avatar.jpg             # Your profile picture (optional)
└── releases/
    └── YOUR_RELEASE_ID/
        ├── info.json      # Release + track info
        └── cover.jpg      # Album art (optional)
```

### Example `profile.json`:

```json
{
  "id": "jane-doe-music",
  "name": "Jane Doe",
  "bio": "Independent electronic artist from Portland",
  "genres": ["electronic", "ambient"],
  "avatar": "./avatar.jpg",
  "socialLinks": {
    "website": "https://janedoe.music",
    "bandcamp": "https://janedoe.bandcamp.com",
    "instagram": "@janedoemusic"
  },
  "wallets": {
    "lightning": "jane@getalby.com",
    "monero": "4A...",
    "bitcoin": "bc1..."
  },
  "createdAt": 1703376000000
}
```

### Example `releases/debut-album/info.json`:

```json
{
  "id": "debut-album",
  "title": "Midnight Dreams",
  "type": "album",
  "releaseDate": 1703376000000,
  "coverArt": "./cover.jpg",
  "tracks": [
    {
      "id": "track-1",
      "name": "Starlight",
      "artist": "Jane Doe",
      "duration": 245,
      "ipfsHash": "bafybeig...",
      "url": "https://w3s.link/ipfs/bafybeig...",
      "license": "cc-by",
      "price": 1.00
    },
    {
      "id": "track-2",
      "name": "Moonbeams",
      "artist": "Jane Doe",
      "duration": 312,
      "ipfsHash": "bafybeih...",
      "url": "https://w3s.link/ipfs/bafybeih...",
      "license": "cc-by",
      "price": 1.00
    }
  ]
}
```

---

## Step 3: Update `catalog/artists.json`

Add your artist ID to the main catalog:

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-12-23T16:00:00.000Z",
  "artists": [
    {
      "id": "jane-doe-music",
      "name": "Jane Doe",
      "genres": ["electronic", "ambient"],
      "avatar": "/catalog/artists/jane-doe-music/avatar.jpg",
      "releases": [
        {
          "id": "debut-album",
          "title": "Midnight Dreams",
          "coverArt": "/catalog/artists/jane-doe-music/releases/debut-album/cover.jpg",
          "tracks": [...]
        }
      ]
    }
  ]
}
```

---

## Step 4: Create a Pull Request

1. **Fork** this repository on GitHub
2. **Add your files** to `catalog/artists/YOUR_ID/`
3. **Update** `catalog/artists.json`
4. **Create a Pull Request** with title: "Add artist: YOUR_NAME"

### In the PR description, include:

```
## New Artist Submission

- **Artist Name**: Jane Doe
- **Genre**: Electronic, Ambient
- **Number of Tracks**: 12
- **IPFS CIDs Verified**: ✅
- **Payment Wallets Configured**: ✅

I confirm that:
- [ ] I own the rights to this music
- [ ] IPFS CIDs are valid and accessible
- [ ] All JSON is valid
- [ ] I've read the Artist Manual
```

---

## Step 5: Automated Validation

Our GitHub Actions workflow will automatically:

1. ✅ Validate all JSON syntax
2. ✅ Check required fields exist
3. ✅ Verify IPFS CID format
4. ✅ Auto-approve if all checks pass
5. ✅ Auto-merge your PR
6. ✅ Your music goes live instantly!

**You'll get a comment in ~30 seconds** with the results.

---

## Payment Setup

Fans will send payments directly to your wallet. We support:

### **Lightning Network** (Recommended - Instant & Low Fees)
- Get a free Lightning address: https://getalby.com
- Format: `yourname@getalby.com` or LNURL

### **Monero (Privacy-Focused)**
- Download Cake Wallet or Monerujo
- Create a wallet, copy your XMR address

### **Bitcoin**
- Any Bitcoin wallet works
- Use a native SegWit address (`bc1...`)

### **Ethereum/Arbitrum/Optimism**
- MetaMask or any Ethereum wallet
- Recommend L2 (Arbitrum/Optimism) for lower fees

**Important**: You receive 100% of payments. We never touch your money!

---

## FAQ

### **Q: Do I need to keep my computer on after uploading to IPFS?**

**A:** No! Once uploaded to Web3.Storage/Pinata, your music is permanently stored on IPFS. The service providers pin it for you.

### **Q: How long until my music appears on Penko-tune?**

**A:** ~5 minutes after PR is merged (automated).

### **Q: Can I update my music later?**

**A:** Yes! Just create another PR with updated files.

### **Q: What if my IPFS CID stops working?**

**A:** If using Web3.Storage or Pinata, they guarantee persistence. If self-hosting, make sure your node stays online or use a pinning service.

### **Q: How do I set pricing?**

**A:** Set `"price"` in your track metadata (in USD). This is a suggested amount - fans can pay more or less. Honor system!

### **Q: What if I don't want to charge?**

**A:** Set `"price": 0.00` for free music. You can still accept donations.

### **Q: What about copyright?**

**A:** Only upload music you own or have rights to distribute. See `ARTIST_MANUAL.md` for details.

---

## Need Help?

- 📖 Read the full [Artist Manual](../ARTIST_MANUAL.md)
- 🐛 Report issues: https://github.com/YOUR_REPO/issues
- 💬 Community: [Discord link coming soon]

---

**Ready?** Upload to IPFS → Create PR → Go live! 🚀
