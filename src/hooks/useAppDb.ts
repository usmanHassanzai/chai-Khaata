import { useAuth } from '../context/AuthContext';
import { db, getDbGeneration, isDbInitialized, subscribeDbGeneration } from '../db/database';
import { useSyncExternalStore } from 'react';

/** Returns the active Dexie DB when ready (re-renders after login AND after cloud import). */
export function useAppDb() {
  const { dbReady } = useAuth();
  const generation = useSyncExternalStore(subscribeDbGeneration, getDbGeneration, getDbGeneration);
  if (!dbReady || !isDbInitialized()) return undefined;
  void generation;
  return db;
}
