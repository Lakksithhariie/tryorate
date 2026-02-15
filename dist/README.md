# Orate Chrome Extension - Production Build

**API Endpoint:** https://tryorate.vercel.app/api

## Installation

1. Download this `/dist` folder
2. Open Chrome → `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select this `dist` folder

## Usage

1. Click the Orate icon to sign in
2. Submit 3-10 writing samples (1,500+ words)
3. Build your voice profile
4. Select text and press `Ctrl/Cmd+Shift+O`
5. Get voice-matched rewrites

## Design System

This extension follows the Orate PRD v2.0 design system:
- **Colors:** Surface #FAFAF9, Accent #6C63FF, Success #10B981
- **Typography:** Inter font family
- **Components:** 8px border radius, consistent shadows
- **Interactions:** Smooth animations, toast notifications

## Files

- `manifest.json` - Extension config
- `popup/` - Auth and dashboard UI
- `content/` - Rewrite panel
- `background/` - Service worker
- `icons/` - Extension icons
