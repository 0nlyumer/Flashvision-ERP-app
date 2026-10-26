// Smoke — Approved batch Part 5 (Omer, 2026-10-26): dashboard calendar
// widget. The old widget was a static mock (hardcoded "May 2026", always 30
// days, fixed padding, highlighted today's day-number in the wrong month).
// A: calendarModel — the REAL util (src/utils/calendarModel.js) imported.
// B: source contracts — no hardcoded month title, model-driven grid,
//    prev/next navigation wired.
import fs from 'fs';
import { execSync } from 'child_process';

const APP = '/home/hatch/workspace/erp/sale_orders_app';
const read = (p) => fs.readFileSync(p, 'utf8');
let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  PASS', name); } else { fail++; console.log('  FAIL', name); } };

execSync(`rm -rf /tmp/calendar-smoke && mkdir -p /tmp/calendar-smoke/utils`);
execSync(`cp ${APP}/src/utils/calendarModel.js /tmp/calendar-smoke/utils/calendarModel.js`);
const { calendarModel } = await import('/tmp/calendar-smoke/utils/calendarModel.js');

{
  const today = new Date(2026, 9, 26); // 26 Oct 2026 (a Monday)
  const oct = calendarModel(new Date(2026, 9, 1), today);
  check('October 2026: title', oct.title === 'October 2026');
  check('October 2026: 31 days', oct.daysInMonth === 31);
  check('October 2026: 1st is a Thursday (weekday 4)', oct.firstWeekday === 4);
  check('October 2026: today highlighted = 26', oct.todayDate === 26);

  const may = calendarModel(new Date(2026, 4, 1), today);
  check('May 2026 viewed from October: title is May 2026 (only when navigated there)', may.title === 'May 2026');
  check('May 2026: NO today highlight in a non-current month', may.todayDate === null);
  check('May 2026: 31 days, 1st is Friday (weekday 5)', may.daysInMonth === 31 && may.firstWeekday === 5);

  const feb = calendarModel(new Date(2026, 1, 1), today);
  check('February 2026: 28 days', feb.daysInMonth === 28);
  const febLeap = calendarModel(new Date(2028, 1, 1), today);
  check('February 2028 (leap): 29 days', febLeap.daysInMonth === 29);

  const next = new Date(2026, 9 + 1, 1);
  check('month shift +1 from October lands on November 2026',
    calendarModel(next, today).title === 'November 2026');
  const prevYear = new Date(2026, 0 - 1, 1);
  check('month shift -1 from January lands on December 2025',
    calendarModel(prevYear, today).title === 'December 2025');
}

// B: source contracts on the real component
{
  const src = read(`${APP}/src/components/dashboard/widgets/CalendarWidget.jsx`);
  check('component: no hardcoded month heading', !src.includes('>May 2026<') && !/>\s*May 2026\s*</.test(src));
  check('component: imports and uses calendarModel util', src.includes("from '../../../utils/calendarModel'") && src.includes('calendarModel(viewDate)'));
  check('component: opens on the current month', src.includes('new Date(now.getFullYear(), now.getMonth(), 1)'));
  check('component: prev/next navigation wired', src.includes('shiftMonth(-1)') && src.includes('shiftMonth(1)'));
  check('component: grid pads by real first weekday', src.includes('model.firstWeekday'));
  check('component: highlight only via model.todayDate', src.includes('date === model.todayDate'));
}

console.log(`\nCalendar Widget smoke: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
