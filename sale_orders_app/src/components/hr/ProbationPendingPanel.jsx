import React from 'react';
import { getProbationInfo, isOnboardingPending } from '../../utils/probation';

// Probation Cleared — Onboarding Pending (Omer, 2026-10-26).
// Employees added at the FlashAM gate serve a 7-day probation; when a
// man keeps coming through the week (utils/probation.js), his
// onboarding becomes pending and his name surfaces HERE, in the
// existing Onboarding area, so he can be called in and onboarded.
// Computed live from the employee records (server data) — nothing is
// stored in the browser for this list.
export function probationPendingEmployees(employees, today = new Date()) {
  if (!Array.isArray(employees)) return [];
  return employees
    .filter((emp) => isOnboardingPending(emp, today))
    .map((emp) => ({ emp, info: getProbationInfo(emp, today) }));
}

export default function ProbationPendingPanel({ employees, onStartOnboarding }) {
  const pending = probationPendingEmployees(employees);
  if (pending.length === 0) return null;
  return (
    <div className="bg-gradient-to-b from-surface-container-lowest to-tertiary-fixed/10 border border-tertiary-fixed/40 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-tertiary">pending_actions</span>
        <h3 className="font-headline font-bold text-base text-on-surface">
          Probation Cleared — Onboarding Pending ({pending.length})
        </h3>
      </div>
      <p className="text-[11px] text-on-surface-variant font-body mb-4">
        These employees finished their 7-day probation and kept coming — call them in and complete their onboarding.
      </p>
      <div className="space-y-2.5">
        {pending.map(({ emp, info }) => (
          <div key={emp.id} className="flex items-center justify-between gap-3 p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/15">
            <div className="flex items-center gap-3 min-w-0">
              {emp.avatar ? (
                <img src={emp.avatar} alt={emp.name} className="w-10 h-10 rounded-full object-cover border border-outline-variant/20 shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs shrink-0">
                  {(emp.name || 'EM').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h4 className="font-headline font-bold text-xs text-on-surface leading-tight truncate">{emp.name}</h4>
                <p className="text-[10px] font-bold text-primary mt-0.5">
                  {emp.id} • {emp.division || 'AJ Synthetic'} • {emp.department || '—'}
                </p>
                <p className="text-[10px] text-on-surface-variant mt-0.5">
                  Probation {info.start} → {info.windowEnd}: {info.cameDays} present
                  {info.leaveDays > 0 ? `, ${info.leaveDays} leave` : ''}
                  {info.absentDays > 0 ? `, ${info.absentDays} absent` : ''}
                </p>
              </div>
            </div>
            {onStartOnboarding && (
              <button
                type="button"
                onClick={() => onStartOnboarding(emp)}
                className="px-4 py-2 bg-primary text-on-primary text-[11px] font-black rounded-xl shadow transition-all active:scale-95 cursor-pointer shrink-0"
              >
                Start Onboarding
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
