# GSC Bulk URL Index Checker - Chrome Extension

A Chrome extension to check the index status of multiple URLs using Google Search Console API.

## Setup Instructions

### 1. Create a Google Cloud Project (if you don't have one)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Search Console API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Search Console API"
   - Click "Enable"

### 2. Create OAuth 2.0 Credentials for Chrome Extension

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Select **"Chrome Extension"** as the application type
4. Enter a name (e.g., "GSC Index Checker Extension")
5. You'll need your extension ID - see step 4 first, then come back here

### 3. Add Icons

Create PNG icons in the `icons/` folder:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

You can use any icon generator or create simple icons with the GSC logo.

### 4. Load the Extension in Chrome (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this `chrome-extension` folder
5. **Copy the Extension ID** shown under the extension name

### 5. Configure OAuth Client ID

1. Go back to Google Cloud Console → Credentials
2. Edit your Chrome Extension OAuth client
3. Add your Extension ID in the "Item ID" field
4. Save the credentials
5. Copy the **Client ID** (looks like `xxxxx.apps.googleusercontent.com`)

### 6. Update manifest.json

Replace `YOUR_CHROME_EXTENSION_CLIENT_ID` in `manifest.json`:

```json
"oauth2": {
  "client_id": "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/webmasters.readonly"
  ]
}
```

### 7. Reload the Extension

1. Go to `chrome://extensions/`
2. Click the refresh icon on your extension
3. Click the extension icon in your toolbar to test

## Usage

1. Click the extension icon in Chrome toolbar
2. Sign in with your Google account
3. Select a Search Console property
4. Enter URLs to check (one per line, max 1000)
5. Click "Check Index Status"
6. Export results as CSV or JSON

## API Limits

- 2,000 URL inspections per day per property
- 600 queries per minute per property

## Troubleshooting

### "Authorization failed" error
- Make sure the Extension ID in Google Cloud matches your loaded extension
- Verify the Client ID in manifest.json is correct
- Try removing and re-adding the extension

### "No properties found"
- Ensure you're signed in with an account that has Search Console access
- Check that the Google Search Console API is enabled in your Cloud project

### Export not working
- The extension needs the "downloads" permission
- Check that downloads aren't being blocked by Chrome settings
