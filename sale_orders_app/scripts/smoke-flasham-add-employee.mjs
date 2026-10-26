// Smoke — FlashAM Add New Employee (Omer, 2026-10-26).
// A: probation util (src/utils/probation.js) — the REAL module imported:
//    window math, Sunday-neutral, leave excused, absent/missing counts,
//    came>=3 & absent<=2 gate, one-time notification finder.
// B: imageQuality util (src/utils/imageQuality.js) — sharpness verdicts
//    + document bounds detection on synthetic frames.
// C: source contracts — gate button + modal wiring, ADD_EMPLOYEE in the
//    offline queue replay, validated phone, AppContext transition,
//    HR Dashboard/Onboarding surfacing, Directory CTA removed.
import fs from 'fs';
import { execSync } from 'child_process';

const APP = '/home/hatch/workspace/erp/sale_orders_app';
const read = (p) => fs.readFileSync(p, 'utf8');
let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  PASS', name); } else { fail++; console.log('  FAIL', name); } };

execSync(`rm -rf /tmp/flasham-smoke && mkdir -p /tmp/flasham-smoke/utils`);
execSync(`cp ${APP}/src/utils/probation.js ${APP}/src/utils/imageQuality.js /tmp/flasham-smoke/utils/`);
const P = await import('/tmp/flasham-smoke/utils/probation.js');
const Q = await import('/tmp/flasham-smoke/utils/imageQuality.js');

const D = (y, m, d) => new Date(y, m - 1, d);
const att = (map) => Object.fromEntries(Object.entries(map).map(([k, s]) => [k, { status: s }]));
// Joining Mon 19 Oct 2026; window 19..25 Oct (25 = Sunday, neutral). Today Mon 26 Oct.
const gateEmp = (attendance, extra = {}) => ({
  id: 'EMP-00139', name: 'TEST MAN', source: 'FlashAM_GateAdd',
  probationStart: '2026-10-19', dateOfJoining: '2026-10-19', attendance: att(attendance), ...extra
});

{
  const a = gateEmp({ '2026-10-19': 'present', '2026-10-20': 'present', '2026-10-21': 'present', '2026-10-22': 'present', '2026-10-23': 'leave', '2026-10-24': 'present' });
  const info = P.getProbationInfo(a, D(2026, 10, 26));
  check('A: window complete after 7 days', info.windowComplete === true);
  check('A: came=5 leave=1 absent=0', info.cameDays === 5 && info.leaveDays === 1 && info.absentDays === 0);
  check('A: Sunday counted neutral', info.neutralDays === 1);
  check('A: passed (leave does not disqualify)', info.passed === true);
  check('A: onboarding pending', P.isOnboardingPending(a, D(2026, 10, 26)) === true);

  const b = gateEmp({ '2026-10-19': 'present', '2026-10-20': 'present', '2026-10-21': 'absent', '2026-10-23': 'absent', '2026-10-24': 'present' }); // 22 Oct: no record = absent
  const infoB = P.getProbationInfo(b, D(2026, 10, 26));
  check('B: missing day counts absent (absent=3)', infoB.absentDays === 3 && infoB.cameDays === 3);
  check('B: NOT passed when absent > 2', infoB.passed === false);

  const c = gateEmp({ '2026-10-19': 'present', '2026-10-20': 'present' });
  check('C: NOT passed when came < 3', P.getProbationInfo(c, D(2026, 10, 26)).passed === false);

  const d = gateEmp({ '2026-10-19': 'present', '2026-10-20': 'present', '2026-10-21': 'present', '2026-10-22': 'present' }, { probationStart: '2026-10-24', dateOfJoining: '2026-10-24' });
  const infoD = P.getProbationInfo(d, D(2026, 10, 26));
  check('D: window not complete mid-probation', infoD.windowComplete === false && infoD.passed === false);

  const e = { ...gateEmp({ '2026-10-24': 'present', '2026-10-26': 'present', '2026-10-27': 'present', '2026-10-28': 'present', '2026-10-29': 'leave', '2026-10-30': 'present' }), probationStart: '2026-10-24', dateOfJoining: '2026-10-24' };
  const infoE = P.getProbationInfo(e, D(2026, 10, 31));
  check('E: Sat-join window skips Sunday, passed', infoE.passed === true && infoE.neutralDays === 1 && infoE.cameDays === 5);

  const shortPunch = gateEmp({ '2026-10-19': 'Absent', '2026-10-20': 'present', '2026-10-21': 'present', '2026-10-22': 'present', '2026-10-23': 'present', '2026-10-24': 'present' });
  const infoSP = P.getProbationInfo(shortPunch, D(2026, 10, 26));
  check('short-punch day (stored Absent) counts absent, still passes at absent=1', infoSP.absentDays === 1 && infoSP.passed === true);

  const due = P.findProbationNotificationsDue([a, { ...a, id: 'X1', probationOnboardingNotified: true }, { ...a, id: 'X2', onboarding: 'completed' }, b], D(2026, 10, 26));
  check('due finder: only un-notified, un-onboarded passers', due.length === 1 && due[0].id === 'EMP-00139');

  const legacy = { id: 'EMP-00001', name: 'OLD TIMER', dateOfJoining: '2026-10-01', attendance: att({ '2026-10-01': 'present', '2026-10-02': 'present', '2026-10-03': 'present', '2026-10-05': 'present', '2026-10-06': 'present', '2026-10-07': 'present' }) };
  check('legacy employee is never a probation employee', P.isProbationEmployee(legacy) === false && P.isOnboardingPending(legacy, D(2026, 10, 26)) === false);
  check('no joining date -> not applicable', P.getProbationInfo({ id: 'Z' }, D(2026, 10, 26)).applicable === false);
}

{
  const W = 64, H = 64;
  const checker = new Uint8ClampedArray(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) checker[y * W + x] = (x + y) % 2 ? 255 : 0;
  const sharp = Q.assessGrayscaleFrame(checker, W, H);
  check('checkerboard frame: sharp, ok', sharp.ok === true && sharp.sharpness > Q.SHARPNESS_MIN);

  const flat = new Uint8ClampedArray(W * H).fill(140);
  const blurry = Q.assessGrayscaleFrame(flat, W, H);
  check('flat frame: blurry verdict', blurry.ok === false && blurry.issues.includes('blurry'));

  const darkChecker = new Uint8ClampedArray(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) darkChecker[y * W + x] = (x + y) % 2 ? 44 : 0;
  const dark = Q.assessGrayscaleFrame(darkChecker, W, H);
  check('dark frame: too-dark verdict', dark.issues.includes('too dark'));

  // Document bounds: bright rectangle (the "CNIC") on a dark desk.
  const w2 = 120, h2 = 90;
  const frame = new Uint8ClampedArray(w2 * h2).fill(25);
  for (let y = 20; y <= 69; y++) for (let x = 25; x <= 94; x++) frame[y * w2 + x] = 210;
  const bounds = Q.detectDocumentBounds(frame, w2, h2);
  check('bounds found for a document on a desk', bounds !== null);
  if (bounds) {
    check('bounds hug the document', Math.abs(bounds.x - 25) <= 4 && Math.abs(bounds.y - 20) <= 4 && Math.abs(bounds.w - 70) <= 8 && Math.abs(bounds.h - 50) <= 8);
  }
  check('flat frame: no bounds (keep whole frame)', Q.detectDocumentBounds(flat, W, H) === null);
}

{
  const flash = read(`${APP}/src/pages/FlashAM.jsx`);
  check('FlashAM: Add New Employee button present', flash.includes('Add New Employee') && flash.includes('setShowAddEmployee(true)'));
  check('FlashAM: gate modal mounted', flash.includes('<FlashAmAddEmployee') && flash.includes('handleGateAddEmployee'));
  check('FlashAM: add writes hr_employees table directly', flash.includes("buildEntityRow('hr_employees', record)") && flash.includes("supabase.from('hr_employees').upsert"));
  check('FlashAM: add writes notifications table (server)', flash.includes("buildEntityRow('notifications', notif)") && flash.includes('gateadd-'));
  check('FlashAM: offline ADD_EMPLOYEE queued', flash.includes("action: 'ADD_EMPLOYEE'") && flash.includes('flasham_pending_employee_adds'));
  check('FlashAM: queue replay handles ADD_EMPLOYEE', flash.includes("i.action === 'ADD_EMPLOYEE'") && flash.includes('failedItems'));
  check('FlashAM: probation + queued chips on roster rows', flash.includes('getProbationInfo(emp)') && flash.includes('Queued — will sync'));

  const form = read(`${APP}/src/components/flasham/FlashAmAddEmployee.jsx`);
  check('form: phone validated via normalizePkMobile', form.includes('normalizePkMobile(phone)') && form.includes('Not a valid mobile number'));
  check('form: live photo capture via getUserMedia', form.includes('getUserMedia') && form.includes("'photo'"));
  check('form: document scanner with auto-crop + sharpness', form.includes('detectDocumentBounds') && form.includes('assessGrayscaleFrame'));
  check('form: blurry scan asks for a retake', form.includes('Retake') && form.includes('may not be readable'));
  check('form: skip documentation option', form.includes('Skip — no documents yet') && form.includes('documentsSkipped'));
  check('form: record starts probation', form.includes('probationStart: dateKey') && form.includes("source: 'FlashAM_GateAdd'"));
  check('form: division + department selects', form.includes('GATE_DIVISIONS') && form.includes('loadHrDepartments'));

  const ctx = read(`${APP}/src/context/AppContext.jsx`);
  check('AppContext: probation transition effect', ctx.includes('findProbationNotificationsDue') && ctx.includes("'Onboarding Pending'") && ctx.includes('probationOnboardingNotified: true'));

  const dash = read(`${APP}/src/components/hr/HRDashboard.jsx`);
  check('HRDashboard: pending list uses the probation rule for gate adds', dash.includes('isProbationEmployee(emp)') && dash.includes('isOnboardingPending(emp)'));

  const onb = read(`${APP}/src/components/hr/HROnboarding.jsx`);
  check('HROnboarding: probation pending panel mounted', onb.includes('<ProbationPendingPanel'));

  const dir = read(`${APP}/src/components/hr/HRDirectory.jsx`);
  check('HRDirectory: Add Employee entry buttons removed', !dir.includes('onClick={openAddDialog}'));

  const layout = read(`${APP}/src/components/Layout.jsx`);
  check('Layout: desktop shell has a notifications bell + overlay', (layout.match(/setShowNotifications\(!showNotifications\)/g) || []).length >= 3 && layout.includes('Notifications overlay — desktop shell'));
}

console.log(`\nFlashAM Add Employee smoke: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
