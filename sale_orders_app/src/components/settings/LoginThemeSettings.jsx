import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { LOGIN_THEMES, normalizeLoginThemeSettings } from '../../utils/loginThemes';

// --- Login Screen Theme (Settings → Login Screen Theme) --------------------
// GLOBAL admin setting (gated in SettingsDashboard with the same
// 'systemConfig' permission as Print Settings & Layout): chooses which
// theme the pre-auth login screen wears. Stored ONLY in app_config under
// key 'loginThemeSettings' via the AppContext write-through (state key
// 'login_theme_settings') — never in the blob, never per-user.
//   Fixed — the selected theme shows on every login screen.
//   Auto  — every login screen shows a different theme than the last one
//           (all registered themes rotate, Classic included).
// Changes apply immediately and are confirmed with a saved chip, in the
// style of the other Settings screens.

export default function LoginThemeSettings() {
  const { state, setCollection } = useApp();
  const current = normalizeLoginThemeSettings(state?.login_theme_settings);

  const [mode, setMode] = useState(current.mode);
  const [fixedThemeId, setFixedThemeId] = useState(current.fixedThemeId);
  const [savedTick, setSavedTick] = useState(false);

  useEffect(() => {
    const next = normalizeLoginThemeSettings(state?.login_theme_settings);
    setMode(next.mode);
    setFixedThemeId(next.fixedThemeId);
  }, [state?.login_theme_settings]);

  const save = (nextMode, nextFixedId) => {
    setCollection('login_theme_settings', normalizeLoginThemeSettings({ mode: nextMode, fixedThemeId: nextFixedId }));
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 2600);
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    save(nextMode, fixedThemeId);
  };

  const handleThemePick = (themeId) => {
    setFixedThemeId(themeId);
    setMode('fixed');
    save('fixed', themeId);
  };

  return (
    <div className="bg-surface rounded-3xl overflow-hidden shadow-sm border border-outline-variant/10 max-w-5xl mx-auto">
      <div className="p-8 space-y-8 bg-surface-container-lowest">
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[16px]">wallpaper</span>
            Login Screen
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-3xl font-black text-on-surface tracking-tight font-manrope">
              Login Screen Theme
            </h2>
            {savedTick && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold animate-in fade-in duration-200">
                <span className="material-symbols-outlined text-[15px]">check_circle</span>
                Saved — new login screens will use this setting
              </span>
            )}
          </div>
          <p className="text-on-surface-variant text-sm font-semibold">
            Choose the design every user sees on the login screen. This is a global setting — it applies to the login screen on all devices.
          </p>
        </header>

        <hr className="border-outline-variant/15" />

        {/* Mode */}
        <section className="space-y-3">
          <h3 className="text-sm font-extrabold text-on-surface uppercase tracking-wider">Theme Mode</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
            <button
              type="button"
              onClick={() => handleModeChange('fixed')}
              className={`flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all ${mode === 'fixed' ? 'border-primary bg-primary/5' : 'border-outline-variant/20 bg-surface hover:border-outline-variant/40'}`}
            >
              <span className={`material-symbols-outlined text-[20px] mt-0.5 ${mode === 'fixed' ? 'text-primary' : 'text-on-surface-variant'}`}>
                {mode === 'fixed' ? 'radio_button_checked' : 'radio_button_unchecked'}
              </span>
              <span>
                <span className="block text-sm font-bold text-on-surface">Fixed Theme</span>
                <span className="block text-xs text-on-surface-variant mt-0.5">The selected theme stays on every login screen.</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('auto')}
              className={`flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all ${mode === 'auto' ? 'border-primary bg-primary/5' : 'border-outline-variant/20 bg-surface hover:border-outline-variant/40'}`}
            >
              <span className={`material-symbols-outlined text-[20px] mt-0.5 ${mode === 'auto' ? 'text-primary' : 'text-on-surface-variant'}`}>
                {mode === 'auto' ? 'radio_button_checked' : 'radio_button_unchecked'}
              </span>
              <span>
                <span className="block text-sm font-bold text-on-surface">Auto — New Theme Every Time</span>
                <span className="block text-xs text-on-surface-variant mt-0.5">Every login screen shows a different theme than the last one. All themes below take part in the rotation.</span>
              </span>
            </button>
          </div>
        </section>

        {/* Theme cards */}
        <section className="space-y-3">
          <h3 className="text-sm font-extrabold text-on-surface uppercase tracking-wider">
            {mode === 'fixed' ? 'Select Theme' : 'Themes in Rotation'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {LOGIN_THEMES.map((theme) => {
              const selected = mode === 'fixed' && fixedThemeId === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => handleThemePick(theme.id)}
                  className={`group relative rounded-2xl border-2 overflow-hidden text-left transition-all bg-surface ${selected ? 'border-primary ring-4 ring-primary/15' : 'border-outline-variant/20 hover:border-outline-variant/50'}`}
                  title={mode === 'auto' ? `Switch to Fixed with ${theme.name}` : `Use ${theme.name} on the login screen`}
                >
                  <div className="h-44 w-full overflow-hidden relative bg-slate-100">
                    {theme.type === 'art' && theme.image ? (
                      <img
                        src={theme.image}
                        alt={`${theme.name} theme artwork`}
                        className="w-full h-full object-cover -scale-x-100"
                        style={{ objectPosition: '50% 28%' }}
                      />
                    ) : (
                      // Classic swatch: a miniature of the original design —
                      // dark backdrop, gradient brand mark, pale card.
                      <div className="w-full h-full relative" style={{ background: 'linear-gradient(135deg,#080d1a 0%,#0f1c33 55%,#1e2a4a 100%)' }}>
                        <div className="absolute top-4 left-4 flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600" />
                          <div className="h-1.5 w-14 rounded bg-white/70" />
                        </div>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-24 rounded-lg bg-white/90 p-2 space-y-1.5 shadow-lg">
                          <div className="h-1.5 w-10 rounded bg-slate-700" />
                          <div className="h-3 w-full rounded-md border border-slate-300 bg-white" />
                          <div className="h-3 w-full rounded-md border border-slate-300 bg-white" />
                          <div className="h-3.5 w-full rounded-md bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600" />
                        </div>
                        <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-cyan-500/25 blur-2xl" />
                        <div className="absolute -top-8 right-16 w-24 h-24 rounded-full bg-indigo-500/25 blur-2xl" />
                      </div>
                    )}
                    {selected && (
                      <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-white text-[10px] font-bold shadow-md">
                        <span className="material-symbols-outlined text-[13px]">check</span>
                        Selected
                      </span>
                    )}
                  </div>
                  <div className="p-3.5">
                    <p className="text-sm font-bold text-on-surface">{theme.name}</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      {theme.type === 'art' ? 'Artwork theme — Omer’s mockup design' : 'The original login design'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-on-surface-variant font-medium">
            {mode === 'fixed'
              ? 'The selected theme will show on the next login screen.'
              : 'Tip: clicking any theme switches to Fixed mode with that theme.'}
          </p>
        </section>
      </div>
    </div>
  );
}
