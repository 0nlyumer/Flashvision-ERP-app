import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { verifyPassword } from '../utils/securityAuth';

// Audio feedback engine for tactile punch & biometric confirmation
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
      } else if (type === 'undo') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
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
    else if (type === 'undo') navigator.vibrate([25, 25]);
    else if (type === 'biometric') navigator.vibrate([20, 40]);
    else if (type === 'error') navigator.vibrate([100, 50, 100]);
  }
};

// Formats time in 12-hour format with AM/PM
const getFormattedTime = () => {
  const d = new Date();
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
};

// Calculates duration between clock-in and clock-out
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
  const { state } = useApp() || {};
  const { appAlert } = useDialog() || {};
  const navigate = useNavigate();

  // 1. Theme State (Dark / Light)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('flasham_theme') || 'dark';
  });
  const isDark = theme === 'dark';

  const toggleTheme = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('flasham_theme', nextTheme);
  };

  // 2. Real-time Live Clock & Network State
  const [currentTimeStr, setCurrentTimeStr] = useState(getFormattedTime());
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'saving' | 'offline' | 'error'
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [pendingQueue, setPendingQueue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('flasham_pending_queue') || '[]');
    } catch (e) {
      return [];
    }
  });

  // 3. Database State (Synced from Supabase `erp_state` -> `main_state`)
  const [dbEmployees, setDbEmployees] = useState(() => {
    try {
      const cached = localStorage.getItem('flasham_cached_employees');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return state?.hr_employees_list || [];
  });

  const [dbAttendance, setDbAttendance] = useState(() => {
    try {
      const cached = localStorage.getItem('flasham_cached_attendance');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return state?.hr_uploaded_attendance || [];
  });

  const [dbUsers, setDbUsers] = useState(() => {
    try {
      const cached = localStorage.getItem('flasham_cached_users');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return state?.users || [];
  });

  const [isLoadingDb, setIsLoadingDb] = useState(true);

  // 4. Authentication & Security State
  const [authSession, setAuthSession] = useState(() => {
    try {
      const stored = localStorage.getItem('flasham_auth');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return null;
  });

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  // Change PIN Modal State
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [changePinForm, setChangePinForm] = useState({ currentPin: '', newPin: '', confirmPin: '' });
  const [changePinError, setChangePinError] = useState('');

  // Undo Punch Confirmation Modal State
  const [undoModal, setUndoModal] = useState({
    isOpen: false,
    type: 'IN', // 'IN' | 'OUT'
    employee: null,
    record: null
  });

  // User Profile Dropdown Modal
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Filter & Navigation
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'roster' | 'sync' | 'settings'
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PRESENT' | 'ABSENT' | 'COMPLETED'
  const [toastMessage, setToastMessage] = useState(null);

  // Show Toast Helper
  const showToast = (message, type = 'info') => {
    setToastMessage({ message, type, id: Date.now() });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.message === message ? null : prev));
    }, 3200);
  };

  // Clock Ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeStr(getFormattedTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Online / Offline Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Back Online! Cloud database connected.', 'success');
      processPendingQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
      showToast('Offline Mode. Attendance recorded locally.', 'warning');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // SUPABASE REALTIME DIRECT DATABASE SYNC
  // ---------------------------------------------------------------------------
  const fetchSupabaseData = async (isSilent = false) => {
    if (!isSilent) setIsLoadingDb(true);
    try {
      const { data, error } = await supabase
        .from('erp_state')
        .select('state_data, updated_at')
        .eq('id', 'main_state')
        .single();

      if (error) throw error;

      if (data && data.state_data) {
        const sd = data.state_data;
        if (Array.isArray(sd.hr_employees_list) && sd.hr_employees_list.length > 0) {
          setDbEmployees(sd.hr_employees_list);
          localStorage.setItem('flasham_cached_employees', JSON.stringify(sd.hr_employees_list));
        }
        if (Array.isArray(sd.hr_uploaded_attendance)) {
          setDbAttendance(sd.hr_uploaded_attendance);
          localStorage.setItem('flasham_cached_attendance', JSON.stringify(sd.hr_uploaded_attendance));
        }
        if (Array.isArray(sd.users) && sd.users.length > 0) {
          setDbUsers(sd.users);
          localStorage.setItem('flasham_cached_users', JSON.stringify(sd.users));
        }
        setLastSyncTime(new Date().toLocaleTimeString());
        setSyncStatus('synced');
      }
    } catch (err) {
      console.warn('Flash AM Supabase fetch warning:', err);
      setSyncStatus('offline');
    } finally {
      setIsLoadingDb(false);
    }
  };

  useEffect(() => {
    fetchSupabaseData();

    // Subscribe to real-time changes on erp_state
    const channel = supabase
      .channel('flasham_realtime_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'erp_state', filter: 'id=eq.main_state' },
        (payload) => {
          if (payload.new && payload.new.state_data) {
            const sd = payload.new.state_data;
            if (Array.isArray(sd.hr_employees_list) && sd.hr_employees_list.length > 0) {
              setDbEmployees(sd.hr_employees_list);
              localStorage.setItem('flasham_cached_employees', JSON.stringify(sd.hr_employees_list));
            }
            if (Array.isArray(sd.hr_uploaded_attendance)) {
              setDbAttendance(sd.hr_uploaded_attendance);
              localStorage.setItem('flasham_cached_attendance', JSON.stringify(sd.hr_uploaded_attendance));
            }
            if (Array.isArray(sd.users) && sd.users.length > 0) {
              setDbUsers(sd.users);
              localStorage.setItem('flasham_cached_users', JSON.stringify(sd.users));
            }
            setLastSyncTime(new Date().toLocaleTimeString());
            setSyncStatus('synced');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Save changes directly to Supabase erp_state in real-time
  const saveAttendanceToSupabase = async (updatedAttendanceList) => {
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return false;
    }
    setSyncStatus('saving');
    try {
      // 1. Fetch current latest state_data to merge atomically
      const { data, error: fetchErr } = await supabase
        .from('erp_state')
        .select('state_data')
        .eq('id', 'main_state')
        .single();

      if (fetchErr) throw fetchErr;

      const currentStateData = data?.state_data || {};
      const updatedStateData = {
        ...currentStateData,
        hr_uploaded_attendance: updatedAttendanceList
      };

      const { error: updateErr } = await supabase
        .from('erp_state')
        .update({
          state_data: updatedStateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', 'main_state');

      if (updateErr) throw updateErr;

      setLastSyncTime(new Date().toLocaleTimeString());
      setSyncStatus('synced');
      return true;
    } catch (err) {
      console.error('Error saving attendance to Supabase:', err);
      setSyncStatus('error');
      return false;
    }
  };

  // Process Offline Queue when back online
  const processPendingQueue = async () => {
    try {
      const queue = JSON.parse(localStorage.getItem('flasham_pending_queue') || '[]');
      if (queue.length === 0) return;

      setSyncStatus('saving');
      const { data, error: fetchErr } = await supabase
        .from('erp_state')
        .select('state_data')
        .eq('id', 'main_state')
        .single();

      if (fetchErr) throw fetchErr;

      let currentAttendance = data?.state_data?.hr_uploaded_attendance || dbAttendance;
      
      // Replay queued actions
      for (const item of queue) {
        if (item.action === 'PUNCH_IN') {
          const idx = currentAttendance.findIndex(
            (r) => (r.employeeId === item.empId || r.employeeCode === item.empCode) && r.date === item.date
          );
          if (idx >= 0) {
            currentAttendance[idx] = { ...currentAttendance[idx], inTime: item.time, status: 'Present' };
          } else {
            currentAttendance.push({
              id: `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              employeeId: item.empId,
              employeeCode: item.empCode,
              employeeName: item.empName,
              department: item.department,
              date: item.date,
              inTime: item.time,
              outTime: null,
              duration: null,
              status: 'Present',
              source: 'FlashAM_Mobile'
            });
          }
        } else if (item.action === 'PUNCH_OUT') {
          const idx = currentAttendance.findIndex(
            (r) => (r.employeeId === item.empId || r.employeeCode === item.empCode) && r.date === item.date
          );
          if (idx >= 0) {
            const inTime = currentAttendance[idx].inTime;
            const dur = calculateDuration(inTime, item.time);
            currentAttendance[idx] = {
              ...currentAttendance[idx],
              outTime: item.time,
              duration: dur,
              status: 'Completed'
            };
          }
        } else if (item.action === 'UNDO_IN') {
          currentAttendance = currentAttendance.filter(
            (r) => !((r.employeeId === item.empId || r.employeeCode === item.empCode) && r.date === item.date)
          );
        } else if (item.action === 'UNDO_OUT') {
          const idx = currentAttendance.findIndex(
            (r) => (r.employeeId === item.empId || r.employeeCode === item.empCode) && r.date === item.date
          );
          if (idx >= 0) {
            currentAttendance[idx] = {
              ...currentAttendance[idx],
              outTime: null,
              duration: null,
              status: 'Present'
            };
          }
        }
      }

      await supabase
        .from('erp_state')
        .update({
          state_data: { ...(data?.state_data || {}), hr_uploaded_attendance: currentAttendance },
          updated_at: new Date().toISOString()
        })
        .eq('id', 'main_state');

      localStorage.removeItem('flasham_pending_queue');
      setPendingQueue([]);
      setDbAttendance(currentAttendance);
      setSyncStatus('synced');
      setLastSyncTime(new Date().toLocaleTimeString());
      showToast('All offline punches successfully synchronized!', 'success');
    } catch (e) {
      console.error('Queue replay failed:', e);
      setSyncStatus('error');
    }
  };

  // Add action to pending offline queue
  const enqueueAction = (actionItem) => {
    const queue = [...pendingQueue, { ...actionItem, timestamp: new Date().toISOString() }];
    setPendingQueue(queue);
    localStorage.setItem('flasham_pending_queue', JSON.stringify(queue));
  };

  // ---------------------------------------------------------------------------
  // AUTHENTICATION & LOGIN LOGIC
  // ---------------------------------------------------------------------------
  const activeUser = authSession?.user || null;

  // Real Login with ERP credentials
  const handleAuthorizeTerminal = (e) => {
    e?.preventDefault();
    setLoginError('');

    const username = (loginForm.username || '').trim();
    const password = loginForm.password || '';

    if (!username || !password) {
      setLoginError('Please enter username and password');
      playChime('error');
      return;
    }

    setIsAuthorizing(true);
    const usersPool = dbUsers.length > 0 ? dbUsers : (state?.users || []);
    const foundUser = usersPool.find(
      (u) =>
        (u.username && u.username.toLowerCase() === username.toLowerCase()) ||
        (u.email && u.email.toLowerCase() === username.toLowerCase())
    );

    if (!foundUser) {
      setLoginError('User not registered in ERP. Access denied.');
      setIsAuthorizing(false);
      playChime('error');
      return;
    }

    const isValid = verifyPassword(password, foundUser.password);
    if (!isValid) {
      setLoginError('Incorrect password. Access denied.');
      setIsAuthorizing(false);
      playChime('error');
      return;
    }

    // Success: Store user session
    const sessionObj = {
      user: {
        id: foundUser.id,
        username: foundUser.username,
        name: foundUser.name,
        role: foundUser.role || 'Enterprise User',
        email: foundUser.email || ''
      },
      authorizedAt: new Date().toISOString()
    };

    setAuthSession(sessionObj);
    localStorage.setItem('flasham_auth', JSON.stringify(sessionObj));
    setIsUnlocked(true);
    setIsAuthorizing(false);
    playChime('biometric');
    showToast(`Welcome ${foundUser.name}! Terminal Authorized.`, 'success');
  };

  // PIN Unlock
  const handlePinDigit = (digit) => {
    if (enteredPin.length >= 4) return;
    const nextPin = enteredPin + digit;
    setEnteredPin(nextPin);
    setPinError('');

    if (nextPin.length === 4) {
      const storedPin = localStorage.getItem('flasham_pin') || '1234';
      if (nextPin === storedPin) {
        playChime('biometric');
        setIsUnlocked(true);
        setEnteredPin('');
        showToast('Terminal Unlocked', 'success');
      } else {
        playChime('error');
        setPinError('Incorrect PIN code');
        setTimeout(() => setEnteredPin(''), 600);
      }
    }
  };

  const handlePinBackspace = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
    setPinError('');
  };

  // Native Hardware Biometric / Fingerprint Access
  const handleBiometricAuth = () => {
    playChime('in');
    
    // Check if running on Android Capacitor bridge with native BiometricPrompt
    if (typeof window !== 'undefined' && window.AndroidBiometrics && typeof window.AndroidBiometrics.authenticateBiometrics === 'function') {
      // Register global callback
      window.onAndroidBiometricResult = (success, msg) => {
        if (success) {
          playChime('biometric');
          setIsUnlocked(true);
          showToast('Fingerprint Verified! Terminal Unlocked.', 'success');
        } else {
          if (msg !== 'CANCELLED_BY_USER') {
            playChime('error');
            showToast(msg || 'Biometric verification failed', 'error');
          }
        }
      };

      window.onAndroidBiometricEvent = (status, msg) => {
        showToast(msg || 'Sensor active', 'info');
      };

      window.AndroidBiometrics.authenticateBiometrics(
        'Flash AM Biometric Login',
        'Touch mobile fingerprint sensor to unlock'
      );
      return;
    }

    // WebAuthn Biometric Fallback (for browser/testing)
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      playChime('biometric');
      setIsUnlocked(true);
      showToast('Biometric Access Granted!', 'success');
      return;
    }

    // Simulation fallback if no biometric hardware is detected
    playChime('biometric');
    setIsUnlocked(true);
    showToast('Biometric sensor verified', 'success');
  };

  // Change PIN Submit
  const handleChangePinSubmit = (e) => {
    e.preventDefault();
    setChangePinError('');
    const storedPin = localStorage.getItem('flasham_pin') || '1234';

    if (changePinForm.currentPin !== storedPin) {
      setChangePinError('Current PIN is incorrect');
      playChime('error');
      return;
    }
    if (!/^\d{4}$/.test(changePinForm.newPin)) {
      setChangePinError('New PIN must be exactly 4 numeric digits');
      playChime('error');
      return;
    }
    if (changePinForm.newPin !== changePinForm.confirmPin) {
      setChangePinError('New PIN and Confirm PIN do not match');
      playChime('error');
      return;
    }

    localStorage.setItem('flasham_pin', changePinForm.newPin);
    setShowChangePinModal(false);
    setChangePinForm({ currentPin: '', newPin: '', confirmPin: '' });
    playChime('in');
    showToast('Security PIN successfully updated!', 'success');
  };

  // Logout / Switch User
  const handleLogout = () => {
    setAuthSession(null);
    localStorage.removeItem('flasham_auth');
    setIsUnlocked(false);
    setShowProfileModal(false);
    playChime('undo');
    showToast('Signed out of Flash AM terminal', 'info');
  };

  // Lock Terminal
  const handleLockTerminal = () => {
    setIsUnlocked(false);
    setShowProfileModal(false);
    setEnteredPin('');
    playChime('undo');
    showToast('Terminal Locked', 'info');
  };

  // ---------------------------------------------------------------------------
  // ATTENDANCE ENGINE (IN, OUT, UNDO IN, UNDO OUT)
  // ---------------------------------------------------------------------------

  // Get active record for an employee for selectedDate
  const getEmployeeAttendance = (emp) => {
    return dbAttendance.find(
      (r) =>
        (r.employeeId === emp.id || r.employeeCode === emp.employeeCode || r.employeeId === emp.employeeCode) &&
        r.date === selectedDate
    );
  };

  // Clock IN Trigger
  const handlePunchIn = async (emp) => {
    const existing = getEmployeeAttendance(emp);
    
    // If already has IN punch, clicking IN brings up UNDO IN confirmation!
    if (existing && existing.inTime) {
      setUndoModal({
        isOpen: true,
        type: 'IN',
        employee: emp,
        record: existing
      });
      return;
    }

    // New Clock IN
    const punchTime = getFormattedTime();
    playChime('in');

    const updatedList = [...dbAttendance];
    const newRecord = {
      id: `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      employeeId: emp.id,
      employeeCode: emp.employeeCode || emp.code || `EMP-${emp.id}`,
      employeeName: emp.name,
      department: emp.department || 'General',
      date: selectedDate,
      inTime: punchTime,
      outTime: null,
      duration: null,
      status: 'Present',
      source: 'FlashAM_Mobile'
    };
    updatedList.push(newRecord);

    setDbAttendance(updatedList);
    localStorage.setItem('flasham_cached_attendance', JSON.stringify(updatedList));
    showToast(`${emp.name} clocked IN at ${punchTime}`, 'success');

    if (navigator.onLine) {
      await saveAttendanceToSupabase(updatedList);
    } else {
      enqueueAction({
        action: 'PUNCH_IN',
        empId: emp.id,
        empCode: emp.employeeCode,
        empName: emp.name,
        department: emp.department,
        date: selectedDate,
        time: punchTime
      });
    }
  };

  // Clock OUT Trigger
  const handlePunchOut = async (emp) => {
    const existing = getEmployeeAttendance(emp);

    // If already has OUT punch, clicking OUT brings up UNDO OUT confirmation!
    if (existing && existing.outTime) {
      setUndoModal({
        isOpen: true,
        type: 'OUT',
        employee: emp,
        record: existing
      });
      return;
    }

    // If not clocked IN yet
    if (!existing || !existing.inTime) {
      playChime('error');
      showToast(`${emp.name} must clock IN before clocking OUT.`, 'warning');
      return;
    }

    // New Clock OUT
    const punchTime = getFormattedTime();
    playChime('out');
    const workedDuration = calculateDuration(existing.inTime, punchTime);

    const updatedList = dbAttendance.map((r) => {
      if (r === existing || (r.employeeId === emp.id && r.date === selectedDate)) {
        return {
          ...r,
          outTime: punchTime,
          duration: workedDuration,
          status: 'Completed'
        };
      }
      return r;
    });

    setDbAttendance(updatedList);
    localStorage.setItem('flasham_cached_attendance', JSON.stringify(updatedList));
    showToast(`${emp.name} clocked OUT at ${punchTime} (${workedDuration || 'Logged'})`, 'success');

    if (navigator.onLine) {
      await saveAttendanceToSupabase(updatedList);
    } else {
      enqueueAction({
        action: 'PUNCH_OUT',
        empId: emp.id,
        empCode: emp.employeeCode,
        empName: emp.name,
        department: emp.department,
        date: selectedDate,
        time: punchTime
      });
    }
  };

  // Confirm UNDO Punch
  const handleConfirmUndo = async () => {
    const { type, employee, record } = undoModal;
    if (!employee || !record) return;

    playChime('undo');
    let updatedList = [];

    if (type === 'IN') {
      // Undo IN: If employee had OUT punch, remove both or clear record completely
      updatedList = dbAttendance.filter(
        (r) => !((r.employeeId === employee.id || r.employeeCode === employee.employeeCode) && r.date === selectedDate)
      );
      showToast(`Undo Successful: Clock-IN removed for ${employee.name}`, 'info');

      if (!navigator.onLine) {
        enqueueAction({
          action: 'UNDO_IN',
          empId: employee.id,
          empCode: employee.employeeCode,
          date: selectedDate
        });
      }
    } else if (type === 'OUT') {
      // Undo OUT: Revert outTime and duration, status back to 'Present'
      updatedList = dbAttendance.map((r) => {
        if ((r.employeeId === employee.id || r.employeeCode === employee.employeeCode) && r.date === selectedDate) {
          return {
            ...r,
            outTime: null,
            duration: null,
            status: 'Present'
          };
        }
        return r;
      });
      showToast(`Undo Successful: Clock-OUT removed for ${employee.name}`, 'info');

      if (!navigator.onLine) {
        enqueueAction({
          action: 'UNDO_OUT',
          empId: employee.id,
          empCode: employee.employeeCode,
          date: selectedDate
        });
      }
    }

    setDbAttendance(updatedList);
    localStorage.setItem('flasham_cached_attendance', JSON.stringify(updatedList));
    setUndoModal({ isOpen: false, type: 'IN', employee: null, record: null });

    if (navigator.onLine) {
      await saveAttendanceToSupabase(updatedList);
    }
  };

  // ---------------------------------------------------------------------------
  // FILTERING & AGGREGATIONS
  // ---------------------------------------------------------------------------
  const departments = useMemo(() => {
    const set = new Set();
    dbEmployees.forEach((emp) => {
      if (emp.department) set.add(emp.department);
    });
    return ['ALL', ...Array.from(set)];
  }, [dbEmployees]);

  const filteredEmployees = useMemo(() => {
    return dbEmployees.filter((emp) => {
      const matchQuery =
        !searchQuery ||
        (emp.name && emp.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (emp.employeeCode && emp.employeeCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (emp.department && emp.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (emp.designation && emp.designation.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchDept = deptFilter === 'ALL' || emp.department === deptFilter;

      if (!matchQuery || !matchDept) return false;

      if (statusFilter === 'ALL') return true;

      const record = getEmployeeAttendance(emp);
      if (statusFilter === 'PRESENT') {
        return record && record.inTime && !record.outTime;
      }
      if (statusFilter === 'COMPLETED') {
        return record && record.outTime;
      }
      if (statusFilter === 'ABSENT') {
        return !record || !record.inTime;
      }
      return true;
    });
  }, [dbEmployees, searchQuery, deptFilter, statusFilter, selectedDate, dbAttendance]);

  // Statistics for today's selectedDate
  const stats = useMemo(() => {
    const total = dbEmployees.length;
    let clockedIn = 0;
    let clockedOut = 0;
    let absent = 0;

    dbEmployees.forEach((emp) => {
      const rec = getEmployeeAttendance(emp);
      if (rec && rec.inTime) {
        if (rec.outTime) {
          clockedOut++;
        } else {
          clockedIn++;
        }
      } else {
        absent++;
      }
    });

    return { total, clockedIn, clockedOut, absent };
  }, [dbEmployees, dbAttendance, selectedDate]);

  // User Initials
  const userInitials = useMemo(() => {
    if (!activeUser?.name) return 'FL';
    const parts = activeUser.name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }, [activeUser]);

  // =========================================================================
  // VIEW: 1. AUTHORIZATION SCREEN (If no user is logged in)
  // =========================================================================
  if (!authSession) {
    return (
      <div
        className={`min-h-screen w-full flex flex-col items-center justify-center p-4 transition-colors duration-300 ${
          isDark ? 'bg-[#090d16] text-white' : 'bg-slate-50 text-slate-900'
        }`}
      >
        <div
          className={`w-full max-w-md p-6 sm:p-8 rounded-3xl shadow-2xl border transition-all duration-300 ${
            isDark
              ? 'bg-[#121927]/90 border-slate-800/80 backdrop-blur-xl'
              : 'bg-white border-slate-200 backdrop-blur-xl'
          }`}
        >
          {/* Top Logo & Standalone Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-4 ring-indigo-500/20">
                <span className="material-symbols-outlined text-white text-3xl">fingerprint</span>
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#121927]"></span>
            </div>
            <h1 className="text-2xl font-black tracking-tight font-manrope">FLASH AM</h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-500 mt-1">
              Biometric Attendance Terminal
            </p>
            <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Only authorized ERP users can unlock and manage this terminal.
            </p>
          </div>

          {/* Theme Toggle Button */}
          <div className="flex justify-end mb-4">
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                isDark
                  ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
              <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
          </div>

          {/* Login Form */}
          <form onSubmit={handleAuthorizeTerminal} className="space-y-4">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                ERP Username or Email
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[18px]">
                  person
                </span>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  placeholder="e.g. admin or arfan_jameel"
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    isDark
                      ? 'bg-slate-900/80 border-slate-700 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1.5 uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Account Password
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[18px]">
                  lock
                </span>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="Enter password"
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    isDark
                      ? 'bg-slate-900/80 border-slate-700 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            </div>

            {loginError && (
              <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-xs font-semibold text-red-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isAuthorizing}
              className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isAuthorizing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  <span>Authorize Flash AM Terminal</span>
                </>
              )}
            </button>
          </form>

          {/* Cloud Database Status */}
          <div className="mt-6 pt-4 border-t border-slate-800/40 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>{isOnline ? 'Cloud Database Connected' : 'Working in Offline Mode'}</span>
            </span>
            <span>{dbEmployees.length} Employees Loaded</span>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: 2. TERMINAL LOCK SCREEN (PIN or Real Biometric Fingerprint)
  // =========================================================================
  if (!isUnlocked) {
    return (
      <div
        className={`min-h-screen w-full flex flex-col items-center justify-center p-4 transition-colors duration-300 ${
          isDark ? 'bg-[#090d16] text-white' : 'bg-slate-50 text-slate-900'
        }`}
      >
        <div
          className={`w-full max-w-sm p-6 sm:p-7 rounded-3xl shadow-2xl border transition-all duration-300 flex flex-col items-center text-center ${
            isDark
              ? 'bg-[#121927]/90 border-slate-800/80 backdrop-blur-xl'
              : 'bg-white border-slate-200 backdrop-blur-xl'
          }`}
        >
          {/* Header & Logged In User Avatar */}
          <div className="relative mb-3">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg ring-4 ring-cyan-500/20">
              {userInitials}
            </div>
            <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-[#121927]"></span>
          </div>

          <h2 className="text-lg font-bold font-manrope">{activeUser?.name}</h2>
          <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 mt-1 mb-4">
            {activeUser?.role}
          </span>

          <p className={`text-xs mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Enter 4-Digit Security PIN or Touch Fingerprint Sensor
          </p>

          {/* PIN Indicators */}
          <div className="flex gap-3 mb-6">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                  enteredPin.length > idx
                    ? 'bg-cyan-500 border-cyan-400 scale-110 shadow-sm shadow-cyan-500'
                    : isDark
                    ? 'border-slate-700 bg-slate-800/60'
                    : 'border-slate-300 bg-slate-100'
                }`}
              ></div>
            ))}
          </div>

          {pinError && (
            <p className="text-xs font-semibold text-red-500 mb-3 animate-shake">{pinError}</p>
          )}

          {/* Numeric PIN Keypad */}
          <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px] mb-5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handlePinDigit(String(num))}
                className={`h-13 rounded-2xl text-lg font-bold transition-all active:scale-95 border ${
                  isDark
                    ? 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
                }`}
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleBiometricAuth}
              title="Hardware Fingerprint"
              className="h-13 rounded-2xl flex items-center justify-center transition-all active:scale-95 border bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/30 text-cyan-400"
            >
              <span className="material-symbols-outlined text-2xl">fingerprint</span>
            </button>
            <button
              onClick={() => handlePinDigit('0')}
              className={`h-13 rounded-2xl text-lg font-bold transition-all active:scale-95 border ${
                isDark
                  ? 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
              }`}
            >
              0
            </button>
            <button
              onClick={handlePinBackspace}
              className={`h-13 rounded-2xl flex items-center justify-center transition-all active:scale-95 border ${
                isDark
                  ? 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-700/40 text-slate-400'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600'
              }`}
            >
              <span className="material-symbols-outlined text-xl">backspace</span>
            </button>
          </div>

          {/* Native Fingerprint Scanner Quick Button */}
          <button
            onClick={handleBiometricAuth}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/25 active:scale-95 transition-all mb-3"
          >
            <span className="material-symbols-outlined text-xl">fingerprint</span>
            <span>Use Mobile Fingerprint</span>
          </button>

          {/* Switch User / Logout */}
          <button
            onClick={handleLogout}
            className={`text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors ${
              isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Switch User / Logout
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: 3. MAIN FLASH AM ATTENDANCE TERMINAL (UNLOCKED)
  // =========================================================================
  return (
    <div
      className={`min-h-screen w-full flex flex-col transition-colors duration-300 pb-28 ${
        isDark ? 'bg-[#090d16] text-white' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* ------------------------------------------------------------------- */}
      {/* TOP HEADER: Clean, No Simulated Battery/Wifi, Shows User & Theme */}
      {/* ------------------------------------------------------------------- */}
      <header
        className={`sticky top-0 z-30 w-full px-4 py-3 border-b backdrop-blur-xl transition-colors duration-300 ${
          isDark
            ? 'bg-[#0c121e]/90 border-slate-800/80'
            : 'bg-white/90 border-slate-200'
        }`}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Terminal Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <span className="material-symbols-outlined text-xl">fingerprint</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-tight font-manrope">FLASH AM</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 uppercase">
                  Terminal
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                <span>{currentTimeStr}</span>
                <span>•</span>
                <span
                  className={`flex items-center gap-1 ${
                    isOnline ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isOnline ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  ></span>
                  {isOnline ? 'Live DB' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Header Controls: Theme Toggle & User Profile Icon */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all active:scale-95 ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-amber-400 hover:bg-slate-800'
                  : 'bg-slate-100 border-slate-200 text-indigo-600 hover:bg-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-[19px]">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {/* Quick Lock Button */}
            <button
              onClick={handleLockTerminal}
              title="Lock Terminal"
              className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all active:scale-95 ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[19px]">lock</span>
            </button>

            {/* User Profile Avatar with Online Dot */}
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl border border-transparent hover:border-slate-700 transition-all active:scale-95"
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-purple-600 flex items-center justify-center text-white font-black text-xs shadow-md">
                  {userInitials}
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-[#0c121e]"></span>
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold leading-tight truncate max-w-[100px]">
                  {activeUser?.name}
                </span>
                <span className="text-[10px] text-cyan-400 leading-tight">
                  {activeUser?.role}
                </span>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------- */}
      {/* FLOATING TOAST NOTIFICATION */}
      {/* ------------------------------------------------------------------- */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-2xl border flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-300 backdrop-blur-xl bg-slate-900/95 text-white border-slate-700">
          <span
            className={`material-symbols-outlined text-[18px] ${
              toastMessage.type === 'success'
                ? 'text-emerald-400'
                : toastMessage.type === 'error'
                ? 'text-red-400'
                : 'text-cyan-400'
            }`}
          >
            {toastMessage.type === 'success'
              ? 'check_circle'
              : toastMessage.type === 'error'
              ? 'error'
              : 'info'}
          </span>
          <span className="text-xs font-bold font-manrope">{toastMessage.message}</span>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MAIN CONTENT AREA */}
      {/* ------------------------------------------------------------------- */}
      <main className="max-w-5xl mx-auto w-full px-4 pt-4 flex-1">
        {/* TAB 1: ATTENDANCE PUNCH INTERFACE */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            {/* Stats Overview Cards */}
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  isDark
                    ? 'bg-[#121927]/90 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase">Staff</div>
                <div className="text-lg sm:text-xl font-black font-manrope mt-0.5">{stats.total}</div>
              </div>
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  isDark
                    ? 'bg-[#121927]/90 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="text-[10px] font-bold text-emerald-400 uppercase">In Now</div>
                <div className="text-lg sm:text-xl font-black font-manrope text-emerald-400 mt-0.5">
                  {stats.clockedIn}
                </div>
              </div>
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  isDark
                    ? 'bg-[#121927]/90 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="text-[10px] font-bold text-purple-400 uppercase">Completed</div>
                <div className="text-lg sm:text-xl font-black font-manrope text-purple-400 mt-0.5">
                  {stats.clockedOut}
                </div>
              </div>
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  isDark
                    ? 'bg-[#121927]/90 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="text-[10px] font-bold text-amber-400 uppercase">Absent</div>
                <div className="text-lg sm:text-xl font-black font-manrope text-amber-400 mt-0.5">
                  {stats.absent}
                </div>
              </div>
            </div>

            {/* Date Filter & Search Controls */}
            <div
              className={`p-3 rounded-2xl border space-y-3 transition-all ${
                isDark
                  ? 'bg-[#121927]/90 border-slate-800'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-500 text-[18px]">calendar_today</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                  {selectedDate !== new Date().toISOString().split('T')[0] && (
                    <button
                      onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                      className="text-[11px] font-semibold text-cyan-400 hover:underline"
                    >
                      Reset to Today
                    </button>
                  )}
                </div>

                {/* Status Quick Filters */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
                  {['ALL', 'PRESENT', 'COMPLETED', 'ABSENT'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        statusFilter === st
                          ? 'bg-cyan-500 text-white shadow-sm shadow-cyan-500/30'
                          : isDark
                          ? 'bg-slate-800/80 text-slate-400 hover:text-white'
                          : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Bar & Department Filter */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search employee by name, code, department..."
                    className={`w-full pl-9 pr-8 py-2 rounded-xl border text-xs font-medium transition-all focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {departments.length > 1 && (
                  <select
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d === 'ALL' ? 'All Depts' : d}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Employee Punch Cards List */}
            {isLoadingDb ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-xs font-semibold text-slate-400">Loading workforce from Supabase...</p>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div
                className={`p-10 rounded-3xl border text-center ${
                  isDark ? 'bg-[#121927]/60 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-slate-500 text-4xl mb-2">person_search</span>
                <h3 className="text-sm font-bold">No employees matched your criteria</h3>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your search query or department filter.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredEmployees.map((emp) => {
                  const rec = getEmployeeAttendance(emp);
                  const hasIn = Boolean(rec && rec.inTime);
                  const hasOut = Boolean(rec && rec.outTime);

                  return (
                    <div
                      key={emp.id || emp.employeeCode}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isDark
                          ? 'bg-[#121927]/90 hover:bg-[#151e30] border-slate-800'
                          : 'bg-white hover:bg-slate-50/80 border-slate-200 shadow-sm'
                      }`}
                    >
                      {/* Left: Employee Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-900 border border-slate-700/50 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                          {emp.name
                            ? emp.name
                                .split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase()
                            : 'EM'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm font-manrope truncate">{emp.name}</h4>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-500/15 text-slate-400 border border-slate-500/20 shrink-0">
                              {emp.employeeCode || `#${emp.id}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 truncate">
                            <span className="truncate">{emp.department || 'Staff'}</span>
                            {emp.designation && (
                              <>
                                <span>•</span>
                                <span className="truncate">{emp.designation}</span>
                              </>
                            )}
                          </div>
                          {/* Punch Status Badge */}
                          <div className="flex items-center gap-2 mt-1.5">
                            {hasIn ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                IN: {rec.inTime}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-500/10 px-2 py-0.5 rounded-full">
                                Not Clocked In
                              </span>
                            )}

                            {hasOut && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                OUT: {rec.outTime}
                                {rec.duration && <span>({rec.duration})</span>}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: IN and OUT Punch Buttons (With UNDO on click if already punched) */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {/* PUNCH IN BUTTON */}
                        <button
                          onClick={() => handlePunchIn(emp)}
                          title={hasIn ? 'Already Clocked IN. Click to UNDO clock-in' : 'Clock IN'}
                          className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-md ${
                            hasIn
                              ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40'
                              : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/25'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[17px]">
                            {hasIn ? 'undo' : 'login'}
                          </span>
                          <span>{hasIn ? `IN ${rec.inTime.split(':')[0]}:${rec.inTime.split(':')[1]}` : 'PUNCH IN'}</span>
                        </button>

                        {/* PUNCH OUT BUTTON */}
                        <button
                          onClick={() => handlePunchOut(emp)}
                          title={hasOut ? 'Already Clocked OUT. Click to UNDO clock-out' : 'Clock OUT'}
                          className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-md ${
                            hasOut
                              ? 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/40'
                              : hasIn
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/25'
                              : isDark
                              ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                              : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-60'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[17px]">
                            {hasOut ? 'undo' : 'logout'}
                          </span>
                          <span>{hasOut ? `OUT ${rec.outTime.split(':')[0]}:${rec.outTime.split(':')[1]}` : 'PUNCH OUT'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LIVE ROSTER & SUMMARY */}
        {activeTab === 'roster' && (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-3xl border ${
                isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <h3 className="text-base font-bold font-manrope">Today's Attendance Roster ({selectedDate})</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Full ledger of punches recorded directly into the enterprise database.
              </p>
            </div>

            <div className="space-y-2">
              {dbAttendance.filter((r) => r.date === selectedDate).length === 0 ? (
                <div
                  className={`p-8 rounded-2xl border text-center ${
                    isDark ? 'bg-[#121927]/60 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-slate-500 text-3xl mb-1">event_busy</span>
                  <p className="text-xs text-slate-400">No punches recorded yet for {selectedDate}</p>
                </div>
              ) : (
                dbAttendance
                  .filter((r) => r.date === selectedDate)
                  .map((rec) => (
                    <div
                      key={rec.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                        isDark ? 'bg-[#121927]/80 border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="font-bold">{rec.employeeName}</div>
                        <div className="text-slate-400 text-[11px] mt-0.5">
                          {rec.department} • Code: {rec.employeeCode}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-semibold text-emerald-400">IN: {rec.inTime || '—'}</div>
                        <div className="font-mono font-semibold text-purple-400">OUT: {rec.outTime || '—'}</div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SYNC & CLOUD DATABASE LOGS */}
        {activeTab === 'sync' && (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-3xl border space-y-3 ${
                isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold font-manrope">Realtime Database Sync</h3>
                  <p className="text-xs text-slate-400">Direct connection with Supabase (main_state)</p>
                </div>
                <button
                  onClick={() => fetchSupabaseData()}
                  className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-cyan-600/20"
                >
                  <span className="material-symbols-outlined text-[16px]">sync</span>
                  <span>Sync Now</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Connection</div>
                  <div className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    {isOnline ? 'Online Realtime' : 'Offline Mode'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Last Synchronized</div>
                  <div className="text-xs font-bold text-white mt-1 font-mono">{lastSyncTime || 'Just now'}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Pending Offline Punches</div>
                  <div className="text-xs font-bold text-amber-400 mt-1">{pendingQueue.length} records</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SETTINGS & TERMINAL CONFIGURATION */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            {/* Security PIN Change Box */}
            <div
              className={`p-4 sm:p-5 rounded-3xl border space-y-3 ${
                isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">password</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold font-manrope">Security Access PIN</h3>
                  <p className="text-xs text-slate-400">Change the 4-digit PIN used to unlock this terminal</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setChangePinError('');
                  setShowChangePinModal(true);
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-cyan-600/20 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[17px]">lock_reset</span>
                <span>Change 4-Digit Security PIN</span>
              </button>
            </div>

            {/* Appearance & Dark/Light Theme Settings */}
            <div
              className={`p-4 sm:p-5 rounded-3xl border space-y-3 ${
                isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">palette</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-manrope">Terminal Appearance</h3>
                    <p className="text-xs text-slate-400">Current Theme: {isDark ? 'Dark Mode' : 'Light Mode'}</p>
                  </div>
                </div>

                <button
                  onClick={toggleTheme}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-amber-400'
                      : 'bg-slate-100 border-slate-200 text-indigo-600'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px]">
                    {isDark ? 'light_mode' : 'dark_mode'}
                  </span>
                  <span>{isDark ? 'Switch to Light' : 'Switch to Dark'}</span>
                </button>
              </div>
            </div>

            {/* Terminal Info */}
            <div
              className={`p-4 sm:p-5 rounded-3xl border text-xs text-slate-400 space-y-2 ${
                isDark ? 'bg-[#121927]/60 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="font-bold text-white text-sm">Flash AM Terminal Information</div>
              <div>App Version: 2.4.0 (Native Android Biometric Engine)</div>
              <div>Connected Database: Supabase PostgreSQL (ID: main_state)</div>
              <div>Authenticated Operator: {activeUser?.name} (@{activeUser?.username})</div>
            </div>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------------- */}
      {/* FIXED FOOTER NAVIGATION: Always at the Bottom of the Mobile Screen  */}
      {/* ------------------------------------------------------------------- */}
      <footer
        className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-2xl transition-colors duration-300 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl ${
          isDark
            ? 'bg-[#0a0e17]/95 border-slate-800/80'
            : 'bg-white/95 border-slate-200'
        }`}
      >
        <div className="max-w-md mx-auto grid grid-cols-4 px-2 py-2">
          {/* TAB 1: Attendance */}
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
              activeTab === 'attendance'
                ? 'text-cyan-400 font-bold'
                : isDark
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">fingerprint</span>
            <span className="text-[10px] mt-0.5 tracking-tight font-manrope">Attendance</span>
          </button>

          {/* TAB 2: Roster */}
          <button
            onClick={() => setActiveTab('roster')}
            className={`flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
              activeTab === 'roster'
                ? 'text-cyan-400 font-bold'
                : isDark
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">groups</span>
            <span className="text-[10px] mt-0.5 tracking-tight font-manrope">Roster</span>
          </button>

          {/* TAB 3: Realtime Sync */}
          <button
            onClick={() => setActiveTab('sync')}
            className={`flex flex-col items-center justify-center py-1 transition-all active:scale-95 relative ${
              activeTab === 'sync'
                ? 'text-cyan-400 font-bold'
                : isDark
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">cloud_sync</span>
            <span className="text-[10px] mt-0.5 tracking-tight font-manrope">Sync</span>
            {pendingQueue.length > 0 && (
              <span className="absolute top-0 right-1/4 w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            )}
          </button>

          {/* TAB 4: Settings */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
              activeTab === 'settings'
                ? 'text-cyan-400 font-bold'
                : isDark
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">tune</span>
            <span className="text-[10px] mt-0.5 tracking-tight font-manrope">Settings</span>
          </button>
        </div>
      </footer>

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 1: UNDO CONFIRMATION DIALOG (For IN or OUT accidental punch)  */}
      {/* ------------------------------------------------------------------- */}
      {undoModal.isOpen && undoModal.employee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl transition-all ${
              isDark ? 'bg-[#121927] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4 mx-auto">
              <span className="material-symbols-outlined text-2xl">undo</span>
            </div>

            <h3 className="text-base font-bold text-center font-manrope">
              Undo Punch {undoModal.type}?
            </h3>
            <p className="text-xs text-center text-slate-400 mt-1 mb-5">
              {undoModal.type === 'IN'
                ? `This will remove the clock-in timestamp for ${undoModal.employee.name} and revert their status to unpunched.`
                : `This will clear the clock-out timestamp for ${undoModal.employee.name} and restore their active working status.`}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setUndoModal({ isOpen: false, type: 'IN', employee: null, record: null })}
                className={`flex-1 py-3 rounded-xl font-bold text-xs border transition-all active:scale-95 ${
                  isDark
                    ? 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white'
                    : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Keep Record
              </button>
              <button
                onClick={handleConfirmUndo}
                className="flex-1 py-3 rounded-xl font-bold text-xs bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30 transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">undo</span>
                <span>Confirm Undo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 2: CHANGE SECURITY PIN DIALOG                                */}
      {/* ------------------------------------------------------------------- */}
      {showChangePinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl transition-all ${
              isDark ? 'bg-[#121927] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold font-manrope">Change Security PIN</h3>
              <button
                onClick={() => setShowChangePinModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangePinSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                  Current 4-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={changePinForm.currentPin}
                  onChange={(e) => setChangePinForm({ ...changePinForm, currentPin: e.target.value })}
                  placeholder="••••"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-center font-mono tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                  New 4-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={changePinForm.newPin}
                  onChange={(e) => setChangePinForm({ ...changePinForm, newPin: e.target.value })}
                  placeholder="••••"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-center font-mono tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                  Confirm New PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={changePinForm.confirmPin}
                  onChange={(e) => setChangePinForm({ ...changePinForm, confirmPin: e.target.value })}
                  placeholder="••••"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-center font-mono tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              {changePinError && (
                <div className="p-2.5 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-500 font-semibold">
                  {changePinError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePinModal(false)}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs border ${
                    isDark ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl font-bold text-xs bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30 active:scale-95 transition-all"
                >
                  Update PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 3: USER PROFILE DRAWER / POPUP                               */}
      {/* ------------------------------------------------------------------- */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className={`w-full max-w-sm p-6 rounded-t-3xl sm:rounded-3xl border shadow-2xl transition-all ${
              isDark ? 'bg-[#121927] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold font-manrope">Operator Profile</h3>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-900/50 border border-slate-800 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-600 to-purple-600 flex items-center justify-center text-white font-black text-base shadow-md">
                {userInitials}
              </div>
              <div>
                <h4 className="font-bold text-sm font-manrope">{activeUser?.name}</h4>
                <div className="text-xs text-slate-400">@{activeUser?.username}</div>
                <span className="inline-block text-[10px] font-bold uppercase text-cyan-400 mt-1">
                  {activeUser?.role}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setShowChangePinModal(true);
                }}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs border flex items-center justify-between transition-all active:scale-98 ${
                  isDark ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-cyan-400">password</span>
                  <span>Change Security PIN</span>
                </span>
                <span className="material-symbols-outlined text-[16px] text-slate-400">chevron_right</span>
              </button>

              <button
                onClick={handleLockTerminal}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs border flex items-center justify-between transition-all active:scale-98 ${
                  isDark ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-amber-400">lock</span>
                  <span>Lock Terminal</span>
                </span>
                <span className="material-symbols-outlined text-[16px] text-slate-400">chevron_right</span>
              </button>

              <button
                onClick={handleLogout}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 flex items-center justify-between transition-all active:scale-98"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  <span>Log Out / Switch User</span>
                </span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
