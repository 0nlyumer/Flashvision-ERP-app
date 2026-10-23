// entityTables.js — Phase C Steps 1–4: per-entity Supabase tables for reference data, production, sales, purchasing & inventory.
//
// App state still lives in AppContext and the erp_state blob remains a
// fallback copy, but these collections are now ALSO kept in their own
// tables (created in Phase A, backfilled in Phase B):
//
//   state key            table
//   items                items
//   customers            customers
//   suppliers            suppliers
//   uomList              uom_list
//   packingTypesList     packing_types_list
//   rawMaterialTypesList raw_material_types_list
//   itemCategories       item_categories
//   productionPlans      production_plans
//   productionOutputs    production_outputs
//   saleOrders           sale_orders
//   deliveries           deliveries
//   salesInvoices        sales_invoices
//   returns              returns
//   adjustments          adjustments
//   stockTransfers       stock_transfers
//   grns                 grns
//   inwardGatePasses     inward_gate_passes
//   purchaseDemands      purchase_demands
//   purchaseOrders       purchase_orders
//   purchaseInvoices     purchase_invoices
//
// Every table row is { id, ...promoted scalar columns, data } where `data`
// holds the complete original record — reads use `data` so no field is lost.
// Lookup-list records have no `id` in state ({label, value, disabled}); their
// table id is the record's `value` (same convention as the Phase B backfill).

import { supabase } from './supabaseClient';

export const STEP1_ENTITY_TABLES = {
  items: 'items',
  customers: 'customers',
  suppliers: 'suppliers',
  uomList: 'uom_list',
  packingTypesList: 'packing_types_list',
  rawMaterialTypesList: 'raw_material_types_list',
  itemCategories: 'item_categories',
  productionPlans: 'production_plans',
  productionOutputs: 'production_outputs',
  saleOrders: 'sale_orders',
  deliveries: 'deliveries',
  salesInvoices: 'sales_invoices',
  returns: 'returns',
  adjustments: 'adjustments',
  stockTransfers: 'stock_transfers',
  grns: 'grns',
  inwardGatePasses: 'inward_gate_passes',
  purchaseDemands: 'purchase_demands',
  purchaseOrders: 'purchase_orders',
  purchaseInvoices: 'purchase_invoices',
};

// Promoted columns per table (verified 2026-10-22 against the live schema).
// kind drives the same type coercion the Phase B backfill used: text keeps
// strings (numbers stringified), numeric keeps numbers (numeric strings
// parsed), boolean keeps booleans only, json takes the value as-is.
const PROMOTED_COLUMNS = {
  items: [
    ['sku', 'text'], ['name', 'text'], ['type', 'text'], ['category', 'text'],
    ['status', 'text'], ['department', 'text'], ['back_cloth_id', 'text'], ['stock', 'numeric'],
  ],
  customers: [
    ['name', 'text'], ['phone', 'text'], ['email', 'text'], ['company', 'text'],
    ['city', 'text'], ['credit_limit', 'numeric'], ['balance', 'numeric'], ['details', 'json'],
  ],
  suppliers: [
    ['name', 'text'], ['phone', 'text'], ['email', 'text'], ['company', 'text'],
    ['city', 'text'], ['payment_terms', 'text'], ['balance', 'numeric'], ['details', 'json'],
  ],
  uom_list: [['label', 'text'], ['value', 'text'], ['disabled', 'boolean']],
  packing_types_list: [['label', 'text'], ['value', 'text'], ['disabled', 'boolean']],
  raw_material_types_list: [['label', 'text'], ['value', 'text'], ['disabled', 'boolean']],
  item_categories: [['label', 'text'], ['value', 'text'], ['disabled', 'boolean']],
  production_plans: [ ['plan_no', 'text'], ['product_name', 'text'], ['target_qty', 'numeric'], ['completed_qty', 'numeric'], ['phases', 'json'], ['status', 'text'], ['details', 'json'] ],
  production_outputs: [ ['plan_id', 'text'], ['item_code', 'text'], ['date', 'text'] ],
  sale_orders: [ ['so_number', 'text'], ['customer_name', 'text'], ['total_amount', 'numeric'], ['status', 'text'], ['items', 'json'] ],
  deliveries: [ ['customer_id', 'text'], ['customer_name', 'text'], ['status', 'text'], ['date', 'text'], ['is_invoiced', 'boolean'] ],
  sales_invoices: [ ['delivery_id', 'text'] ],
  returns: [ ['order_id', 'text'], ['customer_name', 'text'], ['date', 'text'] ],
  adjustments: [ ['item_id', 'text'], ['item_code', 'text'], ['type', 'text'], ['date', 'text'] ],
  stock_transfers: [ ['status', 'text'], ['date', 'text'], ['source', 'text'], ['destination', 'text'] ],
  grns: [ ['po_id', 'text'], ['igp_id', 'text'], ['supplier_id', 'text'], ['supplier_name', 'text'], ['status', 'text'], ['date', 'text'], ['is_invoiced', 'boolean'] ],
  inward_gate_passes: [ ['po_id', 'text'], ['supplier_id', 'text'], ['supplier_name', 'text'], ['status', 'text'], ['date', 'text'], ['is_invoiced', 'boolean'] ],
  purchase_demands: [ ['status', 'text'], ['date', 'text'], ['department', 'text'] ],
  purchase_orders: [ ['pd_id', 'text'], ['supplier_id', 'text'], ['supplier_name', 'text'], ['status', 'text'], ['date', 'text'] ],
  purchase_invoices: [ ['source_id', 'text'] ],
};

const camel = (snake) => {
  const parts = snake.split('_');
  return parts[0] + parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
};

// Stable identity of a state record: its `id`, else its `value` (lookup
// lists), else null (record cannot be tracked in a table).
export const entityRecordKey = (record) => {
  if (!record || typeof record !== 'object') return null;
  if (record.id !== undefined && record.id !== null && record.id !== '') return String(record.id);
  if (record.value !== undefined && record.value !== null && record.value !== '') return String(record.value);
  return null;
};

const pickPromoted = (record, colName, kind) => {
  const candidates = [colName, camel(colName)];
  for (const field of candidates) {
    if (!(field in record)) continue;
    const v = record[field];
    if (v === null || v === undefined) continue;
    if (kind === 'json') return v;
    if (kind === 'text') {
      if (typeof v === 'string') return v;
      if (typeof v === 'number') return String(v);
      continue;
    }
    if (kind === 'numeric') {
      if (typeof v === 'number') return v;
      if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
      continue;
    }
    if (kind === 'boolean') {
      if (typeof v === 'boolean') return v;
      continue;
    }
  }
  return undefined;
};

export const buildEntityRow = (table, record) => {
  const id = entityRecordKey(record);
  if (id === null) return null;
  const row = { id, data: record, updated_at: new Date().toISOString() };
  (PROMOTED_COLUMNS[table] || []).forEach(([colName, kind]) => {
    const v = pickPromoted(record, colName, kind);
    if (v !== undefined) row[colName] = v;
  });
  return row;
};

// Fetch one entity's records from its table. Returns the original records
// (from the `data` column), or null when the fetch failed — callers then
// keep the blob copy (per-entity fallback, no empty screens).
export const fetchEntityTable = async (table) => {
  try {
    const { data, error } = await supabase.from(table).select('data');
    if (error || !Array.isArray(data)) return null;
    return data.map((row) => row?.data).filter((rec) => rec && typeof rec === 'object');
  } catch (_) {
    return null;
  }
};

// Load all step-1 entities from their tables. Returns { [stateKey]: records }
// containing ONLY the entities whose table fetch succeeded; a missing key
// means "keep the blob value".
export const loadStep1EntitiesFromTables = async () => {
  const entries = Object.entries(STEP1_ENTITY_TABLES);
  const results = await Promise.all(entries.map(async ([stateKey, table]) => {
    const records = await fetchEntityTable(table);
    return [stateKey, records];
  }));
  const out = {};
  results.forEach(([stateKey, records]) => {
    if (records !== null) out[stateKey] = records;
  });
  return out;
};

const syncEntityDiffNow = async (stateKey, records, snapshot) => {
  const table = STEP1_ENTITY_TABLES[stateKey];
  if (!table || !Array.isArray(records) || !(snapshot instanceof Map)) return;
  const next = new Map();
  const upserts = [];
  records.forEach((record) => {
    const key = entityRecordKey(record);
    if (key === null) return;
    const json = JSON.stringify(record);
    next.set(key, json);
    if (snapshot.get(key) !== json) {
      const row = buildEntityRow(table, record);
      if (row) upserts.push(row);
    }
  });
  const deletes = [];
  snapshot.forEach((_, key) => {
    if (!next.has(key)) deletes.push(key);
  });
  if (upserts.length === 0 && deletes.length === 0) return;
  try {
    if (upserts.length > 0) {
      const { error } = await supabase.from(table).upsert(upserts, { onConflict: 'id' });
      if (error) throw error;
    }
    if (deletes.length > 0) {
      const { error } = await supabase.from(table).delete().in('id', deletes);
      if (error) throw error;
    }
    // Only advance the snapshot after the writes succeed, so a failed sync
    // is retried by the next diff.
    snapshot.clear();
    next.forEach((v, k) => snapshot.set(k, v));
  } catch (err) {
    console.warn(`[EntityTables] write-through failed for ${stateKey} (${table}):`, err?.message || err);
  }
};

// Diff one entity's current state array against its last-synced snapshot and
// push the changes to its table: upsert new/changed records, delete vanished
// ones. Calls for the same entity are serialized through a promise chain so
// overlapping state changes can never interleave writes. Never throws.
const syncChains = {};
export const syncEntityDiffToTable = (stateKey, records, snapshot) => {
  syncChains[stateKey] = (syncChains[stateKey] || Promise.resolve())
    .then(() => syncEntityDiffNow(stateKey, records, snapshot))
    .catch(() => {});
  return syncChains[stateKey];
};

// --- adminSetup (app_config) — Phase C Step 3 addendum ---------------------
// adminSetup (incl. the base currency selected in User Control ->
// Administration) is a single settings object, not a collection, so it rides
// in the key/value app_config table under key 'adminSetup'. The table copy
// wins on load; the blob copy remains the fallback. This is what makes the
// currency selection durable across blob regressions.

export const loadAdminSetupFromTable = async () => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('data')
      .eq('key', 'adminSetup')
      .maybeSingle();
    if (error || !data || typeof data.data !== 'object' || data.data === null) return null;
    return data.data;
  } catch (_) {
    return null;
  }
};

export const syncAdminSetupToTable = async (adminSetup) => {
  if (!adminSetup || typeof adminSetup !== 'object') return;
  try {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'adminSetup', data: adminSetup, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
  } catch (err) {
    console.warn('[EntityTables] adminSetup write-through failed:', err?.message || err);
  }
};

// --- FG Combination Builder config (app_config) — FG Combo phase ----------
// The builder config (lookups, masking switches, auto-select rules) used to
// live ONLY in each browser's localStorage, so it could silently diverge or
// be lost. It now rides in app_config under key 'fgComboConfig', mirroring
// adminSetup: the table copy wins on load, localStorage remains a fallback
// and offline cache, and changes write through.

export const loadFGComboConfigFromTable = async () => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('data')
      .eq('key', 'fgComboConfig')
      .maybeSingle();
    if (error || !data || typeof data.data !== 'object' || data.data === null) return null;
    return data.data;
  } catch (_) {
    return null;
  }
};

export const syncFGComboConfigToTable = async (config) => {
  if (!config || typeof config !== 'object') return;
  try {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'fgComboConfig', data: config, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
  } catch (err) {
    console.warn('[EntityTables] fgComboConfig write-through failed:', err?.message || err);
  }
};
