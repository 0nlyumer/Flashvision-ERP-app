// Smoke: User Control permissions redesign — registry integrity + resolver
// cascade (module off ⇒ screens/actions off; screen off ⇒ actions off;
// safe defaults from the legacy module array; complete-set round-trip).
import { permissionsRegistry, registryCounts } from '../src/constants/permissionsRegistry.js';
import {
  normalizeSet, moduleEnabled, screenEnabled, actionAllowed, effectiveCounts,
  withModuleEnabled, withScreenEnabled, withAction, syncedModuleArray,
} from '../src/utils/permissions.js';

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; } else { fail++; console.log('FAIL:', name); } };

// --- Registry integrity
const counts = registryCounts();
check('registry has 13 modules', counts.modules === 13);
check('registry has >= 85 screens', counts.screens >= 85);
check('registry has >= 220 actions', counts.actions >= 220);
check('Files module exists', permissionsRegistry.some(m => m.id === 'files'));
check('Daily Activity File screen exists', permissionsRegistry.find(m => m.id === 'files')?.screens.some(s => s.id === 'dailyActivity'));
check('Consumption History (button-opened) exists', permissionsRegistry.find(m => m.id === 'productionPlanning')?.screens.some(s => s.id === 'consumption-history'));
check('HR attendance fine-grained actions kept', (() => {
  const sc = permissionsRegistry.find(m => m.id === 'hr')?.screens.find(s => s.id === 'hrAttendance');
  return sc && sc.actions.some(a => a.id === 'status_present') && sc.actions.some(a => a.id === 'filter_fines') && sc.actions.length >= 16;
})());
check('FlashAM screens match terminal modes', (() => {
  const ids = permissionsRegistry.find(m => m.id === 'flasham')?.screens.map(s => s.id) || [];
  return ['punch', 'deduction', 'overtime', 'fine'].every(id => ids.includes(id));
})());
check('no duplicate module ids', new Set(permissionsRegistry.map(m => m.id)).size === permissionsRegistry.length);
check('no duplicate screen ids within a module', permissionsRegistry.every(m => new Set(m.screens.map(s => s.id)).size === m.screens.length));
check('no duplicate action ids within a screen', permissionsRegistry.every(m => m.screens.every(s => new Set(s.actions.map(a => a.id)).size === s.actions.length)));
check('every screen has columns for the preview', permissionsRegistry.every(m => m.screens.every(s => Array.isArray(s.columns) && s.columns.length >= 2)));

// --- Safe defaults from legacy access
const chatOnlyUser = { permissions: ['chat'], granularPermissions: {} };
const chatSet = normalizeSet(chatOnlyUser.granularPermissions, chatOnlyUser);
check('chat-only user: chat module on', moduleEnabled(chatSet, 'chat') === true);
check('chat-only user: salesOrders module OFF by default', moduleEnabled(chatSet, 'salesOrders') === false);
check('chat-only user: finance module OFF by default', moduleEnabled(chatSet, 'finance') === false);
check('chat-only user: files defaults ON (historically unguarded)', moduleEnabled(chatSet, 'files') === true);
check('chat-only user: dashboard follows array (off)', moduleEnabled(chatSet, 'dashboard') === false);

const fullUser = { permissions: ['salesOrders', 'oms', 'productionPlanning', 'inventory', 'delivery', 'userManagement', 'settings', 'hr', 'chat', 'finance'], granularPermissions: {} };
const fullSet = normalizeSet(fullUser.granularPermissions, fullUser);
check('full user: all array modules on', ['salesOrders', 'inventory', 'hr', 'finance'].every(m => moduleEnabled(fullSet, m)));
check('full user: every action allowed by default', effectiveCounts(fullSet).actionsOn >= 200);

// --- Cascade
let s1 = withModuleEnabled(fullSet, 'salesOrders', false);
check('module off => screen off', screenEnabled(s1, 'salesOrders', 'history') === false);
check('module off => action off', actionAllowed(s1, 'salesOrders', 'history', 'print') === false);
check('module off leaves other modules alone', actionAllowed(s1, 'inventory', 'stock', 'print') === true);

let s2 = withScreenEnabled(fullSet, 'salesOrders', 'history', false);
check('screen off => its actions off', actionAllowed(s2, 'salesOrders', 'history', 'print') === false);
check('screen off leaves sibling screens alone', actionAllowed(s2, 'salesOrders', 'dashboard', 'print') === true);

let s3 = withAction(fullSet, 'salesOrders', 'orderDetails', 'delete', false);
check('action off: delete denied', actionAllowed(s3, 'salesOrders', 'orderDetails', 'delete') === false);
check('action off: edit still allowed', actionAllowed(s3, 'salesOrders', 'orderDetails', 'edit') === true);
check('action off: screen still enabled', screenEnabled(s3, 'salesOrders', 'orderDetails') === true);

let s4 = withAction(s1, 'salesOrders', 'history', 'print', true);
check('enabling an action revives module+screen', moduleEnabled(s4, 'salesOrders') && screenEnabled(s4, 'salesOrders', 'history') && actionAllowed(s4, 'salesOrders', 'history', 'print'));

// --- Complete-set round trip + array sync
check('normalized set carries version', fullSet._v === 2);
check('normalized set is complete', permissionsRegistry.every(m =>
  fullSet[m.id] && m.screens.every(sc => fullSet[m.id][sc.id] && sc.actions.every(a => typeof fullSet[m.id][sc.id][a.id] === 'boolean'))));
const synced = syncedModuleArray(s3, fullUser.permissions);
check('array sync keeps enabled modules', synced.includes('salesOrders') && synced.includes('inventory'));
const syncedOff = syncedModuleArray(s1, fullUser.permissions);
check('array sync drops disabled module', !syncedOff.includes('salesOrders') && syncedOff.includes('inventory'));
check('array sync adds files when enabled', synced.includes('files'));
check('effectiveCounts totals match registry', (() => { const c = effectiveCounts(fullSet); return c.actionsTotal === counts.actions && c.screensTotal === counts.screens; })());

console.log(`permissions-smoke: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
