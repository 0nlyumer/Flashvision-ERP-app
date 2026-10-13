import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const DB_NAME = 'AjSyntheticSettings';
const STORE_NAME = 'media';

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveBgMedia = async (data, type) => {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ data, type }, 'bgMedia');
  } catch (err) {
    console.error("Failed to save media to IDB", err);
  }
};

const loadBgMedia = async () => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get('bgMedia');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to load media from IDB", err);
    return null;
  }
};

const greetingsList = [
  "Streamline your operations. Welcome back!",
  "Powering your productivity, one login at a time.",
  "Ready to optimize your workflow? Let’s begin.",
  "Your business hub is ready. Let’s get to work.",
  "Efficiency starts here. Welcome!",
  "Managing excellence together. Glad to see you!",
  "Data-driven success begins with your focus.",
  "Control your enterprise with precision. Welcome back!",
  "Ready to scale today? Your dashboard awaits.",
  "Turning operations into growth. Let’s start.",
  "Empowering your business journey. Welcome!",
  "Focused management, limitless growth. Let's dive in.",
  "Your mission, our platform. Let’s achieve more today.",
  "Success is in the details. Let’s manage them well.",
  "Experience seamless management. Welcome back!",
  "Your operational command center is online.",
  "Simplify. Manage. Grow. Welcome to the portal.",
  "Precision in every task. Ready to start?",
  "Focus on what matters. We’ll handle the rest.",
  "Synchronizing your success. Welcome!",
  "Drive innovation through better management. Let’s go!",
  "Connecting teams, empowering results. Welcome back."
];

// Authorized quick-demo profiles for authorized review & testing
const DEMO_PROFILES = [
  { role: 'Super Admin', username: 'admin', password: 'admin1', name: 'System Admin', badge: 'Full Access' },
  { role: 'Operations', username: 'arfan_jameel', password: '12345', name: 'Arfan Jameel', badge: 'Executive' },
  { role: 'Manager', username: 'umair_shabir', password: '123456', name: 'Umair Shabir', badge: 'Management' },
  { role: 'Architect', username: 'only.umer', password: '123456', name: 'Omer Khan', badge: 'Lead Arch' }
];

// Reusable component to make sections freely movable
const DraggablePanel = ({ id, defaultOffset, children, className, style, isLocked }) => {
  const [offset, setOffset] = useState(() => {
    try {
      const saved = localStorage.getItem(`aj_draggable_${id}`);
      return saved ? JSON.parse(saved) : defaultOffset;
    } catch (e) {
      return defaultOffset;
    }
  });

  const handleMouseDown = (e) => {
    if (isLocked) return;
    if (['INPUT', 'BUTTON', 'A', 'TEXTAREA', 'SELECT', 'OPTION'].includes(e.target.tagName)) return;
    if (e.target.closest('button') || e.target.closest('a')) return;

    e.preventDefault();
    const startX = e.clientX - offset.x;
    const startY = e.clientY - offset.y;

    const handleMouseMove = (moveEvent) => {
      setOffset({
        x: moveEvent.clientX - startX,
        y: moveEvent.clientY - startY
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const resetPosition = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    try {
      localStorage.setItem(`aj_draggable_${id}`, JSON.stringify(offset));
    } catch (e) {}
  }, [offset, id]);

  return (
    <div 
      className={`relative group ${isLocked ? '' : 'cursor-move'} ${className}`}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)`, transition: isLocked ? 'transform 0.3s ease' : 'transform 0.05s linear', ...style }}
      onMouseDown={handleMouseDown}
    >
      {(offset.x !== 0 || offset.y !== 0) && !isLocked && (
        <button 
          onClick={resetPosition}
          className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg"
          title="Reset Position"
          type="button"
        >
          <span className="material-symbols-outlined text-sm">restart_alt</span>
        </button>
      )}
      {children}
    </div>
  );
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);
  const usernameInputRef = useRef(null);
  const { state, login, isInitialLoadCompleted, isSessionValid, getRateLimitStatus } = useApp();

  // Form Fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Security & Feedback State
  const [errorMessage, setErrorMessage] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);
  const [showDemoDrawer, setShowDemoDrawer] = useState(false);

  // Appearance State
  const [theme, setTheme] = useState('dark');
  const [bgMedia, setBgMedia] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [bgFit, setBgFit] = useState('contain');
  const [isLayoutLocked, setIsLayoutLocked] = useState(false);
  const [showCompanyInfo, setShowCompanyInfo] = useState(true);
  const [shakeField, setShakeField] = useState(null);

  // Check URL params for session expired notification
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reason = params.get('reason');
    if (reason) {
      if (reason === 'inactivity_timeout') {
        setSessionExpiredNotice('Your session timed out after 60 minutes of inactivity. Please re-authenticate.');
      } else {
        setSessionExpiredNotice('Your session has expired. Please sign in with your credentials to continue.');
      }
    }
  }, [location.search]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setErrorMessage('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  // Auto-redirect if already logged in with a cryptographically valid session
  useEffect(() => {
    const valid = state?.currentUser && (!isSessionValid || isSessionValid());
    if (valid) {
      if (state.currentUser.requirePasswordChange) {
        navigate('/profile?forceChange=true', { replace: true });
      } else if (import.meta.env.VITE_APP_MODE === 'chat') {
        navigate('/chat', { replace: true });
      } else {
        const destination = location.state?.from || '/dashboard';
        navigate(destination, { replace: true });
      }
    }
  }, [state?.currentUser, isSessionValid, navigate, location.state]);

  // Load preferences
  useEffect(() => {
    setGreeting(greetingsList[Math.floor(Math.random() * greetingsList.length)]);

    try {
      const savedTheme = localStorage.getItem('aj_login_theme');
      if (savedTheme) setTheme(savedTheme);

      const savedFit = localStorage.getItem('aj_login_bg_fit');
      if (savedFit) setBgFit(savedFit);

      const savedLock = localStorage.getItem('aj_login_layout_lock');
      if (savedLock !== null) setIsLayoutLocked(savedLock === 'true');

      const savedShow = localStorage.getItem('aj_login_show_company');
      if (savedShow !== null) setShowCompanyInfo(savedShow === 'true');
    } catch (e) {}

    loadBgMedia().then(media => {
      if (media) setBgMedia(media);
    });

    // Check rate limit on load
    if (getRateLimitStatus) {
      const status = getRateLimitStatus('global');
      if (!status.allowed && status.remainingSeconds > 0) {
        setLockoutSeconds(status.remainingSeconds);
        setErrorMessage(`Security Lockout Active: Too many failed login attempts. Retry in ${status.remainingSeconds}s.`);
      }
    }

    // Auto focus
    if (usernameInputRef.current) {
      usernameInputRef.current.focus();
    }
  }, [getRateLimitStatus]);

  const handleKeyDown = (e) => {
    if (e.getModifierState) {
      setIsCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  const handleQuickFill = (profile) => {
    setIdentifier(profile.username);
    setPassword(profile.password);
    setErrorMessage('');
    setShowDemoDrawer(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isSubmitting || lockoutSeconds > 0) return;

    const cleanIdentifier = identifier.trim();
    const cleanPassword = password;

    if (!cleanIdentifier || !cleanPassword) {
      if (!cleanIdentifier && !cleanPassword) setShakeField('both');
      else if (!cleanIdentifier) setShakeField('email');
      else setShakeField('password');
      setErrorMessage('Please provide both username/email and password.');
      setTimeout(() => setShakeField(null), 500);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    // Platform detection
    let platform = 'Web';
    if (window.process && window.process.versions && window.process.versions.electron) {
      platform = 'Windows Desktop';
    } else if (window.Capacitor || window.cordova || /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      platform = 'Mobile Client';
    }

    try {
      // Simulate slight cryptographic delay for timing attack mitigation
      await new Promise(r => setTimeout(r, 250));

      const result = login(cleanIdentifier, cleanPassword, platform, rememberMe);

      if (!result.success) {
        setShakeField('both');
        setTimeout(() => setShakeField(null), 500);

        if (result.locked) {
          setLockoutSeconds(result.remainingSeconds || 300);
          setErrorMessage(result.reason || `Too many failed attempts. Locked for ${result.remainingSeconds}s.`);
        } else {
          setRemainingAttempts(result.remainingAttempts);
          const attemptsNotice = result.remainingAttempts !== undefined
            ? ` (${result.remainingAttempts} attempts remaining)`
            : '';
          setErrorMessage(`Access Denied: Invalid credentials provided${attemptsNotice}.`);
        }
        setIsSubmitting(false);
        return;
      }

      // Successful login
      if (result.user.requirePasswordChange) {
        navigate('/profile?forceChange=true');
      } else if (import.meta.env.VITE_APP_MODE === 'chat') {
        navigate('/chat');
      } else {
        const destination = location.state?.from || '/dashboard';
        navigate(destination);
      }
    } catch (err) {
      setErrorMessage('An unexpected security error occurred during authentication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    try {
      localStorage.setItem('aj_login_theme', newTheme);
    } catch (e) {}
  };

  const handleMediaUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const data = reader.result;
        const type = file.type;
        setBgMedia({ data, type });
        saveBgMedia(data, type);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Styling
  const isDark = theme === 'dark';
  const textClass = isDark ? 'text-slate-100' : 'text-slate-900';
  const textMutedClass = isDark ? 'text-slate-400' : 'text-slate-500';
  const cardBgClass = isDark 
    ? 'bg-slate-900/85 backdrop-blur-2xl border-slate-700/60 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)]' 
    : 'bg-white/90 backdrop-blur-2xl border-slate-200/90 shadow-[0_20px_50px_-15px_rgba(15,23,42,0.15)]';
  const inputBgClass = isDark ? 'bg-slate-950/70 text-white placeholder-slate-500 border-slate-700/70 focus:border-cyan-500 focus:ring-cyan-500/20' : 'bg-slate-50 text-slate-900 placeholder-slate-400 border-slate-300 focus:border-blue-600 focus:ring-blue-600/20';
  const shakeClass = "animate-[shake_0.4s_ease-in-out] border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]";

  const companyName = state?.adminSetup?.companyName || 'FLASHVISION ENTERPRISE';

  return (
    <main 
      className="relative min-h-screen h-full w-full overflow-hidden flex items-center justify-center p-4 sm:p-8 transition-colors duration-700 select-none" 
      style={{ backgroundColor: isDark ? '#080d1a' : '#f1f5f9' }}
      onKeyUp={handleKeyDown}
      onKeyDown={handleKeyDown}
    >
      {/* Dynamic Background Media */}
      {bgMedia && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          {bgMedia.type.startsWith('video') ? (
            <video 
              src={bgMedia.data} 
              autoPlay 
              loop 
              muted 
              playsInline 
              className="w-full h-full"
              style={{ objectFit: bgFit }}
            />
          ) : (
            <img 
              src={bgMedia.data} 
              alt="Custom Background" 
              className="w-full h-full"
              style={{ objectFit: bgFit }}
            />
          )}
          {/* Subtle overlay for legibility */}
          <div className={`absolute inset-0 ${isDark ? 'bg-slate-950/75' : 'bg-slate-900/25'}`} />
        </div>
      )}

      {/* Cybernetic Geometric Grid Background Effect */}
      {!bgMedia && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className={`absolute -top-40 -left-40 w-96 h-96 rounded-full blur-[128px] opacity-25 ${isDark ? 'bg-cyan-500' : 'bg-blue-400'}`} />
          <div className={`absolute -bottom-40 -right-40 w-96 h-96 rounded-full blur-[128px] opacity-25 ${isDark ? 'bg-indigo-600' : 'bg-indigo-300'}`} />
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[140px] opacity-15 ${isDark ? 'bg-blue-600' : 'bg-sky-200'}`} />
          {/* SVG Tech Grid */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
      )}

      {/* Loading Skeleton if initial state is not ready */}
      {!isInitialLoadCompleted && (
        <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-4 text-white">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold tracking-wide text-slate-300">Initializing Enterprise Security Engine...</p>
        </div>
      )}

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-5xl flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-14 py-6">
        
        {/* Left Column: Brand & Security Guarantee */}
        {showCompanyInfo && (
          <DraggablePanel 
            id="login_branding_panel" 
            defaultOffset={{ x: 0, y: 0 }} 
            isLocked={isLayoutLocked}
            className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6"
          >
            {/* Enterprise Security Shield Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide border backdrop-blur-md transition-all duration-300 bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-sm">
              <span className="material-symbols-outlined text-[16px] text-cyan-400">verified_user</span>
              <span>256-Bit SSL Encrypted Enterprise Portal</span>
            </div>

            {/* Logo and Brand Title */}
            <div>
              <div className="flex items-center justify-center lg:justify-start gap-3 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 border border-white/20">
                  <span className="material-symbols-outlined text-white text-2xl">diamond</span>
                </div>
                <div>
                  <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-manrope ${textClass}`}>
                    {companyName}
                  </h1>
                  <p className="text-xs font-semibold uppercase tracking-widest text-cyan-500">
                    Integrated Enterprise ERP
                  </p>
                </div>
              </div>

              <p className={`text-sm sm:text-base font-normal leading-relaxed mt-4 max-w-md ${textMutedClass}`}>
                {greeting || "Next-generation ERP architecture for mission-critical manufacturing, operations, and logistics management."}
              </p>
            </div>

            {/* Enterprise Security Badges */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-md pt-2">
              <div className={`p-3 rounded-xl border flex items-center gap-3 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
                <span className="material-symbols-outlined text-cyan-400 text-2xl">lock_clock</span>
                <div className="text-left">
                  <p className={`text-xs font-bold ${textClass}`}>HMAC Signature</p>
                  <p className={`text-[10px] ${textMutedClass}`}>Anti-tamper tokens</p>
                </div>
              </div>
              <div className={`p-3 rounded-xl border flex items-center gap-3 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
                <span className="material-symbols-outlined text-indigo-400 text-2xl">shield_person</span>
                <div className="text-left">
                  <p className={`text-xs font-bold ${textClass}`}>Role Security</p>
                  <p className={`text-[10px] ${textMutedClass}`}>Granular access control</p>
                </div>
              </div>
              <div className={`p-3 rounded-xl border flex items-center gap-3 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
                <span className="material-symbols-outlined text-emerald-400 text-2xl">timer</span>
                <div className="text-left">
                  <p className={`text-xs font-bold ${textClass}`}>Idle Guard</p>
                  <p className={`text-[10px] ${textMutedClass}`}>60m inactivity timeout</p>
                </div>
              </div>
              <div className={`p-3 rounded-xl border flex items-center gap-3 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
                <span className="material-symbols-outlined text-amber-400 text-2xl">policy</span>
                <div className="text-left">
                  <p className={`text-xs font-bold ${textClass}`}>Audit Trails</p>
                  <p className={`text-[10px] ${textMutedClass}`}>Tamper-proof log capture</p>
                </div>
              </div>
            </div>

            {/* Authorized Roles Drawer Trigger */}
            <div className="w-full max-w-md pt-2">
              <button
                type="button"
                onClick={() => setShowDemoDrawer(!showDemoDrawer)}
                className={`w-full py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all duration-300 ${isDark ? 'bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'}`}
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-cyan-400">badge</span>
                  Authorized Operator Profiles ({DEMO_PROFILES.length})
                </span>
                <span className={`material-symbols-outlined text-sm transition-transform duration-300 ${showDemoDrawer ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>

              {showDemoDrawer && (
                <div className={`mt-2 p-3 rounded-xl border space-y-2 animate-in fade-in slide-in-from-top-2 duration-200 ${isDark ? 'bg-slate-900/90 border-slate-700' : 'bg-white border-slate-200 shadow-lg'}`}>
                  <p className={`text-[11px] font-medium ${textMutedClass}`}>Click any role to auto-populate credentials for validation:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {DEMO_PROFILES.map((p) => (
                      <button
                        key={p.username}
                        type="button"
                        onClick={() => handleQuickFill(p)}
                        className={`p-2 rounded-lg border text-left flex flex-col justify-between transition-colors ${isDark ? 'bg-slate-800/80 hover:bg-cyan-950/40 hover:border-cyan-500/50 border-slate-700' : 'bg-slate-50 hover:bg-blue-50 hover:border-blue-300 border-slate-200'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-cyan-400 truncate">{p.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-semibold">{p.badge}</span>
                        </div>
                        <span className={`text-[10px] mt-1 font-mono ${textMutedClass}`}>@{p.username}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DraggablePanel>
        )}

        {/* Right Column: Secure Login Card */}
        <DraggablePanel 
          id="login_form_panel" 
          defaultOffset={{ x: 0, y: 0 }} 
          isLocked={isLayoutLocked}
          className="w-full lg:w-1/2 max-w-md"
        >
          <div className={`p-8 sm:p-10 rounded-3xl border transition-all duration-300 ${cardBgClass}`}>
            
            {/* Card Header */}
            <div className="mb-6 text-center sm:text-left">
              <div className="flex items-center justify-between mb-1">
                <h2 className={`text-2xl font-bold font-manrope tracking-tight ${textClass}`}>
                  Sign In
                </h2>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Security Active
                </div>
              </div>
              <p className={`text-xs ${textMutedClass}`}>
                Enter your authorized credentials to access your enterprise dashboard.
              </p>
            </div>

            {/* Session Expired Alert Banner */}
            {sessionExpiredNotice && (
              <div className="mb-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-300">
                <span className="material-symbols-outlined text-[18px] text-amber-400 shrink-0 mt-0.5">warning</span>
                <div>
                  <p className="font-semibold">Session Locked</p>
                  <p className="text-[11px] opacity-90 mt-0.5">{sessionExpiredNotice}</p>
                </div>
              </div>
            )}

            {/* Security Error / Rate Limit Banner */}
            {errorMessage && (
              <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in shake duration-300">
                <span className="material-symbols-outlined text-[18px] text-rose-400 shrink-0 mt-0.5">error</span>
                <div className="flex-1">
                  <p className="font-semibold">Authentication Notice</p>
                  <p className="text-[11px] opacity-90 mt-0.5">{errorMessage}</p>
                  {lockoutSeconds > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-rose-400 font-mono font-bold">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      Lockout expires in: {Math.floor(lockoutSeconds / 60)}m {lockoutSeconds % 60}s
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              
              {/* Username / Email Field */}
              <div>
                <label className={`block text-xs font-semibold mb-1.5 tracking-wide ${textClass}`}>
                  Username or Corporate Email
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-slate-400 pointer-events-none">
                    person
                  </span>
                  <input
                    ref={usernameInputRef}
                    type="text"
                    name="email"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. admin or operator@flashvision.com"
                    disabled={isSubmitting || lockoutSeconds > 0}
                    className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200 outline-none ${inputBgClass} ${shakeField === 'email' || shakeField === 'both' ? shakeClass : ''}`}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`block text-xs font-semibold tracking-wide ${textClass}`}>
                    Password
                  </label>
                  {isCapsLockOn && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                      <span className="material-symbols-outlined text-xs">keyboard_capslock</span>
                      Caps Lock ON
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-slate-400 pointer-events-none">
                    lock
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter account password"
                    disabled={isSubmitting || lockoutSeconds > 0}
                    className={`w-full pl-11 pr-11 py-3 rounded-xl border text-sm font-medium transition-all duration-200 outline-none ${inputBgClass} ${shakeField === 'password' || shakeField === 'both' ? shakeClass : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Extended Session / Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-600 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className={`text-xs font-medium ${textMutedClass}`}>
                    Remember terminal (24h)
                  </span>
                </label>

                <button 
                  type="button"
                  onClick={() => alert("Enterprise Security Notice:\nTo reset your credentials, please request an administrative reset from your Super Administrator.")}
                  className={`text-xs font-semibold hover:underline transition-colors ${isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-blue-600 hover:text-blue-700'}`}
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || lockoutSeconds > 0}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide mt-2 shadow-lg hover:shadow-cyan-500/20 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
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
                  <>
                    <span>Authenticate & Access</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            {/* Footer */}
            <div className={`mt-8 text-center border-t pt-5 transition-colors duration-700 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
                <span className="material-symbols-outlined text-xs text-emerald-400">shield</span>
                <span>Protected by FlashVision Zero-Trust Architecture</span>
              </div>
              <p className={`text-[10px] mt-2 ${textMutedClass}`}>
                Synthetic Leather ERP • Architected by <span className="font-bold text-slate-300">Omer Khan</span>
              </p>
            </div>

          </div>
        </DraggablePanel>

      </div>

      {/* Floating Settings Widget */}
      <div className="absolute bottom-6 right-6 z-50">
        <div className="relative">
          {settingsOpen && (
            <div className={`absolute bottom-16 right-0 w-72 rounded-2xl p-5 shadow-2xl border backdrop-blur-xl transition-all duration-300 ${isDark ? 'bg-slate-900/95 border-slate-700 text-white' : 'bg-white/95 border-slate-200 text-slate-900'} animate-in fade-in slide-in-from-bottom-2 duration-200`}>
              <h3 className="font-bold mb-4 flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-[18px] text-cyan-400">palette</span>
                Appearance Settings
              </h3>
              
              <div className="space-y-4">
                {/* Theme Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Dark Mode</span>
                  <button 
                    type="button"
                    onClick={toggleTheme}
                    className={`w-10 h-5 rounded-full relative transition-colors duration-500 ${isDark ? 'bg-cyan-600' : 'bg-slate-300'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all duration-500 ${isDark ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>

                {/* Layout Lock Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Lock Layout</span>
                  <button 
                    type="button"
                    onClick={() => {
                      const newLock = !isLayoutLocked;
                      setIsLayoutLocked(newLock);
                      try { localStorage.setItem('aj_login_layout_lock', newLock); } catch(e) {}
                    }}
                    className={`w-10 h-5 rounded-full relative transition-colors duration-500 ${isLayoutLocked ? 'bg-rose-500' : 'bg-slate-300'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all duration-500 ${isLayoutLocked ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>

                {/* Show Company Info Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Show Enterprise Info</span>
                  <button 
                    type="button"
                    onClick={() => {
                      const newShow = !showCompanyInfo;
                      setShowCompanyInfo(newShow);
                      try { localStorage.setItem('aj_login_show_company', newShow); } catch(e) {}
                    }}
                    className={`w-10 h-5 rounded-full relative transition-colors duration-500 ${showCompanyInfo ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all duration-500 ${showCompanyInfo ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>

                <hr className={`transition-colors duration-700 ${isDark ? 'border-slate-800' : 'border-slate-200'}`} />

                {/* Background Upload & Fit */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium">Dynamic Wallpaper</p>
                    <select 
                      value={bgFit}
                      onChange={(e) => {
                        setBgFit(e.target.value);
                        try { localStorage.setItem('aj_login_bg_fit', e.target.value); } catch(e) {}
                      }}
                      className={`text-[10px] rounded px-1.5 py-0.5 border outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-300 text-black'}`}
                    >
                      <option value="contain">Fit (Contain)</option>
                      <option value="cover">Fill (Cover)</option>
                      <option value="fill">Stretch (Fill)</option>
                    </select>
                  </div>
                  <button 
                    type="button"
                    onClick={triggerFileInput}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors duration-300 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">upload</span>
                    Upload Media
                  </button>
                  <p className={`text-[10px] mt-2 text-center ${textMutedClass}`}>
                    High-res wallpapers or looping videos
                  </p>
                  <input 
                    type="file" 
                    accept="image/*,video/*" 
                    ref={fileInputRef} 
                    onChange={handleMediaUpload} 
                    className="hidden" 
                  />
                  {bgMedia && (
                    <button 
                      type="button"
                      onClick={() => { 
                        setBgMedia(null); 
                        initDB().then(db => {
                          const tx = db.transaction(STORE_NAME, 'readwrite');
                          tx.objectStore(STORE_NAME).delete('bgMedia');
                        });
                      }}
                      className="w-full mt-2 py-1.5 px-3 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors duration-300"
                    >
                      Remove Background
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Floating Settings Button */}
          <button 
            type="button"
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-2xl hover:scale-105 transition-all duration-300 ${isDark ? 'bg-slate-800 border border-slate-700 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}
            title="Appearance Settings"
          >
            <span className={`material-symbols-outlined text-xl transition-transform duration-300 ${settingsOpen ? 'rotate-90 text-cyan-400' : ''}`}>
              settings
            </span>
          </button>
        </div>
      </div>

    </main>
  );
}
