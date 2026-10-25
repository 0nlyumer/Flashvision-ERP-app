// --- Batch Record: Estimated Labor Cost ----------------------------------
// Omer's order (2026-10-24), calculation basis confirmed by him personally
// on 2026-10-25 — this basis must NOT drift:
//
//   * For the day a production plan ran, take the AJ Synthetic division
//     employees who are (a) SELECTED for this calculation in HR Settings
//     and (b) PRESENT that day.
//   * One employee's daily cost = monthly salary / days in that month
//     (the exact day-amount rule payrollCalc.js itself uses:
//     "basic salary / current month days = 1 day amount").
//   * The day's total daily cost is split across that day's plan items in
//     proportion to METERS (produced/output meters; planned meters when
//     an item produced nothing yet). With several plans on one day, the
//     day total is first split across the plans by their total meters,
//     then inside each plan across its items — the grand total of all
//     item shares always equals the day total EXACTLY (the rounding
//     remainder lands on the last item; no drift).
//   * When a date has NO attendance data at all for the selected
//     employees, the cost is unknown -> null (the UI shows "—"),
//     never zero and never a guess.
//
// Sources (discovered from the live code/data, 2026-10-25):
//   * Monthly salary: emp.basicSalary || emp.salary || emp.baseSalary —
//     the same field precedence payrollCalc.js uses for real payroll.
//   * Division: emp.division || emp.section || 'AJ Synthetic' — the same
//     resolution payrollCalc.js uses (live records carry the division in
//     `section`). Only Active employees (payrollCalc's own filter).
//   * Presence: the employee's embedded `attendance` map merged with the
//     `hr_uploaded_attendance` logs — the same two sources payrollCalc.js
//     merges, with the same present test (status present/completed/'p',
//     or punch times present) and the same log matching (employeeId /
//     employeeCode / name). An unrecorded day never counts as present.

export const BATCH_LABOR_DIVISION = 'AJ Synthetic';

// --- Config (HR Settings selection) -----------------------------------------
// Rides in AppContext state as `batch_labor_config` and persists to the
// app_config table under key 'batchLaborConfig' (table copy wins on load),
// mirroring flashAmConfig / fgComboConfig.

export function normalizeBatchLaborConfig(raw) {
  const ids = raw && Array.isArray(raw.employeeIds) ? raw.employeeIds : [];
  const seen = new Set();
  const employeeIds = [];
  ids.forEach((id) => {
    const s = String(id ?? '').trim();
    if (s && !seen.has(s)) { seen.add(s); employeeIds.push(s); }
  });
  return { employeeIds };
}

export function getInitialBatchLaborConfig() {
  return normalizeBatchLaborConfig(null);
}

// --- Helpers -----------------------------------------------------------------

const safeNum = (val) => {
  if (val === null || val === undefined) return 0;
  const n = parseFloat(val);
  return Number.isNaN(n) ? 0 : n;
};

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Normalize a date from DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD (or a Date /
// ISO datetime) into a YYYY-MM-DD key. Mirrors payrollCalc.normalizeDate.
export function normalizeDateKey(dateStr) {
  if (!dateStr) return '';
  if (dateStr instanceof Date) {
    if (Number.isNaN(dateStr.getTime())) return '';
    return dateStr.toISOString().slice(0, 10);
  }
  const str = String(dateStr).trim();
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    let year, month, day;
    if (parts[0].length === 4) {
      year = parts[0]; month = parts[1].padStart(2, '0'); day = parts[2].padStart(2, '0');
    } else if (parts[2].length === 4) {
      year = parts[2]; month = parts[0].padStart(2, '0'); day = parts[1].padStart(2, '0');
    } else {
      return str;
    }
    return `${year}-${month}-${day}`;
  }
  return str;
}

export function daysInMonthFor(dateKey) {
  const [y, m] = String(dateKey || '').split('-').map((x) => parseInt(x, 10));
  if (!y || !m) return 0;
  return new Date(y, m, 0).getDate();
}

// The monthly salary payroll itself runs on (payrollCalc.js field order).
export function getMonthlySalary(emp) {
  if (!emp) return 0;
  return safeNum(emp.basicSalary || emp.salary || emp.baseSalary);
}

export function getEmployeeDivision(emp) {
  return String(emp?.division || emp?.section || BATCH_LABOR_DIVISION).trim();
}

export function isActiveEmployee(emp) {
  return String(emp?.status || 'Active').toLowerCase() === 'active';
}

// Employees eligible for the HR Settings selection list: Active and in
// the AJ Synthetic division (payrollCalc's division resolution).
export function getBatchLaborCandidates(employees) {
  return (Array.isArray(employees) ? employees : []).filter(
    (emp) => emp && emp.id && isActiveEmployee(emp)
      && getEmployeeDivision(emp).toLowerCase() === BATCH_LABOR_DIVISION.toLowerCase()
  );
}

// --- Presence ------------------------------------------------------------------
// Returns { hasRecord, present } for one employee on one date, using the
// same merged sources and the same present test as payrollCalc.js.

function recordPresence(rec) {
  if (!rec || typeof rec !== 'object') return { hasRecord: false, present: false };
  if (rec.shortPunch) {
    // A short punch the terminal marked not-counted is never a worked
    // day, even though the record still carries its punch times.
    const st = String(rec.status || '').toLowerCase().trim();
    if (st.includes('abs')) return { hasRecord: true, present: false };
  }
  const st = String(rec.status || '').toLowerCase().trim();
  const hasPunch = Boolean(rec.inTime || rec.outTime);
  if (st.includes('present') || st === 'completed' || st === 'p' || hasPunch) {
    return { hasRecord: true, present: true };
  }
  if (st) return { hasRecord: true, present: false };
  return { hasRecord: true, present: hasPunch };
}

function logMatchesEmployee(log, emp) {
  const empIdStr = String(emp.id || '').trim();
  const empCodeStr = String(emp.employeeCode || emp.code || '').trim();
  const empNameLower = String(emp.name || '').trim().toLowerCase();
  const aEmpId = String(log.employeeId || (log.id && String(log.id).startsWith('EMP-') ? log.id : '')).trim();
  const aEmpCode = String(log.employeeCode || log.code || '').trim();
  const aName = String(log.employeeName || log.name || '').trim().toLowerCase();
  const idMatches = (aEmpId && (aEmpId === empIdStr || aEmpId === empCodeStr))
    || (aEmpCode && (aEmpCode === empIdStr || aEmpCode === empCodeStr));
  const nameMatches = aName && empNameLower
    && (aName === empNameLower || aName.includes(empNameLower) || empNameLower.includes(aName));
  return Boolean(idMatches || nameMatches);
}

export function getPresenceOnDate(emp, dateKey, uploadedLogs) {
  let merged = null;
  const att = emp?.attendance;
  if (att && typeof att === 'object') {
    Object.entries(att).forEach(([dayKey, rec]) => {
      if (normalizeDateKey(dayKey) === dateKey && rec) {
        merged = { ...(merged || {}), ...rec };
      }
    });
  }
  (Array.isArray(uploadedLogs) ? uploadedLogs : []).forEach((log) => {
    if (!log || typeof log !== 'object') return;
    if (normalizeDateKey(log.date || log.logDate || log.punchDate) !== dateKey) return;
    if (!logMatchesEmployee(log, emp)) return;
    if (!merged || !merged.userEdited) {
      merged = {
        ...(merged || {}),
        status: log.status || merged?.status || 'present',
        shortPunch: Boolean(log.shortPunch) || Boolean(merged?.shortPunch),
        inTime: log.inTime || merged?.inTime,
        outTime: log.outTime || merged?.outTime
      };
    }
  });
  if (!merged) return { hasRecord: false, present: false };
  return recordPresence(merged);
}

// --- Day total -------------------------------------------------------------------
// The total daily salary cost of the SELECTED employees who were PRESENT
// on dateKey. Returns null when the date has no attendance data at all
// for any selected employee (cost unknown — never guess), or when no
// employees are selected.

export function computeDailyLaborCost({ dateKey, employees, selectedIds, uploadedAttendance }) {
  const key = normalizeDateKey(dateKey);
  if (!key) return null;
  const daysInMonth = daysInMonthFor(key);
  if (!daysInMonth) return null;
  const selected = new Set((Array.isArray(selectedIds) ? selectedIds : []).map((id) => String(id)));
  if (selected.size === 0) return null;
  const byId = new Map((Array.isArray(employees) ? employees : []).map((e) => [String(e?.id), e]));

  let anyData = false;
  const presentEmployees = [];
  let total = 0;
  selected.forEach((id) => {
    const emp = byId.get(id);
    if (!emp) return;
    const presence = getPresenceOnDate(emp, key, uploadedAttendance);
    if (presence.hasRecord) anyData = true;
    if (presence.present) {
      const monthlySalary = getMonthlySalary(emp);
      const dailyCost = monthlySalary / daysInMonth;
      total += dailyCost;
      presentEmployees.push({ id: String(emp.id), name: emp.name || String(emp.id), monthlySalary, dailyCost: round2(dailyCost) });
    }
  });
  if (!anyData) return null;
  return {
    dateKey: key,
    daysInMonth,
    totalDailyCost: round2(total),
    presentEmployees,
    presentCount: presentEmployees.length
  };
}

// --- Distribution ------------------------------------------------------------------
// Split a day total across plans and their items by meters. plans:
// [{ planId, items: [{ key, meters, fallbackMeters }] }]. Weight = meters
// when positive, else fallbackMeters (planned qty). Returns
// { perItem: Map(key -> PKR 2dp), perPlan: Map(planId -> PKR 2dp) } whose
// item shares sum to round2(dayTotal) EXACTLY: every share is rounded,
// and the rounding remainder lands on the last item of the last plan.

export function splitLaborAcrossPlans(dayTotal, plans) {
  const perItem = new Map();
  const perPlan = new Map();
  const total = round2(dayTotal);
  const planList = (Array.isArray(plans) ? plans : []).map((p) => {
    const items = (p.items || []).map((it) => ({
      key: it.key,
      weight: (Number(it.meters) > 0 ? Number(it.meters) : Number(it.fallbackMeters) || 0)
    }));
    return { planId: p.planId, items, totalWeight: items.reduce((s, i) => s + i.weight, 0) };
  });
  const grandWeight = planList.reduce((s, p) => s + p.totalWeight, 0);
  if (!(total > 0) || grandWeight <= 0) {
    planList.forEach((p) => {
      perPlan.set(p.planId, 0);
      p.items.forEach((it) => perItem.set(it.key, 0));
    });
    return { perItem, perPlan };
  }

  // Flatten in order; the last weighted entry absorbs the remainder so
  // the shares always sum to the day total exactly.
  const flat = [];
  planList.forEach((p) => p.items.forEach((it) => { if (it.weight > 0) flat.push(it); }));
  let assigned = 0;
  flat.forEach((it, idx) => {
    let share;
    if (idx === flat.length - 1) {
      share = round2(total - assigned);
    } else {
      share = round2((total * it.weight) / grandWeight);
      assigned = round2(assigned + share);
    }
    perItem.set(it.key, share);
  });
  planList.forEach((p) => {
    let sum = 0;
    p.items.forEach((it) => { sum += perItem.get(it.key) || 0; });
    perPlan.set(p.planId, round2(sum));
    p.items.forEach((it) => { if (!perItem.has(it.key)) perItem.set(it.key, 0); });
  });
  return { perItem, perPlan };
}

// --- Screen-level entry point ------------------------------------------------------
// batches: the MasterBatchRecord batch objects ({ batchCode, planId, date,
// totalOutputQty, requestedQty }). Groups them by calendar date, computes
// each date's labor total once, and distributes it. Returns a Map from
// `${planId}::${batchCode}` -> PKR amount, or null when the date has no
// attendance data / no selection (UI shows "—").

export function computeBatchLaborCosts({ batches, employees, selectedIds, uploadedAttendance }) {
  const result = new Map();
  const byDate = new Map();
  (Array.isArray(batches) ? batches : []).forEach((b) => {
    const dateKey = normalizeDateKey(b.date);
    if (!dateKey) return;
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey).push(b);
  });

  byDate.forEach((dayBatches, dateKey) => {
    const day = computeDailyLaborCost({ dateKey, employees, selectedIds, uploadedAttendance });
    const planMap = new Map();
    dayBatches.forEach((b) => {
      if (!planMap.has(b.planId)) planMap.set(b.planId, []);
      planMap.get(b.planId).push(b);
    });
    const plans = [...planMap.entries()].map(([planId, items]) => ({
      planId,
      items: items.map((b) => ({
        key: `${planId}::${b.batchCode}`,
        meters: Number(b.totalOutputQty) || 0,
        fallbackMeters: Number(b.requestedQty) || 0
      }))
    }));
    if (!day) {
      plans.forEach((p) => p.items.forEach((it) => result.set(it.key, null)));
      return;
    }
    const { perItem } = splitLaborAcrossPlans(day.totalDailyCost, plans);
    perItem.forEach((v, k) => result.set(k, v));
  });
  return result;
}
