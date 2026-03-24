/**
 * cloudService.ts
 * ---------------
 * Handles cloud storage integrations:
 *  - Google Drive  : OAuth2 PKCE (no backend required)
 *  - OneDrive      : MSAL.js implicit/PKCE flow
 *  - iCloud Drive  : informational only (requires Apple Developer account)
 *  - Local folder  : File System Access API — window.showDirectoryPicker()
 *                    (Chrome / Edge only; not supported on Safari / iOS)
 *
 * SETUP INSTRUCTIONS
 * ------------------
 * Google Drive:
 *   1. Go to https://console.cloud.google.com/
 *   2. Create a project → APIs & Services → Enable "Google Drive API"
 *   3. Credentials → Create OAuth 2.0 Client ID → Web application
 *   4. Add your domain (e.g. https://your-app.vercel.app) to "Authorised JavaScript origins"
 *      and to "Authorised redirect URIs" (same URL, no path needed for PKCE).
 *   5. Copy the Client ID and paste it in GOOGLE_CLIENT_ID below.
 *
 * OneDrive:
 *   1. Go to https://portal.azure.com/ → App registrations → New registration
 *   2. Platform: Single-page application (SPA)
 *   3. Redirect URI: https://your-app.vercel.app (or http://localhost:5173 for dev)
 *   4. Copy the Application (client) ID and paste it in MSFT_CLIENT_ID below.
 *   5. Under "API permissions" add: Files.ReadWrite.AppFolder (Microsoft Graph)
 */

import { PublicClientApplication, AuthenticationResult, Configuration } from '@azure/msal-browser';

// ─── Configuration (replace with your own credentials) ───────────────────────

const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const MSFT_CLIENT_ID   = 'YOUR_AZURE_APP_CLIENT_ID';

// ─── Storage keys ─────────────────────────────────────────────────────────────

const LS_GOOGLE_TOKEN   = 'prscan_google_token';
const LS_ONEDRIVE_TOKEN = 'prscan_onedrive_token';
const LS_ARCHIVE_DIR    = 'prscan_archive_dir_name'; // only stores the display name

// ─── Types ───────────────────────────────────────────────────────────────────

export type CloudStatus = 'connected' | 'disconnected' | 'unavailable';

export interface CloudProviderState {
  status: CloudStatus;
  email?: string;
}

// ─── Google Drive ─────────────────────────────────────────────────────────────
// Uses the OAuth2 PKCE implicit flow via the Google Identity Services library.
// No server needed — the access token is obtained entirely in the browser.

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }): { requestAccessToken(): void };
        };
      };
    };
  }
}

function loadGoogleGIS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload  = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

export async function googleDriveConnect(): Promise<void> {
  if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') {
    throw new Error(
      'Google Drive is not configured yet.\n\n' +
      'Open src/services/cloudService.ts and set GOOGLE_CLIENT_ID.\n' +
      'See the SETUP INSTRUCTIONS at the top of the file.'
    );
  }
  await loadGoogleGIS();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback(resp) {
        if (resp.error) { reject(new Error(resp.error)); return; }
        if (resp.access_token) {
          localStorage.setItem(LS_GOOGLE_TOKEN, resp.access_token);
          resolve();
        }
      },
    });
    client.requestAccessToken();
  });
}

export function googleDriveDisconnect(): void {
  localStorage.removeItem(LS_GOOGLE_TOKEN);
}

export function googleDriveStatus(): CloudProviderState {
  const token = localStorage.getItem(LS_GOOGLE_TOKEN);
  return { status: token ? 'connected' : 'disconnected' };
}

export async function uploadToGoogleDrive(blob: Blob, fileName: string): Promise<string> {
  const token = localStorage.getItem(LS_GOOGLE_TOKEN);
  if (!token) throw new Error('Not connected to Google Drive. Connect in Settings first.');

  // Multipart upload to Drive REST API v3
  const metadata = JSON.stringify({ name: fileName, mimeType: blob.type });
  const body = new FormData();
  body.append('metadata', new Blob([metadata], { type: 'application/json' }));
  body.append('file', blob);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) {
      googleDriveDisconnect();
      throw new Error('Google Drive session expired. Please reconnect in Settings.');
    }
    throw new Error(err?.error?.message ?? `Drive upload failed (${res.status})`);
  }
  const data = await res.json();
  return data.id as string; // Drive file ID
}

// ─── OneDrive (MSAL.js) ───────────────────────────────────────────────────────
// Uses @azure/msal-browser for the token acquisition (PKCE SPA flow).

let msalInstance: PublicClientApplication | null = null;

function getMsalInstance(): PublicClientApplication {
  if (msalInstance) return msalInstance;
  const config: Configuration = {
    auth: {
      clientId: MSFT_CLIENT_ID,
      authority: 'https://login.microsoftonline.com/common',
      redirectUri: window.location.origin,
    },
    cache: { cacheLocation: 'localStorage' },
  };
  msalInstance = new PublicClientApplication(config);
  return msalInstance;
}

export async function oneDriveConnect(): Promise<void> {
  if (MSFT_CLIENT_ID === 'YOUR_AZURE_APP_CLIENT_ID') {
    throw new Error(
      'OneDrive is not configured yet.\n\n' +
      'Open src/services/cloudService.ts and set MSFT_CLIENT_ID.\n' +
      'See the SETUP INSTRUCTIONS at the top of the file.'
    );
  }
  const msal = getMsalInstance();
  await msal.initialize();
  const result: AuthenticationResult = await msal.loginPopup({
    scopes: ['Files.ReadWrite.AppFolder', 'User.Read'],
  });
  localStorage.setItem(LS_ONEDRIVE_TOKEN, result.accessToken);
}

export function oneDriveDisconnect(): void {
  localStorage.removeItem(LS_ONEDRIVE_TOKEN);
  msalInstance = null;
}

export function oneDriveStatus(): CloudProviderState {
  const token = localStorage.getItem(LS_ONEDRIVE_TOKEN);
  return { status: token ? 'connected' : 'disconnected' };
}

export async function uploadToOneDrive(blob: Blob, fileName: string): Promise<string> {
  let token = localStorage.getItem(LS_ONEDRIVE_TOKEN);
  if (!token) throw new Error('Not connected to OneDrive. Connect in Settings first.');

  // Try a silent token refresh first
  try {
    const msal = getMsalInstance();
    await msal.initialize();
    const accounts = msal.getAllAccounts();
    if (accounts.length > 0) {
      const result = await msal.acquireTokenSilent({
        scopes: ['Files.ReadWrite.AppFolder'],
        account: accounts[0],
      });
      token = result.accessToken;
      localStorage.setItem(LS_ONEDRIVE_TOKEN, token);
    }
  } catch {
    // Silent refresh failed — existing token may still work
  }

  // Upload via Microsoft Graph API (special /approot folder — no extra permissions needed)
  const encodedName = encodeURIComponent(fileName);
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${encodedName}:/content`,
    { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': blob.type }, body: blob }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) {
      oneDriveDisconnect();
      throw new Error('OneDrive session expired. Please reconnect in Settings.');
    }
    throw new Error(err?.error?.message ?? `OneDrive upload failed (${res.status})`);
  }
  const data = await res.json();
  return data.id as string; // OneDrive item ID
}

// ─── iCloud Drive ─────────────────────────────────────────────────────────────
// CloudKit JS requires an Apple Developer account ($99/year) and cannot be used
// on a free plan. The function below throws an informational error.

export function iCloudStatus(): CloudProviderState {
  return { status: 'unavailable' };
}

export function iCloudConnect(): never {
  throw new Error(
    'iCloud Drive requires an Apple Developer account ($99/year).\n\n' +
    'PRScan uses CloudKit JS, which is only available to registered Apple developers.\n' +
    'As an alternative, you can use Google Drive or OneDrive (both free).'
  );
}

// ─── Local Archive Folder (File System Access API) ───────────────────────────
// Allows the user to pick a persistent local folder as a personal archive.
// BROWSER SUPPORT: Chrome 86+, Edge 86+, Android Chrome 109+.
// NOT supported on: Safari, Firefox, iOS (any browser).

const fsHandleCache = new Map<string, FileSystemDirectoryHandle>();

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function pickArchiveFolder(): Promise<string> {
  if (!isFileSystemAccessSupported()) {
    throw new Error(
      'Folder picker is not supported in this browser.\n\n' +
      'Use Chrome or Edge on desktop or Android.\n' +
      'Safari and iOS do not support the File System Access API.'
    );
  }
  const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
  fsHandleCache.set(handle.name, handle);
  localStorage.setItem(LS_ARCHIVE_DIR, handle.name);
  return handle.name;
}

export function getArchiveFolderName(): string | null {
  return localStorage.getItem(LS_ARCHIVE_DIR);
}

export function clearArchiveFolder(): void {
  localStorage.removeItem(LS_ARCHIVE_DIR);
}

export async function saveToArchiveFolder(blob: Blob, fileName: string): Promise<void> {
  const folderName = localStorage.getItem(LS_ARCHIVE_DIR);
  if (!folderName) throw new Error('No archive folder selected. Pick one in Settings first.');

  const handle = fsHandleCache.get(folderName);
  if (!handle) {
    throw new Error(
      'The archive folder handle is no longer available.\n' +
      'Please re-select the folder in Settings (browser security requires this after a page reload).'
    );
  }
  const fileHandle = await handle.getFileHandle(fileName, { create: true });
  const writable   = await (fileHandle as any).createWritable();
  await writable.write(blob);
  await writable.close();
}
