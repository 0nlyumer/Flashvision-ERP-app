import React from 'react';
import { useApp } from '../../../context/AppContext';

export default function CalendarWidget() {
  const { state } = useApp();
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const currentDay = today.getDate();

  const monthName = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const dates = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const paddingSlots = Array.from({ length: firstDayIndex }, (_, i) => i);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[18px]">calendar_month</span>
          {monthName}
        </h3>
      </div>
      <div className="grid grid-cols-7 gap-1 flex-1">
        {days.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-on-surface-variant">
            {d}
          </div>
        ))}
        {/* Dynamic empty slots for start of month padding */}
        {paddingSlots.map(slot => (
          <div key={`pad-${slot}`} className="text-center p-1"></div>
        ))}
        
        {dates.map(date => (
          <div key={date} className="flex items-center justify-center">
            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-medium 
              ${date === currentDay ? 'bg-primary text-on-primary font-bold shadow-md' : `text-on-surface ${state.dashboardBackground ? 'hover:bg-surface-container/30' : 'hover:bg-surface-container-high'} cursor-pointer`}`}>
              {date}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
