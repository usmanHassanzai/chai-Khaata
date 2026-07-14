/** User-facing auth error text (never show raw fetch/TypeError). */
export function friendlyAuthError(err: unknown, fallback = 'Could not sign in. Please try again.'): string {
  if (!err || typeof err !== 'object') return fallback;

  const apiErr = err as { code?: string; message?: string };
  const msg = String(apiErr.message || '');
  const code = apiErr.code || '';

  if (code === 'NETWORK_ERROR' || /fetch failed|failed to fetch|networkerror|econnrefused/i.test(msg)) {
    const isLocalDev =
      typeof window !== 'undefined'
      && (/localhost|127\.0\.0\.1/.test(window.location.hostname)
        || ['5173', '5174', '4173'].includes(window.location.port));
    return isLocalDev
      ? 'Cannot reach auth server. Run: cd ~/chai-khaata && npm run dev'
      : 'Cannot reach server. Check internet or Cloud Sync URL in Settings.';
  }

  if (code === 'INVALID_CREDENTIALS') return 'Invalid email or password';
  if (code === 'SERVER_CONFIG') return msg || 'Server configuration error. Contact admin.';
  if (code === 'SERVER_ERROR' && /fetch failed|database|supabase|timed out/i.test(msg)) {
    return 'Server could not connect to the database. Try again in a moment.';
  }

  if (/fetch failed|typeerror/i.test(msg)) return fallback;
  return msg || fallback;
}

export function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  const { hostname, port } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (import.meta.env.DEV && (port === '5173' || port === '5174' || port === '4173')) return true;
  return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);
}
