// Calendar math for the dashboard CalendarWidget (approved batch Part 5,
// 2026-10-26). Pure + smoke-testable: given the month being viewed and
// "today", returns the heading, the weekday the 1st falls on (0 = Sunday),
// the true number of days in the month, and today's day-number ONLY when
// the viewed month is the current month (null otherwise — the old widget
// highlighted today's number even inside the wrong, hardcoded month).

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function calendarModel(viewDate, today = new Date()) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  return {
    title: `${MONTH_NAMES[month]} ${year}`,
    firstWeekday,
    daysInMonth,
    todayDate: isCurrentMonth ? today.getDate() : null
  };
}
