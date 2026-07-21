import { setCors, sendJson } from '../../server/httpUtils.js';
import { getAuthConfig } from '../../server/authLogin.js';

/** Lightweight auth config for login/register pages. */
export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use GET' });
    return;
  }

  try {
    sendJson(res, 200, getAuthConfig());
  } catch (err) {
    console.error('Auth config error:', err);
    sendJson(res, 500, { error: 'SERVER_ERROR', message: 'Could not load auth config' });
  }
}

export const config = { maxDuration: 10 };
