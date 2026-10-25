import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import { normalizeFlashAmConfig } from '../../utils/flashAmConfig';

// Flash AM Configuration — HR Settings screen for the Flash AM attendance
// terminal rules (FlashAM Phase A). Persists through AppContext collection
// 'flash_am_config', which write-throughs to app_config (key 'flashAmConfig')
// — deliberately NOT localStorage, so the rules are identical on every
// terminal and survive browser changes.

export function Toggle({ value, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? 'bg-primary' : 'bg-outline-variant/40'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-pressed={value}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`}></span>
    </button>
  );
}

function FieldRow({ label, hint, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 border-b border-outline-variant/10 last:border-b-0">
      <div className="min-w-0">
        <div className="text-xs font-bold text-on-surface">{label}</div>
        {hint && <div className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function EmployeeMultiSelect({ employees, selectedIds, onChange, disabled, emptyNote }) {
  const [query, setQuery] = useState('');
  const selected = useMemo(() => new Set((selectedIds || []).map(String)), [selectedIds]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(e =>
      (e.name || '').toLowerCase().includes(q) ||
      String(e.employeeCode || e.code || '').toLowerCase().includes(q) ||
      (e.department || '').toLowerCase().includes(q)
    );
  }, [employees, query]);

  const toggleEmp = (emp) => {
    const id = String(emp.id);
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(Array.from(next));
  };

  return (
    <div className={`${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-2 bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/20 flex-1">
          <span className="material-symbols-outlined text-on-surface-variant text-[16px]">search</span>
          <input
            className="bg-transparent border-none focus:ring-0 text-xs font-medium w-full outline-none placeholder:text-on-surface-variant/50 text-on-surface"
            placeholder="Search employees..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="text-[10px] font-bold text-primary bg-primary/5 border border-primary/15 px-2.5 py-1.5 rounded-full whitespace-nowrap">
          {selected.size} selected
        </span>
        {selected.size > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-[11px] font-bold text-error hover:underline cursor-pointer">Clear</button>
        )}
      </div>
      <div className="max-h-56 overflow-y-auto custom-scrollbar rounded-2xl border border-outline-variant/15 divide-y divide-outline-variant/10">
        {filtered.length === 0 && (
          <div className="p-4 text-xs text-on-surface-variant text-center">{emptyNote || 'No employees found.'}</div>
        )}
        {filtered.map(emp => {
          const id = String(emp.id);
          const checked = selected.has(id);
          return (
            <label key={id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${checked ? 'bg-primary/5' : 'hover:bg-surface-container-low'}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleEmp(emp)}
                className="w-4 h-4 rounded accent-primary shrink-0"
              />
              <span className="text-xs font-bold text-on-surface truncate">{emp.name}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant shrink-0">{emp.employeeCode || emp.code || id}</span>
              {emp.department && <span className="text-[10px] text-on-surface-variant truncate">{emp.department}</span>}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function FlashAMConfig({ isMobile, onBack }) {
  const { state, setCollection } = useApp();
  const { showTopPill } = useDialog();
  const [form, setForm] = useState(() => normalizeFlashAmConfig(state.flash_am_config));
  const [saved, setSaved] = useState(false);

  const employees = useMemo(
    () => (Array.isArray(state.hr_employees_list) ? state.hr_employees_list : []).filter(e => e && e.id),
    [state.hr_employees_list]
  );

  const setShort = (patch) => { setForm(f => ({ ...f, shortPunch: { ...f.shortPunch, ...patch } })); setSaved(false); };
  const setLate = (patch) => { setForm(f => ({ ...f, late: { ...f.late, ...patch } })); setSaved(false); };
  const setOvertime = (patch) => { setForm(f => ({ ...f, overtime: { ...f.overtime, ...patch } })); setSaved(false); };

  const handleSave = () => {
    setCollection('flash_am_config', normalizeFlashAmConfig(form));
    setSaved(true);
    showTopPill('Flash AM Configuration Saved • Terminal rules updated', 'success');
  };

  const numInput = "w-24 bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary/20 outline-none";
  const sectionCard = "bg-surface-container-lowest p-5 sm:p-6 rounded-3xl border border-outline-variant/15 shadow-sm";
  const sectionTitle = "font-headline text-sm font-black text-on-surface flex items-center gap-2";

  return (
    <div className="flex flex-col gap-5 w-full animate-in fade-in duration-300 font-body select-none pb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/15 shadow-sm">
        <div className="space-y-1">
          <h1 className="font-headline text-xl font-black text-on-surface tracking-tight flex items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer border border-outline-variant/15"
                title="Back to HR Settings"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              </button>
            )}
            Flash AM Configuration
            {saved && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">Saved</span>
            )}
          </h1>
          <p className="text-xs text-on-surface-variant max-w-2xl leading-relaxed">
            Rules for the Flash AM attendance terminal (gate punch-in / punch-out). Saved to the database — the same rules apply on every terminal and device.
          </p>
        </div>
        <button
          onClick={handleSave}
          className="bg-gradient-to-r from-primary to-primary-container hover:opacity-95 text-white font-headline font-bold text-xs px-6 py-2.5 rounded-2xl flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-primary/20 cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          Apply &amp; Save
        </button>
      </div>

      {/* Short Punch */}
      <div className={sectionCard}>
        <h2 className={sectionTitle}>
          <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><span className="material-symbols-outlined text-[20px]">timer_off</span></span>
          Short Punch Rule
        </h2>
        <p className="text-[11px] text-on-surface-variant mt-2 leading-relaxed">
          When an employee punches out very soon after punching in, decide whether that day counts as attendance.
        </p>
        <div className="mt-2">
          <FieldRow label="Enable short punch rule" hint="Apply the rule below on every punch-out at the terminal.">
            <Toggle value={form.shortPunch.enabled} onChange={(v) => setShort({ enabled: v })} />
          </FieldRow>
          <FieldRow label="Short punch window (hours)" hint="A punch-out within this many hours of punch-in is a short punch.">
            <input
              type="number" min="0" step="0.5" className={numInput}
              value={form.shortPunch.withinHours}
              onChange={(e) => setShort({ withinHours: e.target.value === '' ? 0 : Number(e.target.value) })}
              disabled={!form.shortPunch.enabled}
            />
          </FieldRow>
          <FieldRow label="Count attendance for short punches" hint="ON: the day still counts as present. OFF: the day is marked Absent (short punch) and does not count.">
            <Toggle value={form.shortPunch.countAttendance} onChange={(v) => setShort({ countAttendance: v })} disabled={!form.shortPunch.enabled} />
          </FieldRow>
        </div>
      </div>

      {/* Late Coming */}
      <div className={sectionCard}>
        <h2 className={sectionTitle}>
          <span className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center"><span className="material-symbols-outlined text-[20px]">schedule</span></span>
          Late Coming Rules
        </h2>
        <p className="text-[11px] text-on-surface-variant mt-2 leading-relaxed">
          Late is measured against the employee&apos;s shift start time (from Duty Hours &amp; Shifts). Deduction amounts are applied in Salary Generation from these rules.
        </p>
        <div className="mt-2">
          <FieldRow label="Show late minutes on terminal" hint="Show a “Late X min” badge on the employee row after a late punch-in.">
            <Toggle value={form.late.showLateMinutes} onChange={(v) => setLate({ showLateMinutes: v })} />
          </FieldRow>
          <FieldRow label="Enable late deduction" hint="Master switch for late-coming deductions in salary.">
            <Toggle value={form.late.deductionEnabled} onChange={(v) => setLate({ deductionEnabled: v })} />
          </FieldRow>
          <FieldRow label="Grace period (minutes)" hint="Punch-in within this many minutes after shift start is not late.">
            <input
              type="number" min="0" step="1" className={numInput}
              value={form.late.graceMinutes}
              onChange={(e) => setLate({ graceMinutes: e.target.value === '' ? 0 : Number(e.target.value) })}
            />
          </FieldRow>
          <FieldRow label="Deduction mode" hint="Exact minutes, or round the deduction up to a full hour once lateness passes the threshold.">
            <select
              className="bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
              value={form.late.mode}
              onChange={(e) => setLate({ mode: e.target.value })}
            >
              <option value="minutes">Deduct exact late minutes</option>
              <option value="roundToHour">Round up to 1 hour</option>
            </select>
          </FieldRow>
          {form.late.mode === 'roundToHour' && (
            <FieldRow label="Round-up threshold (minutes)" hint="If late minutes reach this value, a full 1-hour deduction applies.">
              <input
                type="number" min="0" step="1" className={numInput}
                value={form.late.roundToHourAfterMinutes}
                onChange={(e) => setLate({ roundToHourAfterMinutes: e.target.value === '' ? 0 : Number(e.target.value) })}
              />
            </FieldRow>
          )}
          <FieldRow label="Default shift start (fallback)" hint="Used only when an employee's shift start cannot be found in Duty Hours & Shifts.">
            <input
              type="time" className={numInput}
              value={form.late.shiftStartDefault}
              onChange={(e) => setLate({ shiftStartDefault: e.target.value || '09:00' })}
            />
          </FieldRow>
          <FieldRow label="Rules apply to all employees" hint="ON: late rules apply to everyone. OFF: only the employees selected below.">
            <Toggle value={form.rulesApplyToAll} onChange={(v) => setForm(f => ({ ...f, rulesApplyToAll: v }))} />
          </FieldRow>
        </div>
        {!form.rulesApplyToAll && (
          <div className="mt-4">
            <div className="text-xs font-bold text-on-surface mb-2">Employees the late rules apply to</div>
            <EmployeeMultiSelect
              employees={employees}
              selectedIds={form.late.applyToEmployeeIds}
              onChange={(ids) => setLate({ applyToEmployeeIds: ids })}
            />
          </div>
        )}
      </div>

      {/* Overtime */}
      <div className={sectionCard}>
        <h2 className={sectionTitle}>
          <span className="w-9 h-9 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center"><span className="material-symbols-outlined text-[20px]">more_time</span></span>
          Overtime from Punch-Out
        </h2>
        <p className="text-[11px] text-on-surface-variant mt-2 leading-relaxed">
          For the employees selected below, time worked past shift end counts as overtime automatically from their punch-out. Leave the list empty if nobody&apos;s overtime should auto-count from punch-out.
        </p>
        <div className="mt-4">
          <EmployeeMultiSelect
            employees={employees}
            selectedIds={form.overtime.fromPunchOutEmployeeIds}
            onChange={(ids) => setOvertime({ fromPunchOutEmployeeIds: ids })}
          />
        </div>
      </div>
    </div>
  );
}
