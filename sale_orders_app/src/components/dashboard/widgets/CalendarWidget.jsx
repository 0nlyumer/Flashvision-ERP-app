import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { calendarModel } from '../../../utils/calendarModel';

// Dashboard calendar — a REAL month calendar (fixed 2026-10-26, approved
// batch Part 5). This used to be a static mock: the heading was hardcoded
// "May 2026", the grid always showed 30 dates with three fixed leading
// blanks, and it highlighted today's day-number even in the wrong month —
// so in October 2026 the widget still claimed to show May. Now it opens on
// the current month, lays out the true weekdays/days-in-month, highlights
// today only when the viewed month IS the current month, and navigates
// month by month (with a Today shortcut back).

export default function CalendarWidget() {
  const { state } = useApp();
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const model = calendarModel(viewDate);

  const shiftMonth = (delta) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };
  const goToday = () => {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[18px]">calendar_month</span>
          {model.title}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftMonth(-1)}
            className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
            title="Previous month"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          </button>
          <button
            onClick={goToday}
            className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
            title="Back to current month"
          >
            Today
          </button>
          <button
            onClick={() => shiftMonth(1)}
            className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
            title="Next month"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 flex-1">
        {days.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-on-surface-variant">
            {d}
          </div>
        ))}
        {/* Empty slots so day 1 lands on its real weekday */}
        {Array.from({ length: model.firstWeekday }, (_, i) => (
          <div key={`pad-${i}`} className="text-center p-1"></div>
        ))}

        {Array.from({ length: model.daysInMonth }, (_, i) => i + 1).map(date => (
          <div key={date} className="flex items-center justify-center">
            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-medium 
              ${date === model.todayDate ? 'bg-primary text-on-primary font-bold shadow-md' : `text-on-surface ${state.dashboardBackground ? 'hover:bg-surface-container/30' : 'hover:bg-surface-container-high'} cursor-pointer`}`}>
              {date}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
