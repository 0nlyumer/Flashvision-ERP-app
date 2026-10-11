import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

const DialogContext = createContext();

export const DialogProvider = ({ children }) => {
  // Confirm Modal State
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    resolve: null
  });

  // Prompt Modal State
  const [promptState, setPromptState] = useState({
    isOpen: false,
    message: '',
    defaultValue: '',
    inputValue: '',
    resolve: null
  });

  // Alert Modal State
  const [alertState, setAlertState] = useState({
    isOpen: false,
    message: '',
    resolve: null
  });

  // Top-Pill Notification State
  const [pillState, setPillState] = useState({
    isOpen: false,
    message: '',
    type: 'info',
    icon: null,
    duration: 3500,
    isExiting: false
  });
  const pillTimerRef = useRef(null);

  // Global Loading Modal State
  const [loadingState, setLoadingState] = useState({
    isOpen: false,
    title: 'Loading...',
    subtext: 'Please wait while we process your request...'
  });

  const showLoading = (title = 'Loading...', subtext = 'Please wait while we process your request...') => {
    setLoadingState({
      isOpen: true,
      title,
      subtext
    });
  };

  const hideLoading = () => {
    setLoadingState(prev => ({
      ...prev,
      isOpen: false
    }));
  };

  const appConfirm = (message, title = 'Confirm Action', options = {}) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title,
        message,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        resolve
      });
    });
  };

  const appPrompt = (message, defaultValue = '') => {
    return new Promise((resolve) => {
      setPromptState({
        isOpen: true,
        message,
        defaultValue,
        inputValue: defaultValue,
        resolve
      });
    });
  };

  const appAlert = (message) => {
    return new Promise((resolve) => {
      setAlertState({
        isOpen: true,
        message,
        resolve
      });
    });
  };

  const showTopPill = (message, options = {}) => {
    if (pillTimerRef.current) {
      clearTimeout(pillTimerRef.current);
    }

    const duration = options.duration !== undefined ? options.duration : 4000;

    setPillState({
      isOpen: true,
      message,
      type: options.type || 'info',
      icon: options.icon || null,
      duration,
      isExiting: false
    });

    if (duration > 0) {
      pillTimerRef.current = setTimeout(() => {
        dismissTopPill();
      }, duration);
    }
  };

  const dismissTopPill = () => {
    setPillState(prev => {
      if (!prev.isOpen || prev.isExiting) return prev;
      return { ...prev, isExiting: true };
    });

    setTimeout(() => {
      setPillState({
        isOpen: false,
        message: '',
        type: 'info',
        icon: null,
        duration: 3500,
        isExiting: false
      });
    }, 400);
  };

  const handlePillMouseEnter = () => {
    if (pillTimerRef.current) {
      clearTimeout(pillTimerRef.current);
    }
  };

  const handlePillMouseLeave = () => {
    if (pillState.isOpen && pillState.duration > 0) {
      pillTimerRef.current = setTimeout(() => {
        dismissTopPill();
      }, 2000);
    }
  };

  const handleConfirmClose = (result) => {
    if (confirmState.resolve) {
      confirmState.resolve(result);
    }
    setConfirmState({
      isOpen: false,
      title: '',
      message: '',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      resolve: null
    });
  };

  const handlePromptClose = (result) => {
    if (promptState.resolve) {
      promptState.resolve(result);
    }
    setPromptState({
      isOpen: false,
      message: '',
      defaultValue: '',
      inputValue: '',
      resolve: null
    });
  };

  const handleAlertClose = () => {
    if (alertState.resolve) {
      alertState.resolve();
    }
    setAlertState({
      isOpen: false,
      message: '',
      resolve: null
    });
  };

  const getPillTheme = (type) => {
    switch (type) {
      case 'warning':
        return {
          bg: 'bg-amber-50/95 dark:bg-[#181511]/95',
          border: 'border-amber-300 dark:border-[#f59e0b]/35 shadow-[0_12px_32px_rgba(245,158,11,0.12)]',
          text: 'text-amber-950 dark:text-[#fef3c7]',
          iconColor: 'text-amber-600 dark:text-[#fbbf24]',
          accent: 'bg-amber-500',
          defaultIcon: 'warning'
        };
      case 'success':
        return {
          bg: 'bg-emerald-50/95 dark:bg-[#0b1a14]/95',
          border: 'border-emerald-300 dark:border-[#10b981]/35 shadow-[0_12px_32px_rgba(16,185,129,0.12)]',
          text: 'text-emerald-950 dark:text-[#d1fae5]',
          iconColor: 'text-emerald-600 dark:text-[#34d399]',
          accent: 'bg-emerald-500',
          defaultIcon: 'check_circle'
        };
      case 'error':
        return {
          bg: 'bg-red-50/95 dark:bg-[#1c0d11]/95',
          border: 'border-red-300 dark:border-[#ef4444]/35 shadow-[0_12px_32px_rgba(239,68,68,0.12)]',
          text: 'text-red-950 dark:text-[#fee2e2]',
          iconColor: 'text-red-600 dark:text-[#f87171]',
          accent: 'bg-red-500',
          defaultIcon: 'error_outline'
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-50/95 dark:bg-[#0d1627]/95',
          border: 'border-blue-300 dark:border-[#3b82f6]/35 shadow-[0_12px_32px_rgba(59,130,246,0.12)]',
          text: 'text-blue-950 dark:text-[#dbeafe]',
          iconColor: 'text-blue-600 dark:text-[#60a5fa]',
          accent: 'bg-blue-500',
          defaultIcon: 'info'
        };
    }
  };

  return (
    <DialogContext.Provider value={{ 
      appConfirm, 
      appPrompt, 
      appAlert, 
      showTopPill, 
      showPillNotification: showTopPill, 
      dismissTopPill, 
      showLoading, 
      hideLoading 
    }}>
      {children}

      {/* Top-Pill Notification Component */}
      {pillState.isOpen && (
        <div 
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] pointer-events-auto select-none"
          onMouseEnter={handlePillMouseEnter}
          onMouseLeave={handlePillMouseLeave}
          onClick={dismissTopPill}
        >
          {(() => {
            const theme = getPillTheme(pillState.type);
            const displayIcon = pillState.icon || theme.defaultIcon;
            return (
              <div 
                className={`flex items-center gap-3 px-4 py-2.5 rounded-full backdrop-blur-xl border ${theme.bg} ${theme.border} ${theme.text} ${
                  pillState.isExiting ? 'animate-pill-out' : 'animate-pill-in'
                } cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group shadow-xl`}
              >
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`w-2 h-2 rounded-full ${theme.accent} animate-pulse`}></span>
                  <span className={`material-symbols-outlined text-[18px] ${theme.iconColor}`}>
                    {displayIcon}
                  </span>
                </div>

                <span className="font-body text-xs font-semibold tracking-wide whitespace-nowrap">
                  {pillState.message}
                </span>

                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissTopPill();
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10 transition-colors ml-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Professional Pure Glassmorphic Loading Overlay */}
      {loadingState.isOpen && (
        <div 
          role="dialog" 
          aria-modal="true" 
          className="fixed inset-0 z-[10005] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/75 backdrop-blur-xl animate-in fade-in duration-200"
        >
          <div className="relative z-20 w-full max-w-sm bg-surface-container-lowest/95 dark:bg-[#14171f]/95 border border-white/10 dark:border-white/[0.08] rounded-3xl p-8 shadow-[0_25px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200 text-on-surface">
            {/* Glowing Dual Orbital Spinner */}
            <div className="relative w-18 h-18 mb-5 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping opacity-25"></div>
              <svg className="w-16 h-16 animate-spinner-rotate" viewBox="0 0 50 50">
                <circle
                  className="animate-spinner-dash stroke-primary"
                  cx="25"
                  cy="25"
                  r="20"
                  fill="none"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
              <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-[20px] text-primary animate-pulse">
                  sync
                </span>
              </div>
            </div>

            {/* Typography */}
            <h3 className="font-headline font-bold text-base text-on-surface tracking-tight mb-1.5">
              {loadingState.title}
            </h3>
            <p className="font-body text-xs text-on-surface-variant leading-relaxed font-medium max-w-[260px]">
              {loadingState.subtext}
            </p>
          </div>
        </div>
      )}

      {/* Professional Pure Glassmorphic Confirmation Modal */}
      {confirmState.isOpen && (
        <div 
          role="dialog" 
          aria-modal="true" 
          className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div 
            className="relative z-20 w-full max-w-md bg-white dark:bg-[#14171f] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl backdrop-blur-2xl flex flex-col items-center p-7 text-center animate-in zoom-in-95 duration-200 text-on-surface"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mb-5 text-amber-500 shadow-inner">
              <span className="material-symbols-outlined text-[30px]">warning</span>
            </div>
            
            <h2 className="font-headline font-black text-xl text-on-surface mb-2 tracking-tight">
              {confirmState.title || "Confirm Action"}
            </h2>
            <p className="font-body text-xs text-on-surface-variant mb-6 leading-relaxed max-w-[320px]">
              {confirmState.message || "Are you sure you want to apply these changes?"}
            </p>
            
            <div className="flex items-center gap-3 w-full">
              <button 
                onClick={() => handleConfirmClose(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 font-bold text-xs transition-colors cursor-pointer" 
                type="button"
              >
                {confirmState.cancelText || "Cancel"}
              </button>
              <button 
                onClick={() => handleConfirmClose(true)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary/90 transition-all shadow-md active:scale-95 cursor-pointer" 
                type="button"
              >
                {confirmState.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Professional Pure Glassmorphic Prompt Modal */}
      {promptState.isOpen && (
        <div 
          role="dialog" 
          aria-modal="true" 
          className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div 
            className="relative z-20 w-full max-w-md bg-white dark:bg-[#14171f] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl backdrop-blur-2xl flex flex-col items-center p-7 text-center animate-in zoom-in-95 duration-200 text-on-surface"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center mb-5 text-primary shadow-inner">
              <span className="material-symbols-outlined text-[30px]">edit_note</span>
            </div>

            <h2 className="font-headline font-black text-xl text-on-surface mb-2 tracking-tight">Input Required</h2>
            <p className="font-body text-xs text-on-surface-variant mb-5 leading-relaxed max-w-[320px]">
              {promptState.message}
            </p>

            <input 
              type="text" 
              autoFocus
              className="w-full bg-slate-50 dark:bg-[#0b0e14] border border-slate-300 dark:border-white/15 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/25 mb-6"
              value={promptState.inputValue}
              onChange={(e) => setPromptState(prev => ({ ...prev, inputValue: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePromptClose(promptState.inputValue);
                if (e.key === 'Escape') handlePromptClose(null);
              }}
            />
            
            <div className="flex items-center gap-3 w-full">
              <button 
                onClick={() => handlePromptClose(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 font-bold text-xs transition-colors cursor-pointer" 
                type="button"
              >
                Cancel
              </button>
              <button 
                onClick={() => handlePromptClose(promptState.inputValue)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary/90 transition-all shadow-md active:scale-95 cursor-pointer" 
                type="button"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Professional Pure Glassmorphic Alert Modal */}
      {alertState.isOpen && (
        <div 
          role="dialog" 
          aria-modal="true" 
          className="fixed inset-0 z-[10003] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div 
            className="relative z-20 w-full max-w-sm bg-white dark:bg-[#14171f] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl backdrop-blur-2xl flex flex-col items-center p-7 text-center animate-in zoom-in-95 duration-200 text-on-surface"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center mb-5 text-primary shadow-inner">
              <span className="material-symbols-outlined text-[30px]">info</span>
            </div>
            
            <h2 className="font-headline font-black text-lg text-on-surface mb-2 tracking-tight">Notice</h2>
            <p className="font-body text-xs text-on-surface-variant mb-6 leading-relaxed max-w-[280px] whitespace-pre-line">
              {alertState.message}
            </p>
            
            <button 
              onClick={handleAlertClose}
              className="w-full py-2.5 px-6 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary/90 transition-all shadow-md active:scale-95 cursor-pointer" 
              type="button"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = () => useContext(DialogContext);
