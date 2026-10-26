// HR duty settings — single source of truth (SERVER RULE, Omer 2026-10-26).
//
// Duty settings (standard hours, overtime multipliers, attendance status
// rules, Sunday Cut rules, shifts) used to persist ONLY in each browser's
// localStorage ('hr_duty_settings'), so they diverged per machine and were
// lost with the browser. They now live on the server: app_config key
// 'hrDutySettings' (loaded by AppContext at login, written through on every
// change — see entityTables loadDutySettingsFromTable /
// syncDutySettingsToTable). localStorage remains only as a read cache that
// AppContext refreshes from the server value.
//
// This module owns the DEFAULT shape and the normalizer every consumer can
// trust: the HRSettings screen initializer, the AppContext load, and the
// smoke all use these — never a private copy.

import { normalizeSundayCutRules } from './sundayCut.js';

export const DEFAULT_DUTY_SETTINGS = {
  standardHours: 8,
  gracePeriodMinutes: 15,
  halfDayThresholdHours: 4,
  dutyHoursAdjustable: true,
  divisionDutyHours: {},
  departmentDutyHours: {},
  employeeDutyHours: {},
  overtimeCalculation: {
    rateMultiplier: 1.0,
    weekendMultiplier: 1.0,
    holidayMultiplier: 1.0,
    type: 'formula'
  },
  employeeOvertimeMultipliers: {},
  attendanceStatusRules: {
    present: { label: 'Present', urduLabel: 'حاضر', isPaid: true, code: 'P', color: 'emerald', description: 'Standard duty attended by staff (100% Paid)' },
    absent: { label: 'Absent', urduLabel: 'غیر حاضر', isPaid: false, code: 'ABS', color: 'rose', description: 'Unapproved absence without pay (Deducted from salary)' },
    leave: { label: 'Leave', urduLabel: 'رخصت', isPaid: true, code: 'L', color: 'amber', description: 'Approved employee leave request (Paid / Unpaid)' },
    holiday: { label: 'Holiday', urduLabel: 'تعطیل', isPaid: true, code: 'HOL', color: 'purple', description: 'Gazetted public holiday (Paid by default)' },
    offday: { label: 'Off Day', urduLabel: 'ہفتہ وار چھٹی (Sunday)', isPaid: true, code: 'OFF', color: 'indigo', description: 'Sunday & scheduled weekly off days (Paid by default)' },
    halfday: { label: 'Half Day', urduLabel: 'نصف دن', isPaid: true, paidRatio: 0.5, code: 'HLD', color: 'cyan', description: 'Half working day (50% pay ratio)' }
  },
  sundayCutRules: null, // replaced by normalizeSundayCutRules below
  shifts: [
    { id: 1, name: 'GENERAL SHIFT', startTime: '09:00', endTime: '17:00', hours: 8, status: 'Active' },
    { id: 2, name: 'MORNING SHIFT', startTime: '06:00', endTime: '14:00', hours: 8, status: 'Active' },
    { id: 3, name: 'EVENING SHIFT', startTime: '14:00', endTime: '22:00', hours: 8, status: 'Active' },
    { id: 4, name: 'NIGHT SHIFT', startTime: '22:00', endTime: '06:00', hours: 8, status: 'Active' }
  ]
};

const deepClone = (v) => JSON.parse(JSON.stringify(v));

export function getInitialDutySettings() {
  const out = deepClone(DEFAULT_DUTY_SETTINGS);
  out.sundayCutRules = normalizeSundayCutRules(null);
  return out;
}

// Normalize any stored duty-settings value (server copy, localStorage cache
// or legacy shape) into the full current shape. Returns null for anything
// that is not a plain object, so callers can fall through to the next
// source. Never mutates its input. Older saves gain the blocks they predate
// (overtimeCalculation, attendanceStatusRules, sundayCutRules — the last
// with both Sunday Cut rules DISABLED, i.e. no behaviour change).
export function normalizeDutySettings(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = { ...raw };
  if (!out.overtimeCalculation) {
    out.overtimeCalculation = deepClone(DEFAULT_DUTY_SETTINGS.overtimeCalculation);
  }
  out.attendanceStatusRules = {
    ...deepClone(DEFAULT_DUTY_SETTINGS.attendanceStatusRules),
    ...(raw.attendanceStatusRules || {})
  };
  out.sundayCutRules = normalizeSundayCutRules(raw.sundayCutRules);
  return out;
}
