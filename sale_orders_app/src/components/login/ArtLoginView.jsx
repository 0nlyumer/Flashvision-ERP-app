import React, { useState } from 'react';

// --- Art login view (login screen themes — Omer, 2026-10-25) ---------------
// The "art" login layout from Omer's supplied mockup: a large white rounded
// card on a soft backdrop — form on the left, the theme artwork flowing in
// from the right. The supplied artwork carries its wavy torn-paper edge on
// its RIGHT side (leaves left, white paper right); the mockup shows the
// mirror composition (form | wave | leaves), so the artwork is mirrored
// with CSS — the served file itself stays byte-identical.
//
// Layout fix (2026-10-25, Omer's live-laptop report): the backdrop layers
// are FIXED to the viewport so they always cover exactly the screen, and
// the card is a generously sized, truly centred panel (~1200px max,
// form ≈42% / artwork ≈58% as in his mockup) — no top-anchoring and no
// empty white plate below. On phones the card is frosted glass
// (glassmorphism, as in his mockup's phone panel): the artwork shows
// through it, blurred and softened.
//
// This view is a pure skin: every field, handler and behaviour (auth,
// lockout, shake, caps-lock, remember-me, session notices, the Part C
// handover message) is owned by src/pages/Login.jsx and passed in as
// props. No theme controls live here.

export default function ArtLoginView({
  theme,
  companyName,
  identifier,
  setIdentifier,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  rememberMe,
  setRememberMe,
  isCapsLockOn,
  errorMessage,
  lockoutSeconds,
  sessionExpiredNotice,
  isSubmitting,
  handoverMessage,
  shakeField,
  onSubmit,
  onForgotPassword,
  onKeyDown,
  onKeyUp,
  usernameInputRef
}) {
  const accent = theme?.accent || '#2e4b3f';
  const buttonTextColor = theme?.buttonTextColor || '#ffffff';
  const image = theme?.image;
  const [focusedField, setFocusedField] = useState(null);

  const pillStyle = (field, shaking) => ({
    borderColor: shaking ? '#f43f5e' : focusedField === field ? accent : '#d6dcd4',
    boxShadow: shaking
      ? '0 0 12px rgba(244,63,94,0.35)'
      : focusedField === field
        ? `0 0 0 4px ${accent}24`
        : '0 1px 2px rgba(24,44,34,0.05)'
  });

  const userShaking = shakeField === 'email' || shakeField === 'both';
  const passShaking = shakeField === 'password' || shakeField === 'both';

  return (
    <main
      className="relative min-h-screen w-full overflow-x-hidden flex items-center justify-center p-3 sm:p-6 lg:p-10 select-none"
      style={{ backgroundColor: '#edf1ea', minHeight: '100dvh' }}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
    >
      <style>{`@keyframes fv-shake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(2px)}30%,50%,70%{transform:translateX(-4px)}40%,60%{transform:translateX(4px)}}.fv-shake{animation:fv-shake .4s ease-in-out}`}</style>

      {/* Backdrop — FIXED to the viewport so it covers exactly the screen
          at every size: mobile shows the artwork itself (mockup phone
          panel); desktop shows the same artwork, softly blurred, behind
          the card (mockup desktop scene). */}
      {image && (
        <>
          <img
            src={image}
            alt=""
            aria-hidden="true"
            className="fixed inset-0 w-full h-full object-cover -scale-x-100 lg:hidden"
          />
          <img
            src={image}
            alt=""
            aria-hidden="true"
            className="fixed inset-0 w-full h-full object-cover -scale-x-100 scale-110 blur-md hidden lg:block"
          />
          <div className="fixed inset-0 hidden lg:block bg-white/75" />
        </>
      )}

      {/* Card — desktop: solid white, form left / artwork right.
          Mobile: frosted glass over the full-screen artwork. */}
      <div className="relative z-10 w-full max-w-[430px] lg:max-w-[1200px] min-h-[68dvh] lg:min-h-[640px] flex flex-col lg:flex-row rounded-[2rem] overflow-hidden border border-white/60 lg:border-white bg-white/60 lg:bg-white backdrop-blur-[16px] backdrop-saturate-[1.2] lg:backdrop-blur-none lg:backdrop-saturate-100 shadow-[0_35px_90px_-25px_rgba(24,44,34,0.45)]">
        {/* Form column */}
        <section className="w-full lg:w-[42%] flex-1 px-7 py-10 sm:px-10 lg:px-14 lg:py-12 flex flex-col justify-center">
          <div className="w-full max-w-[360px] lg:max-w-[380px] mx-auto lg:mx-0">
            {/* Brand mark */}
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md" style={{ backgroundColor: accent }}>
                <span className="material-symbols-outlined text-white text-[20px]">energy_savings_leaf</span>
              </div>
              <div>
                <p className="text-sm font-extrabold tracking-tight text-slate-800 leading-tight">{companyName}</p>
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: accent }}>Integrated Enterprise ERP</p>
              </div>
            </div>

            <h1 className="mt-9 text-[28px] leading-tight font-bold font-manrope tracking-tight text-slate-800">Log in</h1>

            {/* Session expired notice */}
            {sessionExpiredNotice && (
              <div className="mt-5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 text-xs flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-amber-500 shrink-0 mt-0.5">warning</span>
                <div>
                  <p className="font-semibold">Session Locked</p>
                  <p className="text-[11px] opacity-90 mt-0.5">{sessionExpiredNotice}</p>
                </div>
              </div>
            )}

            {/* Error / lockout banner */}
            {errorMessage && (
              <div className="mt-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-rose-500 shrink-0 mt-0.5">error</span>
                <div className="flex-1">
                  <p className="font-semibold">Authentication Notice</p>
                  <p className="text-[11px] opacity-90 mt-0.5">{errorMessage}</p>
                  {lockoutSeconds > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-rose-500 font-mono font-bold">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      Lockout expires in: {Math.floor(lockoutSeconds / 60)}m {lockoutSeconds % 60}s
                    </div>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={onSubmit} className="mt-7 space-y-5">
              {/* Username or mobile number */}
              <div className={userShaking ? 'fv-shake' : ''}>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 ml-1 tracking-wide">Username or Mobile Number</label>
                <input
                  ref={usernameInputRef}
                  type="text"
                  name="email"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter your username or mobile number"
                  disabled={isSubmitting || lockoutSeconds > 0}
                  className="w-full rounded-full border bg-white px-5 py-3.5 text-sm font-medium text-slate-800 placeholder-slate-300 outline-none transition-all duration-200 disabled:opacity-60"
                  style={pillStyle('email', userShaking)}
                />
              </div>

              {/* Password */}
              <div className={passShaking ? 'fv-shake' : ''}>
                <div className="flex items-center justify-between mb-1.5 ml-1">
                  <label className="block text-[11px] font-semibold text-slate-500 tracking-wide">Password</label>
                  {isCapsLockOn && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      <span className="material-symbols-outlined text-xs">keyboard_capslock</span>
                      Caps Lock ON
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Enter your password"
                    disabled={isSubmitting || lockoutSeconds > 0}
                    className="w-full rounded-full border bg-white pl-5 pr-12 py-3.5 text-sm font-medium text-slate-800 placeholder-slate-300 outline-none transition-all duration-200 disabled:opacity-60"
                    style={pillStyle('password', passShaking)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              {/* Remember + forgot */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded cursor-pointer"
                    style={{ accentColor: accent }}
                  />
                  <span className="text-xs font-medium text-slate-500">Remember terminal (24h)</span>
                </label>
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-xs font-semibold hover:underline transition-colors"
                  style={{ color: accent }}
                >
                  Forgot login or password?
                </button>
              </div>

              {/* Submit — during a single-session handover the button
                  carries the short status message (Part C). */}
              <button
                type="submit"
                disabled={isSubmitting || lockoutSeconds > 0}
                className="w-full py-3.5 px-4 rounded-full font-bold text-sm tracking-wide shadow-lg hover:brightness-110 active:scale-[0.99] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: accent, color: buttonTextColor }}
              >
                {handoverMessage ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{handoverMessage}</span>
                  </>
                ) : isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : lockoutSeconds > 0 ? (
                  <>
                    <span className="material-symbols-outlined text-sm">lock_clock</span>
                    <span>Locked ({lockoutSeconds}s)</span>
                  </>
                ) : (
                  <span>Log in</span>
                )}
              </button>
            </form>

            {/* Footer — one short protection line (Omer, 2026-10-25) */}
            <div className="mt-9 text-center border-t border-slate-900/10 pt-5">
              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500">
                <span className="material-symbols-outlined text-xs" style={{ color: accent }}>lock</span>
                <span>Protected &amp; Encrypted</span>
              </div>
            </div>
          </div>
        </section>

        {/* Artwork panel — desktop: leaves flow in from the right behind
            the wavy paper-cut edge baked into the artwork. */}
        {image && (
          <div className="hidden lg:block relative lg:w-[58%]">
            <img
              src={image}
              alt="Paper-cut tropical leaves artwork"
              className="absolute inset-0 w-full h-full object-cover -scale-x-100"
              style={{ objectPosition: '50% 28%' }}
            />
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white via-white/45 to-transparent" />
          </div>
        )}
      </div>
    </main>
  );
}
