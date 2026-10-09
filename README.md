# Hiraya QR

An interactive 3D QR code generator inspired by Filipino folklore and heritage. Transform ordinary QR codes into miniature 3D worlds with smooth transitions between immersive dioramas and scannable QR codes.

## Features

- **6 Procedural 3D Themes**: Enchanted Balete, Diwata's Garden, Sarimanok Sanctuary, Bahay Kubo Village, Maria Makiling's Mountain, and Philippine Coral Kingdom
- **Smooth Transitions**: Beautiful camera animations between 3D worlds and flat QR codes
- **Theme-Matching QR Codes**: QR codes use color palettes that match each theme
- **Interactive Controls**: Orbit camera in 3D mode, click to toggle views
- **Share & Export**: Copy links, download QR codes, and share via native sharing
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Accessible**: Keyboard navigation, screen reader support, and ARIA labels

## Technology Stack

- **React.js** - UI framework
- **Vite** - Build tool and dev server
- **Three.js** - 3D rendering
- **React Three Fiber** - React renderer for Three.js
- **@react-three/drei** - Three.js helpers and utilities
- **qrcode** - QR code generation

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### Production Build

```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Usage

1. Enter a URL in the input field
2. Click the send button or press Enter
3. A 3D world will appear based on the selected theme
4. Click the world or use the toggle button to reveal the QR code
5. Switch between themes using the gallery below
6. Use the options menu to copy, download, or share

## Project Structure

```
hiraya-qr/
├── public/              # Static assets
├── src/
│   ├── components/      # React components
│   │   ├── Header.jsx
│   │   ├── URLInput.jsx
│   │   ├── ViewToggle.jsx
│   │   ├── DesignGallery.jsx
│   │   └── DesignCard.jsx
│   ├── scenes/          # 3D scene components
│   │   ├── WorldCanvas.jsx
│   │   ├── BaleteScene.jsx
│   │   ├── DiwataScene.jsx
│   │   ├── SarimanokScene.jsx
│   │   ├── BahayKuboScene.jsx
│   │   ├── MariaMakilingScene.jsx
│   │   └── CoralKingdomScene.jsx
│   ├── hooks/           # Custom React hooks
│   │   └── useQRCode.js
│   ├── utils/           # Utility functions
│   │   ├── generateQR.js
│   │   ├── sharing.js
│   │   └── themes.js
│   ├── App.jsx          # Main application
│   ├── main.jsx         # Entry point
│   └── styles.css       # Global styles
├── package.json
├── vite.config.js
└── README.md
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions, including Vercel deployment.

## Design Philosophy

Hiraya QR celebrates Filipino cultural heritage through:

- **Enchanted Balete**: Inspired by Philippine folklore surrounding enchanted trees
- **Diwata's Garden**: Inspired by Filipino nature spirits and enchanted forests
- **Sarimanok Sanctuary**: Inspired by the colorful Maranao cultural symbol
- **Bahay Kubo Village**: Inspired by traditional Filipino rural architecture
- **Maria Makiling's Mountain**: Inspired by Philippine mountain folklore
- **Philippine Coral Kingdom**: Inspired by marine biodiversity

All 3D environments are procedurally generated using Three.js geometry, materials, and animations—no external 3D models required.

## License

This project is open source and available for educational purposes.

## Acknowledgments

- Inspired by Filipino folklore and cultural heritage
- Built with modern web technologies
- Designed to be accessible and inclusive
