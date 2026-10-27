import React from 'react';
import { createPortal } from 'react-dom';
import useZoomCompensatedSize from '../utils/useZoomCompensatedSize';

/**
 * Kicked-device notice (fix run F, 2026-10-28): when this account is
 * signed in on another device, this session no longer dies instantly —
 * the user gets this dismiss-proof popup with a reverse countdown, and
 * the sign-out completes when it reaches zero. Rendered by AppProvider
 * from AppContext state (concurrentKick); there is deliberately no
 * close/dismiss affordance.
 */
export default function ConcurrentKickModal({ secondsLeft }) {
  const size = useZoomCompensatedSize();
  if (secondsLeft === null || secondsLeft === undefined) return null;

  return createPortal(
    <div
      style={{ width: size.width, height: size.height }}
      className="fixed inset-0 z-[100000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-6 select-none"
      role="alertdialog"
      aria-live="assertive"
      aria-label="Signed in on another device"
    >
      <div className="bg-surface-container-lowest text-on-surface border border-outline-variant/30 rounded-[28px] shadow-2xl max-w-md w-full p-8 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-14 h-14 rounded-2xl bg-error-container text-on-error-container mx-auto flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl">devices</span>
        </div>
        <h2 className="font-headline font-black text-xl tracking-tight mt-4">Signed in on another device</h2>
        <p className="text-sm text-on-surface-variant leading-relaxed mt-2">
          This account was just signed in on another device. To keep your account secure, only one
          session can be active at a time, so this session will now be signed out.
        </p>
        <div className="mt-6">
          <div className="text-6xl font-black text-primary tabular-nums leading-none">{secondsLeft}</div>
          <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant mt-2">
            Signing out in {secondsLeft} second{secondsLeft === 1 ? '' : 's'}
          </p>
          <div className="h-1.5 rounded-full bg-surface-container-high mt-4 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${Math.max(0, Math.min(100, (secondsLeft / 10) * 100))}%` }}
            />
          </div>
        </div>
        <p className="text-[11px] text-on-surface-variant/80 mt-6 leading-relaxed">
          If this wasn&rsquo;t you, sign back in and change your password right away.
        </p>
      </div>
    </div>,
    document.body
  );
}
