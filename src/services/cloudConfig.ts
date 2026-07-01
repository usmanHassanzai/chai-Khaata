const CLOUD_URL_KEY = 'chai-khata-cloud-url';

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

export function getCloudApiUrl(): string {
  const saved = localStorage.getItem(CLOUD_URL_KEY)?.trim();
  if (saved) return normalizeUrl(saved);

  const env = import.meta.env.VITE_API_URL as string | undefined;
  if (env?.trim()) return normalizeUrl(env);

  const defaultCloud = import.meta.env.VITE_DEFAULT_CLOUD_URL as string | undefined;
  if (defaultCloud?.trim()) return normalizeUrl(defaultCloud);

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
