// Smoke — Approved batch Part 4 (Omer, 2026-10-26): SERVER RULE.
// Nothing user-facing may persist ONLY in a browser: duty settings and the
// salary & allowance config are server-saved (app_config), localStorage is
// a refreshed cache only; print layouts resolve server-first.
// A: dutySettings util (real import) — defaults, normalization, legacy
//    backfill, no input mutation.
// B: source contracts — entityTables load/sync pairs, AppContext load +
//    migration seed + write-through + blob sanitize, HRSettings and
//    SalaryAllowanceConfig server-first initializers, print precedence.
import fs from 'fs';
import { execSync } from 'child_process';

const APP = '/home/hatch/workspace/erp/sale_orders_app';
const read = (p) => fs.readFileSync(p, 'utf8');
let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  PASS', name); } else { fail++; console.log('  FAIL', name); } };

execSync(`rm -rf /tmp/server-rule-smoke && mkdir -p /tmp/server-rule-smoke/utils`);
for (const f of ['dutySettings.js', 'sundayCut.js']) {
  execSync(`cp ${APP}/src/utils/${f} /tmp/server-rule-smoke/utils/${f}`);
}
const { getInitialDutySettings, normalizeDutySettings, DEFAULT_DUTY_SETTINGS } =
  await import('/tmp/server-rule-smoke/utils/dutySettings.js');

// A: util behaviour
{
  const init = getInitialDutySettings();
  check('defaults: standardHours 8', init.standardHours === 8);
  check('defaults: 4 shifts', Array.isArray(init.shifts) && init.shifts.length === 4);
  check('defaults: sundayCutRules present, both rules DISABLED',
    init.sundayCutRules && init.sundayCutRules.twoAbsence.enabled === false && init.sundayCutRules.continuous.enabled === false);
  check('defaults: deep copy (mutating copy leaves DEFAULT intact)',
    (init.standardHours = 99) === 99 && DEFAULT_DUTY_SETTINGS.standardHours === 8);

  check('normalize: null -> null', normalizeDutySettings(null) === null);
  check('normalize: array -> null', normalizeDutySettings([1]) === null);
  check('normalize: string -> null', normalizeDutySettings('x') === null);

  const legacy = { standardHours: 9, employeeDutyHours: { E1: 7 } };
  const legacyBefore = JSON.stringify(legacy);
  const norm = normalizeDutySettings(legacy);
  check('normalize: keeps own fields', norm.standardHours === 9 && norm.employeeDutyHours.E1 === 7);
  check('normalize: backfills overtimeCalculation', !!norm.overtimeCalculation && norm.overtimeCalculation.rateMultiplier === 1.0);
  check('normalize: backfills attendanceStatusRules (6 rules)',
    Object.keys(norm.attendanceStatusRules).length === 6 && norm.attendanceStatusRules.present.isPaid === true);
  check('normalize: backfills sundayCutRules disabled', norm.sundayCutRules.twoAbsence.enabled === false);
  check('normalize: input not mutated', JSON.stringify(legacy) === legacyBefore);

  const custom = normalizeDutySettings({
    attendanceStatusRules: { present: { label: 'Present', isPaid: false, code: 'P' } },
    sundayCutRules: { twoAbsence: { enabled: true, minAbsences: 3, applyToAll: true, employeeIds: [] },
                      continuous: { enabled: false, applyToAll: false, employeeIds: [] } }
  });
  check('normalize: custom status rule preserved + missing rules backfilled',
    custom.attendanceStatusRules.present.isPaid === false && custom.attendanceStatusRules.absent.code === 'ABS');
  check('normalize: enabled sunday cut rule preserved',
    custom.sundayCutRules.twoAbsence.enabled === true && custom.sundayCutRules.twoAbsence.minAbsences === 3);
}

// B: source contracts
{
  const et = read(`${APP}/src/utils/entityTables.js`);
  check('entityTables: hrDutySettings load+sync', et.includes("eq('key', 'hrDutySettings')") && et.includes('export const syncDutySettingsToTable'));
  check('entityTables: hrSalaryAllowanceConfig load+sync', et.includes("eq('key', 'hrSalaryAllowanceConfig')") && et.includes('export const syncSalaryAllowanceConfigToTable'));

  const ac = read(`${APP}/src/context/AppContext.jsx`);
  check('AppContext: loads duty settings from table', ac.includes('loadDutySettingsFromTable()'));
  check('AppContext: loads salary allowance from table', ac.includes('loadSalaryAllowanceConfigFromTable()'));
  check('AppContext: one-time localStorage migration seed for duty settings', ac.includes("localStorage.getItem('hr_duty_settings')") && ac.includes('dutySettingsLocalSeed'));
  check('AppContext: one-time localStorage migration seed for allowance', ac.includes('salaryAllowanceLocalSeed'));
  check('AppContext: server duty value refreshes the local cache', ac.includes("localStorage.setItem('hr_duty_settings', JSON.stringify(fromTableDuty))"));
  check('AppContext: duty write-through effect', ac.includes('syncDutySettingsToTable(dutySettingsForSync)'));
  check('AppContext: allowance write-through effect', ac.includes('syncSalaryAllowanceConfigToTable(payload)'));
  check('AppContext: blob sanitize excludes all three keys',
    ac.includes('delete cleanState.hr_duty_settings') && ac.includes('delete cleanState.hr_salary_allowance_config') && ac.includes('delete cleanState.hr_employee_allowance_map'));
  check('AppContext: initial state carries duty defaults', ac.includes('hr_duty_settings: getInitialDutySettings()'));

  const hrs = read(`${APP}/src/components/hr/HRSettings.jsx`);
  check('HRSettings: initializer prefers server state', hrs.includes('normalizeDutySettings(state?.hr_duty_settings)'));
  check('HRSettings: save still setCollections hr_duty_settings', hrs.includes("setCollection('hr_duty_settings', updated)"));

  const sac = read(`${APP}/src/components/hr/SalaryAllowanceConfig.jsx`);
  check('SalaryAllowanceConfig: config initializer prefers state', sac.includes('state?.hr_salary_allowance_config'));
  check('SalaryAllowanceConfig: map initializer prefers state', sac.includes('state?.hr_employee_allowance_map'));
  check('SalaryAllowanceConfig: map save writes state (server path)', sac.includes("setCollection('hr_employee_allowance_map', employeeAllowanceMap)"));

  const studio = read(`${APP}/src/components/ui/UniversalPrintStudioModal.jsx`);
  const li = studio.indexOf('...(localSaved || {})');
  const si = studio.indexOf('...(stateLayout || {})');
  check('Studio: server layout spreads AFTER local cache (server wins)', li !== -1 && si !== -1 && li < si);

  const pl = read(`${APP}/src/components/ui/PrintLayout.jsx`);
  check('PrintLayout: server layout before local fallback', pl.includes('printSettings.documentLayouts?.[activeDocType] || savedLocalConfig'));
}

console.log(`\nServer Rule smoke: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
