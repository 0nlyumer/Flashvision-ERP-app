// entityTables.js — Phase C Steps 1–6: per-entity Supabase tables for reference data, production, sales, purchasing & inventory, HR, finance & misc.
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
//   hr_employees_list    hr_employees
//   hr_uploaded_attendance hr_uploaded_attendance
//   hr_leave_requests    hr_leave_requests
//   hr_overtime_requests hr_overtime_requests
//   hr_advance_requests  hr_advance_requests
//   hr_loan_requests     hr_loan_requests
//   hr_loan_ledger       hr_loan_ledger
//   hr_generated_salaries hr_generated_salaries
//   chartOfAccounts      chart_of_accounts
//   vouchers             vouchers
//   paymentVouchers      payment_vouchers
//   approvals            approvals
//   notifications        notifications
//   auditLogs            audit_logs
//   chats                chats
//   routingRules         routing_rules
//   routingTasks         routing_tasks
//   users                users
//   departments          departments
//   boms                 boms
//   finishedGoodPhases   finished_good_phases
//   rawMaterialPhases    raw_material_phases
//   documentWarehouseBinders document_warehouse_binders
//   gatePassActivities   gate_pass_activities
//   otherConsumptions    other_consumptions
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
  hr_employees_list: 'hr_employees',
  hr_uploaded_attendance: 'hr_uploaded_attendance',
  hr_leave_requests: 'hr_leave_requests',
  hr_overtime_requests: 'hr_overtime_requests',
  hr_advance_requests: 'hr_advance_requests',
  hr_loan_requests: 'hr_loan_requests',
  hr_loan_ledger: 'hr_loan_ledger',
  hr_generated_salaries: 'hr_generated_salaries',
  chartOfAccounts: 'chart_of_accounts',
  vouchers: 'vouchers',
  paymentVouchers: 'payment_vouchers',
  approvals: 'approvals',
  notifications: 'notifications',
  auditLogs: 'audit_logs',
  chats: 'chats',
  routingRules: 'routing_rules',
  routingTasks: 'routing_tasks',
  documentWarehouseBinders: 'document_warehouse_binders',
  gatePassActivities: 'gate_pass_activities',
  otherConsumptions: 'other_consumptions',
  users: 'users',
  departments: 'departments',
  boms: 'boms',
  finishedGoodPhases: 'finished_good_phases',
  rawMaterialPhases: 'raw_material_phases',
};

// Promoted columns per table (verified 2026-10-22 against the live schema;
// routing entries corrected 2026-10-23 — see the routing note below).
// kind drives the same type coercion the Phase B backfill used: text keeps
// strings (numbers stringified), numeric keeps numbers (numeric strings
// parsed), boolean keeps booleans only, json takes the value as-is. An
// optional 3rd element names the record field to read when it differs from
// the column name / its camelCase form.
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
  hr_employees: [
    ['name', 'text'], ['department', 'text'], ['designation', 'text'], ['phone', 'text'],
    ['email', 'text'], ['basic_salary', 'numeric'], ['allowance', 'numeric'], ['advance', 'numeric'],
    ['avatar', 'text'], ['status', 'text'],
  ],
  hr_uploaded_attendance: [
    ['employee_id', 'text'], ['employee_code', 'text'], ['date', 'text'], ['status', 'text'], ['department', 'text'],
  ],
  hr_leave_requests: [
    ['employee_id', 'text'], ['employee_name', 'text'], ['status', 'text'], ['leave_type', 'text'],
    ['start_date', 'text'], ['end_date', 'text'],
  ],
  hr_overtime_requests: [
    ['employee_id', 'text'], ['date', 'text'], ['start_time', 'text'], ['end_time', 'text'],
    ['hours', 'numeric'], ['status', 'text'], ['attachments', 'json'],
  ],
  hr_advance_requests: [ ['employee_id', 'text'], ['status', 'text'] ],
  hr_loan_requests: [
    ['employee_id', 'text'], ['department', 'text'], ['date_applied', 'text'], ['repayment_start_date', 'text'],
    ['type', 'text'], ['term_months', 'numeric'], ['monthly_installment', 'numeric'], ['purpose', 'text'],
    ['amount', 'numeric'], ['status', 'text'],
  ],
  hr_loan_ledger: [
    ['loan_request_id', 'text'], ['employee_name', 'text'], ['department', 'text'], ['designation', 'text'],
    ['loan_type', 'text'], ['total_loan_amount', 'numeric'], ['term_months', 'numeric'], ['monthly_installment', 'numeric'],
    ['repayment_start_date', 'text'], ['next_deduction_date', 'text'], ['paid_amount', 'numeric'],
    ['remaining_balance', 'numeric'], ['status', 'text'], ['deductions_history', 'json'],
  ],
  hr_generated_salaries: [ ['employee_id', 'text'] ],
  chart_of_accounts: [ ['name', 'text'], ['category', 'text'] ],
  vouchers: [],
  payment_vouchers: [],
  approvals: [
    ['type', 'text'], ['status', 'text'], ['requested_to', 'text'], ['requested_by', 'text'],
    ['value', 'text'], ['completed_at', 'text'], ['reason_comment', 'text'], ['details', 'json'],
  ],
  notifications: [ ['type', 'text'], ['title', 'text'] ],
  audit_logs: [ ['action', 'text'], ['module', 'text'], ['status', 'text'] ],
  chats: [ ['name', 'text'], ['username', 'text'], ['is_group', 'boolean'] ],
  // routing_rules / routing_tasks were created (Phase A) with their own
  // dedicated columns instead of the generic {id, data} shape, and several
  // are NOT NULL (verified live 2026-10-23): routing_rules.rule_name,
  // routing_rules.steps, routing_tasks.document, routing_tasks.steps,
  // routing_tasks.history. Leaving these lists empty made buildEntityRow
  // emit rows that violated those constraints — every write-through upsert
  // failed (PostgREST 23502), so the routing tables never received a single
  // new record and the boot overlay kept reverting rules/tasks to the
  // Phase B backfill. The entries below mirror the backfill exactly
  // (rule_name <- record.name via the source-field alias).
  routing_rules: [ ['rule_name', 'text', 'name'], ['status', 'text'], ['steps', 'json'] ],
  routing_tasks: [
    ['rule_id', 'text'], ['rule_name', 'text'], ['document', 'json'],
    ['current_step_index', 'numeric'], ['status', 'text'], ['steps', 'json'], ['history', 'json'],
  ],
  document_warehouse_binders: [ ['name', 'text'] ],
  gate_pass_activities: [],
  other_consumptions: [],
  // PHASE D STEP D1: users / departments / boms / phases were the last
  // blob-only collections. Live-schema probe (2026-10-23, insert round-trip):
  // the ONLY extra NOT NULL column among these five tables is
  // users.username — the remaining entries mirror the Phase B backfill so
  // the promoted columns stay populated (full_name comes from record.name;
  // departments.dept_value from record.value).
  users: [
    ['username', 'text'], ['name', 'text'], ['role', 'text'],
    ['permissions', 'json'], ['granular_permissions', 'json'],
    ['full_name', 'text', 'name'], ['email', 'text'], ['phone', 'text'], ['status', 'text'],
  ],
  departments: [ ['name', 'text'], ['label', 'text'], ['dept_value', 'text', 'value'] ],
  boms: [ ['finished_good_id', 'text'], ['finished_good_name', 'text'], ['status', 'text'] ],
  finished_good_phases: [ ['label', 'text'], ['title', 'text'], ['type', 'text'], ['enabled', 'boolean'] ],
  raw_material_phases: [ ['label', 'text'], ['title', 'text'], ['type', 'text'], ['enabled', 'boolean'] ],
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

// Phase C Step 5: legacy `hr_uploaded_attendance` records uploaded before ids
// existed carry neither `id` nor `value` (15 of 20 live records). Their table
// rows were backfilled with synthetic ids, so the write-through needs a
// content-derived key for them: `rec-<djb2 hash of the record JSON>`, with a
// `-2`, `-3`… suffix when the same record repeats within one array pass
// (`seen` counts occurrences per base key). Editing an id-less record changes
// its hash, so the diff deletes the old row and inserts the edited record —
// consistent for every writer (AppContext and the FlashAM terminal). All
// other entities keep the plain entityRecordKey behavior: records without an
// id/value stay untracked (key null).
const FALLBACK_KEY_STATE_KEYS = { hr_uploaded_attendance: true };

const hashRecord = (record) => {
  const s = JSON.stringify(record) || '';
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
};

export const recordKeyWithFallback = (stateKey, record, seen) => {
  let base = entityRecordKey(record);
  if (base === null) {
    if (!FALLBACK_KEY_STATE_KEYS[stateKey]) return null;
    if (!record || typeof record !== 'object') return null;
    base = `rec-${hashRecord(record)}`;
  }
  if (!(seen instanceof Map)) return base;
  const n = (seen.get(base) || 0) + 1;
  seen.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
};

const pickPromoted = (record, colName, kind, sourceField) => {
  // A promoted-column entry may name an explicit source field (3rd element)
  // when the record's field differs from both the column name and its
  // camelCase form (e.g. routing_rules.rule_name comes from record.name).
  const candidates = sourceField ? [sourceField, colName, camel(colName)] : [colName, camel(colName)];
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

export const buildEntityRow = (table, record, keyOverride) => {
  const id = keyOverride !== undefined && keyOverride !== null ? keyOverride : entityRecordKey(record);
  if (id === null) return null;
  const row = { id, data: record, updated_at: new Date().toISOString() };
  (PROMOTED_COLUMNS[table] || []).forEach(([colName, kind, sourceField]) => {
    const v = pickPromoted(record, colName, kind, sourceField);
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
  const seen = new Map();
  records.forEach((record) => {
    const key = recordKeyWithFallback(stateKey, record, seen);
    if (key === null) return;
    const json = JSON.stringify(record);
    next.set(key, json);
    if (snapshot.get(key) !== json) {
      const row = buildEntityRow(table, record, key);
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

// --- Flash AM Configuration (app_config) — FlashAM Phase A -----------------
// Flash AM terminal configuration rides in app_config under key 'flashAmConfig':
// the table copy wins on load and changes write through, mirroring fgComboConfig.

export const loadFlashAmConfigFromTable = async () => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('data')
      .eq('key', 'flashAmConfig')
      .maybeSingle();
    if (error || !data || typeof data.data !== 'object' || data.data === null) return null;
    return data.data;
  } catch (_) {
    return null;
  }
};

export const syncFlashAmConfigToTable = async (config) => {
  if (!config || typeof config !== 'object') return;
  try {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'flashAmConfig', data: config, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
  } catch (err) {
    console.warn('[EntityTables] flashAmConfig write-through failed:', err?.message || err);
  }
};

// --- Salary Print Settings (app_config) — HR Prints phase ------------------
// Salary Generation print-studio settings ride in app_config under key
// 'salaryPrintSettings': the table copy wins on load and changes write
// through, mirroring flashAmConfig. Never stored in the blob/localStorage.

export const loadSalaryPrintSettingsFromTable = async () => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('data')
      .eq('key', 'salaryPrintSettings')
      .maybeSingle();
    if (error || !data || typeof data.data !== 'object' || data.data === null) return null;
    return data.data;
  } catch (_) {
    return null;
  }
};

export const syncSalaryPrintSettingsToTable = async (settings) => {
  if (!settings || typeof settings !== 'object') return;
  try {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'salaryPrintSettings', data: settings, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
  } catch (err) {
    console.warn('[EntityTables] salaryPrintSettings write-through failed:', err?.message || err);
  }
};

// --- Login Theme Settings (app_config) — Login Themes phase ---------------
// The login screen theme choice (fixed theme or auto-rotation) is a GLOBAL
// pre-auth setting: it rides in app_config under key 'loginThemeSettings',
// mirroring salaryPrintSettings — the table copy wins on load and changes
// write through. Never stored in the blob or per-user settings.

export const loadLoginThemeSettingsFromTable = async () => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('data')
      .eq('key', 'loginThemeSettings')
      .maybeSingle();
    if (error || !data || typeof data.data !== 'object' || data.data === null) return null;
    return data.data;
  } catch (_) {
    return null;
  }
};

export const syncLoginThemeSettingsToTable = async (settings) => {
  if (!settings || typeof settings !== 'object') return;
  try {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'loginThemeSettings', data: settings, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
  } catch (err) {
    console.warn('[EntityTables] loginThemeSettings write-through failed:', err?.message || err);
  }
};

// --- Payroll Account Mapping (app_config) — HR Payroll Mapping phase -------
// The HR payroll-category -> GL-account mappings ride in app_config under
// key 'payrollAccountMapping' (data = the mappings array): the table copy
// wins on load and changes write through, mirroring salaryPrintSettings.
// They used to live only in each browser's localStorage. Never stored in
// the blob.

export const loadPayrollAccountMappingFromTable = async () => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('data')
      .eq('key', 'payrollAccountMapping')
      .maybeSingle();
    if (error || !data || !Array.isArray(data.data)) return null;
    return data.data;
  } catch (_) {
    return null;
  }
};

export const syncPayrollAccountMappingToTable = async (mappings) => {
  if (!Array.isArray(mappings)) return;
  try {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'payrollAccountMapping', data: mappings, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
  } catch (err) {
    console.warn('[EntityTables] payrollAccountMapping write-through failed:', err?.message || err);
  }
};

// --- categoryPrefixes + scalars (app_config) — Phase C Step 6 -------------
// App-config completion: the remaining blob config now also rides in
// app_config, mirroring adminSetup. categoryPrefixes (the item-code prefix
// map) is a plain settings object: table copy wins on load, changes write
// through. The `scalars` row bundles buildVersion / lastUpdatedBy /
// productionTarget / isGlobalPaginated; of these only productionTarget and
// isGlobalPaginated are user settings (applied on load by AppContext) —
// buildVersion is force-stamped from the code constant on every sync and
// lastUpdatedBy changes per save, so they are mirrored into the row for
// completeness but never read back.

export const loadCategoryPrefixesFromTable = async () => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('data')
      .eq('key', 'categoryPrefixes')
      .maybeSingle();
    if (error || !data || typeof data.data !== 'object' || data.data === null) return null;
    return data.data;
  } catch (_) {
    return null;
  }
};

export const syncCategoryPrefixesToTable = async (categoryPrefixes) => {
  if (!categoryPrefixes || typeof categoryPrefixes !== 'object') return;
  try {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'categoryPrefixes', data: categoryPrefixes, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
  } catch (err) {
    console.warn('[EntityTables] categoryPrefixes write-through failed:', err?.message || err);
  }
};

export const loadScalarsFromTable = async () => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('data')
      .eq('key', 'scalars')
      .maybeSingle();
    if (error || !data || typeof data.data !== 'object' || data.data === null) return null;
    return data.data;
  } catch (_) {
    return null;
  }
};

export const syncScalarsToTable = async (scalars) => {
  if (!scalars || typeof scalars !== 'object') return;
  try {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'scalars', data: scalars, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
  } catch (err) {
    console.warn('[EntityTables] scalars write-through failed:', err?.message || err);
  }
};

// --- counters + batchOutputTypes (app_config) — Phase D Step D1 ------------
// The last two blob-only leftovers were not collections at all: `counters`
// (the global ITEM-### line-code counter object) and `batchOutputTypes`
// (the production grade definitions array). They ride in app_config like
// the other config, mirroring payrollAccountMapping: the table copy wins
// on load and changes write through. The blob copies remain as fallback
// until Phase D Step D3 stops blob writes.

export const loadCountersFromTable = async () => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('data')
      .eq('key', 'counters')
      .maybeSingle();
    if (error || !data || typeof data.data !== 'object' || data.data === null || Array.isArray(data.data)) return null;
    return data.data;
  } catch (_) {
    return null;
  }
};

export const syncCountersToTable = async (counters) => {
  if (!counters || typeof counters !== 'object' || Array.isArray(counters)) return;
  try {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'counters', data: counters, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
  } catch (err) {
    console.warn('[EntityTables] counters write-through failed:', err?.message || err);
  }
};

export const loadBatchOutputTypesFromTable = async () => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('data')
      .eq('key', 'batchOutputTypes')
      .maybeSingle();
    if (error || !data || !Array.isArray(data.data)) return null;
    return data.data;
  } catch (_) {
    return null;
  }
};

export const syncBatchOutputTypesToTable = async (types) => {
  if (!Array.isArray(types)) return;
  try {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'batchOutputTypes', data: types, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
  } catch (err) {
    console.warn('[EntityTables] batchOutputTypes write-through failed:', err?.message || err);
  }
};

// --- Batch Record labor-cost selection (app_config) — 2026-10-25 -----------
// The HR Settings selection of AJ Synthetic employees whose daily salary
// cost feeds the Batch Record estimated labor cost rides in app_config
// under key 'batchLaborConfig' ({ employeeIds: [...] }), mirroring
// flashAmConfig: the table copy wins on load and changes write through,
// so the selection is identical on every device and can never be lost
// in a blob flip or browser swap.

export const loadBatchLaborConfigFromTable = async () => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('data')
      .eq('key', 'batchLaborConfig')
      .maybeSingle();
    if (error || !data || typeof data.data !== 'object' || data.data === null) return null;
    return data.data;
  } catch (_) {
    return null;
  }
};

export const syncBatchLaborConfigToTable = async (config) => {
  if (!config || typeof config !== 'object') return;
  try {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'batchLaborConfig', data: config, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
  } catch (err) {
    console.warn('[EntityTables] batchLaborConfig write-through failed:', err?.message || err);
  }
};

// --- HR Duty Settings (app_config) — SERVER RULE, 2026-10-26 ---------------
// Duty settings (incl. Sunday Cut rules) used to persist ONLY in each
// browser's localStorage ('hr_duty_settings'). Per Omer's server rule they
// now ride in app_config under key 'hrDutySettings', mirroring
// flashAmConfig: the table copy wins on load, localStorage is only a cache
// refreshed from the server value, and changes write through.

export const loadDutySettingsFromTable = async () => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('data')
      .eq('key', 'hrDutySettings')
      .maybeSingle();
    if (error || !data || typeof data.data !== 'object' || data.data === null) return null;
    return data.data;
  } catch (_) {
    return null;
  }
};

export const syncDutySettingsToTable = async (settings) => {
  if (!settings || typeof settings !== 'object') return;
  try {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'hrDutySettings', data: settings, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
  } catch (err) {
    console.warn('[EntityTables] hrDutySettings write-through failed:', err?.message || err);
  }
};

// --- HR Salary & Allowance Config (app_config) — SERVER RULE, 2026-10-26 ---
// The Salary & Allowance configuration (payrollCalc reads it, plus the
// per-employee allowance map) used to persist ONLY in localStorage
// ('hr_salary_allowance_config' / 'hr_employee_allowance_map'). It now rides
// in app_config under key 'hrSalaryAllowanceConfig' as one object
// { config, employeeAllowanceMap }: the table copy wins on load and is
// mirrored back into the localStorage caches (payrollCalc keeps reading the
// cache, which is refreshed from the server at every login), and saved
// changes write through.

export const loadSalaryAllowanceConfigFromTable = async () => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('data')
      .eq('key', 'hrSalaryAllowanceConfig')
      .maybeSingle();
    if (error || !data || typeof data.data !== 'object' || data.data === null) return null;
    return data.data;
  } catch (_) {
    return null;
  }
};

export const syncSalaryAllowanceConfigToTable = async (payload) => {
  if (!payload || typeof payload !== 'object') return;
  try {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'hrSalaryAllowanceConfig', data: payload, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
  } catch (err) {
    console.warn('[EntityTables] hrSalaryAllowanceConfig write-through failed:', err?.message || err);
  }
};
