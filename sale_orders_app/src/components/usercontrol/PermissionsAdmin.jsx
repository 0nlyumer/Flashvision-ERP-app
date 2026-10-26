import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { useApp } from '../../context/AppContext';
import { permissionsRegistry } from '../../constants/permissionsRegistry';
import {
  normalizeSet, effectiveCounts, screenCounts, moduleEnabled, screenEnabled, actionAllowed,
  withModuleEnabled, withScreenEnabled, withAction, syncedModuleArray,
} from '../../utils/permissions';
import ScreenPreview from './ScreenPreview';

// ============================================================================
// PermissionsAdmin — the NEW User Control permissions screen (Omer, design
// final 2026-10-27). Replaces the GranularPermissionsModal flow.
//
//  - USER DROPDOWN at top: pick any ERP user, their set loads instantly.
//  - Left: module → screen → action tree, every control its own toggle,
//    with live effective counts.
//  - Right: FULL live preview of the selected real screen — enabled controls
//    in real colour, disabled grey/dead; clicking a control IN THE PREVIEW
//    toggles it too (both stay in sync — same draft state).
//  - Save persists server-side on the user record (users table via
//    AppContext.updateUser) and syncs the legacy module array.
//
// Modes: standalone (own user dropdown, saves via updateUser) or embedded
// (draft editing inside AddNewUser: props.embedded = { user, initialSet,
// focusModule }, saving returns the set through onSaveSet).
// Super Admin users are locked here by design: that role always has full
// access (AppContext.hasPermission), so its set can never restrict it.
// ============================================================================

function Toggle({ on, onChange, disabled = false, small = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange(!on); }}
      className={`relative shrink-0 rounded-full transition-all active:scale-95 ${small ? 'w-8 h-4.5' : 'w-11 h-6'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${on ? 'bg-primary' : 'bg-slate-300'}`}
      style={{ height: small ? 18 : 24 }}
      title={on ? 'Enabled — click to disable' : 'Disabled — click to enable'}
    >
      <span
        className="absolute top-0.5 bg-white rounded-full shadow transition-all"
        style={{
          width: small ? 14 : 20, height: small ? 14 : 20,
          left: on ? (small ? 16 : 22) : 2,
        }}
      />
    </button>
  );
}

export default function PermissionsAdmin({ onClose, embedded = null, onSaveSet = null, focusModule = null }) {
  const { state, updateUser } = useApp();
  const allUsers = useMemo(() => state.users || [], [state.users]);

  const [selectedUserId, setSelectedUserId] = useState(() => {
    if (embedded?.user) return embedded.user.id ?? 'embedded';
    const first = (state.users || []).find((u) => u.role !== 'Super Admin') || (state.users || [])[0];
    return first?.id ?? null;
  });

  const targetUser = useMemo(() => {
    if (embedded?.user) return embedded.user;
    return allUsers.find((u) => String(u.id) === String(selectedUserId)) || null;
  }, [embedded, allUsers, selectedUserId]);

  const isSuperAdmin = targetUser?.role === 'Super Admin';

  const [draft, setDraft] = useState(() =>
    normalizeSet(embedded?.initialSet ?? targetUser?.granularPermissions, targetUser));
  const [loadedFor, setLoadedFor] = useState(targetUser?.id ?? null);
  const [selectedModuleId, setSelectedModuleId] = useState(focusModule || embedded?.focusModule || 'salesOrders');
  const [selectedScreenId, setSelectedScreenId] = useState(null);
  const [flash, setFlash] = useState('');

  // Reload the draft when the admin picks a different user.
  if (targetUser && loadedFor !== (targetUser.id ?? 'embedded')) {
    setLoadedFor(targetUser.id ?? 'embedded');
    setDraft(normalizeSet(embedded?.initialSet ?? targetUser.granularPermissions, targetUser));
    setFlash('');
  }

  const selectedModule = permissionsRegistry.find((m) => m.id === selectedModuleId) || permissionsRegistry[0];
  const selectedScreen = selectedModule.screens.find((sc) => sc.id === selectedScreenId) || selectedModule.screens[0];
  const counts = effectiveCounts(draft);

  const say = (msg) => setFlash(msg);

  const toggleModule = (moduleId, on) => {
    if (isSuperAdmin) return;
    setDraft((d) => withModuleEnabled(d, moduleId, on));
    const mod = permissionsRegistry.find((m) => m.id === moduleId);
    say(`${mod?.title} module ${on ? 'ENABLED' : 'DISABLED'} for ${targetUser?.name || 'this user'}.`);
  };
  const toggleScreen = (moduleId, screenId, on) => {
    if (isSuperAdmin) return;
    setDraft((d) => withScreenEnabled(d, moduleId, screenId, on));
    const sc = permissionsRegistry.find((m) => m.id === moduleId)?.screens.find((x) => x.id === screenId);
    say(`${sc?.title} screen ${on ? 'ENABLED' : 'DISABLED'}.`);
  };
  const toggleAction = (moduleId, screenId, actionId, on) => {
    if (isSuperAdmin) return;
    setDraft((d) => withAction(d, moduleId, screenId, actionId, on));
    const sc = permissionsRegistry.find((m) => m.id === moduleId)?.screens.find((x) => x.id === screenId);
    const act = sc?.actions.find((x) => x.id === actionId);
    say(`${act?.label} on ${sc?.title} ${on ? 'ENABLED' : 'DISABLED'} — the preview shows exactly what this user gets.`);
  };

  const handleSave = () => {
    if (!targetUser || isSuperAdmin) return;
    if (embedded) {
      onSaveSet?.(draft);
      onClose?.();
      return;
    }
    updateUser(targetUser.id, {
      ...targetUser,
      permissions: syncedModuleArray(draft, targetUser.permissions),
      granularPermissions: draft,
    });
    say(`Saved — ${targetUser.name}'s permissions are live.`);
  };

  const content = (
    <div className="fixed inset-0 z-[99999] bg-surface flex flex-col w-screen h-screen overflow-hidden animate-in fade-in duration-200 select-none">
      {/* Header */}
      <header className="relative bg-surface-container border-b border-outline-variant/20 px-6 py-4 shrink-0">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-primary-container to-secondary-fixed" />
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>shield_person</span>
          </div>
          <div className="mr-2">
            <h1 className="font-headline font-extrabold text-xl text-on-surface tracking-tight leading-tight">
              Permissions & <span className="text-primary">Access Control</span>
            </h1>
            <p className="text-[11px] text-on-surface-variant font-medium">
              {counts.modulesOn}/{counts.modulesTotal} modules · {counts.screensOn}/{counts.screensTotal} screens · {counts.actionsOn}/{counts.actionsTotal} actions enabled
            </p>
          </div>

          {/* USER DROPDOWN */}
          {!embedded ? (
            <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/25 rounded-xl px-3 py-2">
              <span className="material-symbols-outlined text-primary text-lg">person</span>
              <select
                value={selectedUserId ?? ''}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="bg-transparent text-sm font-bold text-on-surface outline-none cursor-pointer max-w-[240px]"
                title="Select a user to set their permissions"
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} (@{u.username}) — {u.role}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/25 rounded-xl px-3 py-2 text-sm font-bold text-on-surface">
              <span className="material-symbols-outlined text-primary text-lg">person</span>
              {targetUser?.name} (@{targetUser?.username})
            </div>
          )}

          {flash && (
            <p className="text-[11px] font-bold text-primary bg-primary/5 border border-primary/15 rounded-lg px-3 py-1.5 max-w-[380px]">{flash}</p>
          )}

          <div className="flex items-center gap-3 ml-auto">
            <button onClick={onClose} className="px-5 py-2.5 text-xs font-bold text-on-surface-variant hover:text-on-surface bg-surface-container-high hover:bg-surface-container-highest rounded-xl transition-all active:scale-95 cursor-pointer">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSuperAdmin || !targetUser}
              className="px-7 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-on-primary text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              Save Permissions
            </button>
          </div>
        </div>
        {isSuperAdmin && (
          <div className="mt-3 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600 text-lg">lock</span>
            <p className="text-[11px] font-bold text-amber-800">
              {targetUser?.name} is a <b>Super Admin</b> — this role always has full access and can never be restricted or locked out. Pick another user to set permissions.
            </p>
          </div>
        )}
      </header>

      {/* Body */}
      <main className="flex-1 flex min-h-0">
        {/* Left: module → screen → action tree */}
        <aside className="w-[400px] shrink-0 border-r border-outline-variant/20 bg-surface-container-lowest overflow-y-auto custom-scrollbar">
          {permissionsRegistry.map((mod) => {
            const modOn = moduleEnabled(draft, mod.id);
            const isSelectedModule = mod.id === selectedModule.id;
            const modActionsOn = mod.screens.reduce((n, sc) => n + screenCounts(draft, mod.id, sc.id).on, 0);
            const modActionsTotal = mod.screens.reduce((n, sc) => n + sc.actions.length, 0);
            return (
              <div key={mod.id} className={`border-b border-outline-variant/10 ${isSelectedModule ? 'bg-primary/[0.03]' : ''}`}>
                {/* Module row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-container-low"
                  onClick={() => setSelectedModuleId(mod.id)}
                >
                  <span className={`material-symbols-outlined text-xl ${modOn ? 'text-primary' : 'text-slate-400'}`}>{mod.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-extrabold truncate ${modOn ? 'text-on-surface' : 'text-slate-400'}`}>{mod.title}</p>
                    <p className="text-[10px] font-semibold text-on-surface-variant">
                      {mod.screens.filter((sc) => screenEnabled(draft, mod.id, sc.id)).length}/{mod.screens.length} screens · {modActionsOn}/{modActionsTotal} actions
                    </p>
                  </div>
                  <Toggle on={modOn} disabled={isSuperAdmin} onChange={(on) => toggleModule(mod.id, on)} />
                  <span className={`material-symbols-outlined text-base text-on-surface-variant transition-transform ${isSelectedModule ? 'rotate-90' : ''}`}>chevron_right</span>
                </div>

                {/* Screens of the selected module */}
                {isSelectedModule && (
                  <div className="pb-2">
                    {mod.screens.map((sc) => {
                      const scOn = screenEnabled(draft, mod.id, sc.id);
                      const scCounts = screenCounts(draft, mod.id, sc.id);
                      const isSelectedScreen = sc.id === selectedScreen.id;
                      return (
                        <div key={sc.id}>
                          <div
                            className={`flex items-center gap-2.5 pl-11 pr-4 py-2 cursor-pointer ${isSelectedScreen ? 'bg-primary/10 border-r-4 border-primary' : 'hover:bg-surface-container-low'}`}
                            onClick={() => setSelectedScreenId(sc.id)}
                          >
                            <span className={`material-symbols-outlined text-base ${scOn ? 'text-primary' : 'text-slate-400'}`}>{sc.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-bold truncate ${scOn ? 'text-on-surface' : 'text-slate-400'}`}>{sc.title}</p>
                              <p className="text-[9px] font-semibold text-on-surface-variant">
                                {scCounts.on}/{scCounts.total} actions{sc.via ? ` · via ${sc.via}` : ''}
                              </p>
                            </div>
                            <Toggle small on={scOn} disabled={isSuperAdmin} onChange={(on) => toggleScreen(mod.id, sc.id, on)} />
                          </div>

                          {/* Actions of the selected screen */}
                          {isSelectedScreen && (
                            <div className="pl-16 pr-4 py-1.5 space-y-1">
                              {sc.actions.map((act) => {
                                const on = actionAllowed(draft, mod.id, sc.id, act.id);
                                return (
                                  <div
                                    key={act.id}
                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${on ? 'bg-surface border-outline-variant/15' : 'bg-slate-100/70 border-slate-200'}`}
                                  >
                                    <span className={`flex-1 text-[11px] font-bold truncate ${on ? (act.danger ? 'text-error' : 'text-on-surface') : 'text-slate-400 line-through decoration-slate-300'}`}>
                                      {act.label}
                                    </span>
                                    {act.danger && <span className="text-[8px] font-black uppercase text-error/70 bg-error/10 rounded px-1 py-0.5">risk</span>}
                                    <Toggle small on={on} disabled={isSuperAdmin} onChange={(val) => toggleAction(mod.id, sc.id, act.id, val)} />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </aside>

        {/* Right: live preview + what-this-user-gets */}
        <section className="flex-1 flex flex-col min-w-0 bg-surface-container-low p-4 gap-3">
          <div className="flex-1 min-h-0 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden flex flex-col">
            <ScreenPreview
              module={selectedModule}
              screen={selectedScreen}
              set={draft}
              onToggleAction={(actionId) =>
                toggleAction(selectedModule.id, selectedScreen.id, actionId, !actionAllowed(draft, selectedModule.id, selectedScreen.id, actionId))}
              onToggleScreen={() => toggleScreen(selectedModule.id, selectedScreen.id, !screenEnabled(draft, selectedModule.id, selectedScreen.id))}
              onToggleModule={() => toggleModule(selectedModule.id, !moduleEnabled(draft, selectedModule.id))}
            />
          </div>

          {/* What this user gets — effective summary for the selected module */}
          <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl px-4 py-3 shrink-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">
              What {targetUser?.name || 'this user'} gets — {selectedModule.title}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selectedModule.screens.map((sc) => {
                const scOn = screenEnabled(draft, selectedModule.id, sc.id);
                const c = screenCounts(draft, selectedModule.id, sc.id);
                return (
                  <button
                    key={sc.id}
                    onClick={() => setSelectedScreenId(sc.id)}
                    className={`text-[10px] font-bold rounded-full px-2.5 py-1 border transition-all cursor-pointer ${
                      scOn
                        ? c.on === c.total
                          ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25'
                          : 'bg-amber-500/10 text-amber-700 border-amber-500/25'
                        : 'bg-slate-200/70 text-slate-500 border-slate-300'
                    }`}
                    title={scOn ? `${c.on} of ${c.total} actions enabled` : 'Screen OFF'}
                  >
                    {sc.title}: {scOn ? `${c.on}/${c.total}` : 'OFF'}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
