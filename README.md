# GSC URL Index Checker

A **fully client-side** web application to check URL indexing status via the Google Search Console URL Inspection API.

## Features

- **Runs entirely in your browser** - no backend server required
- Connect your Google Search Console account via OAuth2 (Google Identity Services)
- Select any verified property from your Search Console
- Check index status for multiple URLs at once (up to 1000)
- Real-time progress tracking
- View detailed indexing information (verdict, coverage state, last crawl, etc.)
- Export results to CSV or JSON
- Privacy-focused: all data stays in your browser

## Deployment

Since this app runs fully client-side, you can deploy it to any static hosting platform:

- **GitHub Pages**
- **Netlify**
- **Vercel**
- **Cloudflare Pages**
- **Any web server**

Just upload the contents of the `/public` folder.

## Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Search Console API**:
   - Go to APIs & Services > Library
   - Search for "Google Search Console API"
   - Click Enable

### 2. Configure OAuth Consent Screen

1. Go to APIs & Services > OAuth consent screen
2. Select "External" user type (or "Internal" for Google Workspace)
3. Fill in the required information:
   - App name: "GSC URL Checker" (or your preferred name)
   - User support email: your email
   - Developer contact: your email
4. Add scope: `https://www.googleapis.com/auth/webmasters.readonly`
5. Add test users (your Google account) if in testing mode

### 3. Create OAuth Credentials

1. Go to APIs & Services > Credentials
2. Click "Create Credentials" > "OAuth client ID"
3. Select **"Web application"**
4. Add your domain to **"Authorized JavaScript origins"**:
   - For local development: `http://localhost:3000`
   - For production: `https://yourdomain.com`
5. Copy the **Client ID** (no client secret needed for client-side apps)

### 4. Configure the App

Edit `public/app.js` and update the `CLIENT_ID` at the top of the file:

```javascript
const CLIENT_ID = 'your-client-id.apps.googleusercontent.com';
```

### 5. Run Locally (Optional)

For local development, you can use the included Express server:

```bash
# Install dependencies
npm install

# Start the server
npm start
```

Open http://localhost:3000 in your browser.

Alternatively, use any static file server:
```bash
# Using Python
python -m http.server 3000 --directory public

# Using npx
npx serve public
```

## Usage

1. Click "Sign in with Google" to connect your Search Console account
2. Select a property from the dropdown
3. Paste URLs to check (one per line, max 1000)
4. Click "Check Index Status"
5. View results and optionally export to CSV or JSON

## API Limits

- 2,000 queries per day per property
- 600 queries per minute per property

## Privacy

This application is designed with privacy in mind:

- **No backend server** - all data processing happens in your browser
- **Direct API calls** - requests go directly from your browser to Google
- **No data storage** - nothing is stored on any server
- **No tracking** - no analytics or tracking cookies
- **Token handling** - OAuth tokens are stored only in sessionStorage and cleared on logout

## Tech Stack

- Google Identity Services (OAuth2)
- Google Search Console API (direct browser calls)
- Vanilla JavaScript (no framework)
- Express.js (optional, for local development only)
