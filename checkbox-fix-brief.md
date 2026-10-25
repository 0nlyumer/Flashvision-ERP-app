# Task: Fix app-wide checkbox blinking/flickering in FlashVision ERP

Working directory: ~/workspace/erp/sale_orders_app (branch fix/checkbox-blink — this is the exact code the live site is built from).

## Bug
Since today's commits (e85aa34 database switch, 3a850a4 ultra-low egress optimization), checkboxes across the whole ERP (Raw Material Configuration matrix, Department Settings item mapping, user permissions, etc.) visibly blink / toggle on their own without user interaction. It is app-wide, so the cause is in the shared state/sync layer, not in individual screens.

## Prime suspects — src/context/AppContext.jsx
1. The Supabase Realtime handler for `erp_state` (channel 'public:erp_state', ~line 1339) applies the FULL remote state via setState on every event, WITHOUT the content-equality guard that `checkRemoteVersion` (~line 1546) already has (it compares `JSON.stringify(getSanitizedSyncState(erpData))` against `lastSyncedStateRef.current` before applying). Add the same guard to the realtime handler: if the sanitized remote content is identical to the last synced state, do NOT setState. Also keep `lastSyncedStateRef.current` updated in the realtime path exactly like checkRemoteVersion does.
2. The `localStorage.setItem` interceptor effect (~line 1676, "Intercept localStorage.setItem to keep AppContext state and remote database synced") — inspect it carefully. If it re-applies state or triggers a remote upsert on unrelated localStorage writes, guard/debounce it so a local↔remote ping-pong cannot occur.
3. Any other path that calls setState with a freshly built state object on a timer, focus, visibility, or heartbeat path even when nothing changed.

## Goal
When nothing actually changed, there must be NO state replacement and NO re-render churn. A checkbox's `checked` value must remain perfectly stable unless the underlying data genuinely changes.

## Must preserve
- The egress optimization behavior (5-minute poll fallback, zero egress on hidden tabs, realtime for genuine updates).
- Realtime updates from other clients must still apply when the content genuinely differs.
- src/utils/supabaseClient.js must keep pointing at the NEW project (zefeylnjghbdeivdsppc). Do not touch it.
- All features and UI: no visible changes other than the blinking stopping.

## Constraints
- Minimal diff. AppContext.jsx only, unless the interceptor lives elsewhere.
- `npm run build` must pass when you are done.
- When finished, print a short summary: the root cause you found and exactly what you changed (file + lines).
