import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useDialog } from '../../context/DialogContext';
import { useApp } from '../../context/AppContext';
import UniversalPrintPreviewModal from '../ui/UniversalPrintPreviewModal';

const INITIAL_EMPLOYEES = [
  {
    id: 'EMP-4012',
    name: 'Alexander Wright',
    role: 'Foam Mixing Lead',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCsz5H0cp9hoPoPVskVsvUfHMqIHmeWbtlBrIdYUCimhnno7YGAiG5d7F7zYy0PXDAocaUjVshC68njgvEADE6D1Dpa0idVxYuECc-INlCIY3fRLWtHd8g_GVOjNJAmLC96ANO1Sp3B2pHXA-9Eh1JSgPej1Ed_pPvBsOSqMEncFNCwQOiv2hvDs3_8r2jkygIf8obv1dEo-lHdr3bJZ5OlotUmPuoykyXOFZkeqxgxtp_i-6Y3VN7wnwYMDVqpGPmvB8dh8_fvHbT0',
    attendance: {
      Mon: { status: 'present', ot: 2.5, fines: 0, deductions: 0 },
      Tue: { status: 'present', ot: 0.0, fines: 0, deductions: 0 },
      Wed: { status: 'absent', ot: 0.0, fines: 0, deductions: 1.5 },
      Thu: { status: 'present', ot: 1.0, fines: 0, deductions: 0 },
      Fri: { status: 'present', ot: 3.5, fines: 0, deductions: 0 }
    }
  },
  {
    id: 'EMP-4088',
    name: 'Sarah Jenkins',
    role: 'Quality Assurance Specialist',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCbCqv6w6aruYEFdHi3gWMj9wdjy8-IR2IN6rbJMupNyrtR3gf56L1Aly5WDj7lzUNWgjVMSSnywdGCayp1KlI9uzoZPfscGMp-Uc6q5uQCguiG4jg7T5465bU9T3PumuFwaTySjM9rEGuZPx_8tHCDPZu4uJrehyjXdPHhi-j2fGNiVZ8y3_oXwmG2WMBFg56Z0pSDsUHSm2LubleVMg4JXxrBcvCBfkHAofESCfbaJKhYxo2XJdHqTG0dLHR9VIVsbkDz-lfv4WMY',
    attendance: {
      Mon: { status: 'present', ot: 0.0, fines: 0, deductions: 0 },
      Tue: { status: 'present', ot: 1.5, fines: 0, deductions: 0 },
      Wed: { status: 'present', ot: 0.5, fines: 0, deductions: 0 },
      Thu: { status: 'present', ot: 0.0, fines: 0, deductions: 0 },
      Fri: { status: 'present', ot: 0.0, fines: 0, deductions: 0 }
    }
  },
  {
    id: 'EMP-4033',
    name: 'Marcus Chen',
    role: 'Frontend Developer',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCpE_7nq3cQA2WhQwuKWRDeRExnrwDZ2H4cLF9MyG5b8jJwrnmbawBaT3K0ZvtOEBBws0978SY6nNpxxcGodOkJF4gaHFTMaOSc2FXlK-TIZp-2Vgr33JIbpf0eUnfbhhr3MIq1NPxu47bJgK2ot6dCu1P9p381UKWpXqz30L-69ajlaIe17bTDt5BIAT4GFF2fOSyYtsb4IFTfqUvFtSShYTbXFw1paQT1RfoSsoH2r-XNYODxmk9Xc-XziXFtdFLNwzH_TJu_V1_6',
    attendance: {
      Mon: { status: 'present', ot: 1.0, fines: 0, deductions: 0 },
      Tue: { status: 'absent', ot: 0.0, fines: 0, deductions: 0 },
      Wed: { status: 'present', ot: 2.0, fines: 0, deductions: 0 },
      Thu: { status: 'present', ot: 0.0, fines: 10, deductions: 0 },
      Fri: { status: 'present', ot: 1.5, fines: 0, deductions: 0 }
    }
  },
  {
    id: 'EMP-4091',
    name: 'Elena Rodriguez',
    role: 'Assembly Technician',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBiw9W3KBZKZtfaHfBXxJcNbQgCXGmzHy4xF0t-jIFO_axu1O3BgkhMWdESJSYVtzUsHh_RWm6lTkrd6bTBAAh6QQFn_CaVpL17zgXmj4gxI4MUr4tw_9R6bvOU05jVuAxvHZlER0ZF5xekLzxfVuOXE_cYshUSH1w9yOp3ugAHB11zoIKBC1UEAcTSsL-rWGjylBzY0_UIajdzp2KgNqxageVAO0zte4dPjTjwWR3EIaf0xpLVBLQl9nKRCXW8C67gQdpK6HEpd0Hy',
    attendance: {
      Mon: { status: 'present', ot: 0.0, fines: 0, deductions: 0 },
      Tue: { status: 'present', ot: 2.0, fines: 0, deductions: 0 },
      Wed: { status: 'present', ot: 1.5, fines: 0, deductions: 0 },
      Thu: { status: 'present', ot: 3.0, fines: 0, deductions: 0 },
      Fri: { status: 'absent', ot: 0.0, fines: 0, deductions: 2.0 }
    }
  },
  {
    id: 'EMP-4022',
    name: 'David Sterling',
    role: 'Fleet Manager',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBKk0LNdaupYN4M2o10jzp7TNkde7hOugNiZo1FgOTf8LQ9vlyAFwC8dYCCC2ftDtg9m1CXGC-gamYk9yzeQDg7ogEGJ3Te2t7T_rGQZPb6JJFy6cbHGGwh_oSKzpRXbDqZNEfhtW__SW2K3EScgScqcQYmv4yGVWo1gq6aUyzKNATLxs1apHKtN9oQPjZs07gQgV-J7JYkOsSR3kx9wyoAi4cJCorydC7Fu3rBHqmjIPB9aFv1zEuy1lj81qc8SOiiM_WgbEF3tJF5',
    attendance: {
      Mon: { status: 'present', ot: 2.0, fines: 0, deductions: 0 },
      Tue: { status: 'present', ot: 0.0, fines: 0, deductions: 0 },
      Wed: { status: 'present', ot: 0.0, fines: 0, deductions: 0 },
      Thu: { status: 'present', ot: 0.0, fines: 0, deductions: 0 },
      Fri: { status: 'present', ot: 2.0, fines: 0, deductions: 0 }
    }
  }
];

const normalizeDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    let year, month, day;
    if (parts[0].length === 4) {
      year = parts[0];
      month = parts[1].padStart(2, '0');
      day = parts[2].padStart(2, '0');
    } else if (parts[2].length === 4) {
      year = parts[2];
      month = parts[0].padStart(2, '0');
      day = parts[1].padStart(2, '0');
    } else {
      return dateStr.trim();
    }
    return `${year}-${month}-${day}`;
  }
  return dateStr.trim();
};

export default function HRAttendance({ isMobile }) {
  const { appAlert } = useDialog();
  const { state: appState, setCollection, setDirty, hasPermission } = useApp() || {};

  // Granular Permission Flags for Attendance Management
  const canAddEmployee = hasPermission ? hasPermission('hr', 'hrAttendance', 'add_employee') : true;
  const canUploadCSV = hasPermission ? hasPermission('hr', 'hrAttendance', 'upload_csv') : true;
  const canReconcile = hasPermission ? hasPermission('hr', 'hrAttendance', 'reconcile') : true;
  const canUseDateFilter = hasPermission ? hasPermission('hr', 'hrAttendance', 'date_filter') : true;
  const canUseFilterToggles = hasPermission ? hasPermission('hr', 'hrAttendance', 'filter_toggles') : true;
  const canEditAttendance = hasPermission ? hasPermission('hr', 'hrAttendance', 'edit') : true;

  // Distinct Granular Permissions for Column Toggles & Fields
  const canFilterAttendance = hasPermission ? (hasPermission('hr', 'hrAttendance', 'filter_attendance') && canUseFilterToggles) : true;
  const canFilterOvertime = hasPermission ? (hasPermission('hr', 'hrAttendance', 'filter_overtime') && canUseFilterToggles) : true;
  const canFilterFines = hasPermission ? (hasPermission('hr', 'hrAttendance', 'filter_fines') && canUseFilterToggles) : true;
  const canFilterDeductions = hasPermission ? (hasPermission('hr', 'hrAttendance', 'filter_deductions') && canUseFilterToggles) : true;

  // Real-time Permission Sync Event Listener
  const [permTick, setPermTick] = useState(0);
  useEffect(() => {
    const handlePermissionsUpdated = (e) => {
      if (e && e.type === 'storage' && e.key && !e.key.includes('perm')) return;
      setPermTick(t => t + 1);
    };
    window.addEventListener('fv-permissions-updated', handlePermissionsUpdated);
    window.addEventListener('storage', handlePermissionsUpdated);
    return () => {
      window.removeEventListener('fv-permissions-updated', handlePermissionsUpdated);
      window.removeEventListener('storage', handlePermissionsUpdated);
    };
  }, []);

  // Allowed Attendance Status Options based on Granular Permissions
  const allowedStatuses = React.useMemo(() => {
    const list = [];
    const canPresent = hasPermission ? hasPermission('hr', 'hrAttendance', 'status_present') : true;
    const canAbsent = hasPermission ? hasPermission('hr', 'hrAttendance', 'status_absent') : true;
    const canLeave = hasPermission ? hasPermission('hr', 'hrAttendance', 'status_leave') : true;
    const canHoliday = hasPermission ? hasPermission('hr', 'hrAttendance', 'status_holiday') : true;
    const canOffDay = hasPermission ? hasPermission('hr', 'hrAttendance', 'status_offday') : true;

    if (canPresent) list.push({ value: 'present', label: 'Present' });
    if (canAbsent) list.push({ value: 'absent', label: 'Absent' });
    if (canLeave) list.push({ value: 'leave', label: 'Leave' });
    if (canHoliday) list.push({ value: 'holiday', label: 'Holiday' });
    if (canOffDay) list.push({ value: 'off day', label: 'Off Day' });

    if (list.length === 0) {
      return [
        { value: 'present', label: 'Present' },
        { value: 'absent', label: 'Absent' },
        { value: 'leave', label: 'Leave' },
        { value: 'holiday', label: 'Holiday' },
        { value: 'off day', label: 'Off Day' }
      ];
    }
    return list;
  }, [hasPermission, permTick]);

  const handleCycleStatus = (empId, dayKey, currentStatusVal) => {
    if (!canEditAttendance) return;
    if (!allowedStatuses || allowedStatuses.length === 0) return;
    const currentVal = String(currentStatusVal || 'absent').toLowerCase();
    const currIndex = allowedStatuses.findIndex(st => st.value.toLowerCase() === currentVal);
    const nextIndex = currIndex === -1 ? 0 : (currIndex + 1) % allowedStatuses.length;
    const nextStatus = allowedStatuses[nextIndex].value;
    handleStatusChange(empId, dayKey, nextStatus);
  };

  // -------------------------------------------------------------
  // PER-USER FILTER PERSISTENCE (Synchronous Hydration on Frame 1)
  // -------------------------------------------------------------
  const effectiveUserObj = (() => {
    try {
      const raw = typeof window !== 'undefined' ? (localStorage.getItem('aj_current_user') || sessionStorage.getItem('aj_current_user')) : null;
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  })();
  const activeUsername = (effectiveUserObj?.username || effectiveUserObj?.id || appState?.currentUser?.username || appState?.currentUser?.id || 'admin').toLowerCase();
  const userFilterKey = `hr_attendance_filters_${activeUsername}`;

  const savedUserFilters = (() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(userFilterKey) : null;
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  })();

  const [activeConditions, setActiveConditions] = useState(() => {
    if (savedUserFilters?.activeConditions) return savedUserFilters.activeConditions;
    return {
      attendance: canFilterAttendance,
      overtime: canFilterOvertime,
      fines: canFilterFines,
      deductions: canFilterDeductions
    };
  });

  // Strict effective active conditions gating what is actually shown in table/cards
  const effectiveActiveConditions = React.useMemo(() => ({
    attendance: activeConditions.attendance && canFilterAttendance,
    overtime: activeConditions.overtime && canFilterOvertime,
    fines: activeConditions.fines && canFilterFines,
    deductions: activeConditions.deductions && canFilterDeductions
  }), [activeConditions, canFilterAttendance, canFilterOvertime, canFilterFines, canFilterDeductions]);

  const employees = appState?.hr_employees_list || [];
  const uploadedAttendance = appState?.hr_uploaded_attendance || [];

  const [localEmployees, setLocalEmployees] = useState(() => {
    return employees;
  });
  const [isDirty, setIsDirty] = useState(false);
  const [viewMode, setViewMode] = useState(() => savedUserFilters?.viewMode || 'grid'); // 'grid' | 'calendar' | 'reconcile'
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const [calendarDrillFilter, setCalendarDrillFilter] = useState('ALL');
  const [calendarSearchQuery, setCalendarSearchQuery] = useState('');
  const [showStudioModal, setShowStudioModal] = useState(false);

  const attendancePrintData = useMemo(() => {
    const list = localEmployees || [];
    let totalPresent = 0;
    let totalAbsent = 0;

    const items = list.map((emp) => {
      let pCount = 0;
      let aCount = 0;
      let lCount = 0;
      let otSum = 0;

      if (emp.attendance) {
        Object.values(emp.attendance).forEach(day => {
          if (day?.status === 'present') pCount++;
          else if (day?.status === 'absent') aCount++;
          else if (day?.status === 'half_day' || day?.status === 'late') lCount++;
          otSum += (Number(day?.ot) || 0);
        });
      }

      totalPresent += pCount;
      totalAbsent += aCount;

      return {
        emp_id: emp.id || '-',
        employee_name: emp.name || 'Employee',
        department: emp.department || emp.role || 'General',
        present_days: pCount,
        absent_days: aCount,
        late_days: lCount,
        half_days: 0,
        overtime_hours: otSum.toFixed(1)
      };
    });

    return {
      header: {
        month: 'Current Month',
        department: 'All Departments',
        total_employees: list.length,
        present_count: totalPresent,
        absent_count: totalAbsent,
        date: new Date().toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric'})
      },
      items
    };
  }, [localEmployees]);

  // Live Realtime Notification Banner
  const [livePunchNotice, setLivePunchNotice] = useState(null);

  // Automatic Mobile Screen & Orientation Rotation detection
  const [isMobileCardView, setIsMobileCardView] = useState(() => {
    if (isMobile) return true;
    if (typeof window !== 'undefined') {
      const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
      return isMobileDevice;
    }
    return false;
  });

  useEffect(() => {
    const handleResizeOrRotate = () => {
      if (typeof window !== 'undefined') {
        const isMobileScreen = window.innerWidth <= 768;
        const isPortrait = window.matchMedia("(orientation: portrait)").matches;
        setIsMobileCardView(isMobileScreen || isPortrait);
      }
    };
    window.addEventListener('resize', handleResizeOrRotate);
    window.addEventListener('orientationchange', handleResizeOrRotate);
    return () => {
      window.removeEventListener('resize', handleResizeOrRotate);
      window.removeEventListener('orientationchange', handleResizeOrRotate);
    };
  }, []);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    role: '',
    department: '',
    phone: '',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    salary: '',
    joiningDate: new Date().toISOString().split('T')[0]
  });

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewEmployee(prev => ({ ...prev, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const [searchQuery, setSearchQuery] = useState(() => savedUserFilters?.searchQuery || '');
  const [activeComment, setActiveComment] = useState(null); // { empId, dayKey, field }
  const [commentText, setCommentText] = useState('');

  const openCommentPopup = (empId, dayKey, field, currentVal) => {
    setActiveComment({ empId, dayKey, field });
    setCommentText(currentVal || '');
  };

  const saveComment = () => {
    if (!activeComment) return;
    const { empId, dayKey, field } = activeComment;
    setIsDirty(true);
    setLocalEmployees(prev => prev.map(emp => {
      if (emp.id !== empId) return emp;
      const att = emp.attendance || {};
      const record = att[dayKey] || { status: 'absent', ot: 0, fines: 0, deductions: 0 };
      return {
        ...emp,
        attendance: {
          ...att,
          [dayKey]: {
            ...record,
            [field]: commentText
          }
        }
      };
    }));
    setActiveComment(null);
  };
  const [selectedDay, setSelectedDay] = useState(() => savedUserFilters?.selectedDay || 'Fri');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const csvFileInputRef = React.useRef(null);
  
  const [colWidths, setColWidths] = useState({
    details: 280
  });
  const [isColumnPinned, setIsColumnPinned] = useState(true);
  const fileInputRef = useRef(null);
  const docInputRef = useRef(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const handleDocChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewEmpForm(prev => ({
        ...prev,
        legalDocName: file.name,
        legalDocUrl: URL.createObjectURL(file)
      }));
    }
  };

  const monthsList = [
    { num: 0, name: 'January' },
    { num: 1, name: 'February' },
    { num: 2, name: 'March' },
    { num: 3, name: 'April' },
    { num: 4, name: 'May' },
    { num: 5, name: 'June' },
    { num: 6, name: 'July' },
    { num: 7, name: 'August' },
    { num: 8, name: 'September' },
    { num: 9, name: 'October' },
    { num: 10, name: 'November' },
    { num: 11, name: 'December' }
  ];
  const currentYearNum = new Date().getFullYear();
  const yearsList = [currentYearNum - 2, currentYearNum - 1, currentYearNum, currentYearNum + 1];

  const handleMonthChange = (monthNum) => {
    const m = parseInt(monthNum);
    setSelectedMonth(m);
    updateDateRangeFromMonthYear(m, selectedYear);
  };

  const handleYearChange = (yearNum) => {
    const y = parseInt(yearNum);
    setSelectedYear(y);
    updateDateRangeFromMonthYear(selectedMonth, y);
  };

  const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    } catch(e) {
      return dateStr;
    }
  };

  const handleStartDateChange = (val) => {
    setStartDate(val);
  };

  const handleEndDateChange = (val) => {
    setEndDate(val);
  };

  const getColWidth = (key) => colWidths[key] || (key === 'details' ? 280 : 200);

  const [showAllEmployees, setShowAllEmployees] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState(null);

  const [resizingCol, setResizingCol] = useState(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(200);

  const [departmentFilter, setDepartmentFilter] = useState(() => savedUserFilters?.departmentFilter || 'ALL');
  const [statusFilter, setStatusFilter] = useState(() => savedUserFilters?.statusFilter || 'ALL');

  // Interactive Dates Picker states - loaded persistently per user
  const [startDate, setStartDate] = useState(() => {
    if (savedUserFilters?.startDate) return savedUserFilters.startDate;
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });

  const [endDate, setEndDate] = useState(() => {
    if (savedUserFilters?.endDate) return savedUserFilters.endDate;
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
    return `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    if (savedUserFilters?.selectedMonth !== undefined && savedUserFilters?.selectedMonth !== null) {
      return parseInt(savedUserFilters.selectedMonth);
    }
    return new Date().getMonth();
  });

  const [selectedYear, setSelectedYear] = useState(() => {
    if (savedUserFilters?.selectedYear !== undefined && savedUserFilters?.selectedYear !== null) {
      return parseInt(savedUserFilters.selectedYear);
    }
    return new Date().getFullYear();
  });

  // Live real-time attendance punches stream (WhatsApp-speed instant delivery)
  const [liveUploadedAttendance, setLiveUploadedAttendance] = useState(() => appState?.hr_uploaded_attendance || []);

  useEffect(() => {
    if (appState?.hr_uploaded_attendance) {
      setLiveUploadedAttendance(appState.hr_uploaded_attendance);
    }
  }, [appState?.hr_uploaded_attendance]);

  // Subscribe to instant WebSocket punch broadcast channel (Instant WhatsApp-style sync)
  useEffect(() => {
    const channel = supabase
      .channel('hr_attendance_realtime_broadcast')
      .on('broadcast', { event: 'attendance_punch' }, ({ payload }) => {
        if (!payload) return;
        const { action, record, empId, empCode, date } = payload;
        
        // 1. Update live uploaded attendance list
        setLiveUploadedAttendance(prev => {
          let updated = [...(prev || [])];
          if (action === 'PUNCH_IN' || action === 'PUNCH_OUT') {
            const idx = updated.findIndex(u => 
              (String(u.employeeId) === String(record.employeeId) || (u.employeeCode && u.employeeCode === record.employeeCode)) && 
              u.date === record.date
            );
            if (idx >= 0) updated[idx] = { ...updated[idx], ...record };
            else updated.unshift(record);
          } else if (action === 'UNDO_IN') {
            updated = updated.filter(u => 
              !((String(u.employeeId) === String(empId) || (u.employeeCode && u.employeeCode === empCode)) && u.date === date)
            );
          } else if (action === 'UNDO_OUT') {
            const idx = updated.findIndex(u => 
              (String(u.employeeId) === String(empId) || (u.employeeCode && u.employeeCode === empCode)) && u.date === date
            );
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], outTime: null, duration: null, status: 'Present' };
            }
          }
          return updated;
        });

        // 2. IMMEDIATELY update localEmployees attendance for instant desktop grid reflection
        setLocalEmployees(prev => prev.map(emp => {
          const isMatch = String(emp.id) === String(empId) || 
                          (emp.employeeCode && String(emp.employeeCode) === String(empCode)) ||
                          (record?.employeeName && String(emp.name).trim().toLowerCase() === String(record.employeeName).trim().toLowerCase());
          if (!isMatch) return emp;

          const currentAtt = { ...(emp.attendance || {}) };
          const dKey = date;

          if (action === 'PUNCH_IN') {
            currentAtt[dKey] = {
              ...(currentAtt[dKey] || {}),
              status: 'present',
              inTime: record.inTime,
              explicitStatus: true
            };
          } else if (action === 'PUNCH_OUT') {
            currentAtt[dKey] = {
              ...(currentAtt[dKey] || {}),
              status: 'present',
              inTime: record.inTime || currentAtt[dKey]?.inTime,
              outTime: record.outTime,
              duration: record.duration,
              explicitStatus: true
            };
          } else if (action === 'UNDO_IN') {
            delete currentAtt[dKey];
          } else if (action === 'UNDO_OUT') {
            if (currentAtt[dKey]) {
              currentAtt[dKey] = {
                ...currentAtt[dKey],
                outTime: null,
                duration: null,
                status: 'present',
                explicitStatus: true
              };
            }
          }
          return { ...emp, attendance: currentAtt };
        }));

        // 3. Audio / Visual notification banner
        setLivePunchNotice({
          empName: record?.employeeName || 'Staff Member',
          action: action === 'PUNCH_IN' ? 'Clocked IN' : (action === 'PUNCH_OUT' ? 'Clocked OUT' : 'Punch Adjusted'),
          time: record?.inTime || record?.outTime || 'Just Now',
          id: Date.now()
        });
        setTimeout(() => setLivePunchNotice(null), 5000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Per-User Filter Persistence: HYDRATION GUARD
  // Only saves to localStorage AFTER mount and ONLY when filters are changed by user
  const isFiltersHydratedRef = useRef(false);
  useEffect(() => {
    isFiltersHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!isFiltersHydratedRef.current) return;
    const currentFilters = {
      startDate,
      endDate,
      selectedMonth,
      selectedYear,
      selectedDay,
      activeConditions,
      searchQuery,
      departmentFilter,
      statusFilter,
      viewMode
    };
    try {
      localStorage.setItem(userFilterKey, JSON.stringify(currentFilters));
    } catch(e) {}
  }, [startDate, endDate, selectedMonth, selectedYear, selectedDay, activeConditions, searchQuery, departmentFilter, statusFilter, viewMode, userFilterKey]);

  const [openColumnMenu, setOpenColumnMenu] = useState(null);

  const updateDateRangeFromMonthYear = (month, year) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const formatDate = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    setStartDate(formatDate(firstDay));
    setEndDate(formatDate(lastDay));
  };

  useEffect(() => {
    const date = new Date(startDate);
    if (!isNaN(date.getTime())) {
      setSelectedMonth(date.getMonth());
      setSelectedYear(date.getFullYear());
    }
  }, [startDate]);

  useEffect(() => {
    if (setDirty) {
      setDirty(isDirty);
    }
    return () => {
      if (setDirty) {
        setDirty(false);
      }
    };
  }, [isDirty, setDirty]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  // Form state for adding employee
  const [newEmpForm, setNewEmpForm] = useState({
    name: '',
    phone: '',
    reference: '',
    avatar: null,
    paidInternship: false,
    legalDocName: '',
    legalDocUrl: null
  });
  const [modalError, setModalError] = useState('');

  // Column Resizer mouse down triggers
  const handleMouseDown = (e, colKey) => {
    setResizingCol(colKey);
    setStartX(e.clientX);
    setStartWidth(getColWidth(colKey));
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingCol) return;
      const minW = resizingCol === 'details' ? 160 : 100;
      const newWidth = Math.max(minW, startWidth + (e.clientX - startX));
      setColWidths(prev => ({
        ...prev,
        [resizingCol]: newWidth
      }));
    };

    const handleMouseUp = () => {
      setResizingCol(null);
    };

    if (resizingCol) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol, startX, startWidth]);

  // Save changes callback
  const handleSaveChanges = () => {
    if (setCollection) {
      setCollection('hr_employees_list', localEmployees);
    } else {
      localStorage.setItem('hr_employees_list', JSON.stringify(localEmployees));
    }
    setIsDirty(false);
    appAlert("Changes saved successfully to database!");
  };

  // Reset changes callback
  const handleResetChanges = () => {
    setLocalEmployees(employees);
    setIsDirty(false);
  };

  // Bind dirty states and hooks to window for intercepting switches in HRModule
  useEffect(() => {
    window.hrAttendanceIsDirty = isDirty;
    window.hrAttendanceSaveChange = handleSaveChanges;
    window.hrAttendanceResetChanges = handleResetChanges;
    return () => {
      window.hrAttendanceIsDirty = false;
      window.hrAttendanceSaveChange = null;
      window.hrAttendanceResetChanges = null;
    };
  }, [isDirty, localEmployees, employees]);

  // Helper to generate weekdays list dynamically
  const getWeekdaysList = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const result = [];
    const temp = new Date(start);

    let count = 0;
    while (temp <= end && count < 35) {
      count++;
      const dayName = temp.toLocaleDateString('en-US', { weekday: 'short' }); // "Mon", "Tue"...
      const dayNum = temp.getDate();
      const y = temp.getFullYear();
      const m = String(temp.getMonth() + 1).padStart(2, '0');
      const d = String(temp.getDate()).padStart(2, '0');
      const dateString = `${y}-${m}-${d}`;
      const isSunday = temp.getDay() === 0 || dayName === 'Sun';

      result.push({
        key: dayName,
        num: dayNum,
        date: dateString,
        isSunday: isSunday
      });
      temp.setDate(temp.getDate() + 1);
    }
    return result.length > 0 ? result : [
      { key: 'Mon', num: 1, isSunday: false },
      { key: 'Tue', num: 2, isSunday: false },
      { key: 'Wed', num: 3, isSunday: false },
      { key: 'Thu', num: 4, isSunday: false },
      { key: 'Fri', num: 5, isSunday: false },
      { key: 'Sat', num: 6, isSunday: false },
      { key: 'Sun', num: 7, isSunday: true }
    ];
  };

  const weekdays = getWeekdaysList();

  // Toggle dynamic condition chips
  const handleToggleCondition = (key) => {
    setActiveConditions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Change employee attendance status inside draft (via select dropdown)
  const handleStatusChange = (empId, day, nextStatus) => {
    setIsDirty(true);
    setLocalEmployees(prev => prev.map(emp => {
      if (emp.id !== empId) return emp;
      const att = emp.attendance || {};
      const record = att[day] || { status: 'absent', ot: 0, fines: 0, deductions: 0 };
      return {
        ...emp,
        attendance: {
          ...att,
          [day]: {
            ...record,
            status: nextStatus,
            ot: nextStatus === 'absent' ? 0.0 : record.ot,
            explicitStatus: true
          }
        }
      };
    }));
  };

  // Bulk set status for all employees for a specific day
  const handleBulkSetDayStatus = (dayKey, nextStatus) => {
    setIsDirty(true);
    setLocalEmployees(prev => prev.map(emp => {
      const att = emp.attendance || {};
      const record = att[dayKey] || { status: 'absent', ot: 0, fines: 0, deductions: 0 };
      return {
        ...emp,
        attendance: {
          ...att,
          [dayKey]: {
            ...record,
            status: nextStatus,
            ot: nextStatus === 'absent' ? 0.0 : record.ot,
            explicitStatus: true
          }
        }
      };
    }));
  };

  // Toggle status (retained for backward compatibility or simple toggles)
  const handleToggleStatus = (empId, day) => {
    setIsDirty(true);
    setLocalEmployees(prev => prev.map(emp => {
      if (emp.id !== empId) return emp;
      const att = emp.attendance || {};
      const record = att[day] || { status: 'absent', ot: 0, fines: 0, deductions: 0 };
      const nextStatus = record.status === 'present' ? 'absent' : 'present';
      return {
        ...emp,
        attendance: {
          ...att,
          [day]: {
            ...record,
            status: nextStatus,
            ot: nextStatus === 'absent' ? 0.0 : record.ot
          }
        }
      };
    }));
  };

  // Stepper adjustment for OT in mobile
  const handleAdjustOT = (empId, day, direction) => {
    setIsDirty(true);
    setLocalEmployees(prev => prev.map(emp => {
      if (emp.id !== empId) return emp;
      const att = emp.attendance || {};
      const record = att[day] || { status: 'present', ot: 0, fines: 0, deductions: 0 };
      const currentVal = parseFloat(record.ot) || 0;
      let nextVal = direction === 'add' ? currentVal + 0.5 : currentVal - 0.5;
      if (nextVal < 0) nextVal = 0;
      return {
        ...emp,
        attendance: {
          ...att,
          [day]: {
            ...record,
            ot: parseFloat(nextVal.toFixed(1))
          }
        }
      };
    }));
  };

  // Input change handler for OT/Fines/Deductions inside draft
  const handleValueChange = (empId, day, field, value) => {
    setIsDirty(true);
    setLocalEmployees(prev => prev.map(emp => {
      if (emp.id !== empId) return emp;
      const att = emp.attendance || {};
      const record = att[day] || { status: 'present', ot: 0, fines: 0, deductions: 0 };
      return {
        ...emp,
        attendance: {
          ...att,
          [day]: {
            ...record,
            [field]: value
          }
        }
      };
    }));
  };

  // Drag and Drop row handlers
  const handleDragStart = (e, empId) => {
    setDraggedIndex(empId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    const sourceId = draggedIndex;
    if (sourceId === targetId) return;

    const sourceIdx = localEmployees.findIndex(emp => emp.id === sourceId);
    const targetIdx = localEmployees.findIndex(emp => emp.id === targetId);

    if (sourceIdx !== -1 && targetIdx !== -1) {
      setIsDirty(true);
      const reorderedList = [...localEmployees];
      const [removed] = reorderedList.splice(sourceIdx, 1);
      reorderedList.splice(targetIdx, 0, removed);
      setLocalEmployees(reorderedList);
    }
    setDraggedIndex(null);
  };

  // Picture File Upload and Live Camera Capture Handlers
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setNewEmpForm(prev => ({ ...prev, avatar: event.target.result }));
        if (modalError) setModalError('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSimulatePhotoCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setCameraStream(stream);
      setIsCameraActive(true);
      if (modalError) setModalError('');
    } catch (err) {
      console.error("Camera access error:", err);
      appAlert("Could not access camera. Please check camera permissions in your browser.");
    }
  };

  const handleCaptureSnapshot = () => {
    const video = document.getElementById('biometric-camera-preview');
    if (video) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      setNewEmpForm(prev => ({ ...prev, avatar: dataUrl }));
      handleStopCamera();
    }
  };

  const handleStopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (!isAddModalOpen) {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
      setIsCameraActive(false);
    }
  }, [isAddModalOpen]);

  const handleAddEmployeeSubmit = (e) => {
    e.preventDefault();
    if (!newEmpForm.name.trim()) {
      setModalError("Employee Name is required!");
      return;
    }
    if (!newEmpForm.phone.trim()) {
      setModalError("Mobile Number is required!");
      return;
    }

    // Sequential Employee ID generator starting from 001
    const generateId = () => {
      const list = localEmployees || [];
      const nums = list.map(emp => {
        const parts = emp.id.split('-');
        if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
          return parseInt(parts[1]);
        }
        return 0;
      });
      const maxNum = Math.max(...nums, 0);
      const nextNum = maxNum + 1;
      const formattedNum = String(nextNum).padStart(3, '0');
      return `EMP-${formattedNum}`;
    };
    const newId = generateId();

    const defaultAttendance = {};
    weekdays.forEach(day => {
      defaultAttendance[day.date || day.key] = { status: 'absent', ot: 0, fines: 0, deductions: 0 };
    });

    const newEmpObject = {
      id: newId,
      name: newEmpForm.name,
      phone: newEmpForm.phone,
      reference: newEmpForm.reference || '',
      paidInternship: newEmpForm.paidInternship,
      avatar: newEmpForm.avatar || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDG__0P4T6hror-vCHiRpSqP6WHrzFlsfyPfV-h0xSlwPUrzKRj94fEqTfct9f2OsJTwNjSJU_dxCItXniNMgE02yWPAWAv7BtSgMKQwM0k6ltYRhP-sX-YkJFmKyXrf9lMkkuCK0e1o-skZszMgFNtrHkD7EDsnfBv0fyeL2Xc7YGBYvBvFtK0T9kNSJvJ3grwZi340chVZmaVyh6qMqB5H4I_161XW4o83aSCth4U4Gm07mQ-wKk3-Te6wxhPblisYK9LU98RyyWi',
      attendance: defaultAttendance,
      legalDocName: newEmpForm.legalDocName || '',
      legalDocUrl: newEmpForm.legalDocUrl || null
    };

    setLocalEmployees(prev => {
      const updated = [newEmpObject, ...prev];
      if (setCollection) {
        setCollection('hr_employees_list', updated);
      } else {
        localStorage.setItem('hr_employees_list', JSON.stringify(updated));
      }
      return updated;
    });

    setIsAddModalOpen(false);
    setNewEmpForm({
      name: '',
      phone: '',
      reference: '',
      avatar: null,
      paidInternship: false,
      legalDocName: '',
      legalDocUrl: null
    });
    setModalError('');
    appAlert(`Success! Employee ${newEmpForm.name} has been added successfully.`);
  };

  // Filter employees list based on search inside local draft state
  // Distinct Departments for Filter Dropdown
  const departmentsList = React.useMemo(() => {
    const set = new Set();
    localEmployees.forEach(emp => {
      if (emp.department) set.add(emp.department);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [localEmployees]);

  const filteredEmployees = localEmployees.filter(emp => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q || 
      (emp.name && emp.name.toLowerCase().includes(q)) ||
      (emp.id && String(emp.id).toLowerCase().includes(q)) ||
      (emp.employeeCode && String(emp.employeeCode).toLowerCase().includes(q)) ||
      (emp.department && emp.department.toLowerCase().includes(q));

    const matchDept = departmentFilter === 'ALL' || !departmentFilter || emp.department === departmentFilter;

    if (!matchSearch || !matchDept) return false;

    if (statusFilter !== 'ALL' && statusFilter) {
      const att = emp.attendance || {};
      const rec = att[startDate] || att[selectedDay] || {};
      if ((rec.status || 'absent').toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
    }

    return true;
  });

  // Pagination bounds (20 entries per page)
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const displayedEmployees = showAllEmployees 
    ? filteredEmployees 
    : filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Simulated Workflows
  const handleBulkReconcile = () => {
    setViewMode('reconcile');
  };

  const handleUploadBiometric = () => {
    appAlert("Biometric Log successfully parsed! Exceptions synchronized.");
  };

  const handleSaveAndSync = () => {
    appAlert("Attendance sheet saved and synced successfully to high-end ERP database!");
  };

  const handleCSVUpload = () => {
    csvFileInputRef.current?.click();
  };

  const handleCSVFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        appAlert("Selected CSV is empty.");
        return;
      }
      
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      let type = '';
      if (headers.includes('status')) {
        type = 'attendance';
      } else if (headers.includes('overtime hours') || headers.includes('overtime')) {
        type = 'overtime';
      } else if (headers.includes('fine amount') || headers.includes('fines') || headers.includes('fine')) {
        type = 'fines';
      } else if (headers.includes('late hours') || headers.includes('late coming') || headers.includes('late')) {
        type = 'late';
      } else {
        appAlert("Invalid CSV format. Please use the downloaded templates.");
        return;
      }
      
      const parsedRecords = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length < 3) continue;
        
        const empId = cols[0];
        const date = cols[1];
        const val = cols[2];
        const reason = cols[3] || '';
        
        if (!empId || !date) continue;
        
        parsedRecords.push({
          employeeId: empId,
          date: date,
          value: val,
          reason: reason
        });
      }
      
      if (parsedRecords.length === 0) {
        appAlert("No valid records found in the uploaded CSV.");
        return;
      }
      
      const existing = [...uploadedAttendance];
      
      parsedRecords.forEach(rec => {
        let match = existing.find(e => e.employeeId === rec.employeeId && e.date === rec.date);
        if (match) {
          if (type === 'attendance') { match.status = rec.value.toLowerCase(); match.statusReason = rec.reason; }
          if (type === 'overtime') { match.ot = parseFloat(rec.value) || 0; match.otReason = rec.reason; }
          if (type === 'fines') { match.fines = parseFloat(rec.value) || 0; match.finesReason = rec.reason; }
          if (type === 'late') { match.deductions = parseFloat(rec.value) || 0; match.deductionsReason = rec.reason; }
        } else {
          const newRec = {
            employeeId: rec.employeeId,
            date: rec.date,
            status: type === 'attendance' ? rec.value.toLowerCase() : 'absent',
            statusReason: type === 'attendance' ? rec.reason : '',
            ot: type === 'overtime' ? (parseFloat(rec.value) || 0) : 0,
            otReason: type === 'overtime' ? rec.reason : '',
            fines: type === 'fines' ? (parseFloat(rec.value) || 0) : 0,
            finesReason: type === 'fines' ? rec.reason : '',
            deductions: type === 'late' ? (parseFloat(rec.value) || 0) : 0,
            deductionsReason: type === 'late' ? rec.reason : ''
          };
          existing.push(newRec);
        }
      });
      
      if (setCollection) {
        setCollection('hr_uploaded_attendance', existing);
      } else {
        localStorage.setItem('hr_uploaded_attendance', JSON.stringify(existing));
      }
      appAlert(`Success! Reconciled and loaded ${parsedRecords.length} records for ${type} from ${file.name}.`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };
 
  const downloadCSVTemplate = (type) => {
    let csvContent = "";
    let fileName = "";
    if (type === 'attendance') {
      csvContent = "Employee ID,Date,Status,Reason\nEMP-4012,2023-10-20,Present,Regular\nEMP-4088,2023-10-20,Present,Regular\nEMP-4033,2023-10-20,Absent,Sick\nEMP-4091,2023-10-20,Present,Regular\nEMP-4022,2023-10-20,Present,Regular\n";
      fileName = "attendance_template.csv";
    } else if (type === 'overtime') {
      csvContent = "Employee ID,Date,Overtime Hours,Reason\nEMP-4012,2023-10-20,2.5,Production Rush\nEMP-4088,2023-10-20,0.0,None\nEMP-4033,2023-10-20,1.0,Shift Handover\nEMP-4091,2023-10-20,0.0,None\nEMP-4022,2023-10-20,2.0,Maintenance\n";
      fileName = "overtime_template.csv";
    } else if (type === 'fines') {
      csvContent = "Employee ID,Date,Fine Amount,Reason\nEMP-4012,2023-10-20,0,None\nEMP-4088,2023-10-20,0,None\nEMP-4033,2023-10-20,10.0,Safety Violation\nEMP-4091,2023-10-20,0,None\nEMP-4022,2023-10-20,0,None\n";
      fileName = "fines_template.csv";
    } else if (type === 'late') {
      csvContent = "Employee ID,Date,Late Hours,Reason\nEMP-4012,2023-10-20,1.5,Traffic Delay\nEMP-4088,2023-10-20,0.0,None\nEMP-4033,2023-10-20,0.0,None\nEMP-4091,2023-10-20,0.0,None\nEMP-4022,2023-10-20,0.0,None\n";
      fileName = "late_coming_template.csv";
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const modalNode = showStudioModal && attendancePrintData ? (
    <UniversalPrintPreviewModal
      isOpen={showStudioModal}
      onClose={() => setShowStudioModal(false)}
      documentType="attendance_sheet"
      documentData={attendancePrintData}
      documentTitle="Attendance Register"
    />
  ) : null;

  if (viewMode === 'reconcile') {
    return <>{renderReconciliationView()}{modalNode}</>;
  }

  if (viewMode === 'calendar') {
    return <>{renderCalendarView()}{modalNode}</>;
  }

  if (isMobile) {
    return <>{renderMobileView()}{modalNode}</>;
  }

  return <>{renderDesktopView()}{modalNode}</>;

  // ========================================================
  // REUSABLE VIEW MODE SWITCHER
  // ========================================================
  function renderViewModeSwitcher() {
    return (
      <div className="flex items-center bg-surface-container p-1 rounded-xl border border-outline-variant/15 shrink-0 shadow-xs">
        <button 
          type="button"
          onClick={() => setViewMode('grid')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            viewMode === 'grid' 
              ? 'bg-surface-container-lowest text-primary shadow-sm' 
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
          title="Verification Grid"
        >
          <span className="material-symbols-outlined text-[16px]">grid_on</span>
          Grid
        </button>
        <button 
          type="button"
          onClick={() => setViewMode('calendar')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            viewMode === 'calendar' 
              ? 'bg-surface-container-lowest text-primary shadow-sm' 
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
          title="Monthly Calendar"
        >
          <span className="material-symbols-outlined text-[16px]">calendar_month</span>
          Calendar
        </button>
        {canReconcile && (
          <button 
            type="button"
            onClick={() => setViewMode('reconcile')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'reconcile' 
                ? 'bg-surface-container-lowest text-primary shadow-sm' 
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            title="Verify & Reconcile"
          >
            <span className="material-symbols-outlined text-[16px]">compare_arrows</span>
            Reconcile
          </button>
        )}
      </div>
    );
  }

  // ========================================================
  // MOBILE VIEW (Supervisor Attendance Log)
  // ========================================================
  function renderMobileView() {
    return (
      <div className="flex flex-col gap-6 animate-fade-in pb-28 select-none">
        
        {/* Welcome Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="font-headline text-2xl font-black text-on-surface tracking-tight leading-tight">Shift Log</h2>
            <p className="font-body text-xs text-on-surface-variant font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-primary">calendar_today</span>
              Oct 24, 2023 (Friday)
            </p>
          </div>
          {renderViewModeSwitcher()}
        </header>

        {/* Dynamic Condition Selector */}
        <section className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/15 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">View Conditions</span>
            <div className="flex gap-1.5">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${selectedDay === day ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-highest text-on-surface-variant'}`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
            {Object.keys(activeConditions).map(cond => {
              const active = activeConditions[cond];
              return (
                <button
                  key={cond}
                  onClick={() => handleToggleCondition(cond)}
                  className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    active 
                      ? 'bg-primary text-white shadow-sm' 
                      : 'bg-surface-container-lowest border border-outline-variant/15 text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: active ? "'FILL' 1" : undefined }}>
                    {cond === 'attendance' ? 'check_circle' : cond === 'overtime' ? 'schedule' : cond === 'fines' ? 'money_off' : 'remove_circle_outline'}
                  </span>
                  <span className="capitalize">{cond}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Employee Shift List */}
        <section className="flex flex-col gap-4">
          {filteredEmployees.map(emp => {
            const record = emp.attendance[selectedDay] || { status: 'absent', ot: 0, fines: 0, deductions: 0 };
            const isPresent = record.status === 'present';
            
            return (
              <div 
                key={emp.id} 
                className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/15 relative overflow-hidden flex flex-col gap-4 group"
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isPresent ? 'bg-primary' : 'bg-tertiary-fixed'}`}></div>
                
                {/* Employee Info Header */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img 
                      alt={emp.name} 
                      className={`w-12 h-12 rounded-full object-cover border border-outline-variant/15 ${!isPresent ? 'opacity-60' : ''}`} 
                      src={emp.avatar} 
                    />
                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface-container-lowest ${isPresent ? 'bg-emerald-500' : 'bg-outline-variant'}`}></span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-headline font-bold text-sm text-on-surface truncate">{emp.name}</h4>
                    <p className="font-body text-[10px] text-on-surface-variant leading-tight truncate">{emp.id} • {emp.role}</p>
                  </div>
                </div>

                {/* Conditional Inputs */}
                <div className="flex flex-col gap-3.5 border-t border-outline-variant/10 pt-3">
                  {activeConditions.attendance && (
                    <div className="flex justify-between items-center">
                      <span className="font-body text-xs font-semibold text-on-surface-variant">Attendance Status</span>
                      <select
                        value={record.status || 'absent'}
                        onChange={(e) => handleStatusChange(emp.id, selectedDay, e.target.value)}
                        className={`bg-surface-container border border-outline-variant/20 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                          record.status === 'present' ? 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20' :
                          record.status === 'absent' ? 'text-red-700 bg-red-500/10 border-red-500/20' :
                          record.status === 'leave' ? 'text-amber-700 bg-amber-500/10 border-amber-500/20' :
                          record.status === 'holiday' ? 'text-blue-700 bg-blue-500/10 border-blue-500/20' :
                          'text-indigo-700 bg-indigo-500/10 border-indigo-500/20' // Off Day
                        }`}
                      >
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="leave">Leave</option>
                        <option value="holiday">Holiday</option>
                        <option value="off day">Off Day</option>
                      </select>
                    </div>
                  )}

                  {activeConditions.overtime && isPresent && (
                    <div className="flex justify-between items-center animate-in fade-in slide-in-from-top-1 duration-150">
                      <span className="font-body text-xs font-semibold text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-tertiary">schedule</span>
                        Overtime Hours
                      </span>
                      <div className="flex items-center gap-2.5">
                        <button 
                          onClick={() => handleAdjustOT(emp.id, selectedDay, 'remove')}
                          className="w-8 h-8 rounded-lg bg-surface-container-low border border-outline-variant/10 flex items-center justify-center text-on-surface hover:bg-surface-container active:scale-95 transition-all"
                        >
                          <span className="material-symbols-outlined text-[16px]">remove</span>
                        </button>
                        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg h-8 px-4 flex items-center justify-center font-black text-xs text-primary min-w-[60px]">
                          {record.ot}h
                        </div>
                        <button 
                          onClick={() => handleAdjustOT(emp.id, selectedDay, 'add')}
                          className="w-8 h-8 rounded-lg bg-surface-container-low border border-outline-variant/10 flex items-center justify-center text-on-surface hover:bg-surface-container active:scale-95 transition-all"
                        >
                          <span className="material-symbols-outlined text-[16px]">add</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {activeConditions.fines && (
                    <div className="flex justify-between items-center animate-in fade-in slide-in-from-top-1 duration-150">
                      <span className="font-body text-xs font-semibold text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-error">money_off</span>
                        Fine Amount ($)
                      </span>
                      <input 
                        type="number"
                        value={record.fines || ''}
                        onChange={(e) => handleValueChange(emp.id, selectedDay, 'fines', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-24 text-right bg-surface-container-low border border-outline-variant/15 rounded-lg px-2 py-1 text-xs text-on-surface font-semibold focus:ring-1 focus:ring-primary/20 outline-none"
                      />
                    </div>
                  )}

                  {activeConditions.deductions && (
                    <div className="flex justify-between items-center animate-in fade-in slide-in-from-top-1 duration-150">
                      <span className="font-body text-xs font-semibold text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-error">remove_circle_outline</span>
                        Deductions ($)
                      </span>
                      <input 
                        type="number"
                        value={record.deductions || ''}
                        onChange={(e) => handleValueChange(emp.id, selectedDay, 'deductions', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-24 text-right bg-surface-container-low border border-outline-variant/15 rounded-lg px-2 py-1 text-xs text-on-surface font-semibold focus:ring-1 focus:ring-primary/20 outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {/* Mobile Bottom Actions Frame */}
        <div className="fixed bottom-0 left-0 w-full pb-20 md:pb-6 px-4 z-40">
          <div className="max-w-md mx-auto flex flex-col gap-2">
            <button 
              onClick={handleUploadBiometric}
              className="w-full bg-surface-container-lowest/95 backdrop-blur border border-outline-variant/15 text-primary text-xs font-bold py-3 rounded-xl shadow flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">fingerprint</span>
              Upload Biometric Log
            </button>
            
            <button 
              onClick={handleSaveAndSync}
              className="w-full primary-gradient text-on-primary text-sm font-bold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">cloud_sync</span>
              Save &amp; Sync Attendance
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ========================================================
  // CALENDAR VIEW (Monthly Workforce Attendance Calendar)
  // ========================================================
  function renderCalendarView() {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const firstDayIndex = new Date(selectedYear, selectedMonth, 1).getDay(); // 0 = Sunday
    const daysInPrevMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const currentMonthName = monthsList.find(m => m.num === selectedMonth)?.name || 'Month';

    const handlePrevMonth = () => {
      if (selectedMonth === 0) {
        const nextM = 11;
        const nextY = selectedYear - 1;
        setSelectedMonth(nextM);
        setSelectedYear(nextY);
        updateDateRangeFromMonthYear(nextM, nextY);
      } else {
        const nextM = selectedMonth - 1;
        setSelectedMonth(nextM);
        updateDateRangeFromMonthYear(nextM, selectedYear);
      }
    };

    const handleNextMonth = () => {
      if (selectedMonth === 11) {
        const nextM = 0;
        const nextY = selectedYear + 1;
        setSelectedMonth(nextM);
        setSelectedYear(nextY);
        updateDateRangeFromMonthYear(nextM, nextY);
      } else {
        const nextM = selectedMonth + 1;
        setSelectedMonth(nextM);
        updateDateRangeFromMonthYear(nextM, selectedYear);
      }
    };

    const handleToday = () => {
      const now = new Date();
      const m = now.getMonth();
      const y = now.getFullYear();
      setSelectedMonth(m);
      setSelectedYear(y);
      updateDateRangeFromMonthYear(m, y);
    };

    // Build the grid cells (Sundays on column 0)
    const calendarCells = [];

    // Previous month padding cells
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dNum = daysInPrevMonth - i;
      const prevM = selectedMonth === 0 ? 11 : selectedMonth - 1;
      const prevY = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
      const mStr = String(prevM + 1).padStart(2, '0');
      const dStr = String(dNum).padStart(2, '0');
      const dateStr = `${prevY}-${mStr}-${dStr}`;
      const dayOfWeek = new Date(prevY, prevM, dNum).getDay();
      calendarCells.push({
        dayNum: dNum,
        date: dateStr,
        isCurrentMonth: false,
        isSunday: dayOfWeek === 0,
        dayOfWeek
      });
    }

    // Current month cells
    const today = new Date();
    const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(selectedMonth + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${selectedYear}-${mStr}-${dStr}`;
      const dayOfWeek = new Date(selectedYear, selectedMonth, d).getDay();
      calendarCells.push({
        dayNum: d,
        date: dateStr,
        isCurrentMonth: true,
        isSunday: dayOfWeek === 0,
        isToday: dateStr === todayDateStr,
        dayOfWeek
      });
    }

    // Trailing padding cells to complete final row of 7
    const remaining = 7 - (calendarCells.length % 7);
    if (remaining < 7) {
      const nextM = selectedMonth === 11 ? 0 : selectedMonth + 1;
      const nextY = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
      for (let d = 1; d <= remaining; d++) {
        const mStr = String(nextM + 1).padStart(2, '0');
        const dStr = String(d).padStart(2, '0');
        const dateStr = `${nextY}-${mStr}-${dStr}`;
        const dayOfWeek = new Date(nextY, nextM, d).getDay();
        calendarCells.push({
          dayNum: d,
          date: dateStr,
          isCurrentMonth: false,
          isSunday: dayOfWeek === 0,
          dayOfWeek
        });
      }
    }

    // Compute summaries per cell date
    const list = filteredEmployees || localEmployees || [];
    const summariesByDate = {};
    let monthTotalPresent = 0;
    let monthTotalAbsent = 0;
    let monthTotalLeave = 0;
    let monthTotalOt = 0;

    calendarCells.forEach(cell => {
      const dateKey = cell.date;
      const dayOfWeekName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][cell.dayOfWeek];
      let pCount = 0;
      let aCount = 0;
      let lCount = 0;
      let otHours = 0;
      let recordedCount = 0;
      const employeeRecords = [];

      list.forEach(emp => {
        const att = emp.attendance || {};
        const empIdStr = String(emp.id || '');
        const empNameLower = String(emp.name || '').trim().toLowerCase();

        let rec = att[dateKey] || att[normalizeDate(dateKey)];
        if (!rec && cell.isCurrentMonth && att[dayOfWeekName]) {
          rec = att[dayOfWeekName];
        }

        // Check realtime punch or uploaded attendance
        if (!rec) {
          const punch = (liveUploadedAttendance || uploadedAttendance || []).find(u =>
            (
              (u.employeeId && (String(u.employeeId) === empIdStr || String(u.employeeId) === String(emp.employeeId))) ||
              (u.employeeName && String(u.employeeName).trim().toLowerCase() === empNameLower)
            ) &&
            (u.date === dateKey || normalizeDate(u.date) === normalizeDate(dateKey))
          );
          if (punch) {
            rec = {
              status: punch.status || 'present',
              ot: punch.ot || 0,
              fines: punch.fines || 0,
              deductions: punch.deductions || 0
            };
          }
        }

        if (rec && rec.status) {
          recordedCount++;
          const st = String(rec.status).toLowerCase();
          if (st === 'present') {
            pCount++;
            if (cell.isCurrentMonth) monthTotalPresent++;
          } else if (st === 'absent') {
            aCount++;
            if (cell.isCurrentMonth) monthTotalAbsent++;
          } else {
            lCount++;
            if (cell.isCurrentMonth) monthTotalLeave++;
          }

          const ot = parseFloat(rec.ot) || 0;
          otHours += ot;
          if (cell.isCurrentMonth) monthTotalOt += ot;

          employeeRecords.push({
            id: emp.id || '—',
            name: emp.name || 'Unnamed',
            department: emp.department || '—',
            division: emp.division || '—',
            shift: emp.shift || '—',
            status: rec.status,
            ot: ot,
            fines: parseFloat(rec.fines) || 0,
            deductions: parseFloat(rec.deductions) || 0
          });
        } else {
          employeeRecords.push({
            id: emp.id || '—',
            name: emp.name || 'Unnamed',
            department: emp.department || '—',
            division: emp.division || '—',
            shift: emp.shift || '—',
            status: 'Not Marked',
            ot: 0,
            fines: 0,
            deductions: 0
          });
        }
      });

      summariesByDate[dateKey] = {
        dateKey,
        present: pCount,
        absent: aCount,
        leave: lCount,
        totalOt: Number(otHours.toFixed(1)),
        recorded: recordedCount,
        total: list.length,
        employees: employeeRecords
      };
    });

    const sundaysInMonth = calendarCells.filter(c => c.isCurrentMonth && c.isSunday).length;
    const workingDaysInMonth = daysInMonth - sundaysInMonth;

    // Filter employees in selected calendar date drill-down
    const selectedDateSummary = selectedCalendarDate ? summariesByDate[selectedCalendarDate] : null;
    let drillDownList = selectedDateSummary ? selectedDateSummary.employees : [];
    if (drillDownList.length > 0) {
      if (calendarDrillFilter !== 'ALL') {
        drillDownList = drillDownList.filter(e => {
          const st = (e.status || '').toLowerCase();
          if (calendarDrillFilter === 'present') return st === 'present';
          if (calendarDrillFilter === 'absent') return st === 'absent';
          if (calendarDrillFilter === 'leave') return st !== 'present' && st !== 'absent' && st !== 'not marked';
          if (calendarDrillFilter === 'not_marked') return st === 'not marked';
          return true;
        });
      }
      if (calendarSearchQuery.trim()) {
        const q = calendarSearchQuery.toLowerCase().trim();
        drillDownList = drillDownList.filter(e =>
          (e.name && e.name.toLowerCase().includes(q)) ||
          (e.id && String(e.id).toLowerCase().includes(q)) ||
          (e.department && e.department.toLowerCase().includes(q))
        );
      }
    }

    return (
      <div className="flex flex-col gap-6 animate-fade-in pb-12 select-none relative">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">calendar_month</span>
              <h1 className="font-headline text-2xl lg:text-3xl font-black text-on-surface tracking-tight leading-tight">
                Workforce Attendance Calendar
              </h1>
            </div>
            <p className="font-body text-xs text-on-surface-variant mt-1.5 font-medium">
              Monthly attendance overview, daily headcount summaries, and weekly off schedule.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {renderViewModeSwitcher()}

            <button
              type="button"
              onClick={() => setShowStudioModal(true)}
              className="px-4 py-2.5 bg-secondary/10 border border-secondary/20 text-secondary hover:bg-secondary/20 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-[0.97] cursor-pointer shadow-sm"
              title="Print Attendance Register"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              Print Register
            </button>
          </div>
        </div>

        {/* Month Navigation & Controls Toolbar */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Month & Year Navigation */}
            <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-xl border border-outline-variant/15">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-surface-container-high rounded-lg text-on-surface-variant hover:text-on-surface transition-all cursor-pointer flex items-center justify-center"
                title="Previous Month"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>

              <select
                value={selectedMonth}
                onChange={e => handleMonthChange(e.target.value)}
                className="bg-transparent font-black text-xs text-on-surface px-2 py-1 outline-none cursor-pointer"
              >
                {monthsList.map(m => (
                  <option key={m.num} value={m.num} className="bg-surface text-on-surface">
                    {m.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={e => handleYearChange(e.target.value)}
                className="bg-transparent font-black text-xs text-on-surface px-2 py-1 outline-none cursor-pointer"
              >
                {yearsList.map(y => (
                  <option key={y} value={y} className="bg-surface text-on-surface">
                    {y}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-surface-container-high rounded-lg text-on-surface-variant hover:text-on-surface transition-all cursor-pointer flex items-center justify-center"
                title="Next Month"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleToday}
              className="px-3 py-2 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/15 rounded-xl text-xs font-bold text-on-surface transition-all active:scale-95 cursor-pointer"
            >
              Today
            </button>

            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
              className="bg-surface-container-low hover:bg-surface-container-high px-3 py-2 rounded-xl border border-outline-variant/15 text-xs font-semibold text-on-surface transition-all outline-none cursor-pointer"
            >
              {departmentsList.map(dept => (
                <option key={dept} value={dept} className="bg-surface text-on-surface">
                  {dept === 'ALL' ? '🏢 All Departments' : dept}
                </option>
              ))}
            </select>
          </div>

          {/* Legend chips */}
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold text-on-surface-variant">
            <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Present
            </span>
            <span className="flex items-center gap-1.5 bg-rose-500/10 text-rose-700 dark:text-rose-400 px-2 py-1 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span> Absent
            </span>
            <span className="flex items-center gap-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Leave/Late
            </span>
            <span className="flex items-center gap-1.5 bg-teal-500/10 text-teal-700 dark:text-teal-400 px-2 py-1 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-teal-500"></span> Overtime
            </span>
            <span className="flex items-center gap-1.5 bg-amber-500/20 text-amber-800 dark:text-amber-300 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/60 px-2 py-1 rounded-lg">
              <span className="material-symbols-outlined text-[13px]">wb_sunny</span> Sunday (Off)
            </span>
          </div>
        </div>

        {/* Monthly Summary KPI Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/10 shadow-xs flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-outline-variant">Headcount</span>
            <span className="text-xl font-black text-on-surface mt-1">{list.length}</span>
            <span className="text-[10px] text-on-surface-variant mt-0.5">Employees</span>
          </div>
          <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/10 shadow-xs flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-outline-variant">Working Days</span>
            <span className="text-xl font-black text-on-surface mt-1">{workingDaysInMonth}</span>
            <span className="text-[10px] text-on-surface-variant mt-0.5">In {currentMonthName}</span>
          </div>
          <div className="bg-amber-500/10 dark:bg-amber-950/30 p-3.5 rounded-2xl border border-amber-300/60 dark:border-amber-700/60 shadow-xs flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Sundays (Off)</span>
            <span className="text-xl font-black text-amber-800 dark:text-amber-200 mt-1">{sundaysInMonth}</span>
            <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">Weekly holidays</span>
          </div>
          <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/10 shadow-xs flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total Present</span>
            <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-1">{monthTotalPresent}</span>
            <span className="text-[10px] text-on-surface-variant mt-0.5">Recorded logs</span>
          </div>
          <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/10 shadow-xs flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Total Absent</span>
            <span className="text-xl font-black text-rose-700 dark:text-rose-400 mt-1">{monthTotalAbsent}</span>
            <span className="text-[10px] text-on-surface-variant mt-0.5">Recorded logs</span>
          </div>
          <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/10 shadow-xs flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">Overtime</span>
            <span className="text-xl font-black text-teal-700 dark:text-teal-400 mt-1">{monthTotalOt.toFixed(1)}h</span>
            <span className="text-[10px] text-on-surface-variant mt-0.5">Total hours</span>
          </div>
        </div>

        {/* Month Calendar Grid */}
        <div className="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <div className="min-w-[640px]">
              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 border-b border-outline-variant/15 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dName, idx) => {
                  const isSundayCol = idx === 0;
                  return (
                    <div
                      key={dName}
                      className={`py-3 px-2 text-xs font-black uppercase tracking-wider ${
                        isSundayCol
                          ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 dark:bg-amber-950/40 border-r border-amber-300/60 dark:border-amber-700/60'
                          : 'bg-surface-container-low text-on-surface-variant border-r last:border-r-0 border-outline-variant/15'
                      }`}
                    >
                      <span>{dName}</span>
                      {isSundayCol && (
                        <span className="block text-[9px] font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                          WEEKLY OFF
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Grid of Days */}
              <div className="grid grid-cols-7 divide-x divide-y divide-outline-variant/10">
                {calendarCells.map((cell, idx) => {
                  const summary = summariesByDate[cell.date];
                  const isSelected = selectedCalendarDate === cell.date;

                  let cellStyle = '';
                  if (!cell.isCurrentMonth) {
                    cellStyle = cell.isSunday
                      ? 'bg-amber-500/[0.03] dark:bg-amber-950/10 text-on-surface-variant/40 border-amber-200/30 dark:border-amber-900/30 opacity-60'
                      : 'bg-surface-container-low/40 text-on-surface-variant/40 opacity-50';
                  } else if (cell.isSunday) {
                    // Highlighted every Sunday in both light and dark themes
                    cellStyle = 'bg-amber-500/[0.08] dark:bg-amber-950/30 border-amber-300/80 dark:border-amber-700/60 text-amber-950 dark:text-amber-200 hover:bg-amber-500/[0.12] dark:hover:bg-amber-950/45';
                  } else {
                    cellStyle = 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low/50';
                  }

                  return (
                    <div
                      key={`${cell.date}-${idx}`}
                      onClick={() => {
                        if (cell.isCurrentMonth) {
                          setSelectedCalendarDate(prev => prev === cell.date ? null : cell.date);
                        }
                      }}
                      className={`min-h-[125px] p-2.5 flex flex-col justify-between transition-all relative cursor-pointer group ${cellStyle} ${
                        isSelected ? 'ring-2 ring-primary ring-inset shadow-md z-10' : ''
                      }`}
                    >
                      {/* Top cell row: Day number and badges */}
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`font-headline text-sm ${
                            cell.isSunday
                              ? 'font-black text-amber-700 dark:text-amber-300'
                              : cell.isCurrentMonth
                              ? 'font-bold text-on-surface'
                              : 'font-normal text-on-surface-variant/40'
                          }`}
                        >
                          {cell.dayNum}
                        </span>

                        <div className="flex items-center gap-1">
                          {cell.isToday && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-primary text-on-primary shadow-2xs">
                              TODAY
                            </span>
                          )}
                          {cell.isSunday && cell.isCurrentMonth && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-500/30">
                              OFF
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Cell Body: Attendance Summary */}
                      {cell.isCurrentMonth ? (
                        summary && summary.recorded > 0 ? (
                          <div className="flex flex-col gap-1 w-full my-1.5">
                            <div className="flex items-center justify-between text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              <span className="flex items-center gap-1 truncate">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                Present
                              </span>
                              <span>{summary.present}</span>
                            </div>
                            {summary.absent > 0 && (
                              <div className="flex items-center justify-between text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                                <span className="flex items-center gap-1 truncate">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                                  Absent
                                </span>
                                <span>{summary.absent}</span>
                              </div>
                            )}
                            {summary.leave > 0 && (
                              <div className="flex items-center justify-between text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                <span className="flex items-center gap-1 truncate">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                  Leave/Late
                                </span>
                                <span>{summary.leave}</span>
                              </div>
                            )}
                            {summary.totalOt > 0 && (
                              <div className="flex items-center justify-between text-[10px] font-bold text-teal-700 dark:text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded">
                                <span className="flex items-center gap-1 truncate">
                                  <span className="material-symbols-outlined text-[11px]">schedule</span>
                                  OT
                                </span>
                                <span>{summary.totalOt}h</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="my-auto py-2">
                            {cell.isSunday ? (
                              <span className="text-[10px] font-bold text-amber-700/80 dark:text-amber-400/80 italic flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">beach_access</span>
                                Weekly Off
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-outline-variant/60 italic">
                                No logs
                              </span>
                            )}
                          </div>
                        )
                      ) : null}

                      {/* Interactive hint on hover */}
                      {cell.isCurrentMonth && (
                        <div className="text-[9px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity text-right">
                          {isSelected ? 'Selected' : 'View →'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Read-only Safe Date Drill-Down Inspector */}
        {selectedCalendarDate && selectedDateSummary && (
          <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-5 shadow-sm animate-fade-in flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">event_available</span>
                  <h3 className="font-headline text-lg font-black text-on-surface">
                    Attendance Log: {new Date(selectedCalendarDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </h3>
                </div>
                <p className="font-body text-xs text-on-surface-variant font-medium mt-0.5">
                  Read-only day breakdown of workforce presence, overtime, and deductions.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCalendarDate(null)}
                  className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container border border-outline-variant/20 rounded-xl text-xs font-bold text-on-surface flex items-center gap-1 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">close</span>
                  Close Panel
                </button>
              </div>
            </div>

            {/* Quick stats for this day */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="bg-surface-container-low p-2.5 rounded-xl border border-outline-variant/10 text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-outline-variant">Total Headcount</span>
                <p className="text-base font-black text-on-surface mt-0.5">{selectedDateSummary.total}</p>
              </div>
              <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Present</span>
                <p className="text-base font-black text-emerald-700 dark:text-emerald-400 mt-0.5">{selectedDateSummary.present}</p>
              </div>
              <div className="bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20 text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">Absent</span>
                <p className="text-base font-black text-rose-700 dark:text-rose-400 mt-0.5">{selectedDateSummary.absent}</p>
              </div>
              <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Leave / Late</span>
                <p className="text-base font-black text-amber-700 dark:text-amber-400 mt-0.5">{selectedDateSummary.leave}</p>
              </div>
              <div className="bg-teal-500/10 p-2.5 rounded-xl border border-teal-500/20 text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">Overtime</span>
                <p className="text-base font-black text-teal-700 dark:text-teal-400 mt-0.5">{selectedDateSummary.totalOt}h</p>
              </div>
            </div>

            {/* Filter and Search Bar for Drill-down list */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
                {[
                  { key: 'ALL', label: `All (${selectedDateSummary.employees.length})` },
                  { key: 'present', label: `Present (${selectedDateSummary.present})` },
                  { key: 'absent', label: `Absent (${selectedDateSummary.absent})` },
                  { key: 'leave', label: `Leave/Late (${selectedDateSummary.leave})` },
                  { key: 'not_marked', label: `Not Marked (${selectedDateSummary.total - selectedDateSummary.recorded})` }
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setCalendarDrillFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      calendarDrillFilter === tab.key
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant text-[15px]">search</span>
                <input
                  type="text"
                  value={calendarSearchQuery}
                  onChange={e => setCalendarSearchQuery(e.target.value)}
                  placeholder="Filter by name, ID, or dept..."
                  className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl pl-9 pr-3 py-1.5 text-xs text-on-surface font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Employee Records Table (Read-Only) */}
            <div className="border border-outline-variant/15 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-container-low text-[10px] font-black uppercase tracking-wider text-outline-variant sticky top-0 z-10 shadow-2xs">
                  <tr>
                    <th className="px-4 py-2.5">ID</th>
                    <th className="px-4 py-2.5">Employee Name</th>
                    <th className="px-4 py-2.5">Department</th>
                    <th className="px-4 py-2.5">Division</th>
                    <th className="px-4 py-2.5">Shift</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                    <th className="px-4 py-2.5 text-right">OT Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 font-medium text-on-surface">
                  {drillDownList.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-6 text-on-surface-variant italic">
                        No employees found matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    drillDownList.map((emp, i) => {
                      const st = (emp.status || '').toLowerCase();
                      let statusBadge = (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-container text-on-surface-variant">
                          Not Marked
                        </span>
                      );
                      if (st === 'present') {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            Present
                          </span>
                        );
                      } else if (st === 'absent') {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                            Absent
                          </span>
                        );
                      } else if (st === 'leave' || st === 'late' || st === 'half_day') {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 capitalize">
                            {emp.status}
                          </span>
                        );
                      }

                      return (
                        <tr key={`${emp.id}-${i}`} className="hover:bg-surface-container-low/40 transition-colors">
                          <td className="px-4 py-2 font-mono font-bold text-primary">{emp.id || '—'}</td>
                          <td className="px-4 py-2 font-bold text-on-surface">{emp.name}</td>
                          <td className="px-4 py-2 text-on-surface-variant">{emp.department || '—'}</td>
                          <td className="px-4 py-2 text-on-surface-variant">{emp.division || '—'}</td>
                          <td className="px-4 py-2 text-on-surface-variant">{emp.shift || '—'}</td>
                          <td className="px-4 py-2 text-center">{statusBadge}</td>
                          <td className="px-4 py-2 text-right font-mono font-bold text-teal-700 dark:text-teal-400">
                            {emp.ot > 0 ? `${emp.ot}h` : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========================================================
  // RECONCILIATION VIEW (Comparative Side-by-Side Dual Grid)
  // ========================================================
  function renderReconciliationView() {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const temp = new Date(start);
      let count = 0;
      while (temp <= end && count < 35) {
        count++;
        const dayName = temp.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = temp.getDate();
        const y = temp.getFullYear();
        const m = String(temp.getMonth() + 1).padStart(2, '0');
        const d = String(temp.getDate()).padStart(2, '0');
        const dateString = `${y}-${m}-${d}`;
        const isSunday = temp.getDay() === 0 || dayName === 'Sun';
        dates.push({
          key: dayName,
          num: dayNum,
          date: dateString,
          isSunday: isSunday
        });
        temp.setDate(temp.getDate() + 1);
      }
    }

    const handleSyncCell = (empId, date, uploaded) => {
      setIsDirty(true);
      setLocalEmployees(prev => prev.map(emp => {
        if (emp.id !== empId) return emp;
        const att = emp.attendance || {};
        return {
          ...emp,
          attendance: {
            ...att,
            [date]: {
              status: uploaded.status || 'absent',
              ot: uploaded.ot || 0,
              fines: uploaded.fines || 0,
              deductions: uploaded.deductions || 0
            }
          }
        };
      }));
      appAlert(`Cell synced for ${date}!`);
    };

    const handleSyncAllReconciliation = () => {
      let syncCount = 0;
      setIsDirty(true);
      setLocalEmployees(prev => prev.map(emp => {
        const att = { ...(emp.attendance || {}) };
        dates.forEach(day => {
          const systemRec = att[day.date] || att[day.key] || { status: 'absent', ot: 0, fines: 0, deductions: 0 };
          const uploadedRec = uploadedAttendance.find(u => u.employeeId === emp.id && normalizeDate(u.date) === normalizeDate(day.date));
          if (uploadedRec) {
            const isMismatch = (systemRec.status || 'absent').toLowerCase() !== (uploadedRec.status || 'absent').toLowerCase() || 
                               parseFloat(systemRec.ot || 0) !== parseFloat(uploadedRec.ot || 0) || 
                               parseFloat(systemRec.fines || 0) !== parseFloat(uploadedRec.fines || 0) || 
                               parseFloat(systemRec.deductions || 0) !== parseFloat(uploadedRec.deductions || 0);
            if (isMismatch) {
              const saveKey = day.date || day.key;
              att[saveKey] = {
                status: uploadedRec.status || 'absent',
                ot: uploadedRec.ot || 0,
                fines: uploadedRec.fines || 0,
                deductions: uploadedRec.deductions || 0
              };
              syncCount++;
            }
          }
        });
        return { ...emp, attendance: att };
      }));
      appAlert(`Successfully synchronized ${syncCount} mismatched records to software draft. Click "Save Changes" on the toolbar to permanently save.`);
    };

    // Calculate total mismatches for display
    let mismatchCount = 0;
    localEmployees.forEach(emp => {
      dates.forEach(day => {
        const systemRec = emp.attendance?.[day.date] || emp.attendance?.[day.key] || { status: 'absent', ot: 0, fines: 0, deductions: 0 };
        const uploadedRec = uploadedAttendance.find(u => u.employeeId === emp.id && normalizeDate(u.date) === normalizeDate(day.date));
        if (uploadedRec) {
          const isMismatch = (systemRec.status || 'absent').toLowerCase() !== (uploadedRec.status || 'absent').toLowerCase() || 
                             parseFloat(systemRec.ot || 0) !== parseFloat(uploadedRec.ot || 0) || 
                             parseFloat(systemRec.fines || 0) !== parseFloat(uploadedRec.fines || 0) || 
                             parseFloat(systemRec.deductions || 0) !== parseFloat(uploadedRec.deductions || 0);
          if (isMismatch) mismatchCount++;
        }
      });
    });

    return (
      <div className="flex flex-col gap-4 animate-fade-in select-none relative w-full h-full min-h-[calc(100vh-5rem)] flex-1 overflow-hidden">
        {/* Live Punch WhatsApp-Speed Floating Notification Banner */}
        {livePunchNotice && (
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center justify-between animate-bounce border border-white/20 select-none">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-white text-2xl animate-spin">sync</span>
              <div>
                <p className="text-xs font-black tracking-wide">⚡ REALTIME PUNCH RECEIVED FROM MOBILE APP</p>
                <p className="text-[11px] font-semibold text-emerald-100">
                  <b>{livePunchNotice.empName}</b> {livePunchNotice.action} at <b>{livePunchNotice.time}</b>
                </p>
              </div>
            </div>
            <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Live Sync</span>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="font-headline text-3xl font-black text-on-surface tracking-tight leading-tight">Workforce Reconciliation Grid</h1>
            <p className="font-body text-xs text-on-surface-variant mt-1.5 font-medium">Compare local database records side-by-side with uploaded CSV files.</p>
          </div>
          
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {renderViewModeSwitcher()}
            <button 
              onClick={() => setViewMode('grid')}
              className="px-4 py-2.5 bg-surface-container-low hover:bg-surface-container border border-outline-variant/15 rounded-xl text-xs font-bold text-on-surface flex items-center gap-2 transition-all active:scale-[0.97] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Grid
            </button>
            <button 
              onClick={handleSaveChanges}
              className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all active:scale-[0.97] cursor-pointer relative shadow-lg ${
                isDirty 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse' 
                  : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 cursor-default opacity-85'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              Save Changes
              {isDirty && (
                <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-bounce"></span>
              )}
            </button>
            <button 
              onClick={handleCSVUpload}
              className="px-4 py-2.5 bg-surface-container-low hover:bg-surface-container border border-outline-variant/15 rounded-xl text-xs font-bold text-secondary flex items-center gap-2 transition-all active:scale-[0.97] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              Upload CSV/Excel
            </button>
            {mismatchCount > 0 && (
              <button 
                onClick={handleSyncAllReconciliation}
                className="px-5 py-2.5 primary-gradient hover:shadow hover:shadow-primary/10 rounded-xl text-xs font-black text-white flex items-center gap-2 transition-all active:scale-[0.97] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">sync_alt</span>
                Sync All Mismatches ({mismatchCount})
              </button>
            )}
          </div>
        </div>

        {/* Global Controls & Date Search */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-initial">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant text-[16px]">search</span>
              <input 
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Quick search employees..."
                className="w-full md:w-64 bg-surface-container-low border border-outline-variant/15 rounded-xl pl-9 pr-4 py-2 text-xs text-on-surface font-semibold focus:bg-surface-container-lowest focus:border-primary/50 transition-all focus:ring-0 outline-none"
              />
            </div>
            
            {/* Month Select */}
            <div className="relative">
              <select 
                value={selectedMonth}
                onChange={e => {
                  const m = parseInt(e.target.value);
                  setSelectedMonth(m);
                  updateDateRangeFromMonthYear(m, selectedYear);
                }}
                className="bg-surface-container-low hover:bg-surface-container-high px-3 py-2 rounded-xl border border-outline-variant/15 text-xs font-semibold text-on-surface transition-all outline-none cursor-pointer"
              >
                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, idx) => (
                  <option key={month} value={idx}>{month}</option>
                ))}
              </select>
            </div>

            {/* Year Select */}
            <div className="relative">
              <select 
                value={selectedYear}
                onChange={e => {
                  const y = parseInt(e.target.value);
                  setSelectedYear(y);
                  updateDateRangeFromMonthYear(selectedMonth, y);
                }}
                className="bg-surface-container-low hover:bg-surface-container-high px-3 py-2 rounded-xl border border-outline-variant/15 text-xs font-semibold text-on-surface transition-all outline-none cursor-pointer"
              >
                {[2022, 2023, 2024, 2025, 2026].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Interactive Date Picker Button */}
            <div className="relative">
              <button 
                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                className="bg-surface-container-low hover:bg-surface-container-high px-4 py-2 rounded-xl border border-outline-variant/15 text-xs font-semibold text-on-surface flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">calendar_month</span>
                {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                <span className="material-symbols-outlined text-[14px] text-slate-400">expand_more</span>
              </button>
              
              {isDatePickerOpen && (
                <div className="absolute left-0 mt-2 z-50 bg-surface border border-outline-variant/30 rounded-2xl p-4 shadow-xl flex flex-col gap-3 min-w-[280px] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-primary">Start Date</span>
                    <input 
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="bg-surface border border-outline-variant/30 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-transparent text-on-surface"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-primary">End Date</span>
                    <input 
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="bg-surface border border-outline-variant/30 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-transparent text-on-surface"
                    />
                  </div>
                  <button 
                    onClick={() => setIsDatePickerOpen(false)}
                    className="w-full bg-primary hover:bg-primary-container text-on-primary text-xs font-bold py-2 rounded-xl transition-colors mt-1 cursor-pointer"
                  >
                    Apply Filter
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Double-Column Table Layout */}
        <div className="border border-outline-variant/15 rounded-2xl overflow-hidden bg-surface-container-lowest shadow-sm flex flex-col flex-1 w-full h-full min-h-0">
          <div className="overflow-x-auto no-scrollbar relative flex-1 w-full h-full overflow-y-auto min-h-0">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-left sticky top-0 z-25 shadow-sm">
                  <th rowSpan="2" className="px-6 py-4 border-b border-r border-outline-variant/20 min-w-[240px] sticky left-0 z-30 bg-surface-container-low shadow-[2px_0_5px_rgba(0,0,0,0.03)]">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee Details</span>
                  </th>
                  {dates.map(day => (
                    <th key={day.date} colSpan="2" className={`px-4 py-2 border-b border-l border-outline-variant/20 text-center font-headline min-w-[240px] ${
                      day.isSunday ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-surface-container-low'
                    }`}>
                      <div className="flex flex-col items-center">
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${
                          day.isSunday ? 'text-amber-600 dark:text-amber-400 font-black' : 'text-slate-400'
                        }`}>
                          {day.key} {day.isSunday ? '• OFF' : ''}
                        </span>
                        <span className="text-sm font-black text-on-surface">{day.num} ({new Date(day.date).toLocaleDateString('en-US', { month: 'short' })})</span>
                      </div>
                    </th>
                  ))}
                </tr>
                <tr className="bg-surface-container-low text-left sticky top-[52px] z-20 shadow-sm border-b border-outline-variant/20 text-[9px] uppercase tracking-widest text-slate-400 font-bold">
                  {dates.map(day => (
                    <React.Fragment key={day.date + '-sub'}>
                      <th className="px-3 py-2 border-l border-outline-variant/10 text-center w-[120px] bg-surface-container-low">System</th>
                      <th className="px-3 py-2 border-l border-outline-variant/10 text-center w-[120px] bg-surface-container-low">Uploaded</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              
              <tbody className="divide-y divide-outline-variant/15">
                {displayedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={dates.length * 2 + 1} className="text-center py-10 font-body text-xs text-on-surface-variant">
                      No matching records found in this reconciliation period.
                    </td>
                  </tr>
                ) : (
                  displayedEmployees.map(emp => (
                    <tr key={emp.id} className="hover:bg-surface-container-low/30 transition-colors group">
                      {/* Pinned Employee Details Column */}
                      <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-slate-50 border-r border-outline-variant/10 shadow-[2px_0_5px_rgba(0,0,0,0.03)] z-10 transition-colors">
                        <div className="flex items-center gap-3">
                          <img className="w-9 h-9 rounded-full object-cover border border-outline-variant/10 shadow-sm shrink-0" src={emp.avatar} alt={emp.name} />
                          <div className="min-w-0">
                            <h4 className="font-headline font-bold text-xs text-on-surface leading-tight truncate">{emp.name}</h4>
                            <p className="text-[9px] font-bold text-primary mt-0.5 leading-none">{emp.id}</p>
                          </div>
                        </div>
                      </td>

                      {/* Date Cells */}
                      {dates.map(day => {
                        const systemRec = emp.attendance?.[day.date] || emp.attendance?.[day.key] || { status: 'absent', ot: 0, fines: 0, deductions: 0 };
                        const uploadedRec = uploadedAttendance.find(u => u.employeeId === emp.id && normalizeDate(u.date) === normalizeDate(day.date));
                        const isUploadedPresent = !!uploadedRec;
                        
                        const isMismatch = isUploadedPresent && (
                          (systemRec.status || 'absent').toLowerCase() !== (uploadedRec.status || 'absent').toLowerCase() ||
                          parseFloat(systemRec.ot || 0) !== parseFloat(uploadedRec.ot || 0) ||
                          parseFloat(systemRec.fines || 0) !== parseFloat(uploadedRec.fines || 0) ||
                          parseFloat(systemRec.deductions || 0) !== parseFloat(uploadedRec.deductions || 0)
                        );

                        return (
                          <React.Fragment key={day.date + '-' + emp.id}>
                            {/* System record cell */}
                            <td className={`px-2 py-2 border-l border-outline-variant/10 text-center text-[10px] transition-colors ${
                              isMismatch ? 'bg-red-500/10 text-red-700 font-bold border-red-500/30' : 'text-on-surface-variant'
                            }`}>
                              <div className="flex flex-col gap-1 items-center">
                                <select
                                  value={systemRec.status || 'absent'}
                                  onChange={(e) => handleStatusChange(emp.id, day.date || day.key, e.target.value)}
                                  className={`w-full max-w-[100px] bg-white border border-outline-variant/20 rounded px-1.5 py-0.5 text-[10px] font-bold outline-none cursor-pointer ${
                                    systemRec.status === 'present' ? 'text-emerald-700 border-emerald-500/30 bg-emerald-500/5' :
                                    systemRec.status === 'absent' ? 'text-red-700 border-red-500/30 bg-red-500/5' :
                                    systemRec.status === 'leave' ? 'text-amber-700 border-amber-500/30 bg-amber-500/5' :
                                    systemRec.status === 'holiday' ? 'text-blue-700 border-blue-500/30 bg-blue-500/5' :
                                    'text-indigo-700 border-indigo-500/30 bg-indigo-500/5' // Off Day
                                  }`}
                                >
                                  <option value="present">Present</option>
                                  <option value="absent">Absent</option>
                                  <option value="leave">Leave</option>
                                  <option value="holiday">Holiday</option>
                                  <option value="off day">Off Day</option>
                                </select>
                                {uploadedRec && uploadedRec.inTime && (
                                  <div className="flex flex-col gap-0.5 text-[8px] font-mono mt-0.5 w-full bg-emerald-500/10 p-1 rounded border border-emerald-500/20">
                                    <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                      IN: {uploadedRec.inTime}
                                    </span>
                                    {uploadedRec.outTime && (
                                      <span className="text-purple-700 dark:text-purple-400 font-bold flex items-center justify-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                        OUT: {uploadedRec.outTime}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {(systemRec.ot > 0 || systemRec.fines > 0 || systemRec.deductions > 0) && (
                                  <span className="text-[8px] text-slate-400 font-mono">
                                    {systemRec.ot > 0 ? `OT:${systemRec.ot}h ` : ''}
                                    {systemRec.fines > 0 ? `F:${systemRec.fines} ` : ''}
                                    {systemRec.deductions > 0 ? `L:${systemRec.deductions}h` : ''}
                                  </span>
                                )}
                              </div>
                            </td>
                            
                            {/* Uploaded CSV record cell */}
                            <td className={`px-3 py-2.5 border-l border-outline-variant/10 text-center text-[10px] transition-colors ${
                              isMismatch ? 'bg-red-500/10 text-red-700 font-bold border-red-500/30 font-extrabold' : 'text-on-surface-variant'
                            }`}>
                              {isUploadedPresent ? (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="font-extrabold uppercase text-[9px] text-primary">
                                    {uploadedRec.status || 'absent'}
                                  </span>
                                  {(uploadedRec.ot > 0 || uploadedRec.fines > 0 || uploadedRec.deductions > 0) && (
                                    <span className="text-[8px] text-slate-400 font-mono">
                                      {uploadedRec.ot > 0 ? `OT:${uploadedRec.ot}h ` : ''}
                                      {uploadedRec.fines > 0 ? `F:$${uploadedRec.fines} ` : ''}
                                      {uploadedRec.deductions > 0 ? `L:${uploadedRec.deductions}h` : ''}
                                    </span>
                                  )}
                                  {isMismatch && (
                                    <button
                                      type="button"
                                      onClick={() => handleSyncCell(emp.id, day.date || day.key, uploadedRec)}
                                      className="mt-1 px-1.5 py-0.5 bg-primary hover:bg-primary-container text-on-primary text-[8px] font-black rounded flex items-center gap-0.5 cursor-pointer shadow-sm active:scale-95 transition-all"
                                      title="Sync System record to matches CSV record"
                                    >
                                      <span className="material-symbols-outlined text-[10px]">sync</span>
                                      Sync
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300 italic font-mono">-</span>
                              )}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Reconciliation Pagination & List-view control footer */}
          <div className="bg-surface-container-low px-6 py-4 border-t border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-semibold text-on-surface-variant">
            <div className="flex flex-wrap items-center gap-6">
              <span>Showing <b>{displayedEmployees.length}</b> employees of <b>{filteredEmployees.length}</b> total</span>
              <div className="flex items-center gap-2 select-none">
                <span className="w-2.5 h-2.5 bg-red-500/25 border border-red-500/50 rounded-full"></span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Mismatches Highlighted</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Pagination Toggle */}
              <div className="flex items-center gap-2 pr-4 border-r border-outline-variant/20 select-none">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Show All At Once</span>
                <label className="erp-toggle">
                  <input 
                    type="checkbox"
                    checked={showAllEmployees}
                    onChange={() => setShowAllEmployees(!showAllEmployees)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {!showAllEmployees && (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 hover:bg-white rounded-lg border border-outline-variant/10 bg-surface-container-lowest transition-colors active:scale-95 cursor-pointer flex items-center justify-center disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <span>Page {currentPage} of {totalPages || 1}</span>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 hover:bg-white rounded-lg border border-outline-variant/10 bg-surface-container-lowest transition-colors active:scale-95 cursor-pointer flex items-center justify-center disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
  function FieldCommentButton({ empId, dayKey, field, value, reasonField }) {
    const isSelected = activeComment?.empId === empId && activeComment?.dayKey === dayKey && activeComment?.field === reasonField;
    const reasonText = value[reasonField] || '';
    const hasReason = reasonText.trim().length > 0;
    
    return (
      <div className="relative flex items-center justify-center shrink-0 group">
        {/* Icon button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isSelected) {
              saveComment();
            } else {
              openCommentPopup(empId, dayKey, reasonField, reasonText);
            }
          }}
          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
            hasReason 
              ? 'bg-primary/10 text-primary hover:bg-primary/20' 
              : 'text-slate-350 hover:bg-slate-100 hover:text-slate-600'
          }`}
          title={hasReason ? `Reason: ${reasonText}` : 'Add comment'}
        >
          <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: hasReason ? "'FILL' 1" : undefined }}>
            {hasReason ? 'chat_bubble' : 'chat_bubble_outline'}
          </span>
        </button>

        {/* Hover Tooltip (shows reason on cursor hover) */}
        {hasReason && !isSelected && (
          <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:block z-30 bg-slate-800 text-white text-[9px] font-bold py-1 px-2 rounded shadow-md whitespace-nowrap pointer-events-none">
            {reasonText}
          </div>
        )}

        {/* Click Popup Bubble */}
        {isSelected && (
          <div 
            className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white border border-outline-variant/30 rounded-xl p-3 shadow-xl flex flex-col gap-2 min-w-[200px] text-left animate-in fade-in slide-in-from-bottom-1 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[9px] uppercase tracking-wider font-bold text-primary font-sans">Reason / Remarks</span>
            <textarea
              autoFocus
              rows={2}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Type reason here..."
              className="w-full bg-[#f0f2f5] border border-outline-variant/15 rounded-lg p-1.5 text-[10px] outline-none focus:ring-1 focus:ring-primary text-on-surface resize-none font-medium"
            />
            <div className="flex justify-end gap-1.5 mt-0.5">
              <button
                type="button"
                onClick={saveComment}
                className="bg-primary text-on-primary text-[9px] font-bold px-2.5 py-1 rounded-lg shadow cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setActiveComment(null)}
                className="border border-outline-variant text-[9px] font-bold px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========================================================
  // MOBILE CARD VIEW (Workforce Attendance Management Card View)
  // ========================================================
  function renderMobileCardView() {
    return (
      <div className="flex flex-col gap-6 animate-fade-in pb-12 select-none relative">
        {/* Mobile Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">style</span>
              <h1 className="font-headline text-xl font-black text-on-surface tracking-tight leading-tight">Workforce Attendance Management Card View</h1>
            </div>
            <p className="font-body text-xs text-on-surface-variant mt-1 font-medium">Review and reconcile attendance, overtime, and policy logs in card mode.</p>
          </div>
        </div>

        {/* Dynamic Action Bar (respecting granular permissions) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {canEditAttendance && (
            <button 
              onClick={handleSaveChanges}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all active:scale-[0.97] cursor-pointer shadow-md ${
                isDirty 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse' 
                  : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 cursor-default opacity-85'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              Save Changes
              {isDirty && (
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-bounce"></span>
              )}
            </button>
          )}

          {canAddEmployee && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-2 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              Add Employee
            </button>
          )}

          {canUploadCSV && (
            <>
              <button 
                onClick={handleCSVUpload}
                className="px-3.5 py-2 bg-surface-container-low hover:bg-surface-container border border-outline-variant/15 rounded-xl text-xs font-bold text-secondary flex items-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">upload_file</span>
                Upload CSV
              </button>
              <button 
                onClick={() => setIsDownloadModalOpen(true)}
                className="text-xs font-bold text-primary hover:underline transition-all cursor-pointer px-2"
              >
                Template
              </button>
            </>
          )}

          {canReconcile && (
            <button 
              onClick={handleBulkReconcile}
              className="px-4 py-2 primary-gradient rounded-xl text-xs font-black text-white flex items-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer ml-auto"
            >
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
              Verify &amp; Reconcile
            </button>
          )}
        </div>

        {/* Search & Date Filters Bar */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
            <div className="relative flex-1 w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Quick search employees by name, code, dept..." 
                className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-on-surface placeholder:text-slate-400 focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary focus:border-transparent transition-all outline-none"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-on-surface text-[14px]"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Department Filter Dropdown (Saved per user) */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={departmentFilter}
                onChange={(e) => { setDepartmentFilter(e.target.value); setCurrentPage(1); }}
                className="w-full sm:w-auto bg-white border border-outline-variant/20 rounded-xl px-3 py-2 text-xs font-bold text-on-surface cursor-pointer shadow-2xs outline-none focus:ring-1 focus:ring-primary"
                title="Filter by Department (Saved for your user profile)"
              >
                {departmentsList.map(dept => (
                  <option key={dept} value={dept}>
                    {dept === 'ALL' ? '🏢 All Departments' : dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {canUseDateFilter && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <select 
                value={selectedMonth} 
                onChange={(e) => handleMonthChange(e.target.value)}
                className="bg-white border border-outline-variant/20 rounded-xl px-2.5 py-1.5 text-xs font-bold text-on-surface cursor-pointer shadow-2xs"
              >
                {monthsList.map(m => (
                  <option key={m.num} value={m.num}>{m.name}</option>
                ))}
              </select>
              <select 
                value={selectedYear} 
                onChange={(e) => handleYearChange(e.target.value)}
                className="bg-white border border-outline-variant/20 rounded-xl px-2.5 py-1.5 text-xs font-bold text-on-surface cursor-pointer shadow-2xs"
              >
                {yearsList.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  className="bg-white border border-outline-variant/20 rounded-xl px-3 py-1.5 text-xs font-bold text-on-surface flex items-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">calendar_month</span>
                  <span>{formatDateForDisplay(startDate)} - {formatDateForDisplay(endDate)}</span>
                </button>

                {isDatePickerOpen && (
                  <div className="absolute left-0 mt-2 z-50 bg-white border border-outline-variant/30 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 min-w-[260px] animate-in fade-in duration-150">
                    <span className="text-[10px] font-black uppercase text-primary tracking-wider">Select Attendance Period</span>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-slate-400">Start Date</span>
                        <input 
                          type="date" 
                          value={startDate} 
                          onChange={(e) => handleStartDateChange(e.target.value)}
                          className="border border-outline-variant/20 rounded-lg p-1.5 text-xs font-semibold text-on-surface outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-slate-400">End Date</span>
                        <input 
                          type="date" 
                          value={endDate} 
                          onChange={(e) => handleEndDateChange(e.target.value)}
                          className="border border-outline-variant/20 rounded-lg p-1.5 text-xs font-semibold text-on-surface outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/10">
                      <button
                        type="button"
                        onClick={() => setIsDatePickerOpen(false)}
                        className="px-3 py-1 bg-primary text-white text-[10px] font-bold rounded-lg cursor-pointer"
                      >
                        Apply Range
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {(canFilterAttendance || canFilterOvertime || canFilterFines || canFilterDeductions) && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-outline-variant/10">
              <span className="text-[9px] font-bold uppercase text-slate-400 shrink-0 mr-1">Active Filters:</span>
              {canFilterAttendance && (
                <button 
                  onClick={() => setActiveConditions(prev => ({ ...prev, attendance: !prev.attendance }))}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                    activeConditions.attendance ? 'bg-primary text-on-primary shadow-2xs' : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  Attendance
                </button>
              )}
              {canFilterOvertime && (
                <button 
                  onClick={() => setActiveConditions(prev => ({ ...prev, overtime: !prev.overtime }))}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                    activeConditions.overtime ? 'bg-primary text-on-primary shadow-2xs' : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  Overtime
                </button>
              )}
              {canFilterFines && (
                <button 
                  onClick={() => setActiveConditions(prev => ({ ...prev, fines: !prev.fines }))}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                    activeConditions.fines ? 'bg-primary text-on-primary shadow-2xs' : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  Fines
                </button>
              )}
              {canFilterDeductions && (
                <button 
                  onClick={() => setActiveConditions(prev => ({ ...prev, deductions: !prev.deductions }))}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                    activeConditions.deductions ? 'bg-primary text-on-primary shadow-2xs' : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  Late Coming
                </button>
              )}
            </div>
          )}
        </div>

        {/* Employee Cards Container */}
        <div className="space-y-4">
          {displayedEmployees.length === 0 ? (
            <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/10 text-center text-xs font-semibold text-on-surface-variant">
              No matching records found in this shift batch.
            </div>
          ) : (
            displayedEmployees.map(emp => (
              <article 
                key={emp.id}
                className="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl p-4 shadow-sm space-y-3 transition-all hover:border-primary/30"
              >
                {/* Employee Card Header */}
                <div className="flex items-center gap-3 border-b border-outline-variant/10 pb-3">
                  <div className="relative">
                    <img 
                      className="w-12 h-12 rounded-full object-cover border border-outline-variant/10 shadow-sm shrink-0" 
                      src={emp.avatar} 
                      alt={emp.name} 
                    />
                    {emp.paidInternship && (
                      <span className="absolute -top-1 -right-1 bg-tertiary text-white text-[7px] font-extrabold px-1 rounded-full border border-white">
                        INT
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-headline font-bold text-sm text-on-surface truncate">{emp.name}</h4>
                      <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0">{emp.id}</span>
                    </div>
                    {emp.phone && <p className="text-[10px] text-slate-400 font-medium mt-0.5">{emp.phone}</p>}
                    {(emp.department || emp.section) && (
                      <p className="text-[9px] font-bold text-secondary mt-0.5 uppercase tracking-wider truncate">
                        {emp.department}{emp.section ? ` • ${emp.section}` : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* Horizontal Scrollable Dates Strip */}
                <div className="flex overflow-x-auto no-scrollbar snap-x gap-3 p-1">
                  {weekdays.map(day => {
                    const colKey = day.key + '-' + day.num;
                    const att = emp.attendance || {};
                    let rec = att[day.date] || att[day.key] || { status: 'absent', ot: 0, fines: 0, deductions: 0 };

                    const empNameLower = String(emp.name || '').trim().toLowerCase();
                    const empIdStr = String(emp.id || '');

                    const approvedOtReq = (appState?.hr_overtime_requests || []).find(r =>
                      r.status === 'Approved' &&
                      (
                        (r.employeeId && (String(r.employeeId) === empIdStr || String(r.employeeId) === String(emp.employeeId))) ||
                        (r.employeeName && String(r.employeeName).trim().toLowerCase() === empNameLower)
                      ) &&
                      (r.date === day.date || normalizeDate(r.date) === normalizeDate(day.date))
                    );

                    const uploadedRec = (liveUploadedAttendance || uploadedAttendance || []).find(u => 
                      (
                        (u.employeeId && (String(u.employeeId) === empIdStr || String(u.employeeId) === String(emp.employeeId) || String(u.employeeCode) === String(emp.employeeCode))) ||
                        (u.employeeName && String(u.employeeName).trim().toLowerCase() === empNameLower)
                      ) &&
                      (u.date === day.date || normalizeDate(u.date) === normalizeDate(day.date))
                    );

                    // Auto-sync live punch from Flash AM into active cell status
                    if (uploadedRec && uploadedRec.inTime) {
                      rec = {
                        ...rec,
                        status: uploadedRec.status === 'Completed' ? 'present' : (uploadedRec.status?.toLowerCase() || 'present'),
                        inTime: uploadedRec.inTime,
                        outTime: uploadedRec.outTime,
                        duration: uploadedRec.duration,
                        explicitStatus: true
                      };
                    }

                    if (approvedOtReq && parseFloat(approvedOtReq.hours || 0) > 0) {
                      const otHrs = parseFloat(approvedOtReq.hours);
                      if (parseFloat(rec.ot || 0) < otHrs) {
                        rec = {
                          ...rec,
                          status: rec.status === 'absent' ? 'present' : (rec.status || 'present'),
                          ot: otHrs,
                          explicitStatus: true
                        };
                      }
                    } else if (uploadedRec && parseFloat(uploadedRec.ot || 0) > 0) {
                      const otHrs = parseFloat(uploadedRec.ot);
                      if (parseFloat(rec.ot || 0) < otHrs) {
                        rec = {
                          ...rec,
                          status: rec.status === 'absent' ? 'present' : (rec.status || 'present'),
                          ot: otHrs,
                          explicitStatus: true
                        };
                      }
                    }
                    
                    if (rec.status === 'present' && !rec.explicitStatus && !rec.ot && !rec.fines && !rec.deductions && !rec.statusReason && !rec.otReason && !rec.finesReason && !rec.deductionsReason) {
                      rec = { ...rec, status: 'absent' };
                    }
                    const isPresent = rec.status === 'present';

                    return (
                      <div 
                        key={colKey}
                        className={`flex-none w-[190px] border rounded-xl p-3 snap-center space-y-2.5 transition-all ${
                          (day.isSunday || day.key === 'Sun') ? 'ring-1 ring-amber-500/30 bg-amber-500/[0.04] border-amber-500/30' : 'border-outline-variant/20'
                        } ${
                          rec.status === 'present' ? 'bg-emerald-500/5 border-emerald-500/20' :
                          rec.status === 'absent' ? 'bg-red-500/5 border-red-500/20' :
                          rec.status === 'leave' ? 'bg-amber-500/5 border-amber-500/20' :
                          rec.status === 'holiday' ? 'bg-blue-500/5 border-blue-500/20' :
                          'bg-slate-500/5 border-slate-500/20'
                        }`}
                      >
                        {/* Day & Date Header */}
                        <div className="text-center border-b border-outline-variant/10 pb-1.5">
                          <span className={`text-[9px] font-bold uppercase tracking-wider block leading-none ${
                            (day.isSunday || day.key === 'Sun') ? 'text-amber-600 dark:text-amber-400 font-black' : 'text-slate-400'
                          }`}>
                            {day.key} {(day.isSunday || day.key === 'Sun') ? '• OFF' : ''}
                          </span>
                          <span className="text-sm font-black text-on-surface block leading-tight mt-0.5">{day.num}</span>
                        </div>

                        {/* Status Tap-to-Cycle Button (No Dropdown) */}
                        {effectiveActiveConditions.attendance && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Status</span>
                            <div className="flex gap-1.5 items-center">
                              <button
                                type="button"
                                disabled={!canEditAttendance}
                                onClick={() => canEditAttendance && handleCycleStatus(emp.id, day.date || day.key, rec.status)}
                                className={`flex-1 rounded-xl px-2.5 py-1.5 text-xs font-black transition-all flex items-center justify-between shadow-2xs ${!canEditAttendance ? 'cursor-not-allowed opacity-80' : 'cursor-pointer active:scale-95'} ${
                                  rec.status === 'present' ? 'text-emerald-700 bg-emerald-500/15 border border-emerald-500/30' :
                                  rec.status === 'absent' ? 'text-red-700 bg-red-500/15 border border-red-500/30' :
                                  rec.status === 'leave' ? 'text-amber-700 bg-amber-500/15 border border-amber-500/30' :
                                  rec.status === 'holiday' ? 'text-blue-700 bg-blue-500/15 border border-blue-500/30' :
                                  'text-indigo-700 bg-indigo-500/15 border border-indigo-500/30'
                                }`}
                                title="Tap to cycle status"
                              >
                                <span className="capitalize">{rec.status || 'absent'}</span>
                                {canEditAttendance && <span className="material-symbols-outlined text-[13px] opacity-70">sync</span>}
                              </button>
                              {canEditAttendance && (
                                <FieldCommentButton 
                                  empId={emp.id} 
                                  dayKey={day.date || day.key} 
                                  field="statusReason" 
                                  value={rec} 
                                  reasonField="statusReason" 
                                />
                              )}
                            </div>
                          </div>
                        )}

                        {/* Overtime Input */}
                        {effectiveActiveConditions.overtime && (
                          <div className={`flex flex-col gap-1 ${(!isPresent || !canEditAttendance) ? 'opacity-40 pointer-events-none' : ''}`}>
                            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Overtime</span>
                            <div className="flex gap-1.5 items-center">
                              <div className="relative flex-1 flex items-center">
                                <span className="absolute left-2 text-[9px] font-bold text-slate-400 select-none">OT:</span>
                                <input 
                                  type="text"
                                  value={isPresent ? `${rec.ot}h` : '-'}
                                  disabled={!isPresent || !canEditAttendance}
                                  onChange={(e) => {
                                    if (!canEditAttendance) return;
                                    const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                                    handleValueChange(emp.id, day.date || day.key, 'ot', parseFloat(cleaned) || 0);
                                  }}
                                  className="w-full bg-white border border-outline-variant/15 rounded px-2 pl-7 py-1 text-[11px] text-right font-black text-primary outline-none"
                                />
                              </div>
                              {canEditAttendance && (
                                <FieldCommentButton 
                                  empId={emp.id} 
                                  dayKey={day.date || day.key} 
                                  field="otReason" 
                                  value={rec} 
                                  reasonField="otReason" 
                                />
                              )}
                            </div>
                          </div>
                        )}

                        {/* Fines Input */}
                        {effectiveActiveConditions.fines && (
                          <div className={`flex flex-col gap-1 ${!canEditAttendance ? 'opacity-60 pointer-events-none' : ''}`}>
                            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Fine</span>
                            <div className="flex gap-1.5 items-center">
                              <div className="relative flex-1 flex items-center">
                                <span className="absolute left-2 text-[8px] font-bold text-slate-400 select-none">FINE:</span>
                                <input 
                                  type="number"
                                  value={rec.fines || ''}
                                  disabled={!canEditAttendance}
                                  onChange={(e) => canEditAttendance && handleValueChange(emp.id, day.date || day.key, 'fines', parseFloat(e.target.value) || 0)}
                                  placeholder="0"
                                  className="w-full bg-white border border-outline-variant/15 rounded px-2 pl-9 py-1 text-[11px] text-right font-semibold text-on-surface outline-none"
                                />
                              </div>
                              {canEditAttendance && (
                                <FieldCommentButton 
                                  empId={emp.id} 
                                  dayKey={day.date || day.key} 
                                  field="finesReason" 
                                  value={rec} 
                                  reasonField="finesReason" 
                                />
                              )}
                            </div>
                          </div>
                        )}

                        {/* Late Coming Input */}
                        {effectiveActiveConditions.deductions && (
                          <div className={`flex flex-col gap-1 ${!canEditAttendance ? 'opacity-60 pointer-events-none' : ''}`}>
                            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Late Coming</span>
                            <div className="flex gap-1.5 items-center">
                              <div className="relative flex-1 flex items-center">
                                <span className="absolute left-2 text-[8px] font-bold text-slate-400 select-none">LATE:</span>
                                <input 
                                  type="text"
                                  value={rec.deductions ? `${rec.deductions}h` : ''}
                                  disabled={!canEditAttendance}
                                  onChange={(e) => {
                                    if (!canEditAttendance) return;
                                    const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                                    handleValueChange(emp.id, day.date || day.key, 'deductions', parseFloat(cleaned) || 0);
                                  }}
                                  placeholder="hours"
                                  className="w-full bg-white border border-outline-variant/15 rounded px-2 pl-9 py-1 text-[11px] text-right font-semibold text-on-surface outline-none"
                                />
                              </div>
                              {canEditAttendance && (
                                <FieldCommentButton 
                                  empId={emp.id} 
                                  dayKey={day.date || day.key} 
                                  field="deductionsReason" 
                                  value={rec} 
                                  reasonField="deductionsReason" 
                                />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))
          )}
        </div>

        {/* Footer Pagination */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-on-surface-variant">
          <span>Showing <b>{displayedEmployees.length}</b> employees of <b>{filteredEmployees.length}</b> total</span>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 select-none">
              <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Show All</span>
              <label className="erp-toggle">
                <input 
                  type="checkbox"
                  checked={showAllEmployees}
                  onChange={() => setShowAllEmployees(!showAllEmployees)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {!showAllEmployees && (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 hover:bg-white rounded-lg border border-outline-variant/10 bg-surface-container-lowest transition-colors active:scale-95 cursor-pointer flex items-center justify-center disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <span>Page {currentPage} of {totalPages || 1}</span>
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 hover:bg-white rounded-lg border border-outline-variant/10 bg-surface-container-lowest transition-colors active:scale-95 cursor-pointer flex items-center justify-center disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ========================================================
  // DESKTOP VIEW (Workforce Verification Grid)
  // ========================================================
  function renderDesktopView() {
    return (
      <div className="flex flex-col gap-8 animate-fade-in pb-12 select-none relative">
        
        {/* Dynamic Action Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="font-headline text-3xl font-black text-on-surface tracking-tight leading-tight">Workforce Verification Grid</h1>
            <p className="font-body text-xs text-on-surface-variant mt-1.5 font-medium">Review and reconcile attendance, overtime, and policy logs for manufacturing squads.</p>
          </div>
          
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {renderViewModeSwitcher()}

            {/* Pulsing Unsaved Changes Indicator Button */}
            {canEditAttendance && (
              <button 
                onClick={handleSaveChanges}
                className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all active:scale-[0.97] cursor-pointer relative shadow-lg ${
                  isDirty 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse' 
                    : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 cursor-default opacity-85'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                Save Changes
                {isDirty && (
                  <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-bounce"></span>
                )}
              </button>
            )}

            {/* Add New Employee Button */}
            {canAddEmployee && (
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2.5 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-[0.97] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                Add New Employee
              </button>
            )}

            {/* Print Register Button */}
            <button 
              onClick={() => setShowStudioModal(true)}
              className="px-4 py-2.5 bg-secondary/10 border border-secondary/20 text-secondary hover:bg-secondary/20 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-[0.97] cursor-pointer shadow-sm"
              title="Print Attendance Register"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              Print Register
            </button>

            {/* Upload CSV & Download Template Buttons */}
            {canUploadCSV && (
              <>
                <button 
                  onClick={handleCSVUpload}
                  className="px-4 py-2.5 bg-surface-container-low hover:bg-surface-container border border-outline-variant/15 rounded-xl text-xs font-bold text-secondary flex items-center gap-2 transition-all active:scale-[0.97] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">upload_file</span>
                  Upload CSV/Excel
                </button>
                <input 
                  type="file" 
                  ref={csvFileInputRef} 
                  onChange={handleCSVFileChange} 
                  accept=".csv" 
                  className="hidden" 
                />
                <button 
                  onClick={() => setIsDownloadModalOpen(true)}
                  className="text-xs font-bold text-primary hover:underline hover:text-primary-container transition-all cursor-pointer"
                >
                  Download Template
                </button>
              </>
            )}

                        

            {/* Verify & Reconcile Button */}
            {canReconcile && (
              <button 
                onClick={handleBulkReconcile}
                className="px-5 py-2.5 primary-gradient hover:shadow hover:shadow-primary/10 rounded-xl text-xs font-black text-white flex items-center gap-2 transition-all active:scale-[0.97] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
                Verify &amp; Reconcile
              </button>
            )}
          </div>
        </div>

        {/* Global Controls & Date Search */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-initial">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant text-[16px]">search</span>
              <input 
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Quick search employees..."
                className="w-full md:w-64 bg-surface-container-low border border-outline-variant/15 rounded-xl pl-9 pr-4 py-2 text-xs text-on-surface font-semibold focus:bg-surface-container-lowest focus:border-primary/50 transition-all focus:ring-0 outline-none"
              />
            </div>
            
            {/* Month Select, Year Select & Date Picker */}
            {canUseDateFilter && (
              <>
                {/* Month Select */}
                <div className="relative">
                  <select 
                    value={selectedMonth}
                    onChange={e => {
                      const m = parseInt(e.target.value);
                      setSelectedMonth(m);
                      updateDateRangeFromMonthYear(m, selectedYear);
                    }}
                    className="bg-surface-container-low hover:bg-surface-container-high px-3 py-2 rounded-xl border border-outline-variant/15 text-xs font-semibold text-on-surface transition-all outline-none cursor-pointer"
                  >
                    {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, idx) => (
                      <option key={month} value={idx}>{month}</option>
                    ))}
                  </select>
                </div>

                {/* Year Select */}
                <div className="relative">
                  <select 
                    value={selectedYear}
                    onChange={e => {
                      const y = parseInt(e.target.value);
                      setSelectedYear(y);
                      updateDateRangeFromMonthYear(selectedMonth, y);
                    }}
                    className="bg-surface-container-low hover:bg-surface-container-high px-3 py-2 rounded-xl border border-outline-variant/15 text-xs font-semibold text-on-surface transition-all outline-none cursor-pointer"
                  >
                    {[2022, 2023, 2024, 2025, 2026].map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                {/* Interactive Date Picker Button */}
                <div className="relative">
                  <button 
                    onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                    className="bg-surface-container-low hover:bg-surface-container-high px-4 py-2 rounded-xl border border-outline-variant/15 text-xs font-semibold text-on-surface flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary">calendar_month</span>
                    {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    <span className="material-symbols-outlined text-[14px] text-slate-400">expand_more</span>
                  </button>
                  
                  {isDatePickerOpen && (
                    <div className="absolute left-0 mt-2 z-50 bg-surface border border-outline-variant/30 rounded-2xl p-4 shadow-xl flex flex-col gap-3 min-w-[280px] animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-primary">Start Date</span>
                        <input 
                          type="date"
                          value={startDate}
                          onChange={e => setStartDate(e.target.value)}
                          className="bg-surface border border-outline-variant/30 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-transparent text-on-surface"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-primary">End Date</span>
                        <input 
                          type="date"
                          value={endDate}
                          onChange={e => setEndDate(e.target.value)}
                          className="bg-surface border border-outline-variant/30 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-transparent text-on-surface"
                        />
                      </div>
                      <button 
                        onClick={() => setIsDatePickerOpen(false)}
                        className="w-full bg-primary hover:bg-primary-container text-on-primary text-xs font-bold py-2 rounded-xl transition-colors mt-1 cursor-pointer"
                      >
                        Apply Filter
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Condition selector chips */}
          {(canFilterAttendance || canFilterOvertime || canFilterFines || canFilterDeductions) && (
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Filters:</span>
              <div className="flex gap-2">
                {canFilterAttendance && (
                  <button
                    onClick={() => handleToggleCondition('attendance')}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all ${
                      activeConditions.attendance 
                        ? 'bg-primary-fixed text-on-primary-fixed' 
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    <span>Attendance</span>
                    {activeConditions.attendance && <span className="material-symbols-outlined text-[10px]">close</span>}
                  </button>
                )}
                {canFilterOvertime && (
                  <button
                    onClick={() => handleToggleCondition('overtime')}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all ${
                      activeConditions.overtime 
                        ? 'bg-primary-fixed text-on-primary-fixed' 
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    <span>Overtime</span>
                    {activeConditions.overtime && <span className="material-symbols-outlined text-[10px]">close</span>}
                  </button>
                )}
                {canFilterFines && (
                  <button
                    onClick={() => handleToggleCondition('fines')}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all ${
                      activeConditions.fines 
                        ? 'bg-primary-fixed text-on-primary-fixed' 
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    <span>Fines</span>
                    {activeConditions.fines && <span className="material-symbols-outlined text-[10px]">close</span>}
                  </button>
                )}
                {canFilterDeductions && (
                  <button
                    onClick={() => handleToggleCondition('deductions')}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all ${
                      activeConditions.deductions 
                        ? 'bg-primary-fixed text-on-primary-fixed' 
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    <span>Late Coming</span>
                    {activeConditions.deductions && <span className="material-symbols-outlined text-[10px]">close</span>}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Workforce Attendance Sheet Grid */}
        <div className="border border-outline-variant/15 rounded-2xl overflow-hidden bg-surface-container-lowest shadow-sm flex flex-col">
          {/* Scrollable Container with conditional height style */}
          <div 
            style={{ 
              maxHeight: showAllEmployees ? 'none' : 'calc(100vh - 19rem)', 
              overflowY: showAllEmployees ? 'visible' : 'auto' 
            }}
            className="overflow-x-auto no-scrollbar relative"
          >
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-left sticky top-0 z-20 shadow-sm">
                  {/* Sticky employee header with Toggleable Pin option */}
                  <th 
                    style={{ width: getColWidth('details'), minWidth: getColWidth('details'), maxWidth: getColWidth('details') }}
                    className={`${isColumnPinned ? 'sticky left-0 z-30 bg-surface-container-low border-r border-outline-variant/20 shadow-[2px_0_5px_rgba(0,0,0,0.03)]' : ''} px-6 py-4 border-b border-outline-variant/20 relative`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee Details</span>
                      <button 
                        onClick={() => setIsColumnPinned(!isColumnPinned)}
                        className={`w-6 h-6 rounded flex items-center justify-center transition-all ${isColumnPinned ? 'bg-primary/25 text-primary' : 'text-slate-400 hover:bg-slate-200'} cursor-pointer`}
                        title={isColumnPinned ? "Unpin Column" : "Pin Column"}
                      >
                        <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: isColumnPinned ? "'FILL' 1" : undefined }}>
                          push_pin
                        </span>
                      </button>
                    </div>
                    {/* Adjustable Resizer Drag Handle */}
                    <div 
                      onMouseDown={(e) => handleMouseDown(e, 'details')}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/50 transition-colors z-40"
                    />
                  </th>
                  {/* Date Column headers with individual resizers */}
                  {weekdays.map(day => {
                    const colKey = day.key + '-' + day.num;
                    const cWidth = getColWidth(colKey);
                    return (
                      <th 
                        key={colKey} 
                        style={{ width: cWidth, minWidth: cWidth, maxWidth: cWidth }}
                        className={`px-6 py-3 border-b border-l border-outline-variant/20 relative text-center ${
                          (day.isSunday || day.key === 'Sun') ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-surface-container-low'
                        }`}
                      >
                        <div className="flex flex-col items-center relative">
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${
                            (day.isSunday || day.key === 'Sun') ? 'text-amber-600 dark:text-amber-400 font-black' : 'text-slate-400'
                          }`}>
                            {day.key} {(day.isSunday || day.key === 'Sun') ? '• OFF' : ''}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5 justify-center">
                            <span className="text-base font-black text-on-surface">{day.num}</span>
                            {canEditAttendance && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenColumnMenu(openColumnMenu === colKey ? null : colKey);
                                }}
                                className="w-5 h-5 rounded hover:bg-slate-200/50 flex items-center justify-center text-slate-500 cursor-pointer transition-colors"
                                title="Set all status for this day"
                              >
                                <span className="material-symbols-outlined text-sm">more_vert</span>
                              </button>
                            )}
                          </div>

                          {/* Column bulk set dropdown */}
                          {canEditAttendance && openColumnMenu === colKey && (
                            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-white border border-outline-variant/30 rounded-xl py-1.5 shadow-xl min-w-[130px] text-left text-xs font-semibold text-on-surface animate-in fade-in slide-in-from-top-1 duration-150">
                              {allowedStatuses.map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBulkSetDayStatus(day.date || day.key, opt.value);
                                    setOpenColumnMenu(null);
                                  }}
                                  className="w-full px-3.5 py-1.5 hover:bg-slate-100 transition-colors cursor-pointer text-[11px] block"
                                >
                                  Set All {opt.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Date Column Resizer Drag Handle */}
                        <div 
                          onMouseDown={(e) => handleMouseDown(e, colKey)}
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/50 transition-colors z-40"
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              
              <tbody className="divide-y divide-outline-variant/15">
                {displayedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={weekdays.length + 1} className="text-center py-10 font-body text-xs text-on-surface-variant">
                      No matching records found in this shift batch.
                    </td>
                  </tr>
                ) : (
                  displayedEmployees.map(emp => (
                    <tr 
                      key={emp.id} 
                      className={`hover:bg-surface-container-low/30 transition-colors group ${draggedIndex === emp.id ? 'opacity-40 bg-slate-100' : ''}`}
                    >
                      {/* Sticky employee details card - Drag limited ONLY to this cell */}
                      <td 
                        draggable={canEditAttendance}
                        onDragStart={(e) => canEditAttendance && handleDragStart(e, emp.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => canEditAttendance && handleDrop(e, emp.id)}
                        style={{ width: getColWidth('details'), minWidth: getColWidth('details'), maxWidth: getColWidth('details') }}
                        className={`${isColumnPinned ? 'sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-outline-variant/10 shadow-[2px_0_5px_rgba(0,0,0,0.03)]' : ''} transition-colors px-6 py-4 relative ${canEditAttendance ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      >
                        <div className="flex items-center gap-4">
                          {/* Drag indicator handle */}
                          {canEditAttendance && (
                            <span className="material-symbols-outlined text-[18px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 select-none">
                              drag_indicator
                            </span>
                          )}
                          
                          <div className="relative">
                            <img 
                              className="w-11 h-11 rounded-full object-cover border border-outline-variant/10 shadow-sm shrink-0" 
                              src={emp.avatar} 
                              alt={emp.name} 
                            />
                            {emp.paidInternship && (
                              <span className="absolute -top-1.5 -right-1.5 bg-tertiary text-white text-[7px] font-extrabold px-1 rounded-full border border-white">
                                INT
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-headline font-bold text-xs text-on-surface leading-tight truncate">{emp.name}</h4>
                            <p className="text-[9px] font-bold text-primary mt-0.5 leading-none">{emp.id}</p>
                            {emp.phone && <p className="text-[9px] text-slate-400 font-medium leading-none mt-0.5">{emp.phone}</p>}
                            {(emp.department || emp.section) && (
                              <p className="text-[8px] font-bold text-secondary mt-1 leading-none uppercase tracking-wider truncate" title={`${emp.department}${emp.section ? ` - ${emp.section}` : ''}`}>
                                {emp.department}{emp.section ? ` • ${emp.section}` : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Mon to Fri cells - Resized width and hour input */}
                      {weekdays.map(day => {
                        const colKey = day.key + '-' + day.num;
                        const cWidth = getColWidth(colKey);
                        const att = emp.attendance || {};
                        let rec = att[day.date] || att[day.key] || { status: 'absent', ot: 0, fines: 0, deductions: 0 };

                        // Fallback check from hr_overtime_requests & hr_uploaded_attendance
                        const empNameLower = String(emp.name || '').trim().toLowerCase();
                        const empIdStr = String(emp.id || '');

                        const approvedOtReq = (appState?.hr_overtime_requests || []).find(r =>
                          r.status === 'Approved' &&
                          (
                            (r.employeeId && (String(r.employeeId) === empIdStr || String(r.employeeId) === String(emp.employeeId))) ||
                            (r.employeeName && String(r.employeeName).trim().toLowerCase() === empNameLower)
                          ) &&
                          (r.date === day.date || normalizeDate(r.date) === normalizeDate(day.date))
                        );

                        // Realtime Punch lookup from Live Supabase WebSocket & Uploaded Attendance
                        const livePunchRec = (liveUploadedAttendance || uploadedAttendance || []).find(u => 
                          (
                            (u.employeeId && (String(u.employeeId) === empIdStr || String(u.employeeId) === String(emp.employeeId))) ||
                            (u.employeeName && String(u.employeeName).trim().toLowerCase() === empNameLower) ||
                            (u.employeeCode && emp.employeeCode && String(u.employeeCode) === String(emp.employeeCode))
                          ) &&
                          (u.date === day.date || normalizeDate(u.date) === normalizeDate(day.date))
                        );

                        if (livePunchRec) {
                          rec = {
                            ...rec,
                            status: 'present',
                            inTime: livePunchRec.inTime || rec.inTime,
                            outTime: livePunchRec.outTime || rec.outTime,
                            duration: livePunchRec.duration || rec.duration,
                            ot: parseFloat(livePunchRec.ot || 0) > 0 ? parseFloat(livePunchRec.ot) : rec.ot,
                            explicitStatus: true
                          };
                        } else if (approvedOtReq && parseFloat(approvedOtReq.hours || 0) > 0) {
                          const otHrs = parseFloat(approvedOtReq.hours);
                          if (parseFloat(rec.ot || 0) < otHrs) {
                            rec = {
                              ...rec,
                              status: rec.status === 'absent' ? 'present' : (rec.status || 'present'),
                              ot: otHrs,
                              explicitStatus: true
                            };
                          }
                        }
                        
                        // Force clean default 'present' records without punches to show as 'absent'
                        if (rec.status === 'present' && !rec.explicitStatus && !rec.inTime && !rec.outTime && !rec.ot && !rec.fines && !rec.deductions && !rec.statusReason && !rec.otReason && !rec.finesReason && !rec.deductionsReason) {
                          rec = { ...rec, status: 'absent' };
                        }
                        const isPresent = rec.status === 'present';
                        
                        return (
                          <td 
                            key={colKey} 
                            style={{ width: cWidth, minWidth: cWidth, maxWidth: cWidth }}
                            className={`p-4 border-l border-outline-variant/20 transition-all ${
                              (day.isSunday || day.key === 'Sun') ? 'ring-1 ring-inset ring-amber-500/20 bg-amber-500/[0.04]' :
                              rec.status === 'present' ? 'bg-emerald-500/5' :
                              rec.status === 'absent' ? 'bg-red-500/5' :
                              rec.status === 'leave' ? 'bg-amber-500/5' :
                              rec.status === 'holiday' ? 'bg-blue-500/5' :
                              'bg-slate-500/5' // Off Day
                            }`}
                          >
                            <div className="flex flex-col gap-2.5">
                              {/* Attendance Drop-down */}
                              {effectiveActiveConditions.attendance && (
                                <div className="flex flex-col gap-1">
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Status</span>
                                  <div className="flex gap-1.5 items-center">
                                    <select
                                      value={rec.status || 'absent'}
                                      disabled={!canEditAttendance}
                                      onChange={(e) => canEditAttendance && handleStatusChange(emp.id, day.date || day.key, e.target.value)}
                                      className={`flex-1 bg-white border border-outline-variant/20 rounded-xl px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent transition-all ${!canEditAttendance ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'} ${
                                        rec.status === 'present' ? 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20' :
                                        rec.status === 'absent' ? 'text-red-700 bg-red-500/10 border-red-500/20' :
                                        rec.status === 'leave' ? 'text-amber-700 bg-amber-500/10 border-amber-500/20' :
                                        rec.status === 'holiday' ? 'text-blue-700 bg-blue-500/10 border-blue-500/20' :
                                        'text-indigo-700 bg-indigo-500/10 border-indigo-500/20' // Off Day
                                      }`}
                                    >
                                      {allowedStatuses.map(st => (
                                         <option key={st.value} value={st.value}>{st.label}</option>
                                       ))}
                                    </select>
                                    {canEditAttendance && (
                                      <FieldCommentButton 
                                        empId={emp.id} 
                                        dayKey={day.date || day.key} 
                                        field="statusReason" 
                                        value={rec} 
                                        reasonField="statusReason" 
                                      />
                                    )}
                                  </div>

                                  {/* Realtime IN / OUT Punch Badges */}
                                  {(rec.inTime || rec.outTime) && (
                                    <div className="flex flex-col gap-1 mt-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-1.5 shadow-2xs">
                                      {rec.inTime && (
                                        <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-800 leading-none">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                          <span>IN: {rec.inTime}</span>
                                        </div>
                                      )}
                                      {rec.outTime && (
                                        <div className="flex items-center gap-1.5 text-[10px] font-black text-purple-800 leading-none mt-0.5">
                                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                          <span>OUT: {rec.outTime}</span>
                                          {rec.duration && <span className="text-[9px] font-bold text-purple-600">({rec.duration})</span>}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Overtime input */}
                              {effectiveActiveConditions.overtime && (
                                <div className={`flex flex-col gap-1 ${(!isPresent || !canEditAttendance) ? 'opacity-40 pointer-events-none' : ''}`}>
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Overtime</span>
                                  <div className="flex gap-1.5 items-center">
                                    <div className="relative flex-1 flex items-center">
                                      <span className="absolute left-2.5 text-[9px] font-bold text-slate-400 select-none">OT:</span>
                                      <input 
                                        type="text"
                                        value={isPresent ? `${rec.ot}h` : '-'}
                                        disabled={!isPresent || !canEditAttendance}
                                        onChange={(e) => {
                                          if (!canEditAttendance) return;
                                          const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                                          handleValueChange(emp.id, day.date || day.key, 'ot', parseFloat(cleaned) || 0);
                                        }}
                                        className="w-full bg-surface-container-low border border-outline-variant/15 rounded px-2 pl-8 py-1 text-[11px] text-right font-black text-primary focus:bg-surface-container-lowest focus:ring-0 focus:border-primary/50 transition-all outline-none"
                                      />
                                    </div>
                                    {canEditAttendance && (
                                      <FieldCommentButton 
                                        empId={emp.id} 
                                        dayKey={day.date || day.key} 
                                        field="otReason" 
                                        value={rec} 
                                        reasonField="otReason" 
                                      />
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Fines input */}
                              {effectiveActiveConditions.fines && (
                                <div className={`flex flex-col gap-1 ${!canEditAttendance ? 'opacity-60 pointer-events-none' : ''}`}>
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Fine</span>
                                  <div className="flex gap-1.5 items-center">
                                    <div className="relative flex-1 flex items-center">
                                      <span className="absolute left-2.5 text-[9px] font-bold text-slate-400 select-none">FINE:</span>
                                      <input 
                                        type="number"
                                        value={rec.fines || ''}
                                        disabled={!canEditAttendance}
                                        onChange={(e) => canEditAttendance && handleValueChange(emp.id, day.date || day.key, 'fines', parseFloat(e.target.value) || 0)}
                                        placeholder="0"
                                        className="w-full bg-surface-container-low border border-outline-variant/15 rounded px-2 pl-10 py-1 text-[11px] text-right font-semibold text-on-surface focus:bg-surface-container-lowest focus:ring-0 focus:border-primary/50 transition-all outline-none"
                                      />
                                    </div>
                                    {canEditAttendance && (
                                      <FieldCommentButton 
                                        empId={emp.id} 
                                        dayKey={day.date || day.key} 
                                        field="finesReason" 
                                        value={rec} 
                                        reasonField="finesReason" 
                                      />
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Late coming deduction input (Upgraded time deduction in hours) */}
                              {effectiveActiveConditions.deductions && (
                                <div className={`flex flex-col gap-1 ${!canEditAttendance ? 'opacity-60 pointer-events-none' : ''}`}>
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Late Coming</span>
                                  <div className="flex gap-1.5 items-center">
                                    <div className="relative flex-1 flex items-center">
                                      <span className="absolute left-2.5 text-[8px] font-bold text-slate-400 select-none">LATE:</span>
                                      <input 
                                        type="text"
                                        value={rec.deductions ? `${rec.deductions}h` : ''}
                                        disabled={!canEditAttendance}
                                        onChange={(e) => {
                                          if (!canEditAttendance) return;
                                          const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                                          handleValueChange(emp.id, day.date || day.key, 'deductions', parseFloat(cleaned) || 0);
                                        }}
                                        placeholder="hours"
                                        className="w-full bg-surface-container-low border border-outline-variant/15 rounded px-2 pl-10 py-1 text-[11px] text-right font-semibold text-on-surface focus:bg-surface-container-lowest focus:ring-0 focus:border-primary/50 transition-all outline-none"
                                      />
                                    </div>
                                    {canEditAttendance && (
                                      <FieldCommentButton 
                                        empId={emp.id} 
                                        dayKey={day.date || day.key} 
                                        field="deductionsReason" 
                                        value={rec} 
                                        reasonField="deductionsReason" 
                                      />
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer / Paging */}
          <div className="bg-surface-container-low/50 px-6 py-4 flex flex-col sm:flex-row items-center justify-between border-t border-outline-variant/10 text-xs font-semibold text-on-surface-variant gap-4">
            <div className="flex items-center gap-6">
              <span>Showing <b>{displayedEmployees.length}</b> employees of <b>{filteredEmployees.length}</b> total</span>
              <div className="flex items-center gap-2 select-none">
                <span className="w-2.5 h-2.5 bg-primary rounded-full"></span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Attendance Logged</span>
              </div>
              <div className="flex items-center gap-2 select-none">
                <span className="w-2.5 h-2.5 bg-tertiary-fixed rounded-full"></span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Flagged Absences</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Pagination Toggle */}
              <div className="flex items-center gap-2 pr-4 border-r border-outline-variant/20 select-none">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Show All At Once</span>
                <label className="erp-toggle">
                  <input 
                    type="checkbox"
                    checked={showAllEmployees}
                    onChange={() => setShowAllEmployees(!showAllEmployees)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {!showAllEmployees && (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 hover:bg-white rounded-lg border border-outline-variant/10 bg-surface-container-lowest transition-colors active:scale-95 cursor-pointer flex items-center justify-center disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <span>Page {currentPage} of {totalPages || 1}</span>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 hover:bg-white rounded-lg border border-outline-variant/10 bg-surface-container-lowest transition-colors active:scale-95 cursor-pointer flex items-center justify-center disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================
            ADD NEW EMPLOYEE DIALOG POPUP MODAL (DESKTOP)
           ======================================================== */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-surface border border-outline-variant/30 rounded-2xl shadow-2xl p-6 flex flex-col gap-6 animate-in zoom-in-95 duration-200 text-on-surface">
              
              <div className="flex items-center justify-between border-b border-outline-variant/10 pb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-2xl">person_add</span>
                  <h3 className="font-headline text-lg font-black tracking-tight text-on-surface">Add New Employee</h3>
                </div>
                <button 
                  onClick={() => { setIsAddModalOpen(false); setModalError(''); }}
                  className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-slate-400 hover:text-on-surface cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {modalError && (
                <div className="bg-error-container/20 border border-error/20 p-3 rounded-xl text-xs text-error font-semibold animate-shake">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleAddEmployeeSubmit} className="space-y-5">
                
                 {/* Visual Avatar upload preview bar with functional Picture Upload and Webcam Stream */}
                <div className="flex flex-col gap-3 bg-surface-container-low p-3 rounded-xl border border-outline-variant/10">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-surface border border-outline-variant/30 flex items-center justify-center overflow-hidden shrink-0">
                      {newEmpForm.avatar ? (
                        <img src={newEmpForm.avatar} className="w-full h-full object-cover" alt="Avatar Upload Preview" />
                      ) : (
                        <span className="material-symbols-outlined text-2xl text-slate-400">person</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 w-full">
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-secondary-container hover:bg-secondary-fixed text-on-secondary-container text-[10px] font-black py-1.5 px-3 rounded-lg transition-colors cursor-pointer"
                      >
                        Upload Picture
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept="image/*" 
                        className="hidden" 
                      />
                      <button 
                        type="button" 
                        onClick={handleSimulatePhotoCapture}
                        className="border border-outline-variant text-[10px] font-bold py-1.5 px-3 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
                      >
                        Capture live photo
                      </button>
                    </div>
                  </div>

                  {/* Live Camera Stream Video View */}
                  {isCameraActive && (
                    <div className="flex flex-col gap-2 bg-black/90 p-2 rounded-xl border border-outline-variant/20 overflow-hidden mt-1 animate-in fade-in slide-in-from-top-1">
                      <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-slate-950">
                        <video 
                          id="biometric-camera-preview"
                          autoPlay 
                          playsInline 
                          ref={(videoElement) => {
                            if (videoElement && cameraStream) {
                              videoElement.srcObject = cameraStream;
                            }
                          }}
                          className="w-full h-full object-cover scale-x-[-1]"
                        />
                      </div>
                      <div className="flex justify-between gap-2">
                        <button 
                          type="button" 
                          onClick={handleStopCamera}
                          className="px-3 py-1.5 border border-white/20 text-white hover:bg-white/10 text-[10px] font-bold rounded-lg transition-colors"
                        >
                          Cancel Camera
                        </button>
                        <button 
                          type="button" 
                          onClick={handleCaptureSnapshot}
                          className="px-3 py-1.5 bg-primary text-on-primary text-[10px] font-black rounded-lg transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[12px]">photo_camera</span>
                          Take Snapshot
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative group">
                  <input 
                    type="text" 
                    required
                    value={newEmpForm.name}
                    onChange={e => { setNewEmpForm(prev => ({ ...prev, name: e.target.value })); if(modalError) setModalError(''); }}
                    placeholder="e.g. Alexander Wright"
                    className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all outline-none"
                  />
                  <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider text-primary">Employee Name *</label>
                </div>

                <div className="relative group">
                  <input 
                    type="tel" 
                    required
                    value={newEmpForm.phone}
                    onChange={e => { setNewEmpForm(prev => ({ ...prev, phone: e.target.value })); if(modalError) setModalError(''); }}
                    placeholder="e.g. +92 300 1234567"
                    className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all outline-none"
                  />
                  <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider text-primary">Mobile Number *</label>
                </div>

                <div className="relative group">
                  <input 
                    type="text" 
                    value={newEmpForm.reference}
                    onChange={e => { setNewEmpForm(prev => ({ ...prev, reference: e.target.value })); if(modalError) setModalError(''); }}
                    placeholder="e.g. Reference Contact or Info"
                    className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all outline-none"
                  />
                  <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider text-primary">Reference</label>
                </div>

                {/* Legal Documentation file uploader */}
                <div className="flex flex-col gap-1.5 bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/10">
                  <span className="text-[10px] font-black uppercase tracking-wider text-primary">Legal Documentation</span>
                  <p className="text-[9px] text-on-surface-variant mb-1">Capture CNIC, contract, or degrees linkable to profile.</p>
                  <div className="flex items-center gap-3">
                    <button 
                      type="button" 
                      onClick={() => docInputRef.current?.click()}
                      className="bg-[#00a884]/10 hover:bg-[#00a884]/20 text-[#00a884] text-[10px] font-black py-1.5 px-3 rounded-lg transition-colors cursor-pointer"
                    >
                      {newEmpForm.legalDocName ? 'Change Document' : 'Upload Document'}
                    </button>
                    <input 
                      type="file" 
                      ref={docInputRef} 
                      onChange={handleDocChange} 
                      accept=".pdf,.doc,.docx,image/*" 
                      className="hidden" 
                    />
                    {newEmpForm.legalDocName && (
                      <span className="text-[10px] font-semibold text-emerald-650 truncate max-w-[180px]">
                        ✓ {newEmpForm.legalDocName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Switch Toggle for Internship */}
                <div className="flex items-center justify-between bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/10">
                  <div>
                    <span className="text-xs font-black block text-on-surface">7 Day Paid Internship</span>
                    <span className="text-[10px] text-on-surface-variant block mt-0.5">Activate temporary paid training log properties.</span>
                  </div>
                  <label className="erp-toggle">
                    <input 
                      type="checkbox"
                      checked={newEmpForm.paidInternship}
                      onChange={() => setNewEmpForm(prev => ({ ...prev, paidInternship: !prev.paidInternship }))}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant/10">
                  <button 
                    type="button"
                    onClick={() => { setIsAddModalOpen(false); setModalError(''); }}
                    className="px-4 py-2 text-xs font-bold hover:bg-surface-container transition-colors rounded-xl text-on-surface-variant cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-6 py-2 bg-primary hover:bg-primary-container text-on-primary text-xs font-black rounded-xl shadow transition-colors cursor-pointer"
                  >
                    Add Employee
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================
            DOWNLOAD CSV TEMPLATE MODAL
           ======================================================== */}
        {isDownloadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-surface border border-outline-variant/30 rounded-2xl shadow-2xl p-6 flex flex-col gap-6 animate-in zoom-in-95 duration-200 text-on-surface">
              
              <div className="flex items-center justify-between border-b border-outline-variant/10 pb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-2xl">download</span>
                  <h3 className="font-headline text-lg font-black tracking-tight text-on-surface">Download Templates</h3>
                </div>
                <button 
                  onClick={() => setIsDownloadModalOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-slate-400 hover:text-on-surface cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Download templates for attendance, overtime, fines, or late hours separately. Fill in values and upload the CSV to reconcile records.
                </p>

                <div className="space-y-3">
                  {[
                    { type: 'attendance', label: 'Attendance Template', desc: 'Format: Employee ID, Date, Status (Present/Absent)' },
                    { type: 'overtime', label: 'Overtime Template', desc: 'Format: Employee ID, Date, Overtime Hours' },
                    { type: 'fines', label: 'Fines Template', desc: 'Format: Employee ID, Date, Fine Amount' },
                    { type: 'late', label: 'Late Coming Template', desc: 'Format: Employee ID, Date, Late Hours' }
                  ].map(tpl => (
                    <div key={tpl.type} className="flex justify-between items-center bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/10">
                      <div>
                        <span className="text-xs font-black block">{tpl.label}</span>
                        <span className="text-[9px] text-on-surface-variant block mt-0.5">{tpl.desc}</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => downloadCSVTemplate(tpl.type)}
                        className="px-3.5 py-2 bg-primary hover:bg-primary-container text-on-primary text-xs font-black rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <span className="material-symbols-outlined text-sm">download</span>
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-outline-variant/10">
                <button 
                  type="button"
                  onClick={() => setIsDownloadModalOpen(false)}
                  className="px-4 py-2.5 bg-surface-container-low hover:bg-surface-container text-on-surface-variant font-semibold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Verify & Reconcile modal removed - loaded in full screen instead */}

      </div>
    );
  }

  return renderDesktopView();
}
