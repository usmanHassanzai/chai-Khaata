const CLOUD_URL_KEY = 'chai-khata-cloud-url';
const FORCE_LIVE_CLOUD_KEY = 'chai-khata-force-live-cloud';
export const PRODUCTION_CLOUD_URL = 'https://patiwala.pk';

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

function isLocalHostUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\./.test(url);
}

/** True when the app is served from a public deployed origin (not local dev). */
function isDeployedWebOriginInternal(): boolean {
  if (typeof window === 'undefined' || !window.location?.origin) return false;
  return !isLocalHostUrl(window.location.origin);
}

function isCapacitorOrAppShellOrigin(): boolean {
  if (typeof window === 'undefined' || !window.location?.origin) return false;
  const o = window.location.origin;
  return (
    o === 'capacitor://localhost'
    || o === 'https://localhost'
    || o === 'http://localhost'
    || o.startsWith('capacitor://')
    || o.startsWith('ionic://')
  );
}

function isNativeShell(): boolean {
  try {
    // Avoid hard dependency if Capacitor is not present on web
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

function readSavedCloudUrl(): string {
  const saved = localStorage.getItem(CLOUD_URL_KEY)?.trim();
  if (!saved) return '';
  const normalized = normalizeUrl(saved);
  // Never keep a dead local/LAN URL for mobile or sync
  if (isLocalHostUrl(normalized)) {
    localStorage.removeItem(CLOUD_URL_KEY);
    return '';
  }
  return normalized;
}

function envCloudUrl(): string {
  const fromDefault = import.meta.env.VITE_DEFAULT_CLOUD_URL as string | undefined;
  if (fromDefault?.trim()) return normalizeUrl(fromDefault);
  const fromApi = import.meta.env.VITE_API_URL as string | undefined;
  if (fromApi?.trim()) return normalizeUrl(fromApi);
  return PRODUCTION_CLOUD_URL;
}

/**
 * Call once on app boot so mobile/APK always has a working cloud database URL.
 * Safe on laptop production (same-origin) and local Vite (proxy).
 */
export function ensureCloudServerConfigured(): string {
  if (typeof window === 'undefined') return PRODUCTION_CLOUD_URL;

  // Live website always uses itself
  if (isDeployedWebOriginInternal() && !isCapacitorOrAppShellOrigin() && !isNativeShell()) {
    return normalizeUrl(window.location.origin);
  }

  // Native / Capacitor APK — always pin a public HTTPS API
  if (isCapacitorOrAppShellOrigin() || isNativeShell()) {
    const saved = readSavedCloudUrl();
    const url = saved || envCloudUrl();
    localStorage.setItem(CLOUD_URL_KEY, url);
    localStorage.setItem(FORCE_LIVE_CLOUD_KEY, '1');
    return url;
  }

  return getCloudApiUrl();
}

export function getCloudApiUrl(): string {
  // User/mobile explicitly pinned live cloud (login “Use live server”)
  if (typeof window !== 'undefined' && localStorage.getItem(FORCE_LIVE_CLOUD_KEY) === '1') {
    return readSavedCloudUrl() || envCloudUrl();
  }

  // Native / Capacitor APK — never use capacitor:// as API host
  if (isCapacitorOrAppShellOrigin() || isNativeShell()) {
    const saved = readSavedCloudUrl();
    if (saved) return saved;
    return envCloudUrl();
  }

  // Dev web: same-origin Vite proxy (local auth server)
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return normalizeUrl(window.location.origin);
  }

  // Live site (patiwala.pk, *.vercel.app): API is always same-origin.
  if (isDeployedWebOriginInternal()) {
    return normalizeUrl(window.location.origin);
  }

  const saved = readSavedCloudUrl();
  if (saved) return saved;

  return envCloudUrl();
}

export function setCloudApiUrl(url: string) {
  const trimmed = normalizeUrl(url);
  if (!trimmed) {
    localStorage.removeItem(CLOUD_URL_KEY);
    localStorage.removeItem(FORCE_LIVE_CLOUD_KEY);
    return;
  }
  if (isLocalHostUrl(trimmed)) {
    // Refuse to save LAN/localhost — mobile can't use those off your Wi‑Fi
    localStorage.setItem(CLOUD_URL_KEY, PRODUCTION_CLOUD_URL);
    localStorage.setItem(FORCE_LIVE_CLOUD_KEY, '1');
    return;
  }
  localStorage.setItem(CLOUD_URL_KEY, trimmed);
  localStorage.setItem(FORCE_LIVE_CLOUD_KEY, '1');
}

/** Force live production API (used by Login when local server is unreachable). */
export function useProductionCloudServer(): string {
  localStorage.setItem(CLOUD_URL_KEY, PRODUCTION_CLOUD_URL);
  localStorage.setItem(FORCE_LIVE_CLOUD_KEY, '1');
  return PRODUCTION_CLOUD_URL;
}

export function isCloudSyncEnabled(): boolean {
  return Boolean(getCloudApiUrl());
}

export function isDeployedWebOrigin(): boolean {
  if (typeof window === 'undefined' || !window.location?.origin) return false;
  return !isLocalHostUrl(window.location.origin);
}

export async function testCloudConnection(testUrl?: string): Promise<{ ok: boolean; message: string }> {
  const base = normalizeUrl(testUrl || getCloudApiUrl());
  if (!base) return { ok: false, message: 'Enter a cloud server URL first.' };

  try {
    const res = await fetch(`${base}/api/health`, { method: 'GET' });
    if (!res.ok) return { ok: false, message: `Server error (${res.status}). Check the URL.` };

    const data = (await res.json()) as { ok?: boolean; service?: string; sync?: boolean };
    if (data.ok && data.service === 'chai-khata-auth') {
      return {
        ok: true,
        message: data.sync
          ? 'Connected — sync works on any Wi‑Fi or mobile data.'
          : 'Connected to Chai Khata server.',
      };
    }
    return { ok: false, message: 'URL reachable but not a Chai Khata server.' };
  } catch {
    return { ok: false, message: 'Cannot reach server. Use https://patiwala.pk (not a home Wi‑Fi IP).' };
  }
}
