import { handleSyncLedgerRequest } from '../../server/syncLedgerApi.js';
import { setCors } from '../../server/httpUtils.js';

/**
 * Dedicated ledger sync function — bypasses broken Express /api/server catch-all.
 * Mobile + laptop share Supabase through this path.
 */
export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  return handleSyncLedgerRequest(req, res);
}

export const config = { maxDuration: 60 };
