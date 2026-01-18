# Deployment Guide

## Production Build

```bash
# Create production build
npm run build

# Preview production build locally
npm run preview
```

The build output will be in the `dist/` directory.

## Deployment Options

### 1. Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Or connect your GitHub repository to Vercel for automatic deployments.

**Configuration**: No additional configuration needed. Vercel auto-detects Vite.

### 2. Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Build and deploy
npm run build
netlify deploy --prod --dir=dist
```

**Build Settings:**
- Build command: `npm run build`
- Publish directory: `dist`

### 3. GitHub Pages

1. Update `vite.config.ts`:
```typescript
export default defineConfig({
  base: '/your-repo-name/',  // Add this line
  plugins: [react()],
  // ... rest of config
})
```

2. Add to `package.json`:
```json
{
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  }
}
```

3. Install and deploy:
```bash
npm install --save-dev gh-pages
npm run deploy
```

### 4. Static Hosting (Any Provider)

Simply upload the contents of the `dist/` folder to any static hosting provider:
- AWS S3 + CloudFront
- Google Cloud Storage
- Azure Static Web Apps
- DigitalOcean App Platform
- Cloudflare Pages

## PWA Considerations

The app is PWA-ready but currently runs as a web app. To enable full PWA functionality:

1. Install `vite-plugin-pwa`:
```bash
npm install vite-plugin-pwa --save-dev
```

2. Update `vite.config.ts`:
```typescript
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        // Your manifest from public/manifest.json
      }
    })
  ]
})
```

3. Generate icons (192x192 and 512x512) for `public/` directory.

## Environment Variables

If you add environment-specific configuration:

1. Create `.env` files:
```
.env                # Shared
.env.local          # Local overrides (git-ignored)
.env.production     # Production
```

2. Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL
```

3. Prefix variables with `VITE_` to expose them to your code.

## Performance Optimization

The app is already optimized, but for additional improvements:

1. **Code Splitting**: Already implemented via dynamic imports
2. **Asset Optimization**: Vite handles this automatically
3. **Caching**: Configure your CDN/hosting for aggressive caching of `/assets/*`
4. **Compression**: Enable gzip/brotli on your server

## Monitoring

Consider adding:
- **Error Tracking**: Sentry, LogRocket
- **Analytics**: Google Analytics, Plausible
- **Performance**: Lighthouse CI

## Domain Setup

After deploying:
1. Update `manifest.json` with your production URL
2. Configure custom domain in your hosting provider
3. Enable HTTPS (usually automatic)
4. Update any hardcoded URLs (currently none)

## Testing Production Build

Before deploying:

```bash
# Build
npm run build

# Preview locally
npm run preview

# Test in production mode
open http://localhost:4173
```

Verify:
- ✅ All features work
- ✅ localStorage persists
- ✅ Export functions work
- ✅ Responsive on mobile
- ✅ No console errors

## Rollback

If issues occur:
1. Vercel/Netlify: Use dashboard to rollback to previous deployment
2. GitHub Pages: Revert the commit
3. Manual: Keep previous `dist/` folder as backup

## Support

For deployment issues:
- Check build logs
- Verify Node.js version compatibility (18+)
- Ensure all dependencies are installed
- Test locally with `npm run preview` first
