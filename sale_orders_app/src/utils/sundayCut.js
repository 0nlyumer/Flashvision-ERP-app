// --- Sunday Cut Rules (hr_duty_settings.sundayCutRules) --------------------
// Omer's order (2026-10-25): a Sunday can be CUT — counted as Absent
// (unpaid) instead of a paid Off Day — for selected employees when:
//   Rule 1 "twoAbsence": the employee has >= minAbsences ABSENT days in
//     the Mon–Sat window immediately before that Sunday.
//   Rule 2 "continuous": the employee is absent on the Saturday before
//     AND the Monday after the Sunday (the Sunday is sandwiched inside
//     an unbroken absence).
// Trigger counting is ABSENT days only ('leave' never counts; a
// short-punch day is recorded 'Absent' and does count). A Sunday whose
// own record is a Holiday, or one the employee actually worked
// (present / punch times), is never cut.
// The cut is a classification-time decision only — this module NEVER
// writes into emp.attendance; it just answers "which Sundays of this
// period are cut for this employee" for the payroll engine, the live
// payslip modal and the attendance/payslip display builders.
// Config lives inside the hr_duty_settings object next to
// attendanceStatusRules and follows the flashAmConfig discipline:
// a DEFAULT constant + normalize/merge so older saved settings gain
// the block without losing anything. Both rules ship DISABLED, so an
// unconfigured system behaves exactly as before this feature existed.

export const DEFAULT_SUNDAY_CUT_RULES = {
  twoAbsence: { enabled: false, minAbsences: 2, applyToAll: false, employeeIds: [] },
  continuous: { enabled: false, applyToAll: false, employeeIds: [] }
};

const toIdList = (v) => (Array.isArray(v) ? v.map((x) => String(x)) : []);
const toNum = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const toBool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);

export function normalizeSundayCutRules(raw) {
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
  }
  if (!parsed || typeof parsed !== 'object') parsed = {};
  const d = DEFAULT_SUNDAY_CUT_RULES;
  const ta = parsed.twoAbsence && typeof parsed.twoAbsence === 'object' ? parsed.twoAbsence : {};
  const ct = parsed.continuous && typeof parsed.continuous === 'object' ? parsed.continuous : {};
  return {
    twoAbsence: {
      enabled: toBool(ta.enabled, d.twoAbsence.enabled),
      minAbsences: Math.max(1, Math.floor(toNum(ta.minAbsences, d.twoAbsence.minAbsences))),
      applyToAll: toBool(ta.applyToAll, d.twoAbsence.applyToAll),
      employeeIds: toIdList(ta.employeeIds)
    },
    continuous: {
      enabled: toBool(ct.enabled, d.continuous.enabled),
      applyToAll: toBool(ct.applyToAll, d.continuous.applyToAll),
      employeeIds: toIdList(ct.employeeIds)
    }
  };
}

// True when at least one rule is switched on (regardless of scope) —
// callers use this as a fast path to skip all Sunday-cut work.
export function anySundayCutRuleEnabled(raw) {
  const r = normalizeSundayCutRules(raw);
  return Boolean(r.twoAbsence.enabled || r.continuous.enabled);
}

const ruleInScope = (rule, empIdStr) =>
  Boolean(rule && rule.enabled && (rule.applyToAll || rule.employeeIds.includes(empIdStr)));

// Safe date normalizer — identical to payrollCalc's normalizeDate
// (converts DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD into standard YYYY-MM-DD).
const normalizeDate = (dateStr) => {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    let year, month, day;
    if (parts[0].length === 4) {
      year = parts[0];
      month = parts[1].padStart(2, '0');
      day = parts[2].padStart(2, '0');
    } else if (parts[2].length === 4) {
      year = parts[2];
      month = parts[0].padStart(2, '0');
      day = parts[1].padStart(2, '0');
    } else {
      return str;
    }
    return `${year}-${month}-${day}`;
  }
  return str;
};

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad2 = (n) => String(n).padStart(2, '0');
const dateKeyOf = (dt) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;

// Build the FULL day-status map for one employee (not period-sliced),
// the same way payrollCalc builds its dailyMap: emp.attendance records
// first, uploaded / FlashAM punch logs merged over them (an attendance
// record flagged userEdited always wins). Bare day-number attendance
// keys belong to the period month (the only month context they have).
function buildDayStatusMap(emp, period, state, extraLogs) {
  const map = {};
  const [py, pm] = String(period || '').split('-').map((x) => parseInt(x, 10));

  if (emp.attendance && typeof emp.attendance === 'object') {
    Object.entries(emp.attendance).forEach(([dayKey, rec]) => {
      if (!rec) return;
      const rawKey = String(dayKey).trim();
      let normKey = '';
      if (/^\d{1,2}$/.test(rawKey) && py && pm) {
        normKey = `${py}-${pad2(pm)}-${pad2(parseInt(rawKey, 10))}`;
      } else {
        const n = normalizeDate(rawKey);
        if (DATE_KEY_RE.test(n)) normKey = n;
      }
      if (normKey) map[normKey] = { ...rec };
    });
  }

  const empIdStr = String(emp.id || '').trim();
  const empCodeStr = String(emp.employeeCode || emp.code || '').trim();
  const empNameLower = String(emp.name || '').trim().toLowerCase();

  const logs = [
    ...((state && state.hr_uploaded_attendance) || []),
    ...(Array.isArray(extraLogs) ? extraLogs : [])
  ];
  logs.forEach((a) => {
    if (!a) return;
    const aEmpId = String(a.employeeId || (a.id && String(a.id).startsWith('EMP-') ? a.id : '')).trim();
    const aEmpCode = String(a.employeeCode || a.code || '').trim();
    const aName = String(a.employeeName || a.name || '').trim().toLowerCase();
    const idMatches = (aEmpId && (aEmpId === empIdStr || aEmpId === empCodeStr)) ||
                      (aEmpCode && (aEmpCode === empIdStr || aEmpCode === empCodeStr));
    const nameMatches = aName && empNameLower && (aName === empNameLower || aName.includes(empNameLower) || empNameLower.includes(aName));
    if (!idMatches && !nameMatches) return;
    const logDate = normalizeDate(a.date || a.logDate || a.punchDate);
    if (!DATE_KEY_RE.test(logDate)) return;
    if (!map[logDate] || !map[logDate].userEdited) {
      map[logDate] = {
        ...(map[logDate] || {}),
        status: a.status || 'present',
        shortPunch: Boolean(a.shortPunch) || Boolean(map[logDate]?.shortPunch),
        inTime: a.inTime || map[logDate]?.inTime,
        outTime: a.outTime || map[logDate]?.outTime,
        ot: parseFloat(a.ot || a.overtimeHours || map[logDate]?.ot || 0) || 0,
        fines: parseFloat(a.fines || a.fine || map[logDate]?.fines || 0) || 0,
        deductions: parseFloat(a.deductions || a.lateHours || map[logDate]?.deductions || 0) || 0
      };
    }
  });

  return map;
}

// The engine's own absent bucket: status contains 'abs' (any case) OR
// the record carries the shortPunch flag. 'leave' never counts.
const isAbsentDay = (rec) => {
  if (!rec) return false;
  if (rec.shortPunch) return true;
  return String(rec.status || '').toLowerCase().trim().includes('abs');
};

// A Sunday is protected when its own record is a holiday, or the
// employee actually worked it (present bucket / punch times, and not a
// short-punch absent).
const isProtectedSunday = (rec) => {
  if (!rec) return false;
  const st = String(rec.status || '').toLowerCase().trim();
  if (st.includes('holiday')) return true;
  if (rec.shortPunch) return false;
  return st.includes('present') || st === 'completed' || st === 'p' || Boolean(rec.inTime || rec.outTime);
};

// getCutSundays(emp, period, state, rules, extraLogs?)
//   emp       — employee record (id + attendance used)
//   period    — 'YYYY-MM'; only Sundays inside this month are returned
//   state     — AppContext state (hr_uploaded_attendance read from it)
//   rules     — raw sundayCutRules block (normalized internally)
//   extraLogs — optional extra attendance logs (e.g. localStorage copies
//               the caller already merged, or the live modal's logs)
// Returns a Set of 'YYYY-MM-DD' keys of the cut Sundays.
export function getCutSundays(emp, period, state, rules, extraLogs) {
  const cut = new Set();
  if (!emp || !period) return cut;
  const r = normalizeSundayCutRules(rules);
  const empIdStr = String(emp.id || '');
  const twoInScope = ruleInScope(r.twoAbsence, empIdStr);
  const contInScope = ruleInScope(r.continuous, empIdStr);
  if (!twoInScope && !contInScope) return cut;

  const [y, m] = String(period).split('-').map((x) => parseInt(x, 10));
  if (!y || !m) return cut;
  const daysInMonth = new Date(y, m, 0).getDate();
  const map = buildDayStatusMap(emp, period, state, extraLogs);
  const minAbs = Math.max(1, r.twoAbsence.minAbsences || 2);

  for (let d = 1; d <= daysInMonth; d++) {
    const sunday = new Date(y, m - 1, d);
    if (sunday.getDay() !== 0) continue;
    const sKey = dateKeyOf(sunday);
    if (isProtectedSunday(map[sKey])) continue;

    let isCut = false;
    if (twoInScope) {
      // Week window: the 6 days S-6 .. S-1 (Mon–Sat before the Sunday).
      let count = 0;
      for (let i = 6; i >= 1; i--) {
        if (isAbsentDay(map[dateKeyOf(new Date(y, m - 1, d - i))])) count++;
      }
      if (count >= minAbs) isCut = true;
    }
    if (!isCut && contInScope) {
      // Sandwich: Saturday (S-1) absent AND Monday (S+1) absent,
      // recorded data only — a missing record is NOT absent.
      const satAbsent = isAbsentDay(map[dateKeyOf(new Date(y, m - 1, d - 1))]);
      const monAbsent = isAbsentDay(map[dateKeyOf(new Date(y, m - 1, d + 1))]);
      if (satAbsent && monAbsent) isCut = true;
    }
    if (isCut) cut.add(sKey);
  }
  return cut;
}
