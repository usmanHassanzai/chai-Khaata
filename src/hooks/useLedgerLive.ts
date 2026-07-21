import { useLiveQuery } from 'dexie-react-hooks';
import { useAppDb } from './useAppDb';

/** Live ledger tables bound to the active DB instance (survives re-init / cloud pull). */
export function useLedgerLive() {
  const appDb = useAppDb();

  const dealers = useLiveQuery(
    () => (appDb ? appDb.dealers.toArray() : []),
    [appDb],
  ) ?? [];
  const customers = useLiveQuery(
    () => (appDb ? appDb.customers.toArray() : []),
    [appDb],
  ) ?? [];
  const purchases = useLiveQuery(
    () => (appDb ? appDb.purchases.toArray() : []),
    [appDb],
  ) ?? [];
  const sales = useLiveQuery(
    () => (appDb ? appDb.sales.toArray() : []),
    [appDb],
  ) ?? [];
  const payments = useLiveQuery(
    () => (appDb ? appDb.payments.toArray() : []),
    [appDb],
  ) ?? [];
  const settings = useLiveQuery(
    () => (appDb ? appDb.settings.get('settings') : undefined),
    [appDb],
  );

  return {
    ready: Boolean(appDb),
    dealers,
    customers,
    purchases,
    sales,
    payments,
    settings,
  };
}
