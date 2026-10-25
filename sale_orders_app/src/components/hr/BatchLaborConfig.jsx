import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import {
  normalizeBatchLaborConfig,
  getBatchLaborCandidates,
  getMonthlySalary
} from '../../utils/batchLaborCost';

// Batch Record — Labor Cost Employees (HR Settings, Omer 2026-10-24/25).
//
// The employees selected here are the ONLY ones whose salary cost feeds
// the Batch Record's Estimated Labor Cost: for the day a plan ran, each
// selected AJ Synthetic employee who was PRESENT that day contributes
// monthly salary / days-in-month, and the day total is split across the
// day's plan items in proportion to meters.
//
// Persists through AppContext collection 'batch_labor_config', which
// write-throughs to app_config (key 'batchLaborConfig') — deliberately
// NOT localStorage, so the selection is identical on every device and
// survives browser changes (same durable pattern as FlashAMConfig).

export default function BatchLaborConfig({ isMobile, onBack }) {
  const { state, setCollection, currencySymbol } = useApp();
  const { showTopPill } = useDialog();
  // The form is DERIVED from the saved config (Omer, 2026-10-25): a
  // mount-time snapshot went stale — after Clear + Save, reopening the
  // section in the same session kept showing the old selection until a
  // full reload, because the snapshot never re-read the persisted
  // value. Now, whenever the persisted config changes (save round-trip,
  // late table load, remount), the form re-derives from it — unless the
  // user has unsaved edits in flight, which are never clobbered.
  const savedConfig = useMemo(
    () => normalizeBatchLaborConfig(state.batch_labor_config),
    [state.batch_labor_config]
  );
  const [form, setForm] = useState(savedConfig);
  const dirtyRef = useRef(false);
  useEffect(() => {
    if (!dirtyRef.current) setForm(savedConfig);
  }, [savedConfig]);
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState('');

  const candidates = useMemo(
    () => getBatchLaborCandidates(state.hr_employees_list || []),
    [state.hr_employees_list]
  );
  const selected = useMemo(() => new Set(form.employeeIds.map(String)), [form.employeeIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((e) =>
      (e.name || '').toLowerCase().includes(q)
      || String(e.employeeCode || e.code || e.id || '').toLowerCase().includes(q)
      || (e.department || '').toLowerCase().includes(q)
    );
  }, [candidates, query]);

  const fmtMoney = (v) => `${currencySymbol || 'Rs '}${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const applyIds = (ids) => {
    dirtyRef.current = true;
    setForm({ employeeIds: ids });
    setSaved(false);
  };
  const toggleEmp = (emp) => {
    const id = String(emp.id);
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    applyIds(Array.from(next));
  };
  const selectAll = () => applyIds(candidates.map((e) => String(e.id)));
  const clearAll = () => applyIds([]);

  const handleSave = () => {
    setCollection('batch_labor_config', normalizeBatchLaborConfig(form));
    dirtyRef.current = false;
    setSaved(true);
    if (showTopPill) showTopPill('Batch Record Labor Cost Employees Saved • Selection updated', 'success');
  };

  const sectionCard = "bg-surface-container-lowest p-5 sm:p-6 rounded-3xl border border-outline-variant/15 shadow-sm";

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
            <span className="material-symbols-outlined text-primary">engineering</span>
            Batch Record — Labor Cost Employees
          </h1>
          <p className="text-[11px] font-medium text-on-surface-variant leading-relaxed max-w-2xl">
            Sirf yahan select kiye gaye AJ Synthetic employees ki salary Batch Record ke Estimated Labor Cost
            mein ginni jati hai. Hisab: plan wale din jo selected employee PRESENT ho, us ki daily cost =
            monthly salary ÷ us mahine ke din; din ki total cost us din ke plan items par meters ke
            tanasub se taqseem hoti hai.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="shrink-0 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold shadow hover:opacity-90 transition-opacity cursor-pointer"
        >
          {saved ? 'Saved ✓' : 'Save Selection'}
        </button>
      </div>

      {/* Employee checklist */}
      <div className={sectionCard}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/20 flex-1 min-w-[200px]">
            <span className="material-symbols-outlined text-on-surface-variant text-[16px]">search</span>
            <input
              className="bg-transparent border-none focus:ring-0 text-xs font-medium w-full outline-none placeholder:text-on-surface-variant/50 text-on-surface"
              placeholder="Search employees..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <span className="text-[10px] font-bold text-primary bg-primary/5 border border-primary/15 px-2.5 py-1.5 rounded-full whitespace-nowrap">
            {selected.size} of {candidates.length} selected
          </span>
          <button type="button" onClick={selectAll} className="text-[11px] font-bold text-primary hover:underline cursor-pointer">Select All</button>
          {selected.size > 0 && (
            <button type="button" onClick={clearAll} className="text-[11px] font-bold text-error hover:underline cursor-pointer">Clear</button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto custom-scrollbar rounded-2xl border border-outline-variant/15 divide-y divide-outline-variant/10">
          {filtered.length === 0 && (
            <div className="p-4 text-xs text-on-surface-variant text-center">
              No AJ Synthetic employees found.
            </div>
          )}
          {filtered.map((emp) => {
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
                <span className="ml-auto text-[11px] font-bold text-on-surface-variant whitespace-nowrap">
                  {fmtMoney(getMonthlySalary(emp))}<span className="font-medium"> / month</span>
                </span>
              </label>
            );
          })}
        </div>

        <p className="text-[10px] text-on-surface-variant mt-3 leading-relaxed">
          Selection save karne par foran mehfooz ho jati hai aur har device par yahi selection chalti hai.
          Koi employee select na ho to Batch Record par labor cost "—" ayega; jis date ki attendance
          maujood na ho us date par bhi "—" ayega — andaza kabhi nahi lagaya jata.
        </p>
      </div>
    </div>
  );
}
