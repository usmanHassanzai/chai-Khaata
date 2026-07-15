const CLOUD_URL_KEY = 'chai-khata-cloud-url';

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

function isLocalHostUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/.test(url);
}

/** True when the app is served from a public deployed origin (not local dev). */
function isDeployedWebOriginInternal(): boolean {
  if (typeof window === 'undefined' || !window.location?.origin) return false;
  return !isLocalHostUrl(window.location.origin);
}

function isCapacitorOrAppShellOrigin(): boolean {
  if (typeof window === 'undefined' || !window.location?.origin) return false;
  const o = window.location.origin;
  return o === 'capacitor://localhost' || o === 'https://localhost' || o === 'http://localhost';
}

const PRODUCTION_CLOUD_URL = 'https://patiwala.pk';

export function getCloudApiUrl(): string {
  // Dev: always sync/auth via same-origin Vite proxy — ignore saved remote URLs
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return normalizeUrl(window.location.origin);
  }

  // Live site (patiwala.pk, *.vercel.app): API is always same-origin.
  if (isDeployedWebOriginInternal()) {
    return normalizeUrl(window.location.origin);
  }

  // Mobile app (Capacitor APK) — never use capacitor:// as API host
  if (isCapacitorOrAppShellOrigin()) {
    const saved = localStorage.getItem(CLOUD_URL_KEY)?.trim();
    if (saved) {
      const normalized = normalizeUrl(saved);
      if (!isLocalHostUrl(normalized)) return normalized;
    }
    const defaultCloud = import.meta.env.VITE_DEFAULT_CLOUD_URL as string | undefined;
    if (defaultCloud?.trim()) return normalizeUrl(defaultCloud);
    return PRODUCTION_CLOUD_URL;
  }

  const saved = localStorage.getItem(CLOUD_URL_KEY)?.trim();
  if (saved) {
    const normalized = normalizeUrl(saved);
    if (!isLocalHostUrl(normalized)) return normalized;
  }

  const env = import.meta.env.VITE_API_URL as string | undefined;
  if (env?.trim()) return normalizeUrl(env);

  const defaultCloud = import.meta.env.VITE_DEFAULT_CLOUD_URL as string | undefined;
  if (defaultCloud?.trim()) return normalizeUrl(defaultCloud);

  if (typeof window !== 'undefined' && window.location?.origin) {
    return normalizeUrl(window.location.origin);
  }

  return '';
}

export function setCloudApiUrl(url: string) {
  const trimmed = normalizeUrl(url);
  if (trimmed) localStorage.setItem(CLOUD_URL_KEY, trimmed);
  else localStorage.removeItem(CLOUD_URL_KEY);
}

export function isCloudSyncEnabled(): boolean {
  return Boolean(getCloudApiUrl());
}

export function isDeployedWebOrigin(): boolean {
  if (typeof window === 'undefined' || !window.location?.origin) return false;
  return !/localhost|127\.0\.0\.1/.test(window.location.origin);
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
    return { ok: false, message: 'Cannot reach server. Use an https:// public URL (not a home Wi‑Fi IP).' };
  }
}
