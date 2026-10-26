// ============================================================================
// Permission resolution for the User Control permissions redesign (2026-10-27).
//
// A per-user permission set lives on the user record itself
// (`user.granularPermissions`, persisted server-side in the `users` table —
// never in the frozen blob, never browser-local only). Shape:
//
//   granularPermissions = {
//     _v: 2,
//     [moduleId]: {
//       _moduleEnabled: boolean,
//       [screenId]: { _enabled: boolean, [actionId]: boolean }
//     }
//   }
//
// SAFE-DEFAULT RULE: anything not explicitly disabled is ALLOWED. A user with
// no saved set therefore keeps exactly the access they had before this
// redesign (module access via `user.permissions`), and a screen added later
// can never silently lock anyone out. The admin screen always saves a
// COMPLETE set (every registry module/screen/action written explicitly), so
// an explicit "off" is always distinguishable from "never configured".
//
// These pure functions mirror AppContext.hasPermission exactly for complete
// sets; FlashAM keeps its own stricter mirror for terminal modes and is
// unaffected (its screens are in the registry and saved sets are complete).
// ============================================================================
import { permissionsRegistry } from '../constants/permissionsRegistry';

export const PERMISSIONS_SET_VERSION = 2;

const isObj = (v) => v && typeof v === 'object';

export function moduleEnabled(set, moduleId) {
  const m = set?.[moduleId];
  if (!isObj(m)) return true;
  return m._moduleEnabled !== false;
}

export function screenEnabled(set, moduleId, screenId) {
  if (!moduleEnabled(set, moduleId)) return false;
  const sc = set?.[moduleId]?.[screenId];
  if (!isObj(sc)) return true;
  return sc._enabled !== false;
}

export function actionAllowed(set, moduleId, screenId, actionId) {
  if (!screenEnabled(set, moduleId, screenId)) return false;
  const sc = set?.[moduleId]?.[screenId];
  if (!isObj(sc)) return true;
  return sc[actionId] !== false;
}

// Build a COMPLETE set from whatever is saved: every registry module, screen
// and action gets an explicit boolean (saved value wins).
//
// Default for a module that was never configured: the user's EXISTING legacy
// module access (`user.permissions` array) — so opening a user in the admin
// screen and saving without changes can never grant or revoke a module.
// Two historical exceptions: 'files' was reachable by every signed-in user
// (unguarded route), so it defaults ON; 'dashboard' follows the array like
// every other module (Super Admin bypasses checks anyway). Inside an
// accessible module, screens/actions default ON — exactly the pre-redesign
// behaviour when no granular set existed.
export function normalizeSet(saved, user) {
  const legacyModules = new Set(Array.isArray(user?.permissions) ? user.permissions : []);
  const out = { _v: PERMISSIONS_SET_VERSION };
  permissionsRegistry.forEach((mod) => {
    const savedMod = isObj(saved?.[mod.id]) ? saved[mod.id] : {};
    const defaultModuleOn = mod.id === 'files' ? true : legacyModules.has(mod.id);
    const modOut = {
      _moduleEnabled: savedMod._moduleEnabled !== undefined ? savedMod._moduleEnabled !== false : defaultModuleOn,
    };
    mod.screens.forEach((screen) => {
      const savedScreen = isObj(savedMod[screen.id]) ? savedMod[screen.id] : {};
      const screenOut = { _enabled: savedScreen._enabled !== false };
      screen.actions.forEach((action) => {
        screenOut[action.id] = savedScreen[action.id] !== false;
      });
      modOut[screen.id] = screenOut;
    });
    out[mod.id] = modOut;
  });
  return out;
}

// Effective counts for the admin UI ("what this user gets").
export function effectiveCounts(set) {
  let modulesOn = 0, screensOn = 0, screensTotal = 0, actionsOn = 0, actionsTotal = 0;
  permissionsRegistry.forEach((mod) => {
    if (moduleEnabled(set, mod.id)) modulesOn += 1;
    mod.screens.forEach((screen) => {
      screensTotal += 1;
      if (screenEnabled(set, mod.id, screen.id)) screensOn += 1;
      screen.actions.forEach((action) => {
        actionsTotal += 1;
        if (actionAllowed(set, mod.id, screen.id, action.id)) actionsOn += 1;
      });
    });
  });
  return { modulesOn, modulesTotal: permissionsRegistry.length, screensOn, screensTotal, actionsOn, actionsTotal };
}

export function screenCounts(set, moduleId, screenId) {
  const mod = permissionsRegistry.find((m) => m.id === moduleId);
  const screen = mod?.screens.find((sc) => sc.id === screenId);
  if (!screen) return { on: 0, total: 0 };
  const on = screen.actions.filter((act) => actionAllowed(set, moduleId, screenId, act.id)).length;
  return { on, total: screen.actions.length };
}

// Immutable toggle helpers used by the admin screen (tree + preview share
// these, so a click in either place flips the same value).
export function withModuleEnabled(set, moduleId, on) {
  const next = structuredClone(set);
  if (!isObj(next[moduleId])) next[moduleId] = {};
  next[moduleId]._moduleEnabled = on;
  return next;
}

export function withScreenEnabled(set, moduleId, screenId, on) {
  const next = structuredClone(set);
  if (!isObj(next[moduleId])) next[moduleId] = {};
  if (!isObj(next[moduleId][screenId])) next[moduleId][screenId] = {};
  next[moduleId][screenId]._enabled = on;
  if (on) next[moduleId]._moduleEnabled = true; // enabling a screen revives its module
  return next;
}

export function withAction(set, moduleId, screenId, actionId, on) {
  const next = structuredClone(set);
  if (!isObj(next[moduleId])) next[moduleId] = {};
  if (!isObj(next[moduleId][screenId])) next[moduleId][screenId] = {};
  next[moduleId][screenId][actionId] = on;
  if (on) {
    // Enabling any action revives its screen + module (same rule the old
    // GranularPermissionsModal applied to its master toggles).
    next[moduleId][screenId]._enabled = true;
    next[moduleId]._moduleEnabled = true;
  }
  return next;
}

// The legacy `user.permissions` module array, synced from a set: a module key
// is present iff the module is enabled. Non-registry keys already on the user
// are preserved untouched.
export function syncedModuleArray(set, existingArray) {
  const registryIds = new Set(permissionsRegistry.map((m) => m.id));
  const preserved = (Array.isArray(existingArray) ? existingArray : []).filter((k) => !registryIds.has(k));
  const enabled = permissionsRegistry.filter((m) => moduleEnabled(set, m.id)).map((m) => m.id);
  return [...preserved, ...enabled];
}
