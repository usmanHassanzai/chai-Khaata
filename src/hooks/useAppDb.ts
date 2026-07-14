import { useAuth } from '../context/AuthContext';
import { db, isDbInitialized } from '../db/database';

/** Returns the active Dexie DB when ready (re-renders after login). */
export function useAppDb() {
  const { dbReady } = useAuth();
  return dbReady && isDbInitialized() ? db : undefined;
}
