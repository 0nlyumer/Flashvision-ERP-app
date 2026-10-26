// Probation -> Onboarding-pending computation for gate-added employees
// (Omer, 2026-10-26 — FlashAM Add New Employee).
//
// A new man added at the gate (FlashAM) starts a 7-day probation. His
// attendance records normally during the week (FlashAM punches land in
// the employee's embedded attendance map, the same store HR reads). If
// he keeps coming through the week — present days, with a leave or two
// NOT disqualifying him — then once the 7 days are over his Onboarding
// becomes pending: his name surfaces in the Onboarding area and in the
// Dashboard notifications panel so he can be called in and onboarded.
//
// This module is the single, pure computation every surface uses
// (FlashAM roster badge, HR Dashboard pending list, HR Onboarding
// panel, and the AppContext transition that fires the one-time
// dashboard notification). No stored transition is needed to SURFACE
// the state — it is derived from the record on read. The one-time
// notification is guarded by a persisted flag on the record
// (probationOnboardingNotified) so it fires exactly once.
//
// Rule (design decision, recorded in the job result file):
//   window  = 7 consecutive calendar days starting on the joining
//             date (joining day = day 1 … joining+6 = day 7).
//   came    = day status present / late / halfday.
//   leave   = day status leave / on leave — excused, never counts
//             against him ("even with a leave or two").
//   absent  = day status absent (incl. short-punch days, which
//             FlashAM stores as Absent), OR a past non-Sunday window
//             day with no record at all.
//   neutral = Sundays (factory off day) and holiday / off-day records.
//   passed  = window fully elapsed AND came >= 3 AND absent <= 2.

export const PROBATION_DAYS = 7;
export const PROBATION_MIN_CAME = 3;
export const PROBATION_MAX_ABSENT = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

export function toDateKey(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseKey(key) {
  if (!key || typeof key !== 'string') return null;
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

export function addDaysKey(key, n) {
  const d = parseKey(key);
  if (!d) return null;
  return toDateKey(new Date(d.getTime() + n * DAY_MS));
}

// The joining date that starts probation. Gate adds stamp
// `probationStart` explicitly; dateOfJoining/joiningDate are accepted
// so the computation also works for records created elsewhere.
export function probationStartOf(emp) {
  if (!emp) return null;
  const raw = emp.probationStart || emp.dateOfJoining || emp.joiningDate || emp.startDate || null;
  return raw ? toDateKey(raw) : null;
}

// Only employees added through the FlashAM gate flow carry a
// probation window. Legacy employees are never probation-evaluated.
export function isProbationEmployee(emp) {
  return Boolean(emp && (emp.probationStart || emp.source === 'FlashAM_GateAdd'));
}

const CAME = new Set(['present', 'late', 'halfday', 'half day', 'half-day']);
const LEAVE = new Set(['leave', 'on leave', 'on-leave']);
const NEUTRAL = new Set(['holiday', 'off day', 'off-day', 'offday', 'sunday', 'weekly off']);

export function classifyProbationDay(status) {
  if (status === null || status === undefined || status === '') return 'none';
  const s = String(status).trim().toLowerCase();
  if (CAME.has(s)) return 'came';
  if (LEAVE.has(s)) return 'leave';
  if (NEUTRAL.has(s)) return 'neutral';
  if (s === 'absent') return 'absent';
  return 'none';
}

// Full probation picture for one employee as of `today` (Date or key).
// attendance is the employee's embedded map { 'YYYY-MM-DD': {status} } —
// weekday-keyed legacy entries are ignored (probation is date-based).
export function getProbationInfo(emp, today = new Date()) {
  const start = probationStartOf(emp);
  const todayKey = toDateKey(today);
  if (!start || !todayKey) {
    return {
      applicable: false, start: null, windowEnd: null, windowComplete: false,
      cameDays: 0, leaveDays: 0, absentDays: 0, neutralDays: 0, daysElapsed: 0,
      passed: false
    };
  }
  const windowEnd = addDaysKey(start, PROBATION_DAYS - 1);
  const att = (emp && emp.attendance) || {};
  let cameDays = 0, leaveDays = 0, absentDays = 0, neutralDays = 0, daysElapsed = 0;

  for (let i = 0; i < PROBATION_DAYS; i++) {
    const key = addDaysKey(start, i);
    if (!key || key > todayKey) break; // future day — not elapsed yet
    daysElapsed++;
    const d = parseKey(key);
    if (d && d.getDay() === 0) { neutralDays++; continue; } // Sunday — factory off
    const cls = classifyProbationDay(att[key]?.status);
    if (cls === 'came') cameDays++;
    else if (cls === 'leave') leaveDays++;
    else if (cls === 'neutral') neutralDays++;
    else absentDays++; // explicit absent OR no record on an elapsed day
  }

  const windowComplete = todayKey > windowEnd;
  const passed = windowComplete && cameDays >= PROBATION_MIN_CAME && absentDays <= PROBATION_MAX_ABSENT;
  return {
    applicable: true, start, windowEnd, windowComplete,
    cameDays, leaveDays, absentDays, neutralDays, daysElapsed, passed
  };
}

// Onboarding is pending for a probation employee who passed and has
// not completed onboarding yet.
export function isOnboardingPending(emp, today = new Date()) {
  if (!isProbationEmployee(emp)) return false;
  if (emp.onboarding === 'completed') return false;
  return getProbationInfo(emp, today).passed;
}

// Employees whose probation just passed and whose one-time dashboard
// notification has not been fired yet (persisted flag on the record).
export function findProbationNotificationsDue(employees, today = new Date()) {
  if (!Array.isArray(employees)) return [];
  return employees.filter((emp) =>
    isProbationEmployee(emp) &&
    emp.onboarding !== 'completed' &&
    emp.probationOnboardingNotified !== true &&
    getProbationInfo(emp, today).passed
  );
}
