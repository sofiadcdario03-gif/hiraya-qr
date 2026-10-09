# Hiraya QR - Deployment Guide

## Local Development

To run the development server:
```bash
npm install
npm run dev
```
The app will be available at http://localhost:5173

## Production Build

To build for production:
```bash
npm run build
```
The built files will be in the `dist/` directory.

To preview the production build:
```bash
npm run preview
```

## Vercel Deployment

### Option 1: Deploy via Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

4. For production deployment:
```bash
vercel --prod
```

### Option 2: Deploy via Vercel Dashboard

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Add New Project"
4. Import your GitHub repository
5. Vercel will automatically detect it's a Vite project
6. Click "Deploy"

### Vercel Configuration (Optional)

Create a `vercel.json` file in the root directory for custom configuration:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install"
}
```

## Environment Variables

No environment variables are required for this application.

## Performance Notes

The production build includes:
- Three.js and React Three Fiber (~1.2MB minified)
- All 6 procedural 3D scenes
- QR code generation library

The bundle size is acceptable for a single-page application with rich 3D graphics. For optimization in the future, consider:
- Code splitting scene components
- Lazy loading heavy 3D assets (if added later)
- Using a CDN for Three.js

## Browser Support

- Modern browsers with WebGL support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers with WebGL support

## Troubleshooting

If you encounter issues during deployment:

1. Ensure all dependencies are installed: `npm install`
2. Clear the build cache: `rm -rf node_modules dist && npm install && npm run build`
3. Check that the build completes successfully locally before deploying
4. Verify Vercel build logs for any errors

## Post-Deployment Checklist

- [ ] Test QR code generation with various URLs
- [ ] Test all 6 theme scenes
- [ ] Test 3D-to-QR transition
- [ ] Test copy link functionality
- [ ] Test download QR code
- [ ] Test share functionality
- [ ] Test on mobile devices
- [ ] Test keyboard navigation
- [ ] Verify accessibility features
