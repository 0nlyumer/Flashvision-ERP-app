import React from 'react';
import { actionAllowed, moduleEnabled, screenEnabled } from '../../utils/permissions';

// ============================================================================
// ScreenPreview — a faithful, registry-driven replica of a real ERP screen
// for the User Control permissions admin. Every control on the replica is a
// REAL permission control: enabled = its real colour, disabled = grey/dead,
// and CLICKING a control toggles that permission (click-to-toggle, Omer
// 2026-10-27). Structural elements (table cells, pagination) are inert.
// Sample row data is illustrative only — layout and controls mirror the real
// screen; no live data is shown here.
// ============================================================================

const ACTION_ICONS = {
  view: 'visibility', create: 'add_circle', edit: 'edit', delete: 'delete',
  print: 'print', export: 'download', approve: 'check_circle', generate: 'play_circle',
  adjust: 'tune', receive: 'inventory', transfer: 'sync_alt', access: 'fingerprint',
  send: 'send', customize: 'dashboard_customize', fgCombo: 'manage_search',
  createPo: 'shopping_cart', createBinder: 'create_new_folder', editBinder: 'edit',
  deleteBinder: 'delete', viewDocument: 'visibility', printDocument: 'print',
  exportPdf: 'picture_as_pdf', add_employee: 'person_add', upload_csv: 'upload_file',
  reconcile: 'fact_check', date_filter: 'date_range', filter_toggles: 'filter_list',
  filter_attendance: 'how_to_reg', status_present: 'check', status_absent: 'close',
  status_leave: 'event_busy', status_holiday: 'celebration', status_offday: 'weekend',
  filter_overtime: 'more_time', filter_fines: 'money_off', filter_deductions: 'schedule',
  assign: 'assignment_turned_in', confirm: 'verified',
};

const ROW_ACTION_IDS = ['edit', 'delete', 'approve'];
const CHIP_ACTION_IDS = ['view'];

function sampleCell(col, rowIdx) {
  const c = col.toLowerCase();
  if (c.includes('status')) return null; // rendered as chip
  if (c.includes('date') || c === 'time' || c.includes('from') || c.includes('to') || c.includes('due')) return ['27/10/2026', '26/10/2026', '25/10/2026'][rowIdx];
  if (c.includes('customer')) return ['ABDUL HAMEED', 'NADEEM LEATHER STORE', 'RABB NAWAZ'][rowIdx];
  if (c.includes('supplier') || c.includes('party')) return ['Sample Supplier', 'Sample Supplier', 'Sample Supplier'][rowIdx];
  if (c.includes('employee') || c.includes('user') || c.includes('chat')) return ['Sample Employee', 'Sample Employee', 'Sample Employee'][rowIdx];
  if (c.includes('item') || c.includes('material') || c.includes('cloth') || c.includes('phase') || c.includes('widget') || c.includes('binder') || c.includes('entry') || c.includes('head') || c.includes('rule') || c.includes('setting') || c.includes('type') || c.includes('account') || c.includes('description') || c.includes('name')) return ['170 PK DTY BLACK (WHITE)', '106 MISMA REGULAR (WHITE)', '173 PK DTY PURPLE (BLACK)'][rowIdx];
  if (c.includes('no') || c.includes('code') || c.includes('id') || c.includes('ref')) return ['#001', '#002', '#003'][rowIdx];
  if (c.includes('amount') || c.includes('total') || c.includes('value') || c.includes('balance') || c.includes('rate') || c.includes('pay') || c.includes('fine') || c.includes('debit') || c.includes('credit') || c.includes('tax') || c.includes('budget') || c.includes('expense') || c.includes('loan') || c.includes('paid') || c.includes('basic') || c.includes('net') || c.includes('allowance') || c.includes('deduction') || c.includes('shortage') || c.includes('required') || c.includes('price')) return ['Rs 25,000', 'Rs 18,500', 'Rs 42,750'][rowIdx];
  if (c.includes('(m)') || c.includes('qty') || c.includes('metres') || c.includes('stock') || c.includes('kg') || c.includes('(h)') || c.includes('hours') || c.includes('count') || c.includes('documents') || c.includes('orders') || c.includes('employees') || c.includes('present') || c.includes('absent') || c.includes('in') || c.includes('out') || c.includes('change') || c.includes('ageing')) return ['1,000', '800', '2,000'][rowIdx];
  return '—';
}

export default function ScreenPreview({ module: mod, screen, set, onToggleAction, onToggleScreen, onToggleModule }) {
  if (!mod || !screen) {
    return (
      <div className="h-full flex items-center justify-center text-on-surface-variant text-sm font-medium p-10 text-center">
        Select a screen from the list to see its live preview.
      </div>
    );
  }

  const modOn = moduleEnabled(set, mod.id);
  const scrOn = screenEnabled(set, mod.id, screen.id);
  const allowed = (actionId) => actionAllowed(set, mod.id, screen.id, actionId);

  const toolbarActions = screen.actions.filter((act) => !ROW_ACTION_IDS.includes(act.id) && !CHIP_ACTION_IDS.includes(act.id));
  const rowActions = screen.actions.filter((act) => ROW_ACTION_IDS.includes(act.id));
  const chipActions = screen.actions.filter((act) => CHIP_ACTION_IDS.includes(act.id));
  const stats = screen.preview?.stats || null;
  const customToolbar = screen.preview?.toolbar || null;
  const columns = screen.columns || ['Name', 'Date', 'Status'];

  const controlCls = (on, primary = false, danger = false) =>
    on
      ? primary
        ? 'bg-primary text-on-primary hover:bg-primary/90 shadow-sm'
        : danger
          ? 'bg-error/10 text-error hover:bg-error hover:text-white border border-error/20'
          : 'bg-surface-container-lowest text-on-surface border border-outline-variant/30 hover:border-primary/40 hover:text-primary'
      : 'bg-slate-200/80 text-slate-400 border border-dashed border-slate-300 line-through decoration-slate-400/70 cursor-pointer';

  const handleFrameClick = () => {
    if (!modOn) onToggleModule();
    else if (!scrOn) onToggleScreen();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Browser chrome bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-container border-b border-outline-variant/20 rounded-t-2xl">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-error/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        </div>
        <div className="flex-1 bg-surface-container-lowest rounded-lg px-3 py-1 text-[11px] font-mono text-on-surface-variant truncate">
          flashvision-erp.web.app{mod.route || ''} — {screen.title}
        </div>
        {chipActions.map((act) => (
          <button
            key={act.id}
            onClick={(e) => { e.stopPropagation(); onToggleAction(act.id); }}
            title={`${act.label} — click to ${allowed(act.id) ? 'disable' : 'enable'}`}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${controlCls(allowed(act.id))}`}
          >
            <span className="material-symbols-outlined text-xs">{ACTION_ICONS[act.id] || 'tune'}</span>
            {allowed(act.id) ? 'Can View' : 'No View'}
          </button>
        ))}
      </div>

      {/* Screen body */}
      <div
        onClick={handleFrameClick}
        className={`relative flex-1 overflow-y-auto custom-scrollbar bg-surface-container-lowest p-5 rounded-b-2xl ${!modOn || !scrOn ? 'cursor-pointer' : ''}`}
        title={!modOn ? 'Module is OFF — click to enable it' : !scrOn ? 'Screen is OFF — click to enable it' : undefined}
      >
        <div className={!modOn || !scrOn ? 'grayscale opacity-40 pointer-events-none select-none' : ''}>
          {/* Title row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">{screen.icon}</span>
              </div>
              <div>
                <h3 className="font-headline font-extrabold text-on-surface text-base leading-tight">{screen.title}</h3>
                <p className="text-[11px] text-on-surface-variant">{mod.title}{screen.via ? ` · opens via ${screen.via}` : ''}</p>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">Live</span>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {stats.map((label, i) => (
                <div key={label} className="bg-surface-container-low border border-outline-variant/15 rounded-xl p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
                  <p className="text-lg font-black text-on-surface mt-0.5">{['128', '7,200', '36', 'Rs 1.2M'][i % 4]}</p>
                </div>
              ))}
            </div>
          )}

          {/* Toolbar — every button is a permission control */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-1.5 text-[11px] text-on-surface-variant mr-1">
              <span className="material-symbols-outlined text-sm">search</span> Search…
            </div>
            {(customToolbar || toolbarActions.map((act) => ({ label: act.label, icon: ACTION_ICONS[act.id] || 'tune', action: act.id }))).map((btn) => {
              const on = allowed(btn.action);
              const isPrimary = ['create', 'access', 'generate', 'createBinder'].includes(btn.action);
              return (
                <button
                  key={btn.action + btn.label}
                  onClick={(e) => { e.stopPropagation(); onToggleAction(btn.action); }}
                  title={`${btn.label} — click to ${on ? 'DISABLE' : 'ENABLE'} for this user`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 cursor-pointer ${controlCls(on, isPrimary)}`}
                >
                  <span className="material-symbols-outlined text-sm">{btn.icon}</span>
                  {btn.label}
                  {!on && <span className="text-[8px] font-black uppercase bg-slate-400/30 rounded px-1">off</span>}
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div className="border border-outline-variant/20 rounded-xl overflow-hidden">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant">
                  {columns.map((col) => (
                    <th key={col} className="px-3 py-2 font-bold uppercase tracking-wide text-[10px]">{col}</th>
                  ))}
                  {rowActions.length > 0 && <th className="px-3 py-2 font-bold uppercase tracking-wide text-[10px] text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2].map((r) => (
                  <tr key={r} className="border-t border-outline-variant/10">
                    {columns.map((col) => {
                      const v = sampleCell(col, r);
                      return (
                        <td key={col} className="px-3 py-2 text-on-surface font-medium">
                          {v === null
                            ? <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 text-[9px] font-black uppercase">Active</span>
                            : v}
                        </td>
                      );
                    })}
                    {rowActions.length > 0 && (
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1.5">
                          {rowActions.map((act) => {
                            const on = allowed(act.id);
                            return (
                              <button
                                key={act.id}
                                onClick={(e) => { e.stopPropagation(); onToggleAction(act.id); }}
                                title={`${act.label} — click to ${on ? 'DISABLE' : 'ENABLE'} for this user`}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer ${controlCls(on, false, act.id === 'delete')}`}
                              >
                                <span className="material-symbols-outlined text-sm">{ACTION_ICONS[act.id] || 'tune'}</span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-on-surface-variant/70 mt-3 font-medium">
            Preview mirrors the real screen's layout and controls — sample data only. Click any control to enable / disable it for this user.
          </p>
        </div>

        {/* NO ACCESS stamp */}
        {(!modOn || !scrOn) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-5xl text-error/70">block</span>
            <p className="font-headline font-black text-2xl tracking-widest text-error/80 uppercase rotate-[-4deg] border-4 border-error/50 rounded-xl px-4 py-1">
              No Access
            </p>
            <p className="text-xs font-bold text-on-surface-variant">
              {!modOn ? `The whole ${mod.title} module is OFF for this user.` : 'This screen is OFF for this user.'} Click anywhere here to enable it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
