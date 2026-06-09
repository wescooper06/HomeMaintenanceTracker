import { formatDate } from './utils.js';

const GOOGLE_OAUTH_CLIENT_ID = window.GOOGLE_OAUTH_CLIENT_ID || '902309416260-4v04g0nc6fa4lt9otb2gm4ijkfhgoc1s.apps.googleusercontent.com';
const GOOGLE_OAUTH_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_STORAGE_KEY = 'home-maintenance-access-token';
const TOKEN_EXPIRE_STORAGE_KEY = 'home-maintenance-token-expiry';
const AUTH_ORIGIN = window.location.origin;
const REDIRECT_URI = `${AUTH_ORIGIN}${window.location.pathname}`;
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
let authPromise = null;

function parseHash(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return {
    accessToken: params.get('access_token'),
    expiresIn: Number(params.get('expires_in') || 0),
    tokenType: params.get('token_type')
  };
}

function storeToken(tokenData) {
  const expiresAt = Date.now() + (tokenData.expiresIn || 3600) * 1000;
  localStorage.setItem(TOKEN_STORAGE_KEY, tokenData.accessToken);
  localStorage.setItem(TOKEN_EXPIRE_STORAGE_KEY, String(expiresAt));
}

function loadToken() {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const expiresAt = Number(localStorage.getItem(TOKEN_EXPIRE_STORAGE_KEY) || '0');
  if (!token || Date.now() > expiresAt) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRE_STORAGE_KEY);
    return null;
  }
  return token;
}

function createAuthUrl() {
  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'token',
    scope: GOOGLE_OAUTH_SCOPE,
    include_granted_scopes: 'true',
    prompt: 'consent'
  });
  return `${AUTH_URL}?${params.toString()}`;
}

function handlePopupResponse(event) {
  if (event.origin !== AUTH_ORIGIN || !event.data || event.data.type !== 'home-maintenance-oauth') {
    return;
  }
  const tokenData = event.data.tokenData;
  if (tokenData && tokenData.accessToken) {
    storeToken(tokenData);
    if (authPromise) {
      authPromise.resolve(tokenData.accessToken);
      authPromise = null;
    }
  }
}

window.addEventListener('message', handlePopupResponse);

if (window.opener && window.location.hash.includes('access_token')) {
  const tokenData = parseHash(window.location.hash);
  window.opener.postMessage({ type: 'home-maintenance-oauth', tokenData }, AUTH_ORIGIN);
  window.close();
}

function openPopup(url) {
  const width = 500;
  const height = 650;
  const left = window.screenX + (window.innerWidth - width) / 2;
  const top = window.screenY + (window.innerHeight - height) / 2;
  return window.open(
    url,
    'home-maintenance-google-auth',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
}

export async function getAccessToken() {
  const storedToken = loadToken();
  if (storedToken) {
    return storedToken;
  }

  if (authPromise) {
    return authPromise.promise;
  }

  let popup;
  const authUrl = createAuthUrl();

  authPromise = {};
  authPromise.promise = new Promise((resolve, reject) => {
    authPromise.resolve = resolve;
    authPromise.reject = reject;
    popup = openPopup(authUrl);
    if (!popup) {
      reject(new Error('Unable to open OAuth popup. Please allow popups.'));
      authPromise = null;
      return;
    }

    const checkPopupClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkPopupClosed);
        if (loadToken()) {
          resolve(loadToken());
        } else {
          reject(new Error('OAuth popup closed before authorization completed.'));
        }
        authPromise = null;
      }
    }, 500);
  });

  return authPromise.promise;
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_EXPIRE_STORAGE_KEY);
}

export async function ensureAuth() {
  return getAccessToken();
}
