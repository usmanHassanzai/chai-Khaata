import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSettingsQuery } from '../db/database';
import { resolveShopPrintProfile, type ShopPrintProfile } from '../services/shopProfile';

export function useShopPrintProfile(): ShopPrintProfile {
  const { user, dbReady } = useAuth();
  const settings = useLiveQuery(
    () => (dbReady ? getSettingsQuery() : undefined),
    [dbReady],
  );

  return useMemo(
    () => resolveShopPrintProfile(settings, user),
    [settings, user],
  );
}
