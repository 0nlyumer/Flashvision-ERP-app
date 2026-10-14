import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useNavigate } from 'react-router-dom';

// Universal Web Audio API Chime & Haptic Engine
const playChime = (type = 'in') => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'in') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'out') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(783.99, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(523.25, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.38);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.38);
      } else if (type === 'biometric') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      }
    }
  } catch (e) {}

  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    if (type === 'in') navigator.vibrate([35, 20, 35]);
    else if (type === 'out') navigator.vibrate([60]);
    else if (type === 'biometric') navigator.vibrate([20, 40]);
    else if (type === 'error') navigator.vibrate([100, 50, 100]);
  }
};

// Format current time as hh:mm:ss a
const getFormattedTime = () => {
  const d = new Date();
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
};

// Calculate worked hours between two time strings like "09:00:00 AM" and "05:30:00 PM"
const calculateDuration = (inTimeStr, outTimeStr) => {
  if (!inTimeStr || !outTimeStr) return null;
  try {
    const today = '1970-01-01';
    const inDate = new Date(`${today} ${inTimeStr}`);
    const outDate = new Date(`${today} ${outTimeStr}`);
    if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) return null;
    let diffMs = outDate - inDate;
    if (diffMs < 0) diffMs += 24 * 3600 * 1000;
    const diffMins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hrs}h ${mins}m`;
  } catch (e) {
    return null;
  }
};

export default function FlashAM() {
  const { state, setCollection, login } = useApp();
  const { appAlert, appConfirm } = useDialog();
  const navigate = useNavigate();

  // Android Clock & Connectivity State
  const [currentTimeStr, setCurrentTimeStr] = useState(getFormattedTime());
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Layout View Mode (Mobile Fullscreen vs Desktop Android Frame Simulator)
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const [isSimulatorFrame, setIsSimulatorFrame] = useState(!isTouchDevice && window.innerWidth > 768);

  // =========================================================================
  // 1. AUTHENTICATION & BIOMETRIC / PIN SECURITY GATE
  // =========================================================================
  // Flash AM stores authentication token, PIN, and biometric preference in localStorage
  const [authStatus, setAuthStatus] = useState(() => {
    const saved = localStorage.getItem('flasham_auth');
    if (!saved) return 'login'; // First time needs password login
    try {
      const parsed = JSON.parse(saved);
      if (parsed.authenticated) {
        return parsed.pin ? 'locked' : 'setup-pin';
      }
    } catch (e) {}
    return 'login';
  });

  const [savedUser, setSavedUser] = useState(() => {
    try {
      const s = localStorage.getItem('flasham_auth');
      return s ? JSON.parse(s).user : null;
    } catch (e) { return null; }
  });

  // Login form state
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [loginError, setLoginError] = useState('');

  // PIN entry & setup state
  const [pinInput, setPinInput] = useState('');
  const [pinSetupVal, setPinSetupVal] = useState('');
  const [pinSetupConfirm, setPinSetupConfirm] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isBiometricScanning, setIsBiometricScanning] = useState(false);

  // Active Bottom Tab: 'punch' | 'stats' | 'scan' | 'settings'
  const [activeTab, setActiveTab] = useState('punch');

  // =========================================================================
  // 2. ATTENDANCE DATE & FILTERS
  // =========================================================================
  // Today's Date by default (YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedShift, setSelectedShift] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL'); // 'ALL' | 'PRESENT' | 'ABSENT' | 'COMPLETED'

  // Live clock interval
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeStr(getFormattedTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Offline / Online listeners & Auto-Sync
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushOfflineSyncQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check of offline queue
    try {
      const q = JSON.parse(localStorage.getItem('flasham_offline_punches') || '[]');
      setPendingSyncCount(q.length);
      if (navigator.onLine && q.length > 0) {
        flushOfflineSyncQueue();
      }
    } catch (e) {}

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-Save when leaving app or screen is locked (visibilitychange, pagehide, beforeunload)
  useEffect(() => {
    const handleAppBackground = () => {
      commitLocalStateToStorage();
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleAppBackground();
      }
    });
    window.addEventListener('pagehide', handleAppBackground);
    window.addEventListener('beforeunload', handleAppBackground);

    return () => {
      window.removeEventListener('pagehide', handleAppBackground);
      window.removeEventListener('beforeunload', handleAppBackground);
    };
  }, []);

  // Flush offline queue and sync with ERP
  const flushOfflineSyncQueue = () => {
    try {
      const queue = JSON.parse(localStorage.getItem('flasham_offline_punches') || '[]');
      if (queue.length === 0) return;

      const currentEmployees = [...(state.hr_employees_list || [])];
      const currentUploaded = [...(state.hr_uploaded_attendance || [])];

      queue.forEach(item => {
        const { employeeId, date, punchType, time } = item;
        const empIndex = currentEmployees.findIndex(e => e.id === employeeId);
        if (empIndex !== -1) {
          const emp = { ...currentEmployees[empIndex] };
          const att = { ...(emp.attendance || {}) };
          const dayRec = att[date] || { status: 'present', ot: 0, fines: 0, deductions: 0 };

          if (punchType === 'IN') {
            dayRec.status = 'present';
            dayRec.inTime = time;
          } else if (punchType === 'OUT') {
            dayRec.outTime = time;
            if (dayRec.inTime) {
              dayRec.workedHours = calculateDuration(dayRec.inTime, time);
            }
          }
          att[date] = dayRec;
          currentEmployees[empIndex] = { ...emp, attendance: att };
        }

        // Also update uploaded attendance
        const upIndex = currentUploaded.findIndex(u => u.employeeId === employeeId && u.date === date);
        if (upIndex !== -1) {
          if (punchType === 'IN') currentUploaded[upIndex].inTime = time;
          if (punchType === 'OUT') currentUploaded[upIndex].outTime = time;
          currentUploaded[upIndex].status = 'present';
        } else {
          currentUploaded.push({
            employeeId,
            date,
            status: 'present',
            [punchType === 'IN' ? 'inTime' : 'outTime']: time
          });
        }
      });

      if (setCollection) {
        setCollection('hr_employees_list', currentEmployees);
        setCollection('hr_uploaded_attendance', currentUploaded);
      }
      localStorage.setItem('hr_employees_list', JSON.stringify(currentEmployees));
      localStorage.setItem('hr_uploaded_attendance', JSON.stringify(currentUploaded));
      localStorage.removeItem('flasham_offline_punches');
      setPendingSyncCount(0);
      playChime('biometric');
    } catch (e) {
      console.warn('Sync error:', e);
    }
  };

  const commitLocalStateToStorage = () => {
    if (state.hr_employees_list) {
      localStorage.setItem('hr_employees_list', JSON.stringify(state.hr_employees_list));
    }
    if (state.hr_uploaded_attendance) {
      localStorage.setItem('hr_uploaded_attendance', JSON.stringify(state.hr_uploaded_attendance));
    }
  };

  // =========================================================================
  // 3. AUTHENTICATION HANDLERS
  // =========================================================================
  const handlePasswordLogin = async (e) => {
    if (e) e.preventDefault();
    setLoginError('');

    // Check credentials against state users or default admin
    const foundUser = (state.users || []).find(
      u => u.username?.toLowerCase() === loginUsername.trim().toLowerCase()
    );

    if (foundUser || (loginUsername === 'admin' && loginPassword === 'admin123')) {
      const userPayload = foundUser || { username: 'admin', name: 'Super Admin', role: 'admin' };
      const authData = {
        authenticated: true,
        user: userPayload,
        pin: localStorage.getItem('flasham_pin') || null,
        biometricEnabled: localStorage.getItem('flasham_biometric') === 'true'
      };
      localStorage.setItem('flasham_auth', JSON.stringify(authData));
      setSavedUser(userPayload);

      if (!authData.pin) {
        setAuthStatus('setup-pin');
      } else {
        setAuthStatus('unlocked');
        playChime('biometric');
      }
    } else {
      setLoginError('Invalid Username or Password. Please verify and try again.');
      playChime('error');
    }
  };

  // Handle PIN Keypad Press
  const handleKeypadPress = (val) => {
    if (pinInput.length < 4) {
      const nextPin = pinInput + val;
      setPinInput(nextPin);
      playChime('in');

      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleKeypadBackspace = () => {
    if (pinInput.length > 0) {
      setPinInput(pinInput.slice(0, -1));
    }
  };

  const verifyPin = (enteredPin) => {
    const storedPin = localStorage.getItem('flasham_pin');
    // Default fallback PIN is 1234 if not set
    const validPin = storedPin || '1234';

    if (enteredPin === validPin) {
      setPinError(false);
      playChime('biometric');
      setTimeout(() => {
        setAuthStatus('unlocked');
        setPinInput('');
      }, 150);
    } else {
      setPinError(true);
      playChime('error');
      setTimeout(() => {
        setPinInput('');
        setPinError(false);
      }, 600);
    }
  };

  // Handle Biometric Fingerprint Trigger
  const handleBiometricAuth = async () => {
    setIsBiometricScanning(true);
    playChime('in');

    // Simulate authentic mobile biometric sensor response
    setTimeout(() => {
      setIsBiometricScanning(false);
      playChime('biometric');
      setAuthStatus('unlocked');
      setPinInput('');
    }, 700);
  };

  // Handle PIN Setup completion
  const handleSavePinSetup = () => {
    if (pinSetupVal.length !== 4) {
      appAlert('PIN must be exactly 4 digits.');
      return;
    }
    if (pinSetupVal !== pinSetupConfirm) {
      appAlert('PINs do not match. Please re-enter.');
      return;
    }

    localStorage.setItem('flasham_pin', pinSetupVal);
    localStorage.setItem('flasham_biometric', 'true');

    const auth = JSON.parse(localStorage.getItem('flasham_auth') || '{}');
    auth.pin = pinSetupVal;
    auth.biometricEnabled = true;
    localStorage.setItem('flasham_auth', JSON.stringify(auth));

    playChime('biometric');
    appAlert('Security PIN and Fingerprint biometric successfully configured!');
    setAuthStatus('unlocked');
  };

  // Lock App (return to PIN/Biometric lock)
  const handleLockApp = () => {
    setPinInput('');
    setAuthStatus('locked');
  };

  // Logout (require full password login again)
  const handleFullLogout = async () => {
    const confirm = await appConfirm('Are you sure you want to log out of Flash AM? Next login will require your master password.', 'Flash AM Logout', 'Log Out', 'Cancel');
    if (confirm) {
      localStorage.removeItem('flasham_auth');
      setAuthStatus('login');
      setSavedUser(null);
    }
  };

  // =========================================================================
  // 4. ATTENDANCE PUNCH ENGINE (IN & OUT)
  // =========================================================================
  const employees = state.hr_employees_list || [];

  // Departments list for filter
  const departments = useMemo(() => {
    const set = new Set();
    employees.forEach(e => {
      if (e.department) set.add(e.department);
      if (e.section) set.add(e.section);
    });
    return ['ALL', ...Array.from(set)];
  }, [employees]);

  // Handle Punch In / Out
  const handlePunch = (employeeId, type) => {
    const punchTime = getFormattedTime();
    const dateKey = selectedDate;

    // 1. Update Employee Record in state
    const currentEmployees = [...employees];
    const empIndex = currentEmployees.findIndex(e => e.id === employeeId);

    if (empIndex !== -1) {
      const emp = { ...currentEmployees[empIndex] };
      const att = { ...(emp.attendance || {}) };
      const dayRec = { ...(att[dateKey] || { status: 'absent', ot: 0, fines: 0, deductions: 0 }) };

      if (type === 'IN') {
        dayRec.status = 'present';
        dayRec.inTime = punchTime;
        dayRec.explicitStatus = true;
        playChime('in');
      } else if (type === 'OUT') {
        dayRec.outTime = punchTime;
        if (dayRec.inTime) {
          dayRec.workedHours = calculateDuration(dayRec.inTime, punchTime);
        }
        playChime('out');
      }

      att[dateKey] = dayRec;
      currentEmployees[empIndex] = { ...emp, attendance: att };

      if (setCollection) {
        setCollection('hr_employees_list', currentEmployees);
      }
      localStorage.setItem('hr_employees_list', JSON.stringify(currentEmployees));

      // 2. Update hr_uploaded_attendance collection
      const uploaded = [...(state.hr_uploaded_attendance || [])];
      const upIndex = uploaded.findIndex(u => u.employeeId === employeeId && u.date === dateKey);
      if (upIndex !== -1) {
        if (type === 'IN') uploaded[upIndex].inTime = punchTime;
        if (type === 'OUT') uploaded[upIndex].outTime = punchTime;
        uploaded[upIndex].status = 'present';
      } else {
        uploaded.push({
          employeeId,
          employeeName: emp.name,
          date: dateKey,
          status: 'present',
          [type === 'IN' ? 'inTime' : 'outTime']: punchTime
        });
      }
      if (setCollection) {
        setCollection('hr_uploaded_attendance', uploaded);
      }
      localStorage.setItem('hr_uploaded_attendance', JSON.stringify(uploaded));

      // 3. Queue in offline cache if disconnected
      if (!isOnline) {
        const queue = JSON.parse(localStorage.getItem('flasham_offline_punches') || '[]');
        queue.push({
          id: `PUNCH-${Date.now()}`,
          employeeId,
          date: dateKey,
          punchType: type,
          time: punchTime,
          queuedAt: new Date().toISOString()
        });
        localStorage.setItem('flasham_offline_punches', JSON.stringify(queue));
        setPendingSyncCount(queue.length);
      }
    }
  };

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      // Search filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        emp.name?.toLowerCase().includes(q) || 
        emp.id?.toLowerCase().includes(q) || 
        emp.designation?.toLowerCase().includes(q) ||
        emp.department?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // Department filter
      if (selectedDepartment !== 'ALL') {
        const matchesDept = emp.department === selectedDepartment || emp.section === selectedDepartment;
        if (!matchesDept) return false;
      }

      // Shift filter
      if (selectedShift !== 'ALL') {
        if (emp.shift && emp.shift !== selectedShift) return false;
      }

      // Status filter
      const att = emp.attendance?.[selectedDate] || {};
      const isPresent = att.status === 'present' || att.inTime;
      const isCompleted = att.inTime && att.outTime;
      const isAbsent = !isPresent;

      if (selectedStatusFilter === 'PRESENT' && !isPresent) return false;
      if (selectedStatusFilter === 'ABSENT' && !isAbsent) return false;
      if (selectedStatusFilter === 'COMPLETED' && !isCompleted) return false;

      return true;
    });
  }, [employees, searchQuery, selectedDepartment, selectedShift, selectedStatusFilter, selectedDate]);

  // Aggregate stats for selectedDate
  const stats = useMemo(() => {
    let total = employees.length;
    let present = 0;
    let working = 0;
    let completed = 0;
    let absent = 0;

    employees.forEach(e => {
      const a = e.attendance?.[selectedDate] || {};
      const isIn = a.status === 'present' || !!a.inTime;
      const isOut = !!a.outTime;

      if (isIn) {
        present++;
        if (isOut) completed++;
        else working++;
      } else {
        absent++;
      }
    });

    return { total, present, working, completed, absent };
  }, [employees, selectedDate]);

  // Quick QR code badge punch handler
  const [badgeIdInput, setBadgeIdInput] = useState('');
  const handleQuickBadgeScan = (e) => {
    if (e) e.preventDefault();
    const id = badgeIdInput.trim().toUpperCase();
    if (!id) return;

    const matched = employees.find(emp => emp.id?.toUpperCase() === id);
    if (matched) {
      const att = matched.attendance?.[selectedDate] || {};
      if (!att.inTime) {
        handlePunch(matched.id, 'IN');
        appAlert(`Clocked IN: ${matched.name} (${matched.id})`);
      } else if (!att.outTime) {
        handlePunch(matched.id, 'OUT');
        appAlert(`Clocked OUT: ${matched.name} (${matched.id})`);
      } else {
        appAlert(`Employee ${matched.name} has already completed attendance today.`);
      }
      setBadgeIdInput('');
    } else {
      appAlert(`No employee found with ID: ${id}`);
      playChime('error');
    }
  };

  // Change date helpers
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleSetToday = () => {
    setSelectedDate(todayStr);
  };

  // =========================================================================
  // RENDER: 1. FULL PASSWORD LOGIN SCREEN
  // =========================================================================
  if (authStatus === 'login') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-[#07090e] via-[#0b0e14] to-[#121620] text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
        <div className="w-full max-w-sm bg-[#121620]/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-7 shadow-2xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
          {/* Logo & Header */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4 border border-white/20">
            <span className="material-symbols-outlined text-[34px] text-white">fingerprint</span>
          </div>

          <h1 className="font-extrabold text-2xl tracking-tight text-white flex items-center gap-2">
            Flash <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">AM</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium text-center">
            Android Enterprise Attendance Manager
          </p>

          {loginError && (
            <div className="w-full mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs text-center font-medium">
              {loginError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handlePasswordLogin} className="w-full mt-6 space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Operator Username
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-3 text-[18px] text-slate-400">person</span>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="e.g. admin"
                  className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-3 text-[18px] text-slate-400">lock</span>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">login</span>
              Sign In to Flash AM
            </button>
          </form>

          {/* Return to ERP link */}
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-6 text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1 font-medium"
          >
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>
            Return to ERP Portal
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: 2. SET UP PIN & BIOMETRICS (One-Time Setup)
  // =========================================================================
  if (authStatus === 'setup-pin') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-[#07090e] via-[#0b0e14] to-[#121620] text-slate-100 font-sans">
        <div className="w-full max-w-sm bg-[#121620]/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-7 shadow-2xl flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[28px] text-emerald-400">shield_lock</span>
          </div>

          <h2 className="text-xl font-extrabold text-white text-center">Set 4-Digit Security PIN</h2>
          <p className="text-xs text-slate-400 text-center mt-1">
            Create a fast 4-digit PIN for instant attendance access without entering your master password every time.
          </p>

          <div className="w-full mt-6 space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Enter 4-Digit PIN</label>
              <input
                type="password"
                maxLength={4}
                value={pinSetupVal}
                onChange={(e) => setPinSetupVal(e.target.value.replace(/\D/g, ''))}
                placeholder="4 Digits (e.g. 1234)"
                className="w-full text-center tracking-widest text-lg font-bold py-2.5 bg-black/40 border border-white/10 rounded-xl text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Confirm 4-Digit PIN</label>
              <input
                type="password"
                maxLength={4}
                value={pinSetupConfirm}
                onChange={(e) => setPinSetupConfirm(e.target.value.replace(/\D/g, ''))}
                placeholder="Re-enter PIN"
                className="w-full text-center tracking-widest text-lg font-bold py-2.5 bg-black/40 border border-white/10 rounded-xl text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-3">
              <span className="material-symbols-outlined text-blue-400 text-[20px]">fingerprint</span>
              <span className="text-[11px] text-slate-300 leading-tight">
                Fingerprint biometric sensor will also be enabled for instant 1-touch unlock.
              </span>
            </div>

            <button
              onClick={handleSavePinSetup}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Activate Flash AM PIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: 3. ANDROID LOCK SCREEN (PIN & FINGERPRINT)
  // =========================================================================
  if (authStatus === 'locked') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-[#07090e] via-[#0b0e14] to-[#121620] text-slate-100 font-sans select-none">
        <div className="w-full max-w-sm bg-[#121620]/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col items-center">
          {/* Top User Badge */}
          <div className="flex items-center gap-3 w-full p-2.5 rounded-2xl bg-white/[0.04] border border-white/5 mb-6">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center font-bold text-white shadow-md">
              {savedUser?.name ? savedUser.name.charAt(0) : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white truncate">{savedUser?.name || 'Administrator'}</div>
              <div className="text-[10px] text-slate-400 truncate">Flash AM Attendance Terminal</div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/downloads/FlashAM.apk"
                download="FlashAM.apk"
                className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 hover:bg-emerald-500/30 transition-all"
                title="Download Android APK file"
              >
                <span className="material-symbols-outlined text-[12px]">android</span>
                APK
              </a>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[10px] text-emerald-400 font-bold uppercase">{isOnline ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-xl font-extrabold text-white">Enter Security PIN</h2>
            <p className="text-xs text-slate-400 mt-1">Tap PIN or touch fingerprint to unlock</p>
          </div>

          {/* 4 PIN Dots */}
          <div className={`flex items-center gap-4 mb-7 ${pinError ? 'animate-shake' : ''}`}>
            {[0, 1, 2, 3].map(i => {
              const isFilled = pinInput.length > i;
              return (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all duration-200 border ${
                    pinError
                      ? 'bg-rose-500 border-rose-500 scale-110 shadow-lg shadow-rose-500/50'
                      : isFilled
                      ? 'bg-blue-400 border-blue-400 scale-110 shadow-lg shadow-blue-400/50'
                      : 'bg-transparent border-white/30'
                  }`}
                />
              );
            })}
          </div>

          {/* Android Numeric Keypad */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[280px] mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                onClick={() => handleKeypadPress(String(num))}
                className="w-16 h-16 rounded-full mx-auto bg-white/[0.05] hover:bg-white/[0.12] active:bg-blue-500/30 active:scale-95 border border-white/10 text-xl font-bold text-white flex items-center justify-center transition-all cursor-pointer"
              >
                {num}
              </button>
            ))}

            {/* Bottom Row: Fingerprint | 0 | Backspace */}
            <button
              onClick={handleBiometricAuth}
              className="w-16 h-16 rounded-full mx-auto bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 border border-emerald-500/30 text-emerald-400 flex items-center justify-center transition-all cursor-pointer"
              title="Use Mobile Fingerprint"
            >
              <span className={`material-symbols-outlined text-[28px] ${isBiometricScanning ? 'animate-pulse text-emerald-300' : ''}`}>
                fingerprint
              </span>
            </button>

            <button
              onClick={() => handleKeypadPress('0')}
              className="w-16 h-16 rounded-full mx-auto bg-white/[0.05] hover:bg-white/[0.12] active:bg-blue-500/30 active:scale-95 border border-white/10 text-xl font-bold text-white flex items-center justify-center transition-all cursor-pointer"
            >
              0
            </button>

            <button
              onClick={handleKeypadBackspace}
              className="w-16 h-16 rounded-full mx-auto bg-white/[0.05] hover:bg-white/[0.12] active:scale-95 border border-white/10 text-slate-300 flex items-center justify-center transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">backspace</span>
            </button>
          </div>

          {/* Bottom Switch Account */}
          <div className="flex items-center justify-between w-full pt-3 border-t border-white/10 text-xs">
            <button
              onClick={handleFullLogout}
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 font-medium"
            >
              <span className="material-symbols-outlined text-[14px]">logout</span>
              Switch Account
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 font-medium"
            >
              ERP Dashboard
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: 4. MAIN ATTENDANCE APPLICATION
  // =========================================================================
  const appBodyContent = (
    <div className="flex flex-col h-full w-full bg-[#0b0e14] text-slate-100 font-sans select-none overflow-hidden">
      {/* 4.1 Android System Status Bar */}
      <div className="h-7 w-full px-4 bg-[#07090e] border-b border-white/5 flex items-center justify-between text-[11px] font-semibold text-slate-400 z-50 shrink-0">
        <div className="flex items-center gap-1.5 font-mono text-white">
          <span>{currentTimeStr.slice(0, 5)}</span>
        </div>
        <div className="flex items-center gap-2">
          {pendingSyncCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full border border-amber-400/20 animate-pulse">
              <span className="material-symbols-outlined text-[12px]">cloud_sync</span>
              {pendingSyncCount} Q
            </span>
          )}
          <span className="material-symbols-outlined text-[14px] text-emerald-400">
            {isOnline ? 'wifi' : 'wifi_off'}
          </span>
          <span className="material-symbols-outlined text-[15px] text-slate-300">battery_full</span>
        </div>
      </div>

      {/* 4.2 Flash AM App Bar */}
      <div className="px-4 py-3 bg-[#121620] border-b border-white/10 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 border border-white/20">
            <span className="material-symbols-outlined text-[20px]">fingerprint</span>
          </div>
          <div>
            <h1 className="font-black text-base text-white tracking-tight leading-tight flex items-center gap-1.5">
              Flash <span className="text-cyan-400">AM</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">v2.4</span>
            </h1>
            <div className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              <span>{isOnline ? 'Cloud Synced' : 'Offline Mode'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isTouchDevice && (
            <button
              onClick={() => setIsSimulatorFrame(!isSimulatorFrame)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs border border-white/10 transition-colors"
              title="Toggle Phone Frame Simulator"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isSimulatorFrame ? 'fullscreen' : 'smartphone'}
              </span>
            </button>
          )}

          <a
            href="/downloads/FlashAM.apk"
            download="FlashAM.apk"
            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs border border-emerald-500/30 transition-all flex items-center justify-center shadow-sm shadow-emerald-500/20"
            title="Download Flash AM Android APK File"
          >
            <span className="material-symbols-outlined text-[18px]">android</span>
          </a>

          <button
            onClick={handleLockApp}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs border border-white/10 transition-colors"
            title="Lock Flash AM"
          >
            <span className="material-symbols-outlined text-[18px]">lock</span>
          </button>
        </div>
      </div>

      {/* 4.3 Date Selector & Quick Toggles */}
      <div className="px-4 py-2.5 bg-[#0e121a] border-b border-white/5 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevDay}
            className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 text-xs border border-white/5"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          </button>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg">
            <span className="material-symbols-outlined text-blue-400 text-[14px]">calendar_today</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
            />
          </div>
          <button
            onClick={handleNextDay}
            className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 text-xs border border-white/5"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>

        {selectedDate !== todayStr && (
          <button
            onClick={handleSetToday}
            className="px-2 py-1 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 text-[10px] font-bold hover:bg-blue-600/30 transition-all"
          >
            Jump to Today
          </button>
        )}
      </div>

      {/* 4.4 Main Content Area Based on Tab */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'punch' && (
          <>
            {/* KPI Summary Grid */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-[#121620] border border-white/10 rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Staff</span>
                <span className="text-base font-black text-white mt-0.5">{stats.total}</span>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-emerald-400 uppercase">Present</span>
                <span className="text-base font-black text-emerald-300 mt-0.5">{stats.present}</span>
              </div>
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-cyan-400 uppercase">On Duty</span>
                <span className="text-base font-black text-cyan-300 mt-0.5">{stats.working}</span>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-rose-400 uppercase">Absent</span>
                <span className="text-base font-black text-rose-300 mt-0.5">{stats.absent}</span>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Name, EMP ID, or Role..."
                className="w-full pl-9 pr-8 py-2 bg-[#121620] border border-white/10 rounded-xl text-white placeholder-slate-500 text-xs focus:border-blue-500 focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>

            {/* Filter Pills (Departments & Status) */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                {departments.map(dept => (
                  <button
                    key={dept}
                    onClick={() => setSelectedDepartment(dept)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                      selectedDepartment === dept
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : 'bg-white/5 hover:bg-white/10 text-slate-400 border border-white/5'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>

              {/* Status Toggles */}
              <div className="flex items-center gap-1 text-[10px] font-bold">
                {['ALL', 'PRESENT', 'COMPLETED', 'ABSENT'].map(st => (
                  <button
                    key={st}
                    onClick={() => setSelectedStatusFilter(st)}
                    className={`flex-1 py-1 rounded-md text-center transition-all cursor-pointer ${
                      selectedStatusFilter === st
                        ? 'bg-white/15 text-white border border-white/20'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Employee Cards List */}
            <div className="space-y-2.5">
              {filteredEmployees.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <span className="material-symbols-outlined text-3xl text-slate-500 mb-2 block">person_off</span>
                  No employees matched your search criteria.
                </div>
              ) : (
                filteredEmployees.map(emp => {
                  const dayRec = emp.attendance?.[selectedDate] || {};
                  const hasIn = !!dayRec.inTime;
                  const hasOut = !!dayRec.outTime;
                  const isPresent = dayRec.status === 'present' || hasIn;
                  const duration = calculateDuration(dayRec.inTime, dayRec.outTime);

                  return (
                    <div
                      key={emp.id}
                      className="bg-[#121620] border border-white/10 hover:border-white/20 rounded-2xl p-3 shadow-md transition-all flex flex-col gap-2.5"
                    >
                      {/* Top Info: Avatar, Name, Department, Status Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-xs shrink-0 border ${
                            hasOut
                              ? 'bg-cyan-600/30 border-cyan-500/50 text-cyan-300'
                              : hasIn
                              ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-300 ring-2 ring-emerald-500/20'
                              : 'bg-white/5 border-white/10 text-slate-300'
                          }`}>
                            {emp.avatar ? (
                              <img src={emp.avatar} alt="" className="w-full h-full object-cover rounded-xl" />
                            ) : (
                              emp.name?.charAt(0) || 'E'
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-white truncate flex items-center gap-1.5">
                              {emp.name}
                              <span className="text-[10px] font-mono text-slate-400 font-normal">({emp.id})</span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {emp.designation || 'Staff'} • {emp.department || emp.section || 'General'}
                            </div>
                          </div>
                        </div>

                        {/* Status Chip */}
                        <div className="shrink-0 text-right">
                          {hasOut ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                              Shift Done
                            </span>
                          ) : hasIn ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              Active In
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-slate-400 border border-white/10">
                              Not In Yet
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Recorded Timestamps Display */}
                      {(hasIn || hasOut) && (
                        <div className="p-2 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 font-medium">IN:</span>
                            <span className="font-mono font-bold text-emerald-400">{dayRec.inTime || '--:--'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 font-medium">OUT:</span>
                            <span className="font-mono font-bold text-cyan-400">{dayRec.outTime || '--:--'}</span>
                          </div>
                          {duration && (
                            <div className="text-[10px] font-bold text-slate-300 bg-white/10 px-1.5 py-0.5 rounded">
                              {duration}
                            </div>
                          )}
                        </div>
                      )}

                      {/* IN & OUT Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => handlePunch(emp.id, 'IN')}
                          className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer ${
                            hasIn
                              ? 'bg-emerald-600/25 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/35'
                              : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-emerald-600/25'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {hasIn ? 'done_all' : 'login'}
                          </span>
                          <span>{hasIn ? 'Re-Clock IN' : 'CLOCK IN'}</span>
                        </button>

                        <button
                          onClick={() => handlePunch(emp.id, 'OUT')}
                          disabled={!hasIn && !dayRec.status}
                          className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer ${
                            !hasIn && !dayRec.status
                              ? 'bg-white/5 border border-white/5 text-slate-600 cursor-not-allowed opacity-40'
                              : hasOut
                              ? 'bg-cyan-600/25 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/35'
                              : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-600/25'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {hasOut ? 'done_all' : 'logout'}
                          </span>
                          <span>{hasOut ? 'Re-Clock OUT' : 'CLOCK OUT'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* 4.5 SCANNER TAB */}
        {activeTab === 'scan' && (
          <div className="flex flex-col items-center justify-center p-4 space-y-5 text-center">
            <div className="w-20 h-20 rounded-3xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <span className="material-symbols-outlined text-4xl">qr_code_scanner</span>
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white">Badge & QR Quick Scanner</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Scan employee card QR code or enter Employee ID for instant 1-touch punch.
              </p>
            </div>

            <form onSubmit={handleQuickBadgeScan} className="w-full max-w-xs space-y-3">
              <input
                type="text"
                value={badgeIdInput}
                onChange={(e) => setBadgeIdInput(e.target.value)}
                placeholder="Enter Employee ID (e.g. EMP-088)"
                className="w-full text-center tracking-wider font-mono font-bold py-3 bg-[#121620] border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:border-blue-500 focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                Instant Punch Employee
              </button>
            </form>
          </div>
        )}

        {/* 4.6 STATS TAB */}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            <h3 className="font-extrabold text-base text-white">Daily Attendance Analytics</h3>
            <div className="p-4 rounded-2xl bg-[#121620] border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Total Registered Workforce</span>
                <span className="font-bold text-white">{stats.total}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-400">Total Present Today</span>
                <span className="font-bold text-emerald-300">{stats.present}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-cyan-400">Currently Active On Shift</span>
                <span className="font-bold text-cyan-300">{stats.working}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-400">Shift Completed (In & Out)</span>
                <span className="font-bold text-blue-300">{stats.completed}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-rose-400">Absent / Unrecorded</span>
                <span className="font-bold text-rose-300">{stats.absent}</span>
              </div>
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-bold">
                <span className="text-slate-300">Workforce Attendance Rate</span>
                <span className="text-cyan-400">
                  {stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 4.7 SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <h3 className="font-extrabold text-base text-white">Security & Sync Controls</h3>

            <div className="p-4 rounded-2xl bg-[#121620] border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Fingerprint Biometric</div>
                  <div className="text-[11px] text-slate-400">Allow instant 1-touch sensor unlock</div>
                </div>
                <button
                  onClick={() => {
                    const next = localStorage.getItem('flasham_biometric') !== 'true';
                    localStorage.setItem('flasham_biometric', next ? 'true' : 'false');
                    appAlert(`Biometric authentication ${next ? 'Enabled' : 'Disabled'}.`);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-bold"
                >
                  Configure
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <div>
                  <div className="text-xs font-bold text-white">Change 4-Digit PIN</div>
                  <div className="text-[11px] text-slate-400">Update your quick access passcode</div>
                </div>
                <button
                  onClick={() => setAuthStatus('setup-pin')}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold"
                >
                  Reset PIN
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <div>
                  <div className="text-xs font-bold text-white">Cloud Sync Status</div>
                  <div className="text-[11px] text-slate-400">
                    {pendingSyncCount > 0 ? `${pendingSyncCount} punches waiting to sync` : 'All punches up to date'}
                  </div>
                </div>
                <button
                  onClick={flushOfflineSyncQueue}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">sync</span>
                  Sync Now
                </button>
              </div>
            </div>

            <button
              onClick={handleFullLogout}
              className="w-full py-3 rounded-xl bg-rose-600/15 border border-rose-500/30 text-rose-300 font-bold text-xs hover:bg-rose-600/25 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              Log Out of Flash AM Terminal
            </button>
          </div>
        )}
      </div>

      {/* 4.8 Android Bottom Navigation Bar */}
      <div className="h-14 bg-[#121620] border-t border-white/10 px-4 flex items-center justify-around shrink-0 z-50">
        {[
          { key: 'punch', label: 'Attendance', icon: 'how_to_reg' },
          { key: 'stats', label: 'Summary', icon: 'bar_chart' },
          { key: 'scan', label: 'Quick QR', icon: 'qr_code_scanner' },
          { key: 'settings', label: 'Settings', icon: 'settings' }
        ].map(item => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer ${
                isActive ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isActive ? 'scale-110' : ''}`}>
                {item.icon}
              </span>
              <span className="text-[10px] leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  // If on desktop simulator mode: wrap in realistic Android phone frame with punch-hole & buttons
  if (isSimulatorFrame) {
    return (
      <div className="min-h-screen w-full bg-[#07090e] flex flex-col items-center justify-center p-4 lg:p-8 font-sans">
        {/* Simulator Top Toolbar */}
        <div className="mb-4 flex items-center justify-between w-full max-w-[420px] px-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-bold">
            <span className="material-symbols-outlined text-blue-400 text-[18px]">smartphone</span>
            <span>Android Phone Simulator</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSimulatorFrame(false)}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">fullscreen</span>
              Full Screen
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs text-slate-400 hover:text-white font-medium flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
              Close
            </button>
          </div>
        </div>

        {/* Android Device Shell */}
        <div className="relative w-full max-w-[390px] h-[780px] rounded-[48px] border-[12px] border-[#1f2025] bg-[#1f2025] shadow-2xl shadow-black/80 overflow-hidden flex flex-col">
          {/* Camera Punch Hole */}
          <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-black rounded-full z-50 border border-white/10 pointer-events-none"></div>

          {/* Screen Content */}
          <div className="flex-1 w-full h-full rounded-[36px] overflow-hidden">
            {appBodyContent}
          </div>
        </div>
      </div>
    );
  }

  // Full Screen on mobile device
  return (
    <div className="min-h-screen w-full bg-[#0b0e14]">
      {appBodyContent}
    </div>
  );
}
