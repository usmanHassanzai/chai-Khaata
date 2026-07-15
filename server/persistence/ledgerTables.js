import { getSupabase } from '../supabase.js';

const ENTITY_TABLES = {
  dealers: 'ledger_dealers',
  customers: 'ledger_customers',
  purchases: 'ledger_purchases',
  sales: 'ledger_sales',
  payments: 'ledger_payments',
  settings: 'ledger_settings',
};

function throwSupabaseError(error) {
  const message = error?.message || error?.details || error?.hint || JSON.stringify(error);
  const err = new Error(message);
  if (error?.code) err.code = error.code;
  throw err;
}

function isMissingTableError(error) {
  const text = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ');
  return /relation.*does not exist|could not find.*table|schema cache/i.test(text);
}

function toIso(value) {
  if (!value) return new Date().toISOString();
  return new Date(value).toISOString();
}

function maxUpdatedAt(rows) {
  let max = '';
  for (const row of rows) {
    const ts = row?.updatedAt || row?.updated_at || '';
    if (!max || new Date(ts).getTime() > new Date(max).getTime()) max = toIso(ts);
  }
  return max || new Date().toISOString();
}

/** @param {Record<string, unknown>} row */
function dealerFromRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    phone: row.phone || undefined,
    address: row.address || undefined,
    openingDue: Number(row.opening_due) || 0,
    removed: Boolean(row.removed),
    updatedAt: toIso(row.updated_at),
  };
}

/** @param {string} userId @param {Record<string, unknown>} row */
function dealerToRow(userId, row) {
  return {
    user_id: userId,
    id: Number(row.id),
    name: row.name,
    phone: row.phone ?? '',
    address: row.address ?? '',
    opening_due: Number(row.openingDue) || 0,
    removed: Boolean(row.removed),
    updated_at: toIso(row.updatedAt),
  };
}

/** @param {Record<string, unknown>} row */
function customerFromRow(row) {
  return {
    id: Number(row.id),
    customerId: row.customer_id,
    name: row.name,
    phone: row.phone || undefined,
    address: row.address || undefined,
    profilePicture: row.profile_picture || undefined,
    notes: row.notes || undefined,
    registerDate: row.register_date || undefined,
    updatedAt: toIso(row.updated_at),
  };
}

/** @param {string} userId @param {Record<string, unknown>} row */
function customerToRow(userId, row) {
  return {
    user_id: userId,
    id: Number(row.id),
    customer_id: row.customerId,
    name: row.name,
    phone: row.phone ?? '',
    address: row.address ?? '',
    profile_picture: row.profilePicture ?? null,
    notes: row.notes ?? '',
    register_date: row.registerDate ?? null,
    updated_at: toIso(row.updatedAt),
  };
}

/** @param {Record<string, unknown>} row */
function purchaseFromRow(row) {
  return {
    id: Number(row.id),
    date: row.date,
    dealerId: Number(row.dealer_id),
    teaName: row.tea_name,
    bagsOrdered: Number(row.bags_ordered) || 0,
    bagsReceived: Number(row.bags_received) || 0,
    bagWeightKg: Number(row.bag_weight_kg) || 0,
    missWeightKg: Number(row.miss_weight_kg) || 0,
    pricePerKg: Number(row.price_per_kg) || 0,
    depositPaid: Number(row.deposit_paid) || 0,
    billImage: row.bill_image || undefined,
    notes: row.notes || undefined,
    contNo: row.cont_no || undefined,
    lotNo: row.lot_no || undefined,
    country: row.country || undefined,
    grade: row.grade || undefined,
    invoiceNumber: row.invoice_number || undefined,
    updatedAt: toIso(row.updated_at),
  };
}

/** @param {string} userId @param {Record<string, unknown>} row */
function purchaseToRow(userId, row) {
  return {
    user_id: userId,
    id: Number(row.id),
    date: row.date,
    dealer_id: Number(row.dealerId),
    tea_name: row.teaName,
    bags_ordered: Number(row.bagsOrdered) || 0,
    bags_received: Number(row.bagsReceived) || 0,
    bag_weight_kg: Number(row.bagWeightKg) || 0,
    miss_weight_kg: Number(row.missWeightKg) || 0,
    price_per_kg: Number(row.pricePerKg) || 0,
    deposit_paid: Number(row.depositPaid) || 0,
    bill_image: row.billImage ?? null,
    notes: row.notes ?? '',
    cont_no: row.contNo ?? null,
    lot_no: row.lotNo ?? null,
    country: row.country ?? null,
    grade: row.grade ?? null,
    invoice_number: row.invoiceNumber ?? null,
    updated_at: toIso(row.updatedAt),
  };
}

/** @param {Record<string, unknown>} row */
function saleFromRow(row) {
  return {
    id: Number(row.id),
    date: row.date,
    teaName: row.tea_name,
    quantityKg: Number(row.quantity_kg) || 0,
    bagsSold: row.bags_sold != null ? Number(row.bags_sold) : undefined,
    bagWeightKg: row.bag_weight_kg != null ? Number(row.bag_weight_kg) : undefined,
    salePricePerKg: Number(row.sale_price_per_kg) || 0,
    purchasePricePerKg: row.purchase_price_per_kg != null ? Number(row.purchase_price_per_kg) : undefined,
    customerId: row.customer_id != null ? Number(row.customer_id) : undefined,
    amountReceived: Number(row.amount_received) || 0,
    billImage: row.bill_image || undefined,
    notes: row.notes || undefined,
    updatedAt: toIso(row.updated_at),
  };
}

/** @param {string} userId @param {Record<string, unknown>} row */
function saleToRow(userId, row) {
  return {
    user_id: userId,
    id: Number(row.id),
    date: row.date,
    tea_name: row.teaName,
    quantity_kg: Number(row.quantityKg) || 0,
    bags_sold: row.bagsSold ?? null,
    bag_weight_kg: row.bagWeightKg ?? null,
    sale_price_per_kg: Number(row.salePricePerKg) || 0,
    purchase_price_per_kg: row.purchasePricePerKg ?? null,
    customer_id: row.customerId ?? null,
    amount_received: Number(row.amountReceived) || 0,
    bill_image: row.billImage ?? null,
    notes: row.notes ?? '',
    updated_at: toIso(row.updatedAt),
  };
}

/** @param {Record<string, unknown>} row */
function paymentFromRow(row) {
  return {
    id: Number(row.id),
    date: row.date,
    customerId: row.customer_id != null ? Number(row.customer_id) : undefined,
    dealerId: row.dealer_id != null ? Number(row.dealer_id) : undefined,
    amount: Number(row.amount) || 0,
    note: row.note || undefined,
    updatedAt: toIso(row.updated_at),
  };
}

/** @param {string} userId @param {Record<string, unknown>} row */
function paymentToRow(userId, row) {
  return {
    user_id: userId,
    id: Number(row.id),
    date: row.date,
    customer_id: row.customerId ?? null,
    dealer_id: row.dealerId ?? null,
    amount: Number(row.amount) || 0,
    note: row.note ?? '',
    updated_at: toIso(row.updatedAt),
  };
}

/** @param {Record<string, unknown>} row */
function settingsFromRow(row) {
  return {
    id: 'settings',
    lowStockThresholdKg: Number(row.low_stock_threshold_kg) || 50,
    language: row.language === 'en' ? 'en' : 'ur-roman',
    shopName: row.shop_name || undefined,
    shopLogo: row.shop_logo || undefined,
    shopPhone: row.shop_phone || undefined,
    shopAddress: row.shop_address || undefined,
    updatedAt: toIso(row.updated_at),
  };
}

/** @param {string} userId @param {Record<string, unknown>} row */
function settingsToRow(userId, row) {
  return {
    user_id: userId,
    id: 'settings',
    low_stock_threshold_kg: Number(row.lowStockThresholdKg) || 50,
    language: row.language === 'en' ? 'en' : 'ur-roman',
    shop_name: row.shopName ?? null,
    shop_logo: row.shopLogo ?? null,
    shop_phone: row.shopPhone ?? null,
    shop_address: row.shopAddress ?? null,
    updated_at: toIso(row.updatedAt),
  };
}

const FROM_ROW = {
  dealers: dealerFromRow,
  customers: customerFromRow,
  purchases: purchaseFromRow,
  sales: saleFromRow,
  payments: paymentFromRow,
  settings: settingsFromRow,
};

const TO_ROW = {
  dealers: dealerToRow,
  customers: customerToRow,
  purchases: purchaseToRow,
  sales: saleToRow,
  payments: paymentToRow,
  settings: settingsToRow,
};

const UPSERT_CONFLICT = {
  dealers: 'user_id,id',
  customers: 'user_id,id',
  purchases: 'user_id,id',
  sales: 'user_id,id',
  payments: 'user_id,id',
  settings: 'user_id',
};

async function readTableRows(userId, entity) {
  const table = ENTITY_TABLES[entity];
  const { data, error } = await getSupabase()
    .from(table)
    .select('*')
    .eq('user_id', userId);

  if (error) {
    if (isMissingTableError(error)) return [];
    throwSupabaseError(error);
  }

  const fromRow = FROM_ROW[entity];
  return (data ?? []).map(fromRow);
}

/** @param {string} userId */
export async function sbCountLedgerRows(userId) {
  let total = 0;
  for (const entity of Object.keys(ENTITY_TABLES)) {
    const table = ENTITY_TABLES[entity];
    const { count, error } = await getSupabase()
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      if (isMissingTableError(error)) continue;
      throwSupabaseError(error);
    }
    total += count ?? 0;
  }
  return total;
}

/** @param {string} userId */
export async function sbReadLedgerTables(userId) {
  const [dealers, customers, purchases, sales, payments, settingsRows] = await Promise.all([
    readTableRows(userId, 'dealers'),
    readTableRows(userId, 'customers'),
    readTableRows(userId, 'purchases'),
    readTableRows(userId, 'sales'),
    readTableRows(userId, 'payments'),
    readTableRows(userId, 'settings'),
  ]);

  const settings = settingsRows.length ? settingsRows : [];
  const allRows = [...dealers, ...customers, ...purchases, ...sales, ...payments, ...settings];
  if (!allRows.length) return null;

  return {
    updatedAt: maxUpdatedAt(allRows),
    dealers,
    customers,
    purchases,
    sales,
    payments,
    settings,
    userId,
  };
}

/** @param {string} userId */
export async function sbReadLedgerSnapshotOnly(userId) {
  const { data, error } = await getSupabase()
    .from('ledger_snapshots')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  if (!data) return null;

  const payload = data.payload ?? {};
  return {
    ...payload,
    userId: data.user_id,
    updatedAt: data.updated_at,
  };
}

/** @param {string} userId @param {import('../ledgerStore.js').LedgerSnapshot} snapshot */
export async function sbWriteLedgerTables(userId, snapshot) {
  const updatedAt = toIso(snapshot.updatedAt);
  const stamp = (rows) => rows.map((row) => ({
    ...row,
    updatedAt: row.updatedAt || updatedAt,
  }));

  const batches = {
    dealers: stamp(snapshot.dealers ?? []),
    customers: stamp(snapshot.customers ?? []),
    purchases: stamp(snapshot.purchases ?? []),
    sales: stamp(snapshot.sales ?? []),
    payments: stamp(snapshot.payments ?? []),
    settings: stamp(snapshot.settings ?? []),
  };

  for (const entity of Object.keys(batches)) {
    const rows = batches[entity];
    const table = ENTITY_TABLES[entity];
    const toRow = TO_ROW[entity];

    await getSupabase().from(table).delete().eq('user_id', userId);

    if (!rows.length) continue;

    const dbRows = rows.map((row) => toRow(userId, row));
    const { error } = await getSupabase()
      .from(table)
      .upsert(dbRows, { onConflict: UPSERT_CONFLICT[entity] });

    if (error) throwSupabaseError(error);
  }

  return {
    ...snapshot,
    userId,
    updatedAt: maxUpdatedAt([
      ...(snapshot.dealers ?? []),
      ...(snapshot.customers ?? []),
      ...(snapshot.purchases ?? []),
      ...(snapshot.sales ?? []),
      ...(snapshot.payments ?? []),
      ...(snapshot.settings ?? []),
    ].map((r) => ({ updatedAt: r.updatedAt || updatedAt }))),
  };
}

/** @param {string} userId @param {import('../ledgerStore.js').LedgerSnapshot} snapshot */
export async function sbMigrateSnapshotToTables(userId, snapshot) {
  await sbWriteLedgerTables(userId, snapshot);
  return sbReadLedgerTables(userId);
}

/** @param {string} userId */
export async function sbDeleteLedgerTables(userId) {
  for (const table of Object.values(ENTITY_TABLES)) {
    await getSupabase().from(table).delete().eq('user_id', userId);
  }
}

async function readExistingUpdatedAt(userId, entity, id) {
  const table = ENTITY_TABLES[entity];
  const query = getSupabase()
    .from(table)
    .select('updated_at')
    .eq('user_id', userId);

  if (entity === 'settings') {
    const { data, error } = await query.maybeSingle();
    if (error && !isMissingTableError(error)) throwSupabaseError(error);
    return data?.updated_at ? toIso(data.updated_at) : null;
  }

  const { data, error } = await query.eq('id', Number(id)).maybeSingle();
  if (error && !isMissingTableError(error)) throwSupabaseError(error);
  return data?.updated_at ? toIso(data.updated_at) : null;
}

function shouldAcceptRow(existingUpdatedAt, incomingUpdatedAt) {
  if (!existingUpdatedAt) return true;
  if (!incomingUpdatedAt) return false;
  return new Date(incomingUpdatedAt).getTime() >= new Date(existingUpdatedAt).getTime();
}

/**
 * @param {string} userId
 * @param {Array<{ table: string, op: 'upsert'|'delete', row?: Record<string, unknown>, id?: number|string, updatedAt?: string }>} changes
 */
export async function sbApplyLedgerChanges(userId, changes) {
  const applied = [];
  const skipped = [];

  for (const change of changes) {
    const entity = change.table;
    const table = ENTITY_TABLES[entity];
    if (!table) {
      skipped.push({ ...change, reason: 'UNKNOWN_TABLE' });
      continue;
    }

    if (change.op === 'delete') {
      const rowId = change.id ?? change.row?.id;
      if (rowId == null) {
        skipped.push({ ...change, reason: 'MISSING_ID' });
        continue;
      }

      if (entity === 'settings') {
        skipped.push({ ...change, reason: 'SETTINGS_DELETE_BLOCKED' });
        continue;
      }

      const { error } = await getSupabase()
        .from(table)
        .delete()
        .eq('user_id', userId)
        .eq('id', Number(rowId));

      if (error) throwSupabaseError(error);
      applied.push(change);
      continue;
    }

    if (change.op !== 'upsert' || !change.row) {
      skipped.push({ ...change, reason: 'INVALID_OP' });
      continue;
    }

    const row = {
      ...change.row,
      updatedAt: change.updatedAt || change.row.updatedAt || new Date().toISOString(),
    };
    const rowId = row.id;
    if (rowId == null && entity !== 'settings') {
      skipped.push({ ...change, reason: 'MISSING_ID' });
      continue;
    }

    const existingUpdatedAt = await readExistingUpdatedAt(userId, entity, rowId ?? 'settings');
    if (!shouldAcceptRow(existingUpdatedAt, row.updatedAt)) {
      skipped.push({ ...change, reason: 'STALE' });
      continue;
    }

    const dbRow = TO_ROW[entity](userId, row);
    const { error } = await getSupabase()
      .from(table)
      .upsert(dbRow, { onConflict: UPSERT_CONFLICT[entity] });

    if (error) throwSupabaseError(error);
    applied.push(change);
  }

  const ledger = await sbReadLedgerTables(userId);
  return { applied: applied.length, skipped, ledger };
}
