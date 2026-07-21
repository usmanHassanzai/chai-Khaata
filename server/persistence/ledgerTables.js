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
    previousBagsReceived: row.previous_bags_received != null ? Number(row.previous_bags_received) : undefined,
    previousReceiveDate: row.previous_receive_date || undefined,
    lastReceivedAt: row.last_received_at ? toIso(row.last_received_at) : undefined,
    lastReceivedBags: row.last_received_bags != null ? Number(row.last_received_bags) : undefined,
    lastReceivedKg: row.last_received_kg != null ? Number(row.last_received_kg) : undefined,
    receiveReceiptImage: row.receive_receipt_image || undefined,
    previousDepositPaid: row.previous_deposit_paid != null ? Number(row.previous_deposit_paid) : undefined,
    lastPaymentAmount: row.last_payment_amount != null ? Number(row.last_payment_amount) : undefined,
    lastPaymentAt: row.last_payment_at ? toIso(row.last_payment_at) : undefined,
    paymentReceiptImage: row.payment_receipt_image || undefined,
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
    previous_bags_received: row.previousBagsReceived ?? null,
    previous_receive_date: row.previousReceiveDate ?? null,
    last_received_at: row.lastReceivedAt ? toIso(row.lastReceivedAt) : null,
    last_received_bags: row.lastReceivedBags ?? null,
    last_received_kg: row.lastReceivedKg ?? null,
    receive_receipt_image: row.receiveReceiptImage ?? null,
    previous_deposit_paid: row.previousDepositPaid ?? null,
    last_payment_amount: row.lastPaymentAmount ?? null,
    last_payment_at: row.lastPaymentAt ? toIso(row.lastPaymentAt) : null,
    payment_receipt_image: row.paymentReceiptImage ?? null,
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
    lastPaymentAt: row.last_payment_at ? toIso(row.last_payment_at) : undefined,
    paymentReceiptImage: row.payment_receipt_image || undefined,
    previousAmountReceived: row.previous_amount_received != null ? Number(row.previous_amount_received) : undefined,
    lastPaymentAmount: row.last_payment_amount != null ? Number(row.last_payment_amount) : undefined,
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
    last_payment_at: row.lastPaymentAt ? toIso(row.lastPaymentAt) : null,
    payment_receipt_image: row.paymentReceiptImage ?? null,
    previous_amount_received: row.previousAmountReceived ?? null,
    last_payment_amount: row.lastPaymentAmount ?? null,
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
    saleId: row.sale_id != null ? Number(row.sale_id) : undefined,
    purchaseId: row.purchase_id != null ? Number(row.purchase_id) : undefined,
    amount: Number(row.amount) || 0,
    note: row.note || undefined,
    paidAt: row.paid_at != null ? toIso(row.paid_at) : undefined,
    receiptImage: row.receipt_image || undefined,
    previousPaid: row.previous_paid != null ? Number(row.previous_paid) : undefined,
    balanceAfter: row.balance_after != null ? Number(row.balance_after) : undefined,
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
    sale_id: row.saleId ?? null,
    purchase_id: row.purchaseId ?? null,
    amount: Number(row.amount) || 0,
    note: row.note ?? '',
    paid_at: row.paidAt ? toIso(row.paidAt) : null,
    receipt_image: row.receiptImage ?? null,
    previous_paid: row.previousPaid != null ? Number(row.previousPaid) : null,
    balance_after: row.balanceAfter != null ? Number(row.balanceAfter) : null,
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
export async function sbGetLedgerUpdatedAt(userId) {
  if (!(await ledgerTablesAvailable())) {
    const snapshot = await sbReadLedgerSnapshotOnly(userId);
    return snapshot?.updatedAt ? toIso(snapshot.updatedAt) : null;
  }

  const tables = Object.values(ENTITY_TABLES);
  const maxQueries = tables.map(async (table) => {
    const { data, error } = await getSupabase()
      .from(table)
      .select('updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) return null;
      throwSupabaseError(error);
    }
    return data?.updated_at ? toIso(data.updated_at) : null;
  });

  const snapshotQuery = sbReadLedgerSnapshotOnly(userId).then((s) => (s?.updatedAt ? toIso(s.updatedAt) : null));
  const timestamps = await Promise.all([...maxQueries, snapshotQuery]);
  const valid = timestamps.filter(Boolean);
  if (!valid.length) return null;
  return maxUpdatedAt(valid.map((updatedAt) => ({ updatedAt })));
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

function snapshotPayload(snapshot) {
  return {
    dealers: snapshot.dealers ?? [],
    customers: snapshot.customers ?? [],
    purchases: snapshot.purchases ?? [],
    sales: snapshot.sales ?? [],
    payments: snapshot.payments ?? [],
    settings: snapshot.settings ?? [],
  };
}

/** @param {string} userId @param {import('../ledgerStore.js').LedgerSnapshot} snapshot */
export async function sbWriteLedgerSnapshot(userId, snapshot) {
  const updatedAt = toIso(snapshot.updatedAt);
  const { error } = await getSupabase()
    .from('ledger_snapshots')
    .upsert(
      {
        user_id: userId,
        updated_at: updatedAt,
        payload: snapshotPayload(snapshot),
      },
      { onConflict: 'user_id' },
    );

  if (error) throwSupabaseError(error);

  return {
    ...snapshotPayload(snapshot),
    userId,
    updatedAt,
  };
}

async function ledgerTablesAvailable() {
  const { error } = await getSupabase().from('ledger_dealers').select('id').limit(1);
  if (!error) return true;
  return !isMissingTableError(error);
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

  if (!(await ledgerTablesAvailable())) {
    return sbWriteLedgerSnapshot(userId, {
      ...snapshotPayload(snapshot),
      updatedAt,
    });
  }

  const entityKeys = Object.keys(batches);

  try {
    await Promise.all(entityKeys.map(async (entity) => {
      const rows = batches[entity];
      const table = ENTITY_TABLES[entity];
      const toRow = TO_ROW[entity];

      await getSupabase().from(table).delete().eq('user_id', userId);

      if (!rows.length) return;

      const dbRows = rows.map((row) => toRow(userId, row));
      const { error } = await getSupabase()
        .from(table)
        .upsert(dbRows, { onConflict: UPSERT_CONFLICT[entity] });

      if (error) throwSupabaseError(error);
    }));
  } catch (err) {
    if (isMissingTableError(err)) {
      return sbWriteLedgerSnapshot(userId, {
        ...snapshotPayload(snapshot),
        updatedAt,
      });
    }
    throw err;
  }

  return {
    ...snapshotPayload(snapshot),
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

function applyChangeToSnapshot(snapshot, change) {
  const entity = change.table;
  const listKey = entity;
  if (!Array.isArray(snapshot[listKey]) && entity !== 'settings') return snapshot;

  if (change.op === 'delete') {
    const rowId = Number(change.id ?? change.row?.id);
    if (entity === 'settings') return snapshot;
    snapshot[listKey] = snapshot[listKey].filter((row) => Number(row.id) !== rowId);
    return snapshot;
  }

  if (change.op !== 'upsert' || !change.row) return snapshot;

  const row = {
    ...change.row,
    updatedAt: change.updatedAt || change.row.updatedAt || new Date().toISOString(),
  };

  if (entity === 'settings') {
    snapshot.settings = [row];
    return snapshot;
  }

  const rowId = Number(row.id);
  const idx = snapshot[listKey].findIndex((existing) => Number(existing.id) === rowId);
  if (idx >= 0) snapshot[listKey][idx] = { ...snapshot[listKey][idx], ...row };
  else snapshot[listKey].push(row);
  return snapshot;
}

async function sbApplyLedgerChangesViaSnapshot(userId, changes) {
  const existing = await sbReadLedgerSnapshotOnly(userId);
  const snapshot = {
    updatedAt: new Date().toISOString(),
    dealers: existing?.dealers ?? [],
    customers: existing?.customers ?? [],
    purchases: existing?.purchases ?? [],
    sales: existing?.sales ?? [],
    payments: existing?.payments ?? [],
    settings: existing?.settings ?? [],
  };

  for (const change of changes) {
    applyChangeToSnapshot(snapshot, change);
  }

  snapshot.updatedAt = maxUpdatedAt([
    ...snapshot.dealers,
    ...snapshot.customers,
    ...snapshot.purchases,
    ...snapshot.sales,
    ...snapshot.payments,
    ...snapshot.settings,
  ]);

  const saved = await sbWriteLedgerSnapshot(userId, snapshot);
  return { applied: changes.length, skipped: [], updatedAt: saved.updatedAt };
}

/**
 * @param {string} userId
 * @param {Array<{ table: string, op: 'upsert'|'delete', row?: Record<string, unknown>, id?: number|string, updatedAt?: string }>} changes
 */
export async function sbApplyLedgerChanges(userId, changes) {
  if (!(await ledgerTablesAvailable())) {
    return sbApplyLedgerChangesViaSnapshot(userId, changes);
  }

  const applied = [];
  const skipped = [];
  /** @type {Record<string, number[]>} */
  const deletesByEntity = {};
  /** @type {Record<string, Array<{ change: typeof changes[0], row: Record<string, unknown> }>>} */
  const upsertsByEntity = {};

  for (const change of changes) {
    const entity = change.table;
    if (!ENTITY_TABLES[entity]) {
      skipped.push({ ...change, reason: 'UNKNOWN_TABLE' });
      continue;
    }

    if (change.op === 'delete') {
      if (entity === 'settings') {
        skipped.push({ ...change, reason: 'SETTINGS_DELETE_BLOCKED' });
        continue;
      }
      const rowId = change.id ?? change.row?.id;
      if (rowId == null) {
        skipped.push({ ...change, reason: 'MISSING_ID' });
        continue;
      }
      if (!deletesByEntity[entity]) deletesByEntity[entity] = [];
      deletesByEntity[entity].push(Number(rowId));
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
    if (row.id == null && entity !== 'settings') {
      skipped.push({ ...change, reason: 'MISSING_ID' });
      continue;
    }

    if (!upsertsByEntity[entity]) upsertsByEntity[entity] = [];
    upsertsByEntity[entity].push({ change, row });
  }

  try {
    for (const [entity, ids] of Object.entries(deletesByEntity)) {
      const table = ENTITY_TABLES[entity];
      const { error } = await getSupabase()
        .from(table)
        .delete()
        .eq('user_id', userId)
        .in('id', ids);
      if (error) throwSupabaseError(error);
    }

    for (const [entity, entries] of Object.entries(upsertsByEntity)) {
      const table = ENTITY_TABLES[entity];
      const toRow = TO_ROW[entity];
      /** @type {Map<number|string, string>} */
      const existingMap = new Map();

      if (entity === 'settings') {
        const { data, error } = await getSupabase()
          .from(table)
          .select('updated_at')
          .eq('user_id', userId)
          .maybeSingle();
        if (error && !isMissingTableError(error)) throwSupabaseError(error);
        if (data?.updated_at) existingMap.set('settings', toIso(data.updated_at));
      } else {
        const ids = entries.map(({ row }) => Number(row.id)).filter((id) => !Number.isNaN(id));
        if (ids.length) {
          const { data, error } = await getSupabase()
            .from(table)
            .select('id, updated_at')
            .eq('user_id', userId)
            .in('id', ids);
          if (error && !isMissingTableError(error)) throwSupabaseError(error);
          for (const existing of data ?? []) {
            existingMap.set(Number(existing.id), toIso(existing.updated_at));
          }
        }
      }

      const dbRows = [];
      for (const { change, row } of entries) {
        const key = entity === 'settings' ? 'settings' : Number(row.id);
        if (!shouldAcceptRow(existingMap.get(key), row.updatedAt)) {
          skipped.push({ ...change, reason: 'STALE' });
          continue;
        }
        dbRows.push(toRow(userId, row));
        applied.push(change);
      }

      if (dbRows.length) {
        const { error } = await getSupabase()
          .from(table)
          .upsert(dbRows, { onConflict: UPSERT_CONFLICT[entity] });
        if (error) throwSupabaseError(error);
      }
    }
  } catch (err) {
    if (isMissingTableError(err)) {
      return sbApplyLedgerChangesViaSnapshot(userId, changes);
    }
    throw err;
  }

  const updatedAt = maxUpdatedAt(
    applied.map((change) => ({
      updatedAt: change.updatedAt || change.row?.updatedAt || new Date().toISOString(),
    })),
  );

  return { applied: applied.length, skipped, updatedAt };
}
