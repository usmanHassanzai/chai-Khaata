import serverless from 'serverless-http';

let expressHandler = null;

async function getExpressHandler() {
  if (!expressHandler) {
    const { default: app } = await import('./app.js');
    expressHandler = serverless(app);
  }
  return expressHandler;
}

/** Normalize URL so Express routes match on Vercel rewrites. */
export function normalizeVercelUrl(req) {
  const raw = req.url || '/';
  const qIndex = raw.indexOf('?');
  let path = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const query = qIndex >= 0 ? raw.slice(qIndex) : '';

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

  if (!path.startsWith('/api')) {
    req.url = `/api${path.startsWith('/') ? path : `/${path}`}${query}`;
  }
}

export function createVercelApiHandler() {
  return async function vercelApiHandler(req, res) {
    normalizeVercelUrl(req);
    const handler = await getExpressHandler();
    return handler(req, res);
  };
}

export const vercelFunctionConfig = {
  maxDuration: 60,
};
