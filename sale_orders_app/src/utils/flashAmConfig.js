// --- Flash AM Configuration (app_config key 'flashAmConfig') ---------------
// Terminal behaviour rules for the Flash AM attendance app: short-punch
// counting, late-coming display/deduction groundwork and punch-out overtime
// applicability. Mirrors the FG Combo config pattern (fgCombinationUtils):
// a DEFAULT constant + a normalize function that deep-merges saved values
// over the defaults, so older/partial saved configs keep working.

export const DEFAULT_FLASH_AM_CONFIG = {
  shortPunch: { enabled: true, withinHours: 2, countAttendance: false },
  late: {
    showLateMinutes: true,
    deductionEnabled: true,
    graceMinutes: 10,
    mode: 'minutes',
    roundToHourAfterMinutes: 30,
    shiftStartDefault: '09:00',
    applyToEmployeeIds: []
  },
  overtime: { fromPunchOutEmployeeIds: [] },
  rulesApplyToAll: true
};

const toIdList = (v) => (Array.isArray(v) ? v.map((x) => String(x)) : []);
const toNum = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const toBool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);

export function normalizeFlashAmConfig(raw) {
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
  }
  if (!parsed || typeof parsed !== 'object') parsed = {};
  const d = DEFAULT_FLASH_AM_CONFIG;
  const sp = parsed.shortPunch && typeof parsed.shortPunch === 'object' ? parsed.shortPunch : {};
  const lt = parsed.late && typeof parsed.late === 'object' ? parsed.late : {};
  const ot = parsed.overtime && typeof parsed.overtime === 'object' ? parsed.overtime : {};
  return {
    shortPunch: {
      enabled: toBool(sp.enabled, d.shortPunch.enabled),
      withinHours: Math.max(0, toNum(sp.withinHours, d.shortPunch.withinHours)),
      countAttendance: toBool(sp.countAttendance, d.shortPunch.countAttendance)
    },
    late: {
      showLateMinutes: toBool(lt.showLateMinutes, d.late.showLateMinutes),
      deductionEnabled: toBool(lt.deductionEnabled, d.late.deductionEnabled),
      graceMinutes: Math.max(0, toNum(lt.graceMinutes, d.late.graceMinutes)),
      mode: lt.mode === 'roundToHour' ? 'roundToHour' : 'minutes',
      roundToHourAfterMinutes: Math.max(0, toNum(lt.roundToHourAfterMinutes, d.late.roundToHourAfterMinutes)),
      shiftStartDefault: typeof lt.shiftStartDefault === 'string' && /^\d{1,2}:\d{2}$/.test(lt.shiftStartDefault) ? lt.shiftStartDefault : d.late.shiftStartDefault,
      applyToEmployeeIds: toIdList(lt.applyToEmployeeIds)
    },
    overtime: { fromPunchOutEmployeeIds: toIdList(ot.fromPunchOutEmployeeIds) },
    rulesApplyToAll: toBool(parsed.rulesApplyToAll, d.rulesApplyToAll)
  };
}

export function getInitialFlashAmConfig() {
  return normalizeFlashAmConfig(null);
}
