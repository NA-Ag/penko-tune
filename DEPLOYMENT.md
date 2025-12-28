# Penko-tune Deployment Guide

Complete guide to deploying Penko-tune with full YouTube streaming support.

---

## Prerequisites

- Node.js 18+
- Git repository on GitHub
- (Optional) Custom domain

---

## GitHub Pages Deployment (Recommended)

GitHub Pages is **100% free** and perfect for static sites like Penko-tune.

### Method 1: Automatic (GitHub Actions)

**The `.github/workflows/deploy.yml` file is already included!**

1. **Push your code to GitHub:**
```bash
git add .
git commit -m "Initial commit - Penko-tune"
git branch -M main
git remote add origin https://github.com/yourusername/penko-tune.git
git push -u origin main
```

2. **Enable GitHub Pages:**
- Go to your repo → **Settings** → **Pages**
- Source: **GitHub Actions**
- Save

3. **That's it!**
- GitHub Actions will automatically build and deploy
- Your site: `https://yourusername.github.io/penko-tune`
- Every push to `main` triggers a new deployment

### Method 2: Manual Deployment

```bash
# Build the project
npm run build

# Install gh-pages package
npm install -D gh-pages

# Add to package.json scripts:
# "deploy": "gh-pages -d dist"

# Deploy
npm run deploy
```

### Custom Domain (Optional)

1. Add a `CNAME` file to `/public` folder:
```
penkotune.com
```

2. Configure DNS:
- Add A records pointing to GitHub's IPs
- Or CNAME to `yourusername.github.io`

3. Enable HTTPS in repo settings

---

## Vercel Deployment (Fastest)

**One-click deploy with automatic HTTPS and CDN:**

1. **Connect GitHub:**
   - Go to [vercel.com](https://vercel.com)
   - "New Project" → Import your GitHub repo

2. **Configure:**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Deploy:**
   - Click "Deploy"
   - Your site: `https://penko-tune.vercel.app`
   - Custom domain supported for free

**Automatic updates:** Every push to main auto-deploys!

---

## Netlify Deployment

### Method 1: Drag & Drop

```bash
npm run build
```
- Go to [Netlify Drop](https://app.netlify.com/drop)
- Drag `dist` folder
- Instant deployment!

### Method 2: Continuous Deployment

1. **Connect GitHub:**
   - [Netlify Dashboard](https://app.netlify.com) → "New site from Git"
   - Choose your repo

2. **Configure:**
   - Build command: `npm run build`
   - Publish directory: `dist`

3. **Deploy:**
   - Auto-deploys on every push
   - Free HTTPS + CDN
   - Your site: `https://random-name.netlify.app`

---

## Self-Hosted (Docker)

For full control and federation features (coming in Phase 4).

### Dockerfile (create this file):

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### nginx.conf:

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server {
        listen 80;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        # Enable gzip compression
        gzip on;
        gzip_types text/css application/javascript application/json;
    }
}
```

### Deploy:

```bash
# Build image
docker build -t penko-tune .

# Run
docker run -p 80:80 penko-tune

# Or use docker-compose
docker-compose up -d
```

### docker-compose.yml:

```yaml
version: '3.8'
services:
  penko-tune:
    build: .
    ports:
      - "80:80"
    restart: unless-stopped
```

---

## Other Platforms

### Cloudflare Pages

```bash
# Build
npm run build

# Deploy with Wrangler
npm install -g wrangler
wrangler pages publish dist
```

### Railway

- Connect GitHub repo
- Build Command: `npm run build`
- Start Command: `npx serve dist`

### Render

- Connect GitHub
- Build: `npm run build`
- Publish: `dist`
- Static site option

---

## Verification Checklist

After deployment, verify these features work:

- [ ] Local file upload (file picker)
- [ ] Folder import
- [ ] **YouTube streaming** (paste a YouTube URL)
- [ ] Equalizer controls
- [ ] Visualizer modes
- [ ] Gesture controls (swipe, double-tap)
- [ ] Keyboard shortcuts
- [ ] PWA installation (Add to Home Screen)
- [ ] Audio playback without errors

---

## Troubleshooting

### YouTube Streaming Not Working

**Issue:** "Could not find audio stream"

**Causes:**
1.  **Localhost** - Expected! Works only when deployed
2. ❌ **Invalid video** - Try a different YouTube URL
3. ❌ **Regional restrictions** - Video blocked in some countries
4. ❌ **Privacy frontends down** - Piped/Invidious instances sometimes go offline

**Solutions:**
- Deploy to GitHub Pages/Vercel/Netlify
- Wait a few minutes (instances may be temporarily down)
- Try different videos

### 404 on GitHub Pages

**Issue:** Page refreshes show 404

**Fix:** Vite already configured for SPA routing. If issues persist:
- Ensure `base` in `vite.config.ts` matches your repo name
- Check GitHub Pages source is set to "GitHub Actions"

### Build Fails

```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Assets Not Loading

- Check `vite.config.ts` base path
- Verify `/public` folder structure
- Check browser console for 404s

---

## Security Notes

**Penko-tune is secure by design:**
- No backend required (static site)
- No API keys needed
- No user data collected
- All processing client-side
- YouTube via privacy frontends (Piped/Invidious)

**HTTPS is automatic** on:
- GitHub Pages
- Vercel
- Netlify
- Cloudflare Pages

---

## Performance Optimization

### Production Build Tips

1. **Optimize build:**
```bash
# Already configured in vite.config.ts
npm run build
```

2. **Verify bundle size:**
```bash
npx vite-bundle-visualizer
```

3. **Enable CDN caching:**
- GitHub Pages: Automatic
- Vercel/Netlify: Automatic global CDN

### Performance Targets

- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Bundle size: ~500KB (already optimized!)

---

## Custom Domain Setup

### GitHub Pages

1. Add `CNAME` file to `/public`:
```
penkotune.com
```

2. Configure DNS (at your domain registrar):
```
Type: A
Host: @
Value: 185.199.108.153
       185.199.109.153
       185.199.110.153
       185.199.111.153

Type: CNAME
Host: www
Value: yourusername.github.io
```

3. Enable "Enforce HTTPS" in repo settings

### Vercel/Netlify

- Add domain in dashboard
- Update DNS to provided nameservers
- SSL automatic

---

## What Works After Deployment

### Fully Functional Features

- **YouTube Streaming** - Ad-free, privacy-focused
- Local file playback
- Folder import
- Equalizer (10-band)
- 4 visualizer modes
- Gesture controls
- Keyboard shortcuts
- PWA installation
- Offline playback (local files)
- All audio controls

### 🔜 Coming Soon (Phase 2+)

- WebTorrent integration
- IPFS music hosting
- Lightning payments
- Federation
- Plugins

See [UPGRADE_PROPOSAL.md](UPGRADE_PROPOSAL.md) for roadmap!

---

## Support

**Issues deploying?**
- Check [GitHub Issues](https://github.com/yourusername/penko-tune/issues)
- Join the community (coming soon!)
- Read the [UPGRADE_PROPOSAL.md](UPGRADE_PROPOSAL.md)

---

**Built by the community.**

**Deploy once. Music forever. Free forever.** 
