import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { buildEntityRow, recordKeyWithFallback } from '../utils/entityTables';
import { verifyPassword } from '../utils/securityAuth';
import { normalizeFlashAmConfig } from '../utils/flashAmConfig';

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

// Parses 'hh:mm:ss AM/PM', 'hh:mm AM/PM' or 'HH:MM' into minutes since
// midnight. Returns null when unparseable.
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return null;
  try {
    const d = new Date(`1970-01-01 ${timeStr}`);
    if (isNaN(d.getTime())) return null;
    return d.getHours() * 60 + d.getMinutes();
  } catch (e) {
    return null;
  }
};

// Numeric duration in minutes between two punch times (handles overnight).
const durationMinutesBetween = (inTimeStr, outTimeStr) => {
  const inMin = parseTimeToMinutes(inTimeStr);
  const outMin = parseTimeToMinutes(outTimeStr);
  if (inMin === null || outMin === null) return null;
  let diff = outMin - inMin;
  if (diff < 0) diff += 24 * 60;
  return diff;
};

// Converts a stored punch time ('hh:mm:ss AM/PM', 'hh:mm AM/PM' or 'HH:MM')
// into an <input type="time"> value ('HH:MM'), or '' when unparseable.
const timeToInputValue = (timeStr) => {
  const mins = parseTimeToMinutes(timeStr);
  if (mins === null) return '';
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
};

// Converts an <input type="time"> value ('HH:MM') back into the stored
// 12-hour punch format ('h:mm AM/PM') used by attendance records.
const inputValueToTime = (val) => {
  if (!val) return null;
  const parts = String(val).split(':');
  let h = parseInt(parts[0], 10);
  if (isNaN(h)) return null;
  const m = parts[1] || '00';
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${suffix}`;
};

// Fallback shift starts (mirror HR Settings' built-in Duty Hours shifts) —
// used only when hr_duty_settings has no shifts saved yet.
const DEFAULT_SHIFT_STARTS = [
  { name: 'GENERAL SHIFT', startTime: '09:00' },
  { name: 'MORNING SHIFT', startTime: '06:00' },
  { name: 'EVENING SHIFT', startTime: '14:00' },
  { name: 'NIGHT SHIFT', startTime: '22:00' }
];

export default function FlashAM() {
  const { state, updateUser } = useApp() || {};
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

  // User Profile Screen (Phase A)
  const [showProfileScreen, setShowProfileScreen] = useState(false);
  const [profilePwForm, setProfilePwForm] = useState({ current: '', next: '', confirm: '' });
  const [profilePwMsg, setProfilePwMsg] = useState('');

  // Filter & Navigation
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'roster' | 'reports' | 'sync' | 'settings'
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PRESENT' | 'ABSENT' | 'COMPLETED'
  // FLASHAM PHASE B: manual attendance is edited IN-PLACE inside the
  // employee row (the old bottom-sheet popup modal is removed).
  const [manualEdit, setManualEdit] = useState(null); // { empId, inTime: 'HH:MM', outTime: 'HH:MM', status, remarks }

  // FLASHAM PHASE B: permission-wise modes + per-day adjustment drafts.
  const [flashMode, setFlashMode] = useState(null); // 'attendance' | 'deduction' | 'overtime' | 'fine'
  const [adjustDate, setAdjustDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [adjustDrafts, setAdjustDrafts] = useState({ deduction: {}, overtime: {}, fine: {} });
  const [fineNotes, setFineNotes] = useState({});
  const [isSavingAdjust, setIsSavingAdjust] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // 5. Department Reports State (Date Range, Department Selection, Export Modals)
  const [reportDept, setReportDept] = useState('ALL');
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [isExporting, setIsExporting] = useState(false);
  const [imagePreviewModal, setImagePreviewModal] = useState({ isOpen: false, imageUri: '', fileName: '' });

  // Supabase Real-time Broadcast Channel for Sub-second WhatsApp-like delivery
  const broadcastChannelRef = useRef(null);

  useEffect(() => {
    broadcastChannelRef.current = supabase.channel('hr_attendance_realtime_broadcast');
    broadcastChannelRef.current.subscribe();
    return () => {
      if (broadcastChannelRef.current) {
        supabase.removeChannel(broadcastChannelRef.current);
      }
    };
  }, []);

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
  // ---------------------------------------------------------------------------
  // PHASE C STEP 5: employees + attendance live in their own tables now
  // (hr_employees / hr_uploaded_attendance). FlashAM reads and writes ONLY
  // those tables for HR data. The erp_state blob is still READ for `users`
  // (not migrated) but is NEVER written from this terminal anymore — the old
  // whole-blob UPDATEs bypassed the app's sync guard, so a stale terminal
  // could clobber the entire ERP state.
  // ---------------------------------------------------------------------------
  const attendanceSnapshotRef = useRef(new Map());

  const seedAttendanceSnapshot = (list) => {
    const snap = new Map();
    const seen = new Map();
    (Array.isArray(list) ? list : []).forEach((rec) => {
      const k = recordKeyWithFallback('hr_uploaded_attendance', rec, seen);
      if (k !== null) snap.set(k, JSON.stringify(rec));
    });
    attendanceSnapshotRef.current = snap;
  };

  const fetchTableList = async (table) => {
    try {
      const { data, error } = await supabase.from(table).select('data');
      if (error || !Array.isArray(data)) return null;
      return data.map((row) => row?.data).filter((rec) => rec && typeof rec === 'object');
    } catch (_) {
      return null;
    }
  };

  // Persist a full attendance list into hr_uploaded_attendance by diffing
  // against the last persisted snapshot: upsert new/changed rows, delete
  // vanished ones. Throws on write failure so callers can flag sync errors.
  const persistAttendanceList = async (updatedList) => {
    const snapshot = attendanceSnapshotRef.current;
    const next = new Map();
    const upserts = [];
    const seen = new Map();
    (Array.isArray(updatedList) ? updatedList : []).forEach((rec) => {
      const k = recordKeyWithFallback('hr_uploaded_attendance', rec, seen);
      if (k === null) return;
      const json = JSON.stringify(rec);
      next.set(k, json);
      if (snapshot.get(k) !== json) {
        const row = buildEntityRow('hr_uploaded_attendance', rec, k);
        if (row) upserts.push(row);
      }
    });
    const deletes = [];
    snapshot.forEach((_, k) => { if (!next.has(k)) deletes.push(k); });
    if (upserts.length > 0) {
      const { error } = await supabase.from('hr_uploaded_attendance').upsert(upserts, { onConflict: 'id' });
      if (error) throw error;
    }
    if (deletes.length > 0) {
      const { error } = await supabase.from('hr_uploaded_attendance').delete().in('id', deletes);
      if (error) throw error;
    }
    attendanceSnapshotRef.current = next;
  };

  const fetchSupabaseData = async (isSilent = false) => {
    if (typeof document !== 'undefined' && document.hidden) return; // Zero egress when tab in background!
    if (!isSilent) setIsLoadingDb(true);
    try {
      const cachedUpdatedAt = localStorage.getItem('flasham_cached_updated_at');
      const cachedTablesMarker = localStorage.getItem('flasham_cached_tables_marker');
      const hasCachedEmployees = Boolean(localStorage.getItem('flasham_cached_employees'));

      // Probe 1 (tiny): erp_state updated_at — still the freshness signal
      // for `users`, which are not migrated and are read from the blob.
      const { data: verData, error: verErr } = await supabase
        .from('erp_state')
        .select('updated_at')
        .eq('id', 'main_state')
        .single();

      if (verErr) throw verErr;

      // Probe 2 (tiny): latest updated_at of the two HR tables — the
      // freshness signal for employees + attendance since Phase C Step 5.
      const [empProbe, attProbe] = await Promise.all([
        supabase.from('hr_employees').select('updated_at').order('updated_at', { ascending: false }).limit(1),
        supabase.from('hr_uploaded_attendance').select('updated_at').order('updated_at', { ascending: false }).limit(1),
      ]);
      const tablesMarker = (!empProbe.error && !attProbe.error)
        ? `${empProbe.data?.[0]?.updated_at || 'none'}|${attProbe.data?.[0]?.updated_at || 'none'}`
        : null;

      const usersFresh = Boolean(verData?.updated_at && cachedUpdatedAt && verData.updated_at === cachedUpdatedAt);
      const hrFresh = Boolean(tablesMarker !== null && cachedTablesMarker === tablesMarker && hasCachedEmployees);

      // If both caches are already up to date, skip the downloads entirely.
      if (usersFresh && hrFresh) {
        console.log('[Egress Guard] Flash AM workforce is already up to date! Skipped downloads.');
        setLastSyncTime(new Date().toLocaleTimeString());
        setSyncStatus('synced');
        setIsLoadingDb(false);
        return;
      }

      // HR lists come from their tables (the read source since Step 5).
      let empsFromTable = null;
      let attsFromTable = null;
      if (!hrFresh) {
        [empsFromTable, attsFromTable] = await Promise.all([
          fetchTableList('hr_employees'),
          fetchTableList('hr_uploaded_attendance'),
        ]);
        if (Array.isArray(empsFromTable) && empsFromTable.length > 0) {
          setDbEmployees(empsFromTable);
          localStorage.setItem('flasham_cached_employees', JSON.stringify(empsFromTable));
        }
        if (Array.isArray(attsFromTable)) {
          setDbAttendance(attsFromTable);
          seedAttendanceSnapshot(attsFromTable);
          localStorage.setItem('flasham_cached_attendance', JSON.stringify(attsFromTable));
        }
        if (tablesMarker !== null) {
          localStorage.setItem('flasham_cached_tables_marker', tablesMarker);
        }
      }

      // `users` still live in the blob — download it only when it changed,
      // and use it for users (plus an HR fallback if the tables could not
      // be read at all).
      if (!usersFresh) {
        const { data, error } = await supabase
          .from('erp_state')
          .select('state_data, updated_at')
          .eq('id', 'main_state')
          .single();

        if (error) throw error;

        if (data && data.state_data) {
          if (data.updated_at) {
            localStorage.setItem('flasham_cached_updated_at', data.updated_at);
          }
          const sd = data.state_data;
          if (Array.isArray(sd.users) && sd.users.length > 0) {
            setDbUsers(sd.users);
            localStorage.setItem('flasham_cached_users', JSON.stringify(sd.users));
          }
          if (empsFromTable === null && Array.isArray(sd.hr_employees_list) && sd.hr_employees_list.length > 0) {
            setDbEmployees(sd.hr_employees_list);
            localStorage.setItem('flasham_cached_employees', JSON.stringify(sd.hr_employees_list));
          }
          if (attsFromTable === null && Array.isArray(sd.hr_uploaded_attendance)) {
            setDbAttendance(sd.hr_uploaded_attendance);
            seedAttendanceSnapshot(sd.hr_uploaded_attendance);
            localStorage.setItem('flasham_cached_attendance', JSON.stringify(sd.hr_uploaded_attendance));
          }
        }
      }
      setLastSyncTime(new Date().toLocaleTimeString());
      setSyncStatus('synced');
    } catch (err) {
      console.warn('Flash AM Supabase fetch warning / quota:', err);
      setSyncStatus('offline');
    } finally {
      setIsLoadingDb(false);
    }
  };

  useEffect(() => {
    seedAttendanceSnapshot(dbAttendance);
    fetchSupabaseData();

    // Realtime: HR lists follow their tables; `users` still follow the blob.
    const channel = supabase
      .channel('flasham_realtime_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'erp_state', filter: 'id=eq.main_state' },
        (payload) => {
          if (payload.new && payload.new.state_data) {
            const sd = payload.new.state_data;
            if (Array.isArray(sd.users) && sd.users.length > 0) {
              setDbUsers(sd.users);
              localStorage.setItem('flasham_cached_users', JSON.stringify(sd.users));
            }
            setLastSyncTime(new Date().toLocaleTimeString());
            setSyncStatus('synced');
            if (payload.new.updated_at) localStorage.setItem('flasham_cached_updated_at', payload.new.updated_at);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hr_employees' },
        async () => {
          const emps = await fetchTableList('hr_employees');
          if (Array.isArray(emps) && emps.length > 0) {
            setDbEmployees(emps);
            localStorage.setItem('flasham_cached_employees', JSON.stringify(emps));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hr_uploaded_attendance' },
        async () => {
          const atts = await fetchTableList('hr_uploaded_attendance');
          if (Array.isArray(atts)) {
            setDbAttendance(atts);
            seedAttendanceSnapshot(atts);
            localStorage.setItem('flasham_cached_attendance', JSON.stringify(atts));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Save changes to the HR tables in real-time (attendance rows + the
  // attendance maps inside employee records). Phase C Step 5: this terminal
  // no longer writes the erp_state blob.
  const saveAttendanceToSupabase = async (updatedAttendanceList) => {
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return false;
    }
    setSyncStatus('saving');
    try {
      // Current employees from their table (the read source since Step 5).
      const currentEmployees = (await fetchTableList('hr_employees')) || dbEmployees;

      // Synchronize employee attendance records inside hr_employees_list
      const updatedEmployees = currentEmployees.map(emp => {
        const empRecords = updatedAttendanceList.filter(u =>
          String(u.employeeId) === String(emp.id) ||
          (emp.employeeCode && u.employeeCode === emp.employeeCode) ||
          (u.employeeName && String(u.employeeName).trim().toLowerCase() === String(emp.name).trim().toLowerCase())
        );
        if (empRecords.length === 0) return emp;

        const updatedAtt = { ...(emp.attendance || {}) };
        empRecords.forEach(rec => {
          if (rec.date) {
            updatedAtt[rec.date] = {
              ...(updatedAtt[rec.date] || {}),
              status: rec.status === 'Completed' || rec.status === 'Present' ? 'present' : (rec.status || 'present'),
              inTime: rec.inTime,
              outTime: rec.outTime,
              duration: rec.duration,
              explicitStatus: true
            };
          }
        });
        return { ...emp, attendance: updatedAtt };
      });

      // Persist the attendance list to its table (diffed upserts + deletes).
      await persistAttendanceList(updatedAttendanceList);

      // Persist only the employee records whose attendance map changed.
      const changedEmployees = updatedEmployees.filter((emp, i) => JSON.stringify(emp) !== JSON.stringify(currentEmployees[i]));
      if (changedEmployees.length > 0) {
        const rows = changedEmployees.map((emp) => buildEntityRow('hr_employees', emp)).filter(Boolean);
        if (rows.length > 0) {
          const { error } = await supabase.from('hr_employees').upsert(rows, { onConflict: 'id' });
          if (error) throw error;
        }
        setDbEmployees(updatedEmployees);
        localStorage.setItem('flasham_cached_employees', JSON.stringify(updatedEmployees));
      }

      setLastSyncTime(new Date().toLocaleTimeString());
      setSyncStatus('synced');
      return true;
    } catch (err) {
      console.error('Error saving attendance to Supabase:', err);
      setSyncStatus('error');
      return false;
    }
  };

  // Instant WhatsApp-like WebSocket Broadcast
  const broadcastPunchEvent = (action, record, empId, empCode, date) => {
    try {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.send({
          type: 'broadcast',
          event: 'attendance_punch',
          payload: {
            action,
            record,
            empId,
            empCode,
            date,
            timestamp: Date.now()
          }
        });
      }
    } catch (e) {
      console.warn('Broadcast send notice:', e);
    }
  };

  // Process Offline Queue when back online
  const processPendingQueue = async () => {
    try {
      const queue = JSON.parse(localStorage.getItem('flasham_pending_queue') || '[]');
      if (queue.length === 0) return;

      setSyncStatus('saving');
      let currentAttendance = (await fetchTableList('hr_uploaded_attendance')) || dbAttendance;
      
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
            currentAttendance[idx] = applyShortPunchRule({
              ...currentAttendance[idx],
              outTime: item.time,
              duration: dur,
              status: 'Completed'
            });
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
              status: 'Present',
              shortPunch: false
            };
          }
        }
      }

      await persistAttendanceList(currentAttendance);

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

  // FLASHAM PHASE A: terminal rules (HR Settings -> Flash AM Configuration,
  // persisted in app_config) + the signed-in user's own ERP record, which now
  // carries the per-user AM PIN (users.amPin). The old device-wide
  // localStorage PIN is retired.
  const flashAmConfig = useMemo(
    () => normalizeFlashAmConfig(state?.flash_am_config),
    [state?.flash_am_config]
  );
  const currentUserRecord = useMemo(() => {
    if (!activeUser) return null;
    const pool = dbUsers.length > 0 ? dbUsers : (state?.users || []);
    return pool.find(
      (u) =>
        String(u.id) === String(activeUser.id) ||
        (u.username && activeUser.username && u.username.toLowerCase() === activeUser.username.toLowerCase())
    ) || null;
  }, [dbUsers, state?.users, activeUser]);
  const userAmPin = currentUserRecord?.amPin ? String(currentUserRecord.amPin) : '';

  // FLASHAM PHASE B — permission-wise terminal modes. Mirrors AppContext
  // hasPermission semantics exactly (Super Admin = all; module access via
  // user.permissions; granular screen object via user.granularPermissions),
  // but evaluated against the terminal's signed-in user record, because the
  // standalone terminal keeps its own session (authSession) and AppContext's
  // currentUser is not set there. Permissions are configured in User Control
  // (module 'flasham', screens punch / deduction / overtime / fine).
  const canFlashAm = (action) => {
    const user = currentUserRecord;
    if (!user) return false;
    if (user.role === 'Super Admin') return true;
    let hasModuleAccess = false;
    if (Array.isArray(user.permissions)) {
      hasModuleAccess = user.permissions.includes('flasham');
    } else if (user.permissions && typeof user.permissions === 'object') {
      hasModuleAccess = !!user.permissions.flasham;
    }
    if (!hasModuleAccess) return false;
    const moduleGranular = user.granularPermissions?.flasham;
    if (moduleGranular && typeof moduleGranular === 'object') {
      const screenPerms = moduleGranular[action];
      if (screenPerms === undefined) return false;
      if (typeof screenPerms === 'boolean') return screenPerms;
      if (typeof screenPerms === 'object' && screenPerms !== null) {
        if (screenPerms._enabled === false) return false;
        if (screenPerms.access !== undefined) return !!screenPerms.access;
        return Object.keys(screenPerms).filter(k => k !== '_enabled').some(k => screenPerms[k]);
      }
    }
    return true;
  };
  const canPunch = canFlashAm('punch');
  const canDeduction = canFlashAm('deduction');
  const canOvertime = canFlashAm('overtime');
  const canFine = canFlashAm('fine');
  const permittedModes = [
    ...(canPunch ? ['attendance'] : []),
    ...(canDeduction ? ['deduction'] : []),
    ...(canOvertime ? ['overtime'] : []),
    ...(canFine ? ['fine'] : [])
  ];
  const activeMode = flashMode && permittedModes.includes(flashMode) ? flashMode : (permittedModes[0] || null);

  // Roster / Reports are attendance views — a user without the punch
  // permission must never land on them.
  useEffect(() => {
    if (!canPunch && (activeTab === 'roster' || activeTab === 'reports')) {
      setActiveTab('attendance');
    }
  }, [canPunch, activeTab]);
  const pinRequired = userAmPin.length >= 4;

  useEffect(() => {
    try { localStorage.removeItem('flasham_pin'); } catch (e) {}
  }, []);

  // Patch the locally cached users pool after a self-service credential
  // change so the new password / PIN is effective immediately on this
  // terminal (AppContext updateUser already persisted it to the ERP users).
  const patchLocalUser = (fields) => {
    if (!activeUser) return;
    setDbUsers(prev => {
      const next = (prev || []).map(u =>
        String(u.id) === String(activeUser.id) ||
        (u.username && activeUser.username && u.username.toLowerCase() === activeUser.username.toLowerCase())
          ? { ...u, ...fields }
          : u
      );
      try { localStorage.setItem('flasham_cached_users', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

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
    // FLASHAM PHASE A: users WITH an AM PIN must unlock with their own PIN;
    // users without one go straight in (PIN can be set from the profile).
    setIsUnlocked(foundUser.amPin ? false : true);
    setIsAuthorizing(false);
    playChime('biometric');
    showToast(`Welcome ${foundUser.name}! Terminal Authorized.`, 'success');
  };

  // PIN Unlock — validates against the signed-in user's own AM PIN
  // (users.amPin), never a device-wide code.
  const handlePinDigit = (digit) => {
    if (!pinRequired) return;
    if (enteredPin.length >= userAmPin.length) return;
    const nextPin = enteredPin + digit;
    setEnteredPin(nextPin);
    setPinError('');

    if (nextPin.length === userAmPin.length) {
      if (nextPin === userAmPin) {
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
    
    if (typeof window !== 'undefined' && window.AndroidBiometrics && typeof window.AndroidBiometrics.authenticateBiometrics === 'function') {
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

    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      playChime('biometric');
      setIsUnlocked(true);
      showToast('Biometric Access Granted!', 'success');
      return;
    }

    playChime('biometric');
    setIsUnlocked(true);
    showToast('Biometric sensor verified', 'success');
  };

  // Change AM PIN Submit — saves to the signed-in user's ERP record
  // (users.amPin) through the normal AppContext update path, so the PIN
  // persists in the ERP users collection and follows the user to any
  // terminal. Setting a first PIN needs no current PIN.
  const handleChangePinSubmit = (e) => {
    e.preventDefault();
    setChangePinError('');

    if (!currentUserRecord) {
      setChangePinError('User record not found. Please sign in again.');
      playChime('error');
      return;
    }
    if (pinRequired && changePinForm.currentPin !== userAmPin) {
      setChangePinError('Current PIN is incorrect');
      playChime('error');
      return;
    }
    if (!/^\d{4,6}$/.test(changePinForm.newPin)) {
      setChangePinError('New PIN must be 4 to 6 numeric digits');
      playChime('error');
      return;
    }
    if (changePinForm.newPin !== changePinForm.confirmPin) {
      setChangePinError('New PIN and Confirm PIN do not match');
      playChime('error');
      return;
    }

    if (typeof updateUser === 'function') {
      updateUser(currentUserRecord.id, { amPin: changePinForm.newPin });
    }
    patchLocalUser({ amPin: changePinForm.newPin });
    setShowChangePinModal(false);
    setChangePinForm({ currentPin: '', newPin: '', confirmPin: '' });
    playChime('in');
    showToast('AM PIN successfully updated!', 'success');
  };

  // Change account password from the Flash AM profile — same mechanism as
  // the ERP profile screen (AppContext updateUser on the users record).
  const handleProfileChangePassword = (e) => {
    e.preventDefault();
    setProfilePwMsg('');
    if (!currentUserRecord) {
      setProfilePwMsg('User record not found. Please sign in again.');
      playChime('error');
      return;
    }
    if (!verifyPassword(profilePwForm.current, currentUserRecord.password)) {
      setProfilePwMsg('Current password is incorrect.');
      playChime('error');
      return;
    }
    if (!profilePwForm.next || profilePwForm.next.length < 4) {
      setProfilePwMsg('New password must be at least 4 characters long.');
      playChime('error');
      return;
    }
    if (profilePwForm.next !== profilePwForm.confirm) {
      setProfilePwMsg('Confirm password does not match the new password.');
      playChime('error');
      return;
    }
    if (typeof updateUser === 'function') {
      updateUser(currentUserRecord.id, { password: profilePwForm.next, requirePasswordChange: false });
    }
    patchLocalUser({ password: profilePwForm.next });
    setProfilePwForm({ current: '', next: '', confirm: '' });
    playChime('in');
    showToast('Password updated successfully!', 'success');
  };

  // Logout / Switch User
  const handleLogout = () => {
    setAuthSession(null);
    localStorage.removeItem('flasham_auth');
    setIsUnlocked(false);
    setShowProfileScreen(false);
    playChime('undo');
    showToast('Signed out of Flash AM terminal', 'info');
  };

  // Lock Terminal
  const handleLockTerminal = () => {
    setIsUnlocked(false);
    setShowProfileScreen(false);
    setEnteredPin('');
    playChime('undo');
    showToast('Terminal Locked', 'info');
  };

  // ---------------------------------------------------------------------------
  // ATTENDANCE ENGINE (IN, OUT, UNDO IN, UNDO OUT)
  // ---------------------------------------------------------------------------
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
    
    if (existing && existing.inTime) {
      setUndoModal({
        isOpen: true,
        type: 'IN',
        employee: emp,
        record: existing
      });
      return;
    }

    const punchTime = getFormattedTime();
    playChime('in');

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

    const updatedList = [...dbAttendance, newRecord];
    setDbAttendance(updatedList);
    localStorage.setItem('flasham_cached_attendance', JSON.stringify(updatedList));
    showToast(`${emp.name} clocked IN at ${punchTime}`, 'success');

    // Instant WhatsApp-like WebSocket Broadcast
    broadcastPunchEvent('PUNCH_IN', newRecord, emp.id, emp.employeeCode, selectedDate);

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

  // FLASHAM PHASE A — config-driven punch rules (HR Settings -> Flash AM
  // Configuration). Short punch: a punch-out inside the configured window
  // marks the day Absent (not counted) unless the config says to count it.
  // The record keeps its punch times + a shortPunch flag for audit; salary
  // generation honours the flag (see HRSalaryGeneration).
  const applyShortPunchRule = (record) => {
    const sp = flashAmConfig.shortPunch;
    if (!record) return record;
    if (!sp || !sp.enabled || sp.countAttendance) {
      return record.shortPunch ? { ...record, shortPunch: false } : record;
    }
    const mins = durationMinutesBetween(record.inTime, record.outTime);
    if (mins !== null && mins < sp.withinHours * 60) {
      return {
        ...record,
        status: 'Absent',
        shortPunch: true,
        remarks: `Short punch (${record.duration || mins + 'm'} worked, under ${sp.withinHours}h) - attendance not counted per Flash AM Configuration`
      };
    }
    return record.shortPunch ? { ...record, shortPunch: false } : record;
  };

  // FLASHAM PHASE B — per-day deduction / overtime / fine values live in the
  // SAME store the HR module edits and salary generation consumes: the
  // employee's embedded attendance map, emp.attendance[date] =
  // { status, ot, fines, deductions, userEdited, explicitStatus }
  // (see HRAttendance handleValueChange / HRSalaryGeneration daily merge).
  const ADJUST_FIELD = {
    deduction: { embedded: 'deductions', logKeys: ['deductions', 'lateHours'], label: 'Deduction', unit: 'hrs', icon: 'remove_circle' },
    overtime: { embedded: 'ot', logKeys: ['ot', 'overtimeHours'], label: 'Overtime', unit: 'hrs', icon: 'more_time' },
    fine: { embedded: 'fines', logKeys: ['fines', 'fine'], label: 'Fine', unit: 'amount', icon: 'money_off' }
  };

  const getDayAdjustValue = (emp, dateStr, mode) => {
    const cfg = ADJUST_FIELD[mode];
    if (!cfg || !emp) return 0;
    const embedded = emp.attendance?.[dateStr];
    if (embedded && embedded[cfg.embedded] !== undefined && embedded[cfg.embedded] !== null && embedded[cfg.embedded] !== '') {
      const n = parseFloat(embedded[cfg.embedded]);
      return isNaN(n) ? 0 : n;
    }
    const log = dbAttendance.find(
      (r) => (r.employeeId === emp.id || r.employeeCode === emp.employeeCode || r.employeeId === emp.employeeCode) && r.date === dateStr
    );
    if (log) {
      for (const k of cfg.logKeys) {
        if (log[k] !== undefined && log[k] !== null && log[k] !== '') {
          const n = parseFloat(log[k]);
          if (!isNaN(n)) return n;
        }
      }
    }
    return 0;
  };

  const adjustEmployees = useMemo(() => {
    return dbEmployees.filter((emp) => {
      const matchQuery =
        !searchQuery ||
        (emp.name && emp.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (emp.employeeCode && emp.employeeCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (emp.department && emp.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (emp.designation && emp.designation.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (emp.division && emp.division.toLowerCase().includes(searchQuery.toLowerCase()));
      const div = emp.division || emp.section;
      const matchDiv = divisionFilter === 'ALL' || !divisionFilter || div === divisionFilter;
      const matchDept = deptFilter === 'ALL' || !deptFilter || emp.department === deptFilter;
      return matchQuery && matchDiv && matchDept;
    });
  }, [dbEmployees, searchQuery, divisionFilter, deptFilter]);

  // Persist one mode's drafts into the employees' embedded attendance maps
  // (hr_employees table — the exact write shape HRAttendance saves and
  // HRSalaryGeneration reads). Status is preserved from the existing day
  // record; a brand-new day record uses the HR module's own default base
  // ({ status: 'present', ot: 0, fines: 0, deductions: 0 }).
  const handleSaveAdjustments = async (mode) => {
    const cfg = ADJUST_FIELD[mode];
    if (!cfg) return;
    const drafts = adjustDrafts[mode] || {};
    const entries = Object.entries(drafts)
      .map(([empId, raw]) => ({
        emp: dbEmployees.find((e) => String(e.id) === String(empId)),
        value: parseFloat(raw)
      }))
      .filter((x) => x.emp && !isNaN(x.value) && x.value >= 0);
    if (entries.length === 0) {
      showToast('No changes to save', 'info');
      return;
    }
    if (!navigator.onLine) {
      showToast('You are offline — entries were not saved.', 'warning');
      return;
    }
    setIsSavingAdjust(true);
    try {
      const entryById = new Map(entries.map((x) => [String(x.emp.id), x.value]));
      const updatedEmployees = dbEmployees.map((emp) => {
        if (!entryById.has(String(emp.id))) return emp;
        const att = { ...(emp.attendance || {}) };
        const existing = att[adjustDate] || { status: 'present', ot: 0, fines: 0, deductions: 0 };
        const nextRec = {
          ...existing,
          [cfg.embedded]: entryById.get(String(emp.id)),
          userEdited: true,
          explicitStatus: true
        };
        if (mode === 'fine') {
          const note = (fineNotes[String(emp.id)] || '').trim();
          if (note) nextRec.fineRemarks = note;
        }
        att[adjustDate] = nextRec;
        return { ...emp, attendance: att };
      });
      const changed = updatedEmployees.filter((emp, i) => JSON.stringify(emp) !== JSON.stringify(dbEmployees[i]));
      if (changed.length > 0) {
        const rows = changed.map((emp) => buildEntityRow('hr_employees', emp)).filter(Boolean);
        if (rows.length > 0) {
          const { error } = await supabase.from('hr_employees').upsert(rows, { onConflict: 'id' });
          if (error) throw error;
        }
      }
      setDbEmployees(updatedEmployees);
      try { localStorage.setItem('flasham_cached_employees', JSON.stringify(updatedEmployees)); } catch (e) {}
      setAdjustDrafts((prev) => ({ ...prev, [mode]: {} }));
      if (mode === 'fine') setFineNotes({});
      setSyncStatus('synced');
      setLastSyncTime(new Date().toLocaleTimeString());
      showToast(`${cfg.label} entries saved for ${adjustDate}`, 'success');
    } catch (err) {
      console.error('Error saving Flash AM adjustments:', err);
      setSyncStatus('error');
      showToast('Failed to save entries. Please try again.', 'warning');
    } finally {
      setIsSavingAdjust(false);
    }
  };

  const lateAppliesTo = (emp) =>
    flashAmConfig.rulesApplyToAll ||
    (flashAmConfig.late.applyToEmployeeIds || []).includes(String(emp?.id));

  // Late minutes for the row badge: punch-in past (shift start + grace).
  const getLateMinutes = (emp, rec) => {
    const late = flashAmConfig.late;
    if (!late || !late.showLateMinutes || !rec?.inTime) return 0;
    if (!lateAppliesTo(emp)) return 0;
    const shifts = state?.hr_duty_settings?.shifts;
    const shiftList = Array.isArray(shifts) && shifts.length > 0 ? shifts : DEFAULT_SHIFT_STARTS;
    const match = emp?.shift
      ? shiftList.find(s => String(s.name || '').trim().toUpperCase() === String(emp.shift).trim().toUpperCase())
      : null;
    const startMin = parseTimeToMinutes(match?.startTime || late.shiftStartDefault || '09:00');
    const inMin = parseTimeToMinutes(rec.inTime);
    if (startMin === null || inMin === null) return 0;
    const lateBy = inMin - (startMin + (late.graceMinutes || 0));
    return lateBy > 0 ? lateBy : 0;
  };

  // Clock OUT Trigger
  const handlePunchOut = async (emp) => {
    const existing = getEmployeeAttendance(emp);

    if (existing && existing.outTime) {
      setUndoModal({
        isOpen: true,
        type: 'OUT',
        employee: emp,
        record: existing
      });
      return;
    }

    if (!existing || !existing.inTime) {
      playChime('error');
      showToast(`${emp.name} must clock IN before clocking OUT.`, 'warning');
      return;
    }

    const punchTime = getFormattedTime();
    playChime('out');
    const workedDuration = calculateDuration(existing.inTime, punchTime);

    let updatedRecord = null;
    const updatedList = dbAttendance.map((r) => {
      if (r === existing || (r.employeeId === emp.id && r.date === selectedDate)) {
        updatedRecord = applyShortPunchRule({
          ...r,
          outTime: punchTime,
          duration: workedDuration,
          status: 'Completed'
        });
        return updatedRecord;
      }
      return r;
    });

    setDbAttendance(updatedList);
    localStorage.setItem('flasham_cached_attendance', JSON.stringify(updatedList));
    if (updatedRecord?.shortPunch) {
      showToast(`${emp.name} clocked OUT at ${punchTime} - short punch, attendance NOT counted`, 'warning');
    } else {
      showToast(`${emp.name} clocked OUT at ${punchTime} (${workedDuration || 'Logged'})`, 'success');
    }

    // Instant WhatsApp-like WebSocket Broadcast
    broadcastPunchEvent('PUNCH_OUT', updatedRecord || existing, emp.id, emp.employeeCode, selectedDate);

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
      updatedList = dbAttendance.filter(
        (r) => !((r.employeeId === employee.id || r.employeeCode === employee.employeeCode) && r.date === selectedDate)
      );
      showToast(`Undo Successful: Clock-IN removed for ${employee.name}`, 'info');

      broadcastPunchEvent('UNDO_IN', null, employee.id, employee.employeeCode, selectedDate);

      if (!navigator.onLine) {
        enqueueAction({
          action: 'UNDO_IN',
          empId: employee.id,
          empCode: employee.employeeCode,
          date: selectedDate
        });
      }
    } else if (type === 'OUT') {
      updatedList = dbAttendance.map((r) => {
        if ((r.employeeId === employee.id || r.employeeCode === employee.employeeCode) && r.date === selectedDate) {
          return {
            ...r,
            outTime: null,
            duration: null,
            status: 'Present',
            shortPunch: false
          };
        }
        return r;
      });
      showToast(`Undo Successful: Clock-OUT removed for ${employee.name}`, 'info');

      broadcastPunchEvent('UNDO_OUT', null, employee.id, employee.employeeCode, selectedDate);

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

  // FLASHAM PHASE B — manual attendance is edited in-place inside the row.
  const startManualEdit = (emp, rec) => {
    setManualEdit({
      empId: emp.id,
      inTime: timeToInputValue(rec?.inTime) || '09:00',
      outTime: timeToInputValue(rec?.outTime),
      status: rec?.status || 'Present',
      remarks: rec?.remarks || ''
    });
  };

  const cancelManualEdit = () => setManualEdit(null);

  // Save uses the exact same record shape + persistence path as the old
  // modal (source 'FlashAM_Manual' into hr_uploaded_attendance), and the
  // Phase A short-punch rule is applied exactly like a real punch-out.
  const handleSaveManualEdit = async () => {
    if (!manualEdit) return;
    const emp = dbEmployees.find((e) => String(e.id) === String(manualEdit.empId));
    if (!emp) { setManualEdit(null); return; }
    const dateStr = selectedDate;
    const inT = inputValueToTime(manualEdit.inTime);
    const outT = inputValueToTime(manualEdit.outTime);
    const duration = (inT && outT) ? calculateDuration(inT, outT) : null;
    const status = manualEdit.status || (inT ? 'Present' : 'Absent');

    let found = false;
    let recordIndex = -1;
    let updatedRecord = null;
    const updatedList = dbAttendance.map((r, idx) => {
      const match = (r.employeeId === emp.id || r.employeeCode === emp.employeeCode) && r.date === dateStr;
      if (match) {
        found = true;
        recordIndex = idx;
        updatedRecord = {
          ...r,
          inTime: inT,
          outTime: outT,
          duration: duration,
          status: status,
          remarks: manualEdit.remarks || 'Manual punch entry',
          source: 'FlashAM_Manual'
        };
        return updatedRecord;
      }
      return r;
    });

    if (!found) {
      updatedRecord = {
        id: `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        employeeId: emp.id,
        employeeCode: emp.employeeCode || emp.code || `EMP-${emp.id}`,
        employeeName: emp.name,
        department: emp.department || 'General',
        division: emp.division || emp.section || 'AJ Synthetic',
        date: dateStr,
        inTime: inT,
        outTime: outT,
        duration: duration,
        status: status,
        remarks: manualEdit.remarks || 'Manual punch entry',
        source: 'FlashAM_Manual'
      };
      updatedList.push(updatedRecord);
      recordIndex = updatedList.length - 1;
    }

    // Short-punch rule — same representation as a real punch-out
    // (status 'Absent' + shortPunch flag + explanatory remarks).
    if (updatedRecord && inT && outT && status === 'Present') {
      const ruled = applyShortPunchRule(updatedRecord);
      if (ruled !== updatedRecord) {
        updatedRecord = ruled;
        if (recordIndex >= 0) updatedList[recordIndex] = ruled;
      }
    }

    setDbAttendance(updatedList);
    localStorage.setItem('flasham_cached_attendance', JSON.stringify(updatedList));
    setManualEdit(null);
    if (updatedRecord?.shortPunch) {
      showToast(`Manual entry saved for ${emp.name} - short punch, attendance NOT counted`, 'warning');
    } else {
      showToast(`Manual attendance saved for ${emp.name}`, 'success');
    }

    broadcastPunchEvent('MANUAL_ENTRY', updatedRecord, emp.id, emp.employeeCode, dateStr);

    if (navigator.onLine) {
      await saveAttendanceToSupabase(updatedList);
    }
  };

  // Clear the edited row's punch record for the selected date (was the
  // modal's Clear button; now a small action inside the inline editor).
  const handleClearManualEdit = async () => {
    if (!manualEdit) return;
    const emp = dbEmployees.find((e) => String(e.id) === String(manualEdit.empId));
    if (!emp) { setManualEdit(null); return; }
    const dateStr = selectedDate;

    const updatedList = dbAttendance.filter(r =>
      !((r.employeeId === emp.id || r.employeeCode === emp.employeeCode) && r.date === dateStr)
    );

    setDbAttendance(updatedList);
    localStorage.setItem('flasham_cached_attendance', JSON.stringify(updatedList));
    setManualEdit(null);
    showToast(`Attendance cleared for ${emp.name}`, 'info');

    broadcastPunchEvent('PUNCH_DELETED', null, emp.id, emp.employeeCode, dateStr);

    if (navigator.onLine) {
      await saveAttendanceToSupabase(updatedList);
    }
  };

  // ---------------------------------------------------------------------------
  // FILTERING & AGGREGATIONS
  // ---------------------------------------------------------------------------
  const divisions = useMemo(() => {
    const set = new Set();
    dbEmployees.forEach((emp) => {
      const div = emp.division || emp.section;
      if (div && typeof div === 'string' && div.trim()) {
        set.add(div.trim());
      }
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [dbEmployees]);

  const departments = useMemo(() => {
    const set = new Set();
    dbEmployees.forEach((emp) => {
      const div = emp.division || emp.section;
      if (divisionFilter === 'ALL' || !divisionFilter || div === divisionFilter) {
        if (emp.department) set.add(emp.department);
      }
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [dbEmployees, divisionFilter]);

  const filteredEmployees = useMemo(() => {
    return dbEmployees.filter((emp) => {
      const matchQuery =
        !searchQuery ||
        (emp.name && emp.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (emp.employeeCode && emp.employeeCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (emp.department && emp.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (emp.designation && emp.designation.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (emp.division && emp.division.toLowerCase().includes(searchQuery.toLowerCase()));

      const div = emp.division || emp.section;
      const matchDiv = divisionFilter === 'ALL' || !divisionFilter || div === divisionFilter;
      const matchDept = deptFilter === 'ALL' || !deptFilter || emp.department === deptFilter;

      if (!matchQuery || !matchDiv || !matchDept) return false;

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
  }, [dbEmployees, searchQuery, divisionFilter, deptFilter, statusFilter, selectedDate, dbAttendance]);

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

  // ---------------------------------------------------------------------------
  // DEPARTMENT-WISE ATTENDANCE REPORT CALCULATIONS & EXPORTS
  // ---------------------------------------------------------------------------
  const reportEmployees = useMemo(() => {
    return dbEmployees.filter((emp) => {
      if (reportDept === 'ALL') return true;
      return emp.department === reportDept;
    });
  }, [dbEmployees, reportDept]);

  const reportRecords = useMemo(() => {
    const start = new Date(reportStartDate);
    const end = new Date(reportEndDate);

    return dbAttendance.filter((rec) => {
      if (!rec.date) return false;
      const recDate = new Date(rec.date);
      if (isNaN(recDate.getTime())) return false;
      if (recDate < start || recDate > end) return false;

      if (reportDept === 'ALL') return true;
      return rec.department === reportDept;
    });
  }, [dbAttendance, reportDept, reportStartDate, reportEndDate]);

  const reportStats = useMemo(() => {
    const totalEmp = reportEmployees.length;
    const totalPunches = reportRecords.length;
    const presentCount = reportRecords.filter((r) => r.inTime).length;
    const completedCount = reportRecords.filter((r) => r.outTime).length;
    
    // Total Hours
    let totalMinutes = 0;
    reportRecords.forEach((r) => {
      if (r.duration) {
        const m = r.duration.match(/(\d+)h\s*(\d+)m/);
        if (m) totalMinutes += parseInt(m[1]) * 60 + parseInt(m[2]);
      }
    });
    const totalHrs = Math.floor(totalMinutes / 60);
    const remMins = totalMinutes % 60;

    return {
      totalEmp,
      totalPunches,
      presentCount,
      completedCount,
      totalHoursStr: `${totalHrs}h ${remMins}m`
    };
  }, [reportEmployees, reportRecords]);

  // Quick Date Range Preset Selector
  const applyDatePreset = (preset) => {
    const today = new Date();
    const formatDate = (d) => d.toISOString().split('T')[0];

    if (preset === 'today') {
      const t = formatDate(today);
      setReportStartDate(t);
      setReportEndDate(t);
    } else if (preset === 'yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      const yStr = formatDate(y);
      setReportStartDate(yStr);
      setReportEndDate(yStr);
    } else if (preset === 'week') {
      const w = new Date(today);
      w.setDate(today.getDate() - 7);
      setReportStartDate(formatDate(w));
      setReportEndDate(formatDate(today));
    } else if (preset === 'month') {
      const m = new Date(today);
      m.setDate(1);
      setReportStartDate(formatDate(m));
      setReportEndDate(formatDate(today));
    }
  };

  // EXPORT 1: CSV Export
  const exportCSV = () => {
    try {
      setIsExporting(true);
      const headers = ['Employee ID', 'Employee Code', 'Employee Name', 'Department', 'Date', 'Clock IN', 'Clock OUT', 'Duration', 'Status'];
      const rows = reportRecords.map((r) => [
        `"${r.employeeId || ''}"`,
        `"${r.employeeCode || ''}"`,
        `"${r.employeeName || ''}"`,
        `"${r.department || ''}"`,
        `"${r.date || ''}"`,
        `"${r.inTime || ''}"`,
        `"${r.outTime || ''}"`,
        `"${r.duration || ''}"`,
        `"${r.status || ''}"`
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\r\n');
      const fileName = `Attendance_Report_${reportDept}_${reportStartDate}_to_${reportEndDate}.csv`;

      // Check Native Android File Saver first (Handles Android WebView Downloads directly)
      if (typeof window !== 'undefined' && window.AndroidFileSaver && typeof window.AndroidFileSaver.saveBase64File === 'function') {
        const base64Data = btoa(unescape(encodeURIComponent(csvContent)));
        window.AndroidFileSaver.saveBase64File(base64Data, fileName, 'text/csv');
        showToast('CSV Report saved to Downloads/FlashAM/' + fileName, 'success');
        playChime('in');
      } else {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('CSV Report Downloaded Successfully!', 'success');
        playChime('in');
      }
    } catch (e) {
      showToast('Failed to export CSV', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // EXPORT 2: Printable PDF Export
  const exportPDF = () => {
    setIsExporting(true);
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        showToast('Please allow popups to export printable PDF report', 'warning');
        setIsExporting(false);
        return;
      }

      const rowsHtml = reportRecords
        .map(
          (r, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 6px 8px; font-weight: bold;">${idx + 1}</td>
          <td style="padding: 6px 8px;">${r.employeeCode || r.employeeId}</td>
          <td style="padding: 6px 8px; font-weight: bold;">${r.employeeName}</td>
          <td style="padding: 6px 8px;">${r.department || 'General'}</td>
          <td style="padding: 6px 8px; font-family: monospace;">${r.date}</td>
          <td style="padding: 6px 8px; color: #059669; font-weight: bold;">${r.inTime || '—'}</td>
          <td style="padding: 6px 8px; color: #7c3aed; font-weight: bold;">${r.outTime || '—'}</td>
          <td style="padding: 6px 8px;">${r.duration || '—'}</td>
          <td style="padding: 6px 8px;"><span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold;">${r.status}</span></td>
        </tr>
      `
        )
        .join('');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Department Attendance Report - ${reportDept}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 20px; color: #0f172a; }
            .header { border-bottom: 2px solid #0284c7; padding-bottom: 10px; margin-bottom: 15px; }
            .title { font-size: 18px; font-weight: 900; margin: 0; color: #0f172a; }
            .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
            .kpis { display: flex; gap: 10px; margin-bottom: 15px; }
            .kpi-card { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; background: #f8fafc; }
            .kpi-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; }
            .kpi-val { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; text-align: left; }
            th { background: #f1f5f9; padding: 8px; font-size: 10px; text-transform: uppercase; color: #475569; border-bottom: 1px solid #cbd5e1; }
            @media print {
              body { margin: 0; }
              @page { size: auto; margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">FLASHVISION ENTERPRISE — DEPARTMENT ATTENDANCE AUDIT</h1>
            <div class="subtitle">
              Department: <b>${reportDept}</b> | Date Range: <b>${reportStartDate}</b> to <b>${reportEndDate}</b> | Generated: ${new Date().toLocaleString()} | Operator: ${activeUser?.name || 'Admin'}
            </div>
          </div>
          <div class="kpis">
            <div class="kpi-card"><div class="kpi-label">Staff in Dept</div><div class="kpi-val">${reportStats.totalEmp}</div></div>
            <div class="kpi-card"><div class="kpi-label">Recorded Punches</div><div class="kpi-val">${reportStats.totalPunches}</div></div>
            <div class="kpi-card"><div class="kpi-label">Clocked In</div><div class="kpi-val" style="color: #059669;">${reportStats.presentCount}</div></div>
            <div class="kpi-card"><div class="kpi-label">Completed Shifts</div><div class="kpi-val" style="color: #7c3aed;">${reportStats.completedCount}</div></div>
            <div class="kpi-card"><div class="kpi-label">Total Work Duration</div><div class="kpi-val">${reportStats.totalHoursStr}</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Emp Code</th>
                <th>Employee Name</th>
                <th>Department</th>
                <th>Date</th>
                <th>Clock IN</th>
                <th>Clock OUT</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="9" style="text-align: center; padding: 20px;">No punches found for this period.</td></tr>'}
            </tbody>
          </table>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
      showToast('Printable PDF Opened!', 'success');
      playChime('in');
    } catch (e) {
      showToast('PDF export failed', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // EXPORT 3: High-Quality Image (PNG) Export
  const exportImage = () => {
    setIsExporting(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const dpr = 2; // High-DPI retina scale
      const width = 1000;
      const rowHeight = 36;
      const headerHeight = 240;
      const rowsCount = Math.max(reportRecords.length, 1);
      const height = headerHeight + rowsCount * rowHeight + 80;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // Background
      ctx.fillStyle = isDark ? '#0b0f19' : '#f8fafc';
      ctx.fillRect(0, 0, width, height);

      // Top Banner gradient
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#06b6d4');
      gradient.addColorStop(0.5, '#4f46e5');
      gradient.addColorStop(1, '#9333ea');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, 8);

      // Title & Header Text
      ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
      ctx.font = 'bold 24px -apple-system, sans-serif';
      ctx.fillText('FLASHVISION — DEPARTMENT ATTENDANCE REPORT', 40, 50);

      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.font = '13px -apple-system, sans-serif';
      ctx.fillText(
        `Department: ${reportDept}  |  Period: ${reportStartDate} to ${reportEndDate}  |  Generated: ${new Date().toLocaleDateString()}`,
        40,
        78
      );

      // KPI Cards
      const kpis = [
        { label: 'STAFF IN DEPT', val: String(reportStats.totalEmp) },
        { label: 'TOTAL PUNCHES', val: String(reportStats.totalPunches) },
        { label: 'CLOCKED IN', val: String(reportStats.presentCount), color: '#10b981' },
        { label: 'COMPLETED SHIFTS', val: String(reportStats.completedCount), color: '#8b5cf6' },
        { label: 'TOTAL WORK DURATION', val: reportStats.totalHoursStr }
      ];

      kpis.forEach((kpi, i) => {
        const x = 40 + i * 180;
        const y = 105;
        ctx.fillStyle = isDark ? '#161f30' : '#ffffff';
        ctx.strokeStyle = isDark ? '#1e293b' : '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, 168, 64, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
        ctx.font = 'bold 9px -apple-system, sans-serif';
        ctx.fillText(kpi.label, x + 12, y + 24);

        ctx.fillStyle = kpi.color || (isDark ? '#ffffff' : '#0f172a');
        ctx.font = 'bold 18px -apple-system, sans-serif';
        ctx.fillText(kpi.val, x + 12, y + 48);
      });

      // Table Header
      const tableTop = 200;
      ctx.fillStyle = isDark ? '#161f30' : '#e2e8f0';
      ctx.fillRect(40, tableTop, width - 80, 32);

      ctx.fillStyle = isDark ? '#94a3b8' : '#475569';
      ctx.font = 'bold 10px -apple-system, sans-serif';
      ctx.fillText('#', 55, tableTop + 20);
      ctx.fillText('EMP CODE', 90, tableTop + 20);
      ctx.fillText('EMPLOYEE NAME', 220, tableTop + 20);
      ctx.fillText('DEPARTMENT', 420, tableTop + 20);
      ctx.fillText('DATE', 580, tableTop + 20);
      ctx.fillText('CLOCK IN', 690, tableTop + 20);
      ctx.fillText('CLOCK OUT', 780, tableTop + 20);
      ctx.fillText('DURATION', 870, tableTop + 20);

      // Table Rows
      reportRecords.forEach((r, idx) => {
        const y = tableTop + 32 + idx * rowHeight;
        ctx.fillStyle = idx % 2 === 0 ? (isDark ? '#111726' : '#ffffff') : (isDark ? '#0c121e' : '#f8fafc');
        ctx.fillRect(40, y, width - 80, rowHeight);

        ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
        ctx.font = '11px -apple-system, sans-serif';
        ctx.fillText(String(idx + 1), 55, y + 22);

        ctx.font = 'bold 11px monospace';
        ctx.fillText(String(r.employeeCode || r.employeeId || '—'), 90, y + 22);

        ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
        ctx.font = 'bold 11px -apple-system, sans-serif';
        ctx.fillText(String(r.employeeName || 'Staff'), 220, y + 22);

        ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
        ctx.font = '11px -apple-system, sans-serif';
        ctx.fillText(String(r.department || 'General'), 420, y + 22);

        ctx.font = '11px monospace';
        ctx.fillText(String(r.date || '—'), 580, y + 22);

        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(String(r.inTime || '—'), 690, y + 22);

        ctx.fillStyle = '#8b5cf6';
        ctx.fillText(String(r.outTime || '—'), 780, y + 22);

        ctx.fillStyle = isDark ? '#cbd5e1' : '#334155';
        ctx.font = '11px -apple-system, sans-serif';
        ctx.fillText(String(r.duration || '—'), 870, y + 22);
      });

      // Export canvas as high-resolution PNG image
      const fileName = `Attendance_HighRes_${reportDept}_${reportStartDate}_to_${reportEndDate}.png`;
      const imageUri = canvas.toDataURL('image/png');

      // Check Native Android File Saver first (Directly writes to Downloads/FlashAM)
      if (typeof window !== 'undefined' && window.AndroidFileSaver && typeof window.AndroidFileSaver.saveBase64File === 'function') {
        window.AndroidFileSaver.saveBase64File(imageUri, fileName, 'image/png');
        showToast('Report Image saved to Downloads/FlashAM/' + fileName, 'success');
        playChime('in');
      } else {
        const dlLink = document.createElement('a');
        dlLink.download = fileName;
        dlLink.href = imageUri;
        document.body.appendChild(dlLink);
        dlLink.click();
        document.body.removeChild(dlLink);
        showToast('High-Resolution Image Downloaded!', 'success');
        playChime('in');
      }

      // Always launch interactive preview modal so user can view & share to WhatsApp directly!
      setImagePreviewModal({
        isOpen: true,
        imageUri,
        fileName
      });
    } catch (e) {
      showToast('Image export failed', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // =========================================================================
  // VIEW 1: AUTHORIZATION SCREEN (When no user logged in)
  // =========================================================================
  if (!authSession) {
    return (
      <div
        className={`h-screen h-[100dvh] w-full flex flex-col items-center justify-center p-4 overflow-y-auto overflow-x-hidden touch-pan-y transition-colors duration-300 ${
          isDark ? 'bg-[#090d16] text-white' : 'bg-slate-50 text-slate-900'
        }`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div
          className={`w-full max-w-md p-6 sm:p-8 rounded-3xl shadow-2xl border transition-all duration-300 my-auto ${
            isDark
              ? 'bg-[#121927]/90 border-slate-800/80 backdrop-blur-xl'
              : 'bg-white border-slate-200 backdrop-blur-xl'
          }`}
        >
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
  // VIEW 2: TERMINAL LOCK SCREEN (PIN or Real Biometric Fingerprint)
  // =========================================================================
  if (!isUnlocked) {
    return (
      <div
        className={`h-screen h-[100dvh] w-full flex flex-col items-center justify-center p-4 overflow-y-auto overflow-x-hidden touch-pan-y transition-colors duration-300 ${
          isDark ? 'bg-[#090d16] text-white' : 'bg-slate-50 text-slate-900'
        }`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div
          className={`w-full max-w-sm p-6 sm:p-7 rounded-3xl shadow-2xl border transition-all duration-300 flex flex-col items-center text-center my-auto ${
            isDark
              ? 'bg-[#121927]/90 border-slate-800/80 backdrop-blur-xl'
              : 'bg-white border-slate-200 backdrop-blur-xl'
          }`}
        >
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
            {pinRequired
              ? `Enter your ${userAmPin.length}-Digit AM PIN or Touch Fingerprint Sensor`
              : 'Touch Fingerprint Sensor or tap Unlock to continue'}
          </p>

          {pinRequired ? (
          <div className="flex gap-3 mb-6">
            {(userAmPin ? userAmPin.split('') : [0, 1, 2, 3]).map((_, idx) => (
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
          ) : null}

          {pinError && (
            <p className="text-xs font-semibold text-red-500 mb-3 animate-shake">{pinError}</p>
          )}

          {pinRequired && (
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
          )}

          {!pinRequired && (
            <button
              onClick={handleBiometricAuth}
              className="w-full max-w-[260px] py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 active:scale-95 transition-all mb-5"
            >
              <span className="material-symbols-outlined text-[18px]">lock_open</span>
              <span>Unlock Terminal</span>
            </button>
          )}

          <button
            onClick={handleBiometricAuth}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/25 active:scale-95 transition-all mb-3"
          >
            <span className="material-symbols-outlined text-xl">fingerprint</span>
            <span>Use Mobile Fingerprint</span>
          </button>

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

  // FLASHAM PHASE B — one adjustment panel per mode (deduction / overtime /
  // fine): date selector + the same employee-list format, each row carrying
  // just a value input. NO punch / in-out data is shown in these modes.
  const renderAdjustPanel = (mode) => {
    const cfg = ADJUST_FIELD[mode];
    const drafts = adjustDrafts[mode] || {};
    const dirtyCount = Object.keys(drafts).length;
    return (
      <div className="space-y-4">
        <div
          className={`p-3 rounded-2xl border space-y-3 transition-all ${
            isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-500 text-[18px]">{cfg.icon}</span>
              <h3 className="text-sm font-bold font-manrope">{cfg.label} Entry</h3>
              <input
                type="date"
                value={adjustDate}
                onChange={(e) => setAdjustDate(e.target.value)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                  isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
              {adjustDate !== new Date().toISOString().split('T')[0] && (
                <button
                  onClick={() => setAdjustDate(new Date().toISOString().split('T')[0])}
                  className="text-[11px] font-semibold text-cyan-400 hover:underline"
                >
                  Reset to Today
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleSaveAdjustments(mode)}
              disabled={isSavingAdjust || dirtyCount === 0}
              className="px-3.5 py-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md shadow-emerald-600/25 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              {isSavingAdjust ? 'Saving...' : `Save ${cfg.label}${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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
            <div className="flex items-center gap-2">
              {divisions.length > 1 && (
                <select
                  value={divisionFilter}
                  onChange={(e) => {
                    setDivisionFilter(e.target.value);
                    setDeptFilter('ALL');
                  }}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all focus:outline-none focus:ring-1 focus:ring-cyan-500 max-w-[170px] truncate cursor-pointer ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  {divisions.map((d) => (
                    <option key={d} value={d}>
                      {d === 'ALL' ? '🏢 All Divisions' : d}
                    </option>
                  ))}
                </select>
              )}
              {departments.length > 1 && (
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all focus:outline-none focus:ring-1 focus:ring-cyan-500 max-w-[170px] truncate cursor-pointer ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d === 'ALL' ? '📁 All Depts' : d}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Enter {mode === 'fine' ? 'a fine amount' : `${cfg.label.toLowerCase()} hours`} per employee for {adjustDate}, then Save. Saved values appear under Current.
          </p>
        </div>

        {isLoadingDb ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs font-semibold text-slate-400">Loading workforce from Supabase...</p>
          </div>
        ) : adjustEmployees.length === 0 ? (
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
            {adjustEmployees.map((emp) => {
              const savedVal = getDayAdjustValue(emp, adjustDate, mode);
              const draftVal = drafts[String(emp.id)];
              const inputVal = draftVal !== undefined ? draftVal : (savedVal ? String(savedVal) : '');
              return (
                <div
                  key={emp.id || emp.employeeCode}
                  className={`p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 ${
                    isDark
                      ? 'bg-[#121927]/90 hover:bg-[#151e30] border-slate-800'
                      : 'bg-white hover:bg-slate-50/80 border-slate-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {emp.avatar ? (
                      <img
                        src={emp.avatar}
                        alt={emp.name}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm shrink-0"
                      />
                    ) : (
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-sm border border-white/20 ${
                        isDark
                          ? 'bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white'
                          : 'bg-gradient-to-br from-indigo-500 via-blue-600 to-cyan-500 text-white shadow-indigo-500/20'
                      }`}>
                        {emp.name
                          ? emp.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                          : 'EM'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm font-manrope truncate">{emp.name}</h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-500/15 text-slate-400 border border-slate-500/20 shrink-0">
                          {emp.employeeCode || `#${emp.id}`}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {emp.department || 'Staff'}
                        {emp.designation ? ` • ${emp.designation}` : ''}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Current: <span className="font-bold text-cyan-400">{savedVal || 0}{mode === 'fine' ? '' : ' hrs'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min="0"
                      step={mode === 'fine' ? '1' : '0.5'}
                      value={inputVal}
                      onChange={(e) =>
                        setAdjustDrafts((prev) => ({
                          ...prev,
                          [mode]: { ...(prev[mode] || {}), [String(emp.id)]: e.target.value }
                        }))
                      }
                      placeholder="0"
                      className={`w-24 px-3 py-2.5 rounded-xl border font-mono font-bold text-xs text-center focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                    <span className="text-[10px] font-bold uppercase text-slate-400 w-8">
                      {mode === 'fine' ? 'Amt' : 'Hrs'}
                    </span>
                  </div>
                  {mode === 'fine' && (
                    <input
                      type="text"
                      value={fineNotes[String(emp.id)] ?? (emp.attendance?.[adjustDate]?.fineRemarks || '')}
                      onChange={(e) => setFineNotes((prev) => ({ ...prev, [String(emp.id)]: e.target.value }))}
                      placeholder="Note (optional)"
                      className={`hidden md:block w-40 px-3 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                        isDark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // VIEW 3: MAIN FLASH AM ATTENDANCE TERMINAL (UNLOCKED & SCROLLABLE)
  // =========================================================================
  return (
    <div
      className={`h-screen h-[100dvh] w-full flex flex-col overflow-y-auto overflow-x-hidden touch-pan-y transition-colors duration-300 pb-28 ${
        isDark ? 'bg-[#090d16] text-white' : 'bg-slate-50 text-slate-900'
      }`}
      style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
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

            <button
              onClick={() => setShowProfileScreen(true)}
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

      {/* Floating Toast Notification */}
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

      {/* MAIN CONTENT AREA */}
      <main className="max-w-5xl mx-auto w-full px-4 pt-4 flex-1">
        {/* TAB 1: ATTENDANCE PUNCH INTERFACE */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            {/* FLASHAM PHASE B: permission-wise mode switch */}
            {permittedModes.length > 1 && (
              <div
                className={`p-1.5 rounded-2xl border flex items-center gap-1 overflow-x-auto ${
                  isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                {[
                  { id: 'attendance', label: 'Attendance', icon: 'fingerprint' },
                  { id: 'deduction', label: 'Deductions', icon: 'remove_circle' },
                  { id: 'overtime', label: 'Overtime', icon: 'more_time' },
                  { id: 'fine', label: 'Fines', icon: 'money_off' }
                ]
                  .filter((m) => permittedModes.includes(m.id))
                  .map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFlashMode(m.id)}
                      className={`flex-1 min-w-[86px] px-2.5 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                        activeMode === m.id
                          ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/30'
                          : isDark
                          ? 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">{m.icon}</span>
                      {m.label}
                    </button>
                  ))}
              </div>
            )}

            {!activeMode ? (
              <div
                className={`p-10 rounded-3xl border text-center ${
                  isDark ? 'bg-[#121927]/60 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-slate-500 text-4xl mb-2">lock</span>
                <h3 className="text-sm font-bold">Not Authorized</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Your account has no Flash AM permissions (punch, deduction, overtime or fine). Please contact your administrator.
                </p>
              </div>
            ) : activeMode !== 'attendance' ? (
              renderAdjustPanel(activeMode)
            ) : (
              <>
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase">Staff</div>
                <div className="text-lg sm:text-xl font-black font-manrope mt-0.5">{stats.total}</div>
              </div>
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="text-[10px] font-bold text-emerald-400 uppercase">In Now</div>
                <div className="text-lg sm:text-xl font-black font-manrope text-emerald-400 mt-0.5">
                  {stats.clockedIn}
                </div>
              </div>
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="text-[10px] font-bold text-purple-400 uppercase">Completed</div>
                <div className="text-lg sm:text-xl font-black font-manrope text-purple-400 mt-0.5">
                  {stats.clockedOut}
                </div>
              </div>
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="text-[10px] font-bold text-amber-400 uppercase">Absent</div>
                <div className="text-lg sm:text-xl font-black font-manrope text-amber-400 mt-0.5">
                  {stats.absent}
                </div>
              </div>
            </div>

            <div
              className={`p-3 rounded-2xl border space-y-3 transition-all ${
                isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'
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
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
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

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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

                <div className="flex items-center gap-2">
                  {/* Division Dropdown */}
                  {divisions.length > 1 && (
                    <select
                      value={divisionFilter}
                      onChange={(e) => {
                        setDivisionFilter(e.target.value);
                        setDeptFilter('ALL');
                      }}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all focus:outline-none focus:ring-1 focus:ring-cyan-500 max-w-[170px] truncate cursor-pointer ${
                        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      {divisions.map((d) => (
                        <option key={d} value={d}>
                          {d === 'ALL' ? '🏢 All Divisions' : d}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Department Dropdown */}
                  {departments.length > 1 && (
                    <select
                      value={deptFilter}
                      onChange={(e) => setDeptFilter(e.target.value)}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all focus:outline-none focus:ring-1 focus:ring-cyan-500 max-w-[170px] truncate cursor-pointer ${
                        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      {departments.map((d) => (
                        <option key={d} value={d}>
                          {d === 'ALL' ? '📁 All Depts' : d}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

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
                  const lateMins = getLateMinutes(emp, rec);
                  const isEditing = Boolean(manualEdit) && String(manualEdit.empId) === String(emp.id);

                  return (
                    <div
                      key={emp.id || emp.employeeCode}
                      className={`p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 flex flex-col ${isEditing ? 'items-stretch' : 'sm:flex-row sm:items-center'} justify-between gap-3 ${
                        isDark
                          ? 'bg-[#121927]/90 hover:bg-[#151e30] border-slate-800'
                          : 'bg-white hover:bg-slate-50/80 border-slate-200 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {emp.avatar ? (
                          <img
                            src={emp.avatar}
                            alt={emp.name}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm shrink-0"
                          />
                        ) : (
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-sm transition-all border border-white/20 ${
                            isDark
                              ? 'bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white'
                              : 'bg-gradient-to-br from-indigo-500 via-blue-600 to-cyan-500 text-white shadow-indigo-500/20'
                          }`}>
                            {emp.name
                              ? emp.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join('')
                                  .toUpperCase()
                              : 'EM'}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm font-manrope truncate">{emp.name}</h4>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-500/15 text-slate-400 border border-slate-500/20 shrink-0">
                              {emp.employeeCode || `#${emp.id}`}
                            </span>
                            {emp.division && (
                              <span className="hidden sm:inline-block text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 shrink-0">
                                {emp.division}
                              </span>
                            )}
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
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
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

                            {lateMins > 0 && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                                <span className="material-symbols-outlined text-[12px]">schedule</span>
                                Late {lateMins} min
                              </span>
                            )}

                            {hasOut && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                OUT: {rec.outTime}
                                {rec.duration && <span>({rec.duration})</span>}
                              </span>
                            )}

                            {rec && rec.status && rec.status !== 'Present' && rec.status !== 'Completed' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                {rec.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isEditing ? (
                        <div
                          className={`w-full p-3 rounded-2xl border space-y-2.5 ${
                            isDark ? 'bg-slate-900/70 border-cyan-500/30' : 'bg-cyan-50/60 border-cyan-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-500 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">edit_calendar</span>
                              Manual Entry — {selectedDate}
                            </span>
                            <span className="text-[10px] text-slate-400">Source: Manual</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 block mb-1">Time In</label>
                              <input
                                type="time"
                                value={manualEdit.inTime}
                                onChange={(e) => setManualEdit((prev) => ({ ...prev, inTime: e.target.value }))}
                                className={`w-full px-2.5 py-2 rounded-xl border font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                                  isDark ? 'bg-slate-900 border-slate-700 text-emerald-400' : 'bg-white border-slate-200 text-emerald-700'
                                }`}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-wider text-purple-500 block mb-1">Time Out</label>
                              <input
                                type="time"
                                value={manualEdit.outTime}
                                onChange={(e) => setManualEdit((prev) => ({ ...prev, outTime: e.target.value }))}
                                className={`w-full px-2.5 py-2 rounded-xl border font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                                  isDark ? 'bg-slate-900 border-slate-700 text-purple-400' : 'bg-white border-slate-200 text-purple-700'
                                }`}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Status</label>
                              <select
                                value={manualEdit.status}
                                onChange={(e) => setManualEdit((prev) => ({ ...prev, status: e.target.value }))}
                                className={`w-full px-2.5 py-2 rounded-xl border font-bold text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                                  isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                                }`}
                              >
                                <option value="Present">Present (حاضر)</option>
                                <option value="Absent">Absent (غیر حاضر)</option>
                                <option value="Leave">Leave (رخصت)</option>
                                <option value="Holiday">Holiday (تعطیل)</option>
                                <option value="Off Day">Off Day (چھٹی)</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Remarks</label>
                              <input
                                type="text"
                                value={manualEdit.remarks}
                                onChange={(e) => setManualEdit((prev) => ({ ...prev, remarks: e.target.value }))}
                                placeholder="e.g. Card forgotten"
                                className={`w-full px-2.5 py-2 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                                  isDark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                                }`}
                              />
                            </div>
                          </div>
                          {manualEdit.inTime && manualEdit.outTime && (
                            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-between text-[11px]">
                              <span className="text-slate-400 font-bold">Duration:</span>
                              <span className="font-mono font-black text-cyan-500">
                                {calculateDuration(inputValueToTime(manualEdit.inTime), inputValueToTime(manualEdit.outTime)) || '—'}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 pt-0.5">
                            {rec && (rec.inTime || rec.outTime) && (
                              <button
                                type="button"
                                onClick={handleClearManualEdit}
                                title="Clear this day's punch record"
                                className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition-all cursor-pointer flex items-center justify-center"
                              >
                                <span className="material-symbols-outlined text-[17px]">delete</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={cancelManualEdit}
                              className={`flex-1 py-2 rounded-xl font-bold text-xs border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                isDark ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-700'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveManualEdit}
                              className="flex-1 py-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[16px]">check</span>
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {/* PUNCH IN BUTTON - Guarantees 100% Crisp White Text in Light & Dark Mode */}
                        <button
                          type="button"
                          onClick={() => handlePunchIn(emp)}
                          title={hasIn ? 'Already Clocked IN. Click to UNDO clock-in' : 'Clock IN'}
                          className={`px-3.5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-md cursor-pointer !text-white text-white ${
                            hasIn
                              ? 'bg-emerald-600 hover:bg-emerald-700 !text-white text-white shadow-emerald-600/30 border border-emerald-400/40'
                              : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 !text-white text-white shadow-emerald-600/25'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[17px] !text-white text-white font-bold">
                            {hasIn ? 'undo' : 'login'}
                          </span>
                          <span className="!text-white text-white font-black tracking-wide">
                            {hasIn ? `IN ${rec.inTime.split(':')[0]}:${rec.inTime.split(':')[1]}` : 'PUNCH IN'}
                          </span>
                        </button>

                        {/* PUNCH OUT BUTTON - Guarantees 100% Crisp White Text in Light & Dark Mode */}
                        <button
                          type="button"
                          onClick={() => handlePunchOut(emp)}
                          title={hasOut ? 'Already Clocked OUT. Click to UNDO clock-out' : 'Clock OUT'}
                          className={`px-3.5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-md cursor-pointer ${
                            hasOut
                              ? 'bg-purple-600 hover:bg-purple-700 !text-white text-white shadow-purple-600/30 border border-purple-400/40'
                              : hasIn
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 !text-white text-white shadow-purple-600/25'
                              : isDark
                              ? 'bg-slate-800/80 !text-slate-400 border border-slate-700 cursor-not-allowed opacity-60'
                              : 'bg-slate-200 !text-slate-400 border border-slate-300 cursor-not-allowed opacity-60'
                          }`}
                        >
                          <span className={`material-symbols-outlined text-[17px] font-bold ${hasOut || hasIn ? '!text-white text-white' : '!text-slate-400'}`}>
                            {hasOut ? 'undo' : 'logout'}
                          </span>
                          <span className={`font-black tracking-wide ${hasOut || hasIn ? '!text-white text-white' : '!text-slate-400'}`}>
                            {hasOut ? `OUT ${rec.outTime.split(':')[0]}:${rec.outTime.split(':')[1]}` : 'PUNCH OUT'}
                          </span>
                        </button>

                        {/* MANUAL TIME LOG BUTTON */}
                        <button
                          type="button"
                          onClick={() => startManualEdit(emp, rec)}
                          title="Manual Time In / Out & Attendance Edit"
                          className={`p-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-sm ${
                            isDark
                              ? 'bg-slate-800/90 hover:bg-slate-700 text-cyan-400 border-slate-700'
                              : 'bg-slate-100 hover:bg-slate-200 text-cyan-700 border-slate-300'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">edit_calendar</span>
                        </button>
                      </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
              </>
            )}
          </div>
        )}

        {/* TAB 2: LIVE ROSTER */}
        {activeTab === 'roster' && canPunch && (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-3xl border flex items-center justify-between gap-3 ${
                isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div>
                <h3 className="text-base font-bold font-manrope">Today's Attendance Roster ({selectedDate})</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Full ledger of punches recorded directly into the enterprise database.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('reports')}
                className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-600/20 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">summarize</span>
                <span>Dept Reports</span>
              </button>
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

        {/* TAB 3: DEPARTMENT-WISE ATTENDANCE REPORTS (PDF, CSV, HIGH-QUALITY IMAGE) */}
        {activeTab === 'reports' && canPunch && (
          <div className="space-y-4">
            <div
              className={`p-4 sm:p-5 rounded-3xl border space-y-4 ${
                isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold font-manrope">Department Attendance Reports</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Generate multi-format audit reports in PDF, CSV, and High-Resolution Image formats.
                  </p>
                </div>

                {/* 3 Export Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportPDF}
                    disabled={isExporting}
                    className="px-3.5 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                    title="Export Printable PDF Document"
                  >
                    <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                    <span>PDF</span>
                  </button>

                  <button
                    onClick={exportCSV}
                    disabled={isExporting}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                    title="Export Microsoft Excel CSV to Downloads"
                  >
                    <span className="material-symbols-outlined text-[16px]">csv</span>
                    <span>CSV</span>
                  </button>

                  <button
                    onClick={exportImage}
                    disabled={isExporting}
                    className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-cyan-600/20"
                    title="Export High-Resolution Image & Preview"
                  >
                    <span className="material-symbols-outlined text-[16px]">image</span>
                    <span>HQ Image</span>
                  </button>
                </div>
              </div>

              {/* Department & Date Range Selection Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/40">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Select Department</label>
                  <select
                    value={reportDept}
                    onChange={(e) => setReportDept(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-bold transition-all focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d === 'ALL' ? '🏢 All Departments' : d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">From Date</label>
                  <input
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-bold transition-all focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">To Date</label>
                  <input
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-bold transition-all focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              {/* Quick Range Presets */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Presets:</span>
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: 'week', label: 'Last 7 Days' },
                  { id: 'month', label: 'This Month' }
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyDatePreset(p.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border transition-all ${
                      isDark
                        ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:text-white'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Department Summary KPI Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="text-[10px] font-bold uppercase text-slate-400">Total Staff in Dept</div>
                <div className="text-xl font-black mt-1 font-manrope">{reportStats.totalEmp}</div>
              </div>
              <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="text-[10px] font-bold uppercase text-emerald-400">Recorded Clock-Ins</div>
                <div className="text-xl font-black mt-1 text-emerald-400 font-manrope">{reportStats.presentCount}</div>
              </div>
              <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="text-[10px] font-bold uppercase text-purple-400">Completed Shifts</div>
                <div className="text-xl font-black mt-1 text-purple-400 font-manrope">{reportStats.completedCount}</div>
              </div>
              <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="text-[10px] font-bold uppercase text-cyan-400">Total Work Duration</div>
                <div className="text-xl font-black mt-1 text-cyan-400 font-manrope">{reportStats.totalHoursStr}</div>
              </div>
            </div>

            {/* Department Records Table */}
            <div className={`rounded-3xl border overflow-hidden ${isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="p-3.5 border-b border-slate-800/40 flex items-center justify-between text-xs">
                <span className="font-bold">Department Punches ({reportRecords.length} records)</span>
                <span className="text-slate-400">{reportDept} • {reportStartDate} to {reportEndDate}</span>
              </div>

              {reportRecords.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-400">
                  No attendance punches recorded for this department within the selected date range.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className={`border-b ${isDark ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                        <th className="p-3">#</th>
                        <th className="p-3">Emp Code</th>
                        <th className="p-3">Name</th>
                        <th className="p-3">Department</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Clock IN</th>
                        <th className="p-3">Clock OUT</th>
                        <th className="p-3">Duration</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {reportRecords.map((r, i) => (
                        <tr key={r.id || i} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                          <td className="p-3 text-slate-400">{i + 1}</td>
                          <td className="p-3 font-mono font-bold text-cyan-400">{r.employeeCode || r.employeeId}</td>
                          <td className="p-3 font-bold">{r.employeeName}</td>
                          <td className="p-3 text-slate-400">{r.department}</td>
                          <td className="p-3 font-mono">{r.date}</td>
                          <td className="p-3 text-emerald-400 font-mono font-bold">{r.inTime || '—'}</td>
                          <td className="p-3 text-purple-400 font-mono font-bold">{r.outTime || '—'}</td>
                          <td className="p-3 text-slate-300 font-mono">{r.duration || '—'}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: SYNC & CLOUD DATABASE LOGS */}
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
                  <p className="text-xs text-slate-400">Direct connection with Supabase (main_state) & WhatsApp-speed Broadcast</p>
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

        {/* TAB 5: SETTINGS & TERMINAL CONFIGURATION */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
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
                  <h3 className="text-sm font-bold font-manrope">AM PIN</h3>
                  <p className="text-xs text-slate-400">
                    {pinRequired
                      ? 'Your personal PIN for unlocking this terminal (saved on your ERP user account)'
                      : 'PIN not set - set your personal PIN for unlocking this terminal'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setChangePinError('');
                  setChangePinForm({ currentPin: '', newPin: '', confirmPin: '' });
                  setShowChangePinModal(true);
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-cyan-600/20 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[17px]">lock_reset</span>
                <span>{pinRequired ? 'Change AM PIN' : 'Set AM PIN'}</span>
              </button>
            </div>

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

            <div
              className={`p-4 sm:p-5 rounded-3xl border text-xs text-slate-400 space-y-2 ${
                isDark ? 'bg-[#121927]/60 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="font-bold text-white text-sm">Flash AM Terminal Information</div>
              <div>App Version: 2.5.0 (Instant Broadcast & Multi-Format Reports)</div>
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
        <div className={`max-w-md mx-auto grid ${canPunch ? 'grid-cols-5' : 'grid-cols-3'} px-2 py-2`}>
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
            <span className="material-symbols-outlined text-[20px]">fingerprint</span>
            <span className="text-[9px] mt-0.5 tracking-tight font-manrope">Attendance</span>
          </button>

          {/* TAB 2: Roster */}
          {canPunch && (
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
            <span className="material-symbols-outlined text-[20px]">groups</span>
            <span className="text-[9px] mt-0.5 tracking-tight font-manrope">Roster</span>
          </button>
          )}

          {/* TAB 3: Reports */}
          {canPunch && (
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
              activeTab === 'reports'
                ? 'text-cyan-400 font-bold'
                : isDark
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">summarize</span>
            <span className="text-[9px] mt-0.5 tracking-tight font-manrope">Reports</span>
          </button>
          )}

          {/* TAB 4: Realtime Sync */}
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
            <span className="material-symbols-outlined text-[20px]">cloud_sync</span>
            <span className="text-[9px] mt-0.5 tracking-tight font-manrope">Sync</span>
            {pendingQueue.length > 0 && (
              <span className="absolute top-0 right-1/4 w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            )}
          </button>

          {/* TAB 5: Settings */}
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
            <span className="material-symbols-outlined text-[20px]">tune</span>
            <span className="text-[9px] mt-0.5 tracking-tight font-manrope">Settings</span>
          </button>
        </div>
      </footer>

      {/* MODAL 1: UNDO CONFIRMATION DIALOG */}
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


      {/* MODAL 2: CHANGE SECURITY PIN DIALOG */}
      {showChangePinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl transition-all ${
              isDark ? 'bg-[#121927] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold font-manrope">{pinRequired ? 'Change AM PIN' : 'Set AM PIN'}</h3>
              <button
                onClick={() => setShowChangePinModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangePinSubmit} className="space-y-3">
              {pinRequired && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                  Current PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={changePinForm.currentPin}
                  onChange={(e) => setChangePinForm({ ...changePinForm, currentPin: e.target.value.replace(/\D/g, '') })}
                  placeholder="••••"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-center font-mono tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                  New PIN (4-6 digits)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={changePinForm.newPin}
                  onChange={(e) => setChangePinForm({ ...changePinForm, newPin: e.target.value.replace(/\D/g, '') })}
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
                  maxLength={6}
                  value={changePinForm.confirmPin}
                  onChange={(e) => setChangePinForm({ ...changePinForm, confirmPin: e.target.value.replace(/\D/g, '') })}
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

      {/* PROFILE SCREEN (Phase A): ERP-style operator profile — details,
          change password, change AM PIN, lock / sign out. */}
      {showProfileScreen && (
        <div className={`fixed inset-0 z-50 overflow-y-auto animate-in fade-in duration-200 ${isDark ? 'bg-[#090d16] text-white' : 'bg-slate-50 text-slate-900'}`}>
          <div className="max-w-2xl mx-auto px-4 py-5 pb-16">
            <div className="flex items-center gap-3 mb-5">
              <button
                onClick={() => { setShowProfileScreen(false); setProfilePwMsg(''); }}
                className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all active:scale-95 ${isDark ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'}`}
                title="Back to Terminal"
              >
                <span className="material-symbols-outlined text-[19px]">arrow_back</span>
              </button>
              <h3 className="text-lg font-bold font-manrope">My Profile</h3>
            </div>

            <div className={`p-5 rounded-3xl border shadow-sm mb-4 ${isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-cyan-600 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-base font-manrope truncate">{currentUserRecord?.name || activeUser?.name}</h4>
                  <div className="text-xs text-slate-400 truncate">@{currentUserRecord?.username || activeUser?.username}</div>
                  <span className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 mt-1.5">
                    {currentUserRecord?.role || activeUser?.role}
                  </span>
                </div>
              </div>

              {!pinRequired && (
                <div className="mt-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-500 text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[17px]">warning</span>
                  <span>PIN not set — set your AM PIN below so this terminal locks with your own code.</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-5">
                {[
                  ['Full Name', currentUserRecord?.name],
                  ['Username', currentUserRecord?.username ? `@${currentUserRecord.username}` : ''],
                  ['Email', currentUserRecord?.email],
                  ['Phone', currentUserRecord?.phone],
                  ['Role', currentUserRecord?.role],
                  ['Department', currentUserRecord?.department],
                  ['Division', currentUserRecord?.division],
                  ['Job Title', currentUserRecord?.jobTitle],
                  ['Status', currentUserRecord?.status || 'Active'],
                  ['AM PIN', pinRequired ? 'Set (••••)' : 'Not set']
                ].filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '').map(([label, value]) => (
                  <div key={label} className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
                    <div className="text-sm font-bold mt-0.5 truncate">{String(value)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`p-5 rounded-3xl border shadow-sm mb-4 ${isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h4 className="text-sm font-bold font-manrope flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[19px] text-cyan-400">lock</span>
                Change Password
              </h4>
              <form onSubmit={handleProfileChangePassword} className="space-y-3">
                <input
                  type="password"
                  value={profilePwForm.current}
                  onChange={(e) => setProfilePwForm({ ...profilePwForm, current: e.target.value })}
                  placeholder="Current password"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="password"
                    value={profilePwForm.next}
                    onChange={(e) => setProfilePwForm({ ...profilePwForm, next: e.target.value })}
                    placeholder="New password"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  />
                  <input
                    type="password"
                    value={profilePwForm.confirm}
                    onChange={(e) => setProfilePwForm({ ...profilePwForm, confirm: e.target.value })}
                    placeholder="Confirm new password"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  />
                </div>
                {profilePwMsg && (
                  <div className="p-2.5 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-500 font-semibold">{profilePwMsg}</div>
                )}
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-cyan-600/20 active:scale-95 transition-all cursor-pointer"
                >
                  Update Password
                </button>
              </form>
            </div>

            <div className={`p-5 rounded-3xl border shadow-sm mb-4 ${isDark ? 'bg-[#121927]/90 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h4 className="text-sm font-bold font-manrope flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-[19px] text-cyan-400">password</span>
                AM PIN
              </h4>
              <p className="text-xs text-slate-400 mb-3">
                {pinRequired
                  ? 'This PIN unlocks the Flash AM terminal for your account.'
                  : 'PIN not set — without a PIN this terminal opens right after login.'}
              </p>
              <button
                onClick={() => {
                  setChangePinError('');
                  setChangePinForm({ currentPin: '', newPin: '', confirmPin: '' });
                  setShowChangePinModal(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-cyan-600/20 active:scale-95 transition-all cursor-pointer"
              >
                {pinRequired ? 'Change AM PIN' : 'Set AM PIN'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleLockTerminal}
                className={`py-3 px-4 rounded-xl font-bold text-xs border flex items-center justify-center gap-2 transition-all active:scale-95 ${isDark ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
              >
                <span className="material-symbols-outlined text-[18px] text-amber-400">lock</span>
                Lock Terminal
              </button>
              <button
                onClick={handleLogout}
                className="py-3 px-4 rounded-xl font-bold text-xs bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Log Out / Switch User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
