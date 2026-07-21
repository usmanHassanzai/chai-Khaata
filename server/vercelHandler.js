let appPromise = null;

async function getExpressApp() {
  if (!appPromise) {
    appPromise = import('./app.js').then((m) => m.default);
  }
  return appPromise;
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

/**
 * Run Express as a plain Node listener — no serverless-http.
 * That wrapper was hanging on Vercel (0-byte timeouts) for laptop/admin routes.
 */
export function createVercelApiHandler() {
  return async function vercelApiHandler(req, res) {
    normalizeVercelUrl(req);
    const app = await getExpressApp();

    await new Promise((resolve, reject) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve(undefined);
      };
      const fail = (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      };

      res.once('finish', done);
      res.once('close', done);

      try {
        app(req, res, (err) => {
          if (err) fail(err);
          else done();
        });
      } catch (err) {
        fail(err);
      }
    });
  };
}

export const vercelFunctionConfig = {
  maxDuration: 60,
};
