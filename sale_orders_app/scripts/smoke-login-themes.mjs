// Smoke test — Login Screen Themes (Omer's order, 2026-10-25).
//
// The login screen gets a GLOBAL theme setting (app_config key
// 'loginThemeSettings'): a fixed theme, or Auto (a different theme on
// every login-screen appearance). Registry in src/utils/loginThemes.js:
//   classic    — the original login design, untouched (fallback / way back)
//   paper-leaf — Omer's mockup design with his supplied artwork, served
//                byte-identical from public/login-themes/paper-leaf.jpg
//
// Part 1 (unit): registry shape, artwork presence + byte-identity with
//   Omer's supplied file, config normalize/defaults, auto-rotation never
//   repeating the last theme when >1 theme exists.
// Part 2 (static): wiring — Login resolves theme from state via the
//   registry (no hardcoded single design), the classic auth call sites are
//   untouched, AppContext carries the config app_config-only, and the
//   Settings UI is registered in the Settings workspace.
//
// Run: node scripts/smoke-login-themes.mjs   (exit 0 = all pass)

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = join(fileURLToPath(new URL('.', import.meta.url)), '..');
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

const {
  LOGIN_THEMES,
  DEFAULT_LOGIN_THEME_SETTINGS,
  LAST_LOGIN_THEME_KEY,
  getLoginThemeById,
  normalizeLoginThemeSettings,
  getInitialLoginThemeSettings,
  pickAutoThemeId,
  resolveLoginThemeId
} = await import('../src/utils/loginThemes.js');

// ---------------------------------------------------------------- Part 1
console.log('Part 1 — registry, artwork, normalize, rotation');

check('registry has exactly classic + paper-leaf',
  LOGIN_THEMES.length === 2 && LOGIN_THEMES[0].id === 'classic' && LOGIN_THEMES[1].id === 'paper-leaf',
  JSON.stringify(LOGIN_THEMES.map((t) => t.id)));
check('classic is type classic', getLoginThemeById('classic')?.type === 'classic');
const paperLeaf = getLoginThemeById('paper-leaf');
check('paper-leaf is an art theme with the public artwork path',
  paperLeaf?.type === 'art' && paperLeaf?.image === '/login-themes/paper-leaf.jpg');
check('paper-leaf accent is the deep green', paperLeaf?.accent === '#2e4b3f', paperLeaf?.accent);
check('unknown theme id resolves to null', getLoginThemeById('bogus') === null);

const artInRepo = join(appDir, 'public', 'login-themes', 'paper-leaf.jpg');
check('artwork exists in public/login-themes/', existsSync(artInRepo));
const omerFile = join(appDir, '..', '..', 'user', 'files', '1000268438_1_n9rw.jpg');
check("Omer's supplied source file is present for comparison", existsSync(omerFile), omerFile);
if (existsSync(artInRepo) && existsSync(omerFile)) {
  check('artwork is byte-identical to Omer’s supplied file (sha256)',
    sha256(artInRepo) === sha256(omerFile), `${sha256(artInRepo)} vs ${sha256(omerFile)}`);
}

check('shipped default is fixed / paper-leaf',
  DEFAULT_LOGIN_THEME_SETTINGS.mode === 'fixed' && DEFAULT_LOGIN_THEME_SETTINGS.fixedThemeId === 'paper-leaf');
check('normalize(null) → shipped default',
  JSON.stringify(normalizeLoginThemeSettings(null)) === JSON.stringify({ mode: 'fixed', fixedThemeId: 'paper-leaf' }));
check('normalize(undefined) → shipped default',
  JSON.stringify(normalizeLoginThemeSettings(undefined)) === JSON.stringify({ mode: 'fixed', fixedThemeId: 'paper-leaf' }));
check('normalize({}) → shipped default',
  JSON.stringify(normalizeLoginThemeSettings({})) === JSON.stringify({ mode: 'fixed', fixedThemeId: 'paper-leaf' }));
check('getInitialLoginThemeSettings() → shipped default',
  JSON.stringify(getInitialLoginThemeSettings()) === JSON.stringify({ mode: 'fixed', fixedThemeId: 'paper-leaf' }));
check("normalize keeps mode 'auto'",
  normalizeLoginThemeSettings({ mode: 'auto' }).mode === 'auto');
check('normalize bad mode → fixed',
  normalizeLoginThemeSettings({ mode: 'weird' }).mode === 'fixed');
check('normalize bad fixedThemeId → paper-leaf',
  normalizeLoginThemeSettings({ fixedThemeId: 'nope' }).fixedThemeId === 'paper-leaf');
check('normalize keeps a valid fixedThemeId (classic)',
  normalizeLoginThemeSettings({ fixedThemeId: 'classic' }).fixedThemeId === 'classic');
check('normalize parses a JSON string',
  JSON.stringify(normalizeLoginThemeSettings('{"mode":"auto","fixedThemeId":"classic"}')) === JSON.stringify({ mode: 'auto', fixedThemeId: 'classic' }));

const ids = LOGIN_THEMES.map((t) => t.id);
check('auto pick never repeats last (last=classic → paper-leaf, all rands)',
  [0, 0.25, 0.5, 0.75, 0.999].every((r) => pickAutoThemeId(ids, 'classic', () => r) === 'paper-leaf'));
check('auto pick never repeats last (last=paper-leaf → classic, all rands)',
  [0, 0.25, 0.5, 0.75, 0.999].every((r) => pickAutoThemeId(ids, 'paper-leaf', () => r) === 'classic'));
check('auto pick with a single theme returns it', pickAutoThemeId(['classic'], 'classic', () => 0) === 'classic');
check('auto pick with no themes returns null', pickAutoThemeId([], null, () => 0) === null);

const fakeStorage = (seed = {}) => {
  const m = new Map(Object.entries(seed));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _map: m };
};
{
  const st = fakeStorage();
  const id = resolveLoginThemeId({ mode: 'fixed', fixedThemeId: 'classic' }, st);
  check('resolve fixed → the fixed theme', id === 'classic', id);
  check('resolve records last-shown in localStorage key', st._map.get(LAST_LOGIN_THEME_KEY) === 'classic');
}
{
  const st = fakeStorage({ [LAST_LOGIN_THEME_KEY]: 'classic' });
  const first = resolveLoginThemeId({ mode: 'auto' }, st, () => 0.4);
  const second = resolveLoginThemeId({ mode: 'auto' }, st, () => 0.4);
  check('resolve auto alternates away from last-shown', first === 'paper-leaf' && second === 'classic', `${first}/${second}`);
}
{
  const st = fakeStorage();
  check('resolve with garbage settings → paper-leaf fallback',
    resolveLoginThemeId({ mode: 'zzz', fixedThemeId: 'nope' }, st) === 'paper-leaf');
}

// ---------------------------------------------------------------- Part 2
console.log('Part 2 — static wiring');

const loginSrc = readFileSync(join(appDir, 'src', 'pages', 'Login.jsx'), 'utf8');
check('Login reads the theme from app state', loginSrc.includes('login_theme_settings'));
check('Login resolves via the registry helpers',
  loginSrc.includes('resolveLoginThemeId') && loginSrc.includes('getLoginThemeById'));
check('Login renders ArtLoginView for art themes',
  loginSrc.includes('ArtLoginView') && loginSrc.includes("activeLoginTheme.type === 'art'"));
check('classic login design preserved (Authenticate & Access)',
  loginSrc.includes('Authenticate & Access'));
check('auth call site untouched — login(identifier, password, platform, rememberMe)',
  loginSrc.includes('login(cleanIdentifier, cleanPassword, platform, rememberMe)'));
check('rate-limit behaviour untouched', loginSrc.includes('getRateLimitStatus'));
check('post-login routing untouched (password-change + dashboard destinations)',
  loginSrc.includes("navigate('/profile?forceChange=true'") && loginSrc.includes("'/dashboard'"));

const artSrc = readFileSync(join(appDir, 'src', 'components', 'login', 'ArtLoginView.jsx'), 'utf8');
check('ArtLoginView renders the theme artwork', artSrc.includes('theme?.image') || artSrc.includes('theme.image'));
check('ArtLoginView has the mockup Log in submit', artSrc.includes('>Log in</span>') || artSrc.includes('Log in'));
check('ArtLoginView has the password eye toggle', artSrc.includes('visibility_off') && artSrc.includes('visibility'));
check('ArtLoginView has NO social-login row (no dead Google/Outlook buttons)',
  !/google|outlook/i.test(artSrc));

const ctxSrc = readFileSync(join(appDir, 'src', 'context', 'AppContext.jsx'), 'utf8');
check('AppContext seeds login_theme_settings from the registry defaults',
  ctxSrc.includes('login_theme_settings: getInitialLoginThemeSettings()'));
check('AppContext loads the app_config copy on start',
  ctxSrc.includes('loadLoginThemeSettingsFromTable') && ctxSrc.includes('normalizeLoginThemeSettings(loginThemeSettingsFromTable)'));
check('AppContext writes changes through to app_config',
  ctxSrc.includes('syncLoginThemeSettingsToTable'));
check('login_theme_settings is kept OUT of the blob',
  ctxSrc.includes('delete cleanState.login_theme_settings;'));

const etSrc = readFileSync(join(appDir, 'src', 'utils', 'entityTables.js'), 'utf8');
check("entityTables reads app_config key 'loginThemeSettings'",
  etSrc.includes("loadLoginThemeSettingsFromTable") && etSrc.includes(".eq('key', 'loginThemeSettings')"));
check('entityTables upserts the loginThemeSettings key',
  etSrc.includes('syncLoginThemeSettingsToTable') && etSrc.includes("upsert({ key: 'loginThemeSettings'"));

const dashSrc = readFileSync(join(appDir, 'src', 'pages', 'SettingsDashboard.jsx'), 'utf8');
check('Settings workspace has the Login Screen Theme tab (systemConfig gate)',
  dashSrc.includes("id: 'login_theme'") && dashSrc.includes("label: 'Login Screen Theme'") && dashSrc.includes('<LoginThemeSettings />'));

const settingsSrc = readFileSync(join(appDir, 'src', 'components', 'settings', 'LoginThemeSettings.jsx'), 'utf8');
check('Settings UI renders cards from the registry (LOGIN_THEMES)',
  settingsSrc.includes('LOGIN_THEMES.map'));
check('Settings UI saves via setCollection to login_theme_settings',
  settingsSrc.includes("setCollection('login_theme_settings'"));
check('Settings UI offers Fixed + Auto modes',
  settingsSrc.includes('Fixed Theme') && settingsSrc.includes('Auto'));

// ---------------------------------------------------------------- done
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
