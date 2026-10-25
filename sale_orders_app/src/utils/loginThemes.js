// --- Login Screen Themes (app_config key 'loginThemeSettings') -------------
// The login screen's look is a GLOBAL (pre-auth) setting, chosen by Omer
// (2026-10-25): a fixed theme, or "auto" — a different theme on every
// login-screen appearance. Themes live in ONE registry here; adding a theme
// later = drop its artwork in `public/login-themes/` + add one entry below.
//
//   classic   — the original login design (dark/light, draggable panels,
//               custom wallpaper). Untouched; the fallback and the way back.
//   paper-leaf — Omer's supplied paper-cut leaf artwork in his mockup
//               layout (white card, form left, artwork right behind a wavy
//               paper-cut edge, deep-green pill button).
//
// The settings object rides in app_config under key 'loginThemeSettings'
// (table copy wins on load, changes write through — the flashAmConfig
// pattern in entityTables.js / AppContext). It is NEVER stored in the blob.

export const LOGIN_THEMES = [
  {
    id: 'classic',
    name: 'Classic',
    type: 'classic',
    accent: '#2563eb'
  },
  {
    id: 'paper-leaf',
    name: 'Paper Leaf',
    type: 'art',
    // Omer's supplied artwork, served byte-identical from public/.
    image: '/login-themes/paper-leaf.jpg',
    // Deep green sampled from the artwork / mockup button.
    accent: '#2e4b3f',
    buttonTextColor: '#ffffff'
  }
];

export const LAST_LOGIN_THEME_KEY = 'fv_login_theme_last';

export const DEFAULT_LOGIN_THEME_SETTINGS = {
  mode: 'fixed',
  fixedThemeId: 'paper-leaf'
};

export function getLoginThemeById(id) {
  return LOGIN_THEMES.find((t) => t.id === id) || null;
}

export function normalizeLoginThemeSettings(raw) {
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
  }
  if (!parsed || typeof parsed !== 'object') parsed = {};
  const d = DEFAULT_LOGIN_THEME_SETTINGS;
  return {
    mode: parsed.mode === 'auto' ? 'auto' : 'fixed',
    fixedThemeId: getLoginThemeById(parsed.fixedThemeId) ? parsed.fixedThemeId : d.fixedThemeId
  };
}

export function getInitialLoginThemeSettings() {
  return normalizeLoginThemeSettings(null);
}

// Pure auto-rotation picker: a random id from `ids` that differs from
// `lastId` whenever more than one theme exists. Exported for the smoke.
export function pickAutoThemeId(ids, lastId, rand = Math.random) {
  const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  const pool = list.filter((id) => id !== lastId);
  const pick = pool[Math.floor(rand() * pool.length)];
  return pick || pool[0];
}

const defaultStorage = () => {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
};

// Resolve which theme id the login screen shows for these settings.
// Fixed → the chosen theme. Auto → a different theme than the one shown
// last time (remembered in localStorage under LAST_LOGIN_THEME_KEY).
// The resolved id is recorded as last-shown in BOTH modes, so switching
// from fixed to auto never immediately repeats the fixed theme.
// Any failure falls back to the shipped default (paper-leaf), then classic.
export function resolveLoginThemeId(rawSettings, storage = defaultStorage(), rand = Math.random) {
  try {
    const settings = normalizeLoginThemeSettings(rawSettings);
    let id;
    if (settings.mode === 'auto') {
      let lastId = null;
      try { lastId = storage ? storage.getItem(LAST_LOGIN_THEME_KEY) : null; } catch (e) {}
      id = pickAutoThemeId(LOGIN_THEMES.map((t) => t.id), lastId, rand);
    } else {
      id = settings.fixedThemeId;
    }
    if (!getLoginThemeById(id)) id = DEFAULT_LOGIN_THEME_SETTINGS.fixedThemeId;
    try { if (storage) storage.setItem(LAST_LOGIN_THEME_KEY, id); } catch (e) {}
    return id;
  } catch (e) {
    return getLoginThemeById(DEFAULT_LOGIN_THEME_SETTINGS.fixedThemeId)
      ? DEFAULT_LOGIN_THEME_SETTINGS.fixedThemeId
      : 'classic';
  }
}
