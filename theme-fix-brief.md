# Fix brief — theme color flicker (checkboxes shift dark/light shade on their own)

## Symptom (confirmed by the client)
Checkbox/tick states NEVER change. Only COLORS oscillate: themed elements keep shifting between the dark-variant and light-variant shade of the active theme color (e.g. dark green ↔ light green, dark blue ↔ light blue), continuously, on every screen, on laptop AND phone. It is a theme re-application fight, not a data/sync problem.

## Root cause
`state.themeSettings` can be re-set from multiple sources (localStorage cache load, Supabase `user_settings` fetch, and the `user_settings` REALTIME subscription), and every identity change of `state.themeSettings` re-runs `applyTheme`, rewriting all CSS variables — including switching `--color-primary` between the light palette and dark palette of the same color whenever the incoming settings object differs (e.g. a stale/differently-shaped object missing fields, or two clients whose saved settings differ). Realtime events from another client of the same user re-apply THEIR theme here, this client's settings-save effect then writes back, and the two clients keep re-applying each other's theme forever.

## Required changes (minimal, surgical — do NOT redesign anything)

### 1. `src/utils/theme.js` — make `applyTheme` idempotent
- Keep a module-level variable holding the JSON string of the last applied settings.
- At the top of `applyTheme`, compute `JSON.stringify(settings)`; if it equals the last applied key, return immediately without touching the DOM.
- Otherwise apply as today and store the key.

### 2. `src/context/AppContext.jsx` — stabilize the theme-apply effect (~line 1069)
- The `useEffect(() => { if (state.themeSettings) applyTheme(state.themeSettings); }, [state.themeSettings])` must only call `applyTheme` when the settings' JSON content actually changed (keep a `useRef` of the last JSON). (theme.js idempotence already covers this; add the ref guard anyway for cheapness — optional if redundant.)

### 3. `src/context/AppContext.jsx` — `user_settings` realtime handler (~line 2390-2410): deep-equality guard
- In the postgres_changes handler, before `setState`, compare the incoming fields with the current state values (themeSettings, displaySettings, dashboardLayout, dashboardBackground, documentWarehouseBinders) via JSON.stringify.
- Build the next state ONLY from fields that actually differ; if nothing differs, do not call setState at all.
- Keep the existing `lastUpdatedBy === clientId.current` early-return.

### 4. `src/context/AppContext.jsx` — initial remote settings fetch (`fetchInitialSettings`, ~line 2338): same guard
- When applying `data.settings_data`, only setState with fields whose JSON differs from current state; if none differ, skip setState entirely.

### 5. `src/context/AppContext.jsx` — settings save effect (~line 2418): skip no-op writes
- Keep a `useRef` with the JSON of the last saved `userSettings` object (the one containing themeSettings/displaySettings/dashboardLayout/dashboardBackground/documentWarehouseBinders/lastUpdatedBy — compare WITHOUT lastUpdatedBy, or rebuild the comparison object without it).
- If unchanged since the last save, return early: no localStorage writes, no Supabase upsert.

## Hard constraints
- Do NOT change any palette values, theme defaults, Theme Settings UI, or any visual design.
- Do NOT touch `src/utils/supabaseClient.js`.
- Do NOT touch the erp_state sync logic or the guards added in commit 91e1139 (checkbox sync fix) — they stay as they are.
- `npm run build` must pass.
- Report a per-file summary of every change.
