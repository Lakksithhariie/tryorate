# Orate Chrome Extension - Production Build

**API Endpoint:** https://tryorate.vercel.app/api

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right corner)
3. Click "Load unpacked"
4. Select this `dist` folder
5. The Orate extension icon should appear in your toolbar

## Usage

1. Click the Orate icon to sign in with your email
2. Submit 3-10 writing samples (minimum 1,500 total words)
3. Build your voice profile
4. Select text on any webpage and press `Ctrl/Cmd+Shift+O`
5. Review and accept your voice-matched rewrite

## Files

- `manifest.json` - Extension configuration
- `popup/` - Extension popup UI (sign in, profile management)
- `content/` - Content scripts (text selection, rewrite panel)
- `background/` - Service worker (keyboard shortcuts, API calls)
- `icons/` - Extension icons

## Troubleshooting

If the extension doesn't work:
1. Check that the API URL is correct in the JS files
2. Ensure your Vercel deployment is running
3. Check Chrome console for errors
4. Try reloading the extension

## API Configuration

The extension is configured to use:
- **API Base URL:** https://tryorate.vercel.app/api

If your Vercel URL is different, update these files:
- `popup/popup.js` (line 2)
- `content/content.js` (line 2)
- `background/background.js` (line 2)

Then reload the extension in Chrome.
