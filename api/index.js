import serverless from 'serverless-http';
import app from '../server/app.js';

const handler = serverless(app);

function fixUrl(req) {
  const raw = req.url || '/';
  const qIndex = raw.indexOf('?');
  const path = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const query = qIndex >= 0 ? raw.slice(qIndex) : '';
  if (path.startsWith('/api')) return;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  req.url = `/api${normalized}${query}`;
}

export default function vercelHandler(req, res) {
  fixUrl(req);
  return handler(req, res);
}

export const config = {
  maxDuration: 60,
};
