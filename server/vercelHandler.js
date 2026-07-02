import serverless from 'serverless-http';
import app from './app.js';

const expressHandler = serverless(app);

/** Normalize URL so Express routes like /api/auth/login match on Vercel. */
export function normalizeVercelUrl(req) {
  const raw = req.url || '/';
  const qIndex = raw.indexOf('?');
  let path = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  let query = qIndex >= 0 ? raw.slice(qIndex) : '';

  if (query.startsWith('?')) {
    const params = new URLSearchParams(query.slice(1));
    const vercelPath = params.get('__vercel_path');
    if (vercelPath) {
      params.delete('__vercel_path');
      const rest = params.toString();
      req.url = `/api/${vercelPath}${rest ? `?${rest}` : ''}`;
      return;
    }
  }

  if (path.startsWith('/api/') && path !== '/api/server') {
    req.url = path + query;
    return;
  }

  const forwarded = req.headers['x-vercel-original-url'] || req.headers['x-forwarded-uri'];
  if (typeof forwarded === 'string') {
    const forwardedPath = forwarded.split('?')[0];
    if (forwardedPath.startsWith('/api/')) {
      req.url = forwarded.includes('?') ? forwarded : forwarded + query;
      return;
    }
  }

  if (!path.startsWith('/api')) {
    req.url = `/api${path.startsWith('/') ? path : `/${path}`}${query}`;
  }
}

export function createVercelApiHandler() {
  return function vercelApiHandler(req, res) {
    normalizeVercelUrl(req);
    return expressHandler(req, res);
  };
}

export const vercelFunctionConfig = {
  maxDuration: 60,
};
