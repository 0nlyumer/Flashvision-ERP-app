import { getEffectiveDutyHours, getEffectiveOvertimeMultiplier } from '../../utils/hrDutyHours';
import HRPayslipModal from './HRPayslipModal';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useDialog } from '../../context/DialogContext';
import { useApp } from '../../context/AppContext';

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


const sanitizeEmployees = (list) => {
  const seenIds = new Set();
  return (list || []).map((emp, index) => {
    let id = emp.id && String(emp.id).trim() !== '' && emp.id !== '.' ? String(emp.id).trim() : '';
    if (!id || seenIds.has(id)) {
      id = 'EMP-' + String(index + 1).padStart(5, '0');
    }
    seenIds.add(id);
    return {
      ...emp,
      id,
      attendance: emp.attendance ? { ...emp.attendance } : {}
    };
  });
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
    if (isCurrentMonthFinalized || isDateFinalized(dayKey)) {
      alertSalaryFinalizedLocked();
      return;
    }
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

  const employees = React.useMemo(() => (appState?.hr_employees_list || []).filter(e => (e.status || 'Active').toLowerCase() === 'active'), [appState?.hr_employees_list]);
  const uploadedAttendance = appState?.hr_uploaded_attendance || [];

  const [localEmployees, setLocalEmployees] = useState(() => {
    return sanitizeEmployees(employees);
  });
  const [isDirty, setIsDirty] = useState(false);
  // Ensure localEmployees sync with global employees when !isDirty
  useEffect(() => {
    if (!isDirty && employees && employees.length > 0) {
      setLocalEmployees(sanitizeEmployees(employees));
    }
  }, [employees, isDirty]);

  const [viewMode, setViewMode] = useState(() => savedUserFilters?.viewMode || 'grid'); // 'grid' | 'reconcile'

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
  const [isLivePayslipOpen, setIsLivePayslipOpen] = useState(false);
  const [livePayslipModalData, setLivePayslipModalData] = useState(null);
  const [isCsvDropdownOpen, setIsCsvDropdownOpen] = useState(false);
  const [isAlphaDropdownOpen, setIsAlphaDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [selectedEmploymentStatuses, setSelectedEmploymentStatuses] = useState(['Active']);
  const [selectedAlphaLetter, setSelectedAlphaLetter] = useState('ALL');
  const [nameSortOrder, setNameSortOrder] = useState('asc'); // 'asc' | 'desc'
  const [activeComment, setActiveComment] = useState(null); // { empId, dayKey, field }
  const [commentText, setCommentText] = useState('');

  const openCommentPopup = (empId, dayKey, field, currentVal) => {
    setActiveComment({ empId, dayKey, field });
    setCommentText(currentVal || '');
  };

  const saveComment = () => {
    if (!activeComment) return;
    if (isCurrentMonthFinalized || isDateFinalized(activeComment?.dayKey)) {
      alertSalaryFinalizedLocked();
      return;
    }
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
  const [divisionFilter, setDivisionFilter] = useState(() => savedUserFilters?.divisionFilter || 'ALL');
  const [statusFilter, setStatusFilter] = useState(() => savedUserFilters?.statusFilter || 'ALL');

  // Interactive Dates Picker states - loaded persistently per user
  const [startDate, setStartDate] = useState(() => {
    if (savedUserFilters?.startDate) return savedUserFilters.startDate;
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

  const [endDate, setEndDate] = useState(() => {
    if (savedUserFilters?.endDate) return savedUserFilters.endDate;
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
      divisionFilter,
      statusFilter,
      viewMode
    };
    try {
      localStorage.setItem(userFilterKey, JSON.stringify(currentFilters));
    } catch(e) {}
  }, [startDate, endDate, selectedMonth, selectedYear, selectedDay, activeConditions, searchQuery, departmentFilter, divisionFilter, statusFilter, viewMode, userFilterKey]);

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

  // Active Payroll Month Key & Strict Finalized Salary Lock Check
  const activeMonthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

  const isCurrentMonthFinalized = React.useMemo(() => {
    const list = appState?.hr_generated_salaries || [];
    return list.some(item => 
      item.month === activeMonthKey && (item.status === 'Finalized' || item.status === 'finalized' || (item.records && item.records.length > 0))
    );
  }, [appState?.hr_generated_salaries, activeMonthKey]);

  const isDateFinalized = React.useCallback((dateStr) => {
    if (!dateStr) return false;
    const cleanStr = String(dateStr).trim();
    const parts = cleanStr.split(/[-/]/);
    let monthKey = '';
    if (parts.length >= 2) {
      if (parts[0].length === 4) {
        monthKey = `${parts[0]}-${parts[1].padStart(2, '0')}`;
      } else if (parts[2] && parts[2].length === 4) {
        monthKey = `${parts[2]}-${parts[0].padStart(2, '0')}`;
      }
    }
    if (!monthKey && cleanStr.length >= 7) {
      monthKey = cleanStr.substring(0, 7);
    }
    if (!monthKey) return false;

    const list = appState?.hr_generated_salaries || [];
    return list.some(item => 
      item.month === monthKey && (item.status === 'Finalized' || item.status === 'finalized' || (item.records && item.records.length > 0))
    );
  }, [appState?.hr_generated_salaries]);

  const alertSalaryFinalizedLocked = () => {
    appAlert(`Attendance for ${monthsList[selectedMonth]?.name || activeMonthKey} ${selectedYear} is locked because payroll has been finalized. Attendance is read-only. To make changes, delete the finalized payroll from Salary Generation History.`);
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
    if (isCurrentMonthFinalized) {
      alertSalaryFinalizedLocked();
      return;
    }
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
    while (temp <= end && count < 32) {
      count++;
      const dayName = temp.toLocaleDateString('en-US', { weekday: 'short' }); // "Mon", "Tue"...
      const dayNum = temp.getDate();
      const dateString = temp.toISOString().split('T')[0];

      result.push({
        key: dayName,
        num: dayNum,
        date: dateString
      });
      temp.setDate(temp.getDate() + 1);
    }
    return result.length > 0 ? result : [
      { key: 'Mon', num: 20 },
      { key: 'Tue', num: 21 },
      { key: 'Wed', num: 22 },
      { key: 'Thu', num: 23 },
      { key: 'Fri', num: 24 }
    ];
  };

  const weekdays = getWeekdaysList();

  // Toggle dynamic condition chips
  const handleToggleCondition = (key) => {
    setActiveConditions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Change employee attendance status inside draft (via select dropdown)
  const handleStatusChange = (empId, day, nextStatus) => {
    if (isCurrentMonthFinalized || isDateFinalized(day)) {
      alertSalaryFinalizedLocked();
      return;
    }
    if (!empId) return;
    setIsDirty(true);
    setLocalEmployees(prev => prev.map(emp => {
      if (String(emp.id) !== String(empId)) return emp;
      const att = { ...(emp.attendance || {}) };
      const record = { ...(att[day] || { status: 'absent', ot: 0, fines: 0, deductions: 0 }) };
      return {
        ...emp,
        attendance: {
          ...att,
          [day]: {
            ...record,
            status: nextStatus,
            ot: nextStatus === 'absent' ? 0.0 : record.ot,
            explicitStatus: true,
            userEdited: true
          }
        }
      };
    }));
  };

  // Bulk set status for all employees for a specific day
  const handleBulkSetDayStatus = (dayKey, nextStatus) => {
    if (isCurrentMonthFinalized || isDateFinalized(dayKey)) {
      alertSalaryFinalizedLocked();
      return;
    }
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
    if (isCurrentMonthFinalized || isDateFinalized(day)) {
      alertSalaryFinalizedLocked();
      return;
    }
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
    if (isCurrentMonthFinalized || isDateFinalized(day)) {
      alertSalaryFinalizedLocked();
      return;
    }
    if (!empId) return;
    setIsDirty(true);
    setLocalEmployees(prev => prev.map(emp => {
      if (String(emp.id) !== String(empId)) return emp;
      const att = { ...(emp.attendance || {}) };
      const record = { ...(att[day] || { status: 'present', ot: 0, fines: 0, deductions: 0 }) };
      const currentVal = parseFloat(record.ot) || 0;
      let nextVal = direction === 'add' ? currentVal + 0.5 : currentVal - 0.5;
      if (nextVal < 0) nextVal = 0;
      return {
        ...emp,
        attendance: {
          ...att,
          [day]: {
            ...record,
            ot: parseFloat(nextVal.toFixed(1)),
            userEdited: true,
            explicitStatus: true
          }
        }
      };
    }));
  };

  // Input change handler for OT/Fines/Deductions inside draft
  const handleValueChange = (empId, day, field, value) => {
    if (isCurrentMonthFinalized || isDateFinalized(day)) {
      alertSalaryFinalizedLocked();
      return;
    }
    if (!empId) return;
    setIsDirty(true);
    setLocalEmployees(prev => prev.map(emp => {
      if (String(emp.id) !== String(empId)) return emp;
      const att = { ...(emp.attendance || {}) };
      const record = { ...(att[day] || { status: 'present', ot: 0, fines: 0, deductions: 0 }) };
      return {
        ...emp,
        attendance: {
          ...att,
          [day]: {
            ...record,
            [field]: value,
            userEdited: true,
            explicitStatus: true
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

  // Distinct Divisions/Sections for Filter Dropdown
  const divisionsList = React.useMemo(() => {
    const set = new Set(['AJ Synthetic', 'AAA']);
    localEmployees.forEach(emp => {
      const div = emp.division || emp.section || 'AJ Synthetic';
      if (div && (departmentFilter === 'ALL' || !departmentFilter || emp.department === departmentFilter)) {
        set.add(div);
      }
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [localEmployees, departmentFilter]);

  // Live Pay Slip Generator from current month attendance
  const handleGenerateLivePayslip = (emp) => {
    if (!emp) return;
    const y = parseInt(selectedYear) || new Date().getFullYear();
    const m = (selectedMonth !== undefined && selectedMonth !== null && !isNaN(parseInt(selectedMonth)))
      ? (parseInt(selectedMonth) + 1)
      : (new Date().getMonth() + 1);
    const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    const periodMonthYear = `${monthNames[m - 1] || 'CURRENT'} ${y}`;
    const currentMonthDays = new Date(y, m, 0).getDate();

    let dutySettings = appState?.hr_duty_settings || null;
    try {
      if (!dutySettings) {
        const saved = localStorage.getItem('hr_duty_settings');
        if (saved) dutySettings = JSON.parse(saved);
      }
    } catch (e) {}

    const dutyInfo = getEffectiveDutyHours(emp, dutySettings);
    const empDutyHours = Number(dutyInfo?.hours) || 8;

    const baseSalary = Number(emp.basicSalary || emp.salary || emp.baseSalary || 20000);
    const oneDayAmount = currentMonthDays > 0 ? (baseSalary / currentMonthDays) : 0;
    const oneHourAmount = empDutyHours > 0 ? (oneDayAmount / empDutyHours) : 0;

    const otMultiplier = getEffectiveOvertimeMultiplier(emp, dutySettings);
    const otHourlyRate = oneHourAmount * otMultiplier;

    const dailyRecords = [];
    let presentDays = 0;
    let paidDays = 0;
    let absentDays = 0;
    let totalOtHours = 0;
    let totalDtHours = 0;

    const empIdStr = String(emp.id || '');
    const empCodeStr = String(emp.employeeCode || '');
    const empNameLower = String(emp.name || '').trim().toLowerCase();

    for (let d = 1; d <= currentMonthDays; d++) {
      const dayDateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dateDisplay = String(d).padStart(2, '0');

      const attObj = emp.attendance || {};
      const dayRecord = attObj[dayDateStr] || attObj[`${y}-${m}-${d}`] || attObj[d] || null;

      const punch = (liveUploadedAttendance || uploadedAttendance || []).find(u => 
        ((u.employeeId && (String(u.employeeId) === empIdStr || String(u.employeeId) === empCodeStr)) ||
         (u.employeeName && String(u.employeeName).trim().toLowerCase() === empNameLower)) &&
        (u.date === dayDateStr || normalizeDate(u.date) === normalizeDate(dayDateStr))
      );

      const otReq = (appState?.hr_overtime_requests || []).find(r => 
        r.status === 'Approved' &&
        ((r.employeeId && (String(r.employeeId) === empIdStr || String(r.employeeId) === empCodeStr)) ||
         (r.employeeName && String(r.employeeName).trim().toLowerCase() === empNameLower)) &&
        (r.date === dayDateStr || normalizeDate(r.date) === normalizeDate(dayDateStr))
      );

      let status = dayRecord?.status || punch?.status;
      let ot = parseFloat(dayRecord?.ot || punch?.ot || otReq?.hours || 0) || 0;
      let dt = parseFloat(dayRecord?.deductions || punch?.lateHours || 0) || 0;
      let remarks = dayRecord?.remarks || punch?.remarks || '-';

      const dayOfWeek = new Date(y, m - 1, d).getDay();
      if (!status) {
        if (dayOfWeek === 0) {
          status = 'off day';
        } else {
          status = 'absent';
        }
      }

      const statLower = String(status).toLowerCase();
      let attCode = 'ABS';
      if (statLower.includes('present') || statLower === 'p') {
        attCode = 'P';
        presentDays++;
        if (dutySettings?.attendanceStatusRules?.present?.isPaid !== false) paidDays += 1;
        else absentDays += 1;
      } else if (statLower.includes('offday') || statLower.includes('off day') || statLower === 'off') {
        attCode = 'OFF';
        if (dutySettings?.attendanceStatusRules?.offday?.isPaid !== false) paidDays += 1;
        else absentDays += 1;
        if (remarks === '-' || !remarks) remarks = 'Weekly Off';
      } else if (statLower.includes('holiday')) {
        attCode = 'HOL';
        if (dutySettings?.attendanceStatusRules?.holiday?.isPaid !== false) paidDays += 1;
        else absentDays += 1;
        if (remarks === '-' || !remarks) remarks = 'Public Holiday';
      } else if (statLower.includes('leave') || statLower === 'l' || statLower === 'paid_leave') {
        attCode = 'L';
        if (dutySettings?.attendanceStatusRules?.leave?.isPaid !== false) paidDays += 1;
        else absentDays += 1;
      } else if (statLower.includes('half') || statLower === 'halfday') {
        attCode = 'HLD';
        presentDays += 0.5;
        if (dutySettings?.attendanceStatusRules?.halfday?.isPaid !== false) paidDays += 0.5;
        else absentDays += 0.5;
      } else {
        attCode = 'ABS';
        if (dutySettings?.attendanceStatusRules?.absent?.isPaid === true) paidDays += 1;
        else absentDays++;
      }

      totalOtHours += ot;
      totalDtHours += dt;

      dailyRecords.push({
        dateStr: dateDisplay,
        att: attCode,
        ot: ot > 0 ? `+${ot.toFixed(1)}h` : '-',
        dt: dt > 0 ? `-${dt.toFixed(1)}h` : '-',
        remarks: remarks || '-'
      });
    }

    const earnedBasicSalary = Math.round(oneDayAmount * paidDays * 100) / 100;
    const absentDeduction = Math.round(oneDayAmount * absentDays * 100) / 100;
    const otPay = Math.round(totalOtHours * otHourlyRate * 100) / 100;
    const dtDeduction = Math.round(totalDtHours * oneHourAmount * 100) / 100;
    const allowances = Number(emp.allowance || emp.allowances || 0);
    const advance = Number(emp.advance || emp.advanceAmount || 0);
    const loanInstallment = Number(emp.loan || emp.loanInstallment || 0);
    const fines = Number(emp.fine || emp.fines || 0);

    const netAdjustmentBalance = Math.round((otPay + allowances - absentDeduction - dtDeduction - fines - advance - loanInstallment) * 100) / 100;
    const netSalary = Math.max(0, Math.round((earnedBasicSalary + otPay + allowances - dtDeduction - fines - advance - loanInstallment) * 100) / 100);

    const slipData = {
      employeeId: emp.employeeCode || emp.id || '-',
      employeeName: emp.name || 'EMPLOYEE',
      designation: emp.designation || emp.role || 'WORKER',
      department: emp.department || 'Operations',
      shiftSchedule: emp.shift || 'Standard',
      dutyHours: empDutyHours,
      basicSalary: baseSalary,
      paidDays: paidDays,
      presentDays: presentDays,
      absentDays: absentDays,
      currentMonthDays: currentMonthDays,
      periodMonthYear: periodMonthYear,
      otHours: totalOtHours,
      otPay: otPay,
      dtHours: totalDtHours,
      dtDeduction: dtDeduction,
      absentDeduction: absentDeduction,
      fines: fines,
      allowances: allowances,
      advance: advance,
      loanInstallment: loanInstallment,
      netAdjustmentBalance: netAdjustmentBalance,
      netSalary: netSalary,
      dailyRecords: dailyRecords
    };

    setLivePayslipModalData(slipData);
    setIsLivePayslipOpen(true);
  };

  const filteredEmployees = localEmployees.filter(emp => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q || 
      (emp.name && emp.name.toLowerCase().includes(q)) ||
      (emp.id && String(emp.id).toLowerCase().includes(q)) ||
      (emp.employeeCode && String(emp.employeeCode).toLowerCase().includes(q)) ||
      (emp.department && emp.department.toLowerCase().includes(q));

    const matchDept = departmentFilter === 'ALL' || !departmentFilter || emp.department === departmentFilter;
    const empDiv = emp.division || emp.section || 'AJ Synthetic';
    const matchDiv = divisionFilter === 'ALL' || !divisionFilter || (empDiv === divisionFilter);

    if (!matchSearch || !matchDept || !matchDiv) return false;

    // Employment Status Filter (Active / Inactive)
    const empStatus = (emp.status || 'Active').toLowerCase();
    const allowActive = selectedEmploymentStatuses.some(s => s.toLowerCase() === 'active');
    const allowInactive = selectedEmploymentStatuses.some(s => s.toLowerCase() === 'inactive');
    if (allowActive && !allowInactive && empStatus !== 'active') return false;
    if (allowInactive && !allowActive && empStatus === 'active') return false;
    if (!allowActive && !allowInactive) return false;

    // Alphabetical Letter Filter
    if (selectedAlphaLetter !== 'ALL') {
      const firstChar = (emp.name || '').trim().charAt(0).toUpperCase();
      if (firstChar !== selectedAlphaLetter) return false;
    }

    if (statusFilter !== 'ALL' && statusFilter) {
      const att = emp.attendance || {};
      const rec = att[startDate] || att[selectedDay] || {};
      if ((rec.status || 'absent').toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
    }

    return true;
  }).sort((a, b) => {
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    return nameSortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
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
    if (isCurrentMonthFinalized) {
      alertSalaryFinalizedLocked();
      return;
    }
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

  if (viewMode === 'reconcile') {
    return renderReconciliationView();
  }

  if (isMobile) {
    return renderMobileView();
  }

  return renderDesktopView();

  // ========================================================
  // MOBILE VIEW (Supervisor Attendance Log)
  // ========================================================
  function renderMobileView() {
    return (
      <div className="flex flex-col gap-6 animate-fade-in pb-28 select-none">
        {/* Payroll Finalized Locked Notice Banner */}
        {isCurrentMonthFinalized && (
          <div className="bg-amber-500/10 border-2 border-amber-500/40 text-amber-950 dark:text-amber-100 p-4 rounded-2xl flex flex-col gap-2 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-amber-700">lock</span>
              <span className="font-headline font-black text-xs text-amber-900 uppercase">Attendance Locked (Read-Only)</span>
            </div>
            <p className="text-[11px] text-amber-800/90 font-medium">Payroll finalized for this month. Attendance records are read-only. Delete the finalized payroll from history to edit.</p>
          </div>
        )}

        {/* Welcome Header */}
        <header className="flex flex-col gap-1">
          <h2 className="font-headline text-2xl font-black text-on-surface tracking-tight leading-tight">Shift Log</h2>
          <p className="font-body text-xs text-on-surface-variant font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-primary">calendar_today</span>
            Oct 24, 2023 (Friday)
          </p>
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
  // RECONCILIATION VIEW (Comparative Side-by-Side Dual Grid)
  // ========================================================
  function renderReconciliationView() {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const temp = new Date(start);
      let count = 0;
      while (temp <= end && count < 32) {
        count++;
        const dayName = temp.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = temp.getDate();
        const dateString = temp.toISOString().split('T')[0];
        dates.push({
          key: dayName,
          num: dayNum,
          date: dateString
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
          
          <div className="flex items-center gap-3 shrink-0">
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
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              
              {/* Quick Search */}
              <div className="relative flex-1 sm:flex-initial">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant text-[16px]">search</span>
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Quick search employees..."
                  className="w-full sm:w-56 bg-surface-container-low border border-outline-variant/20 rounded-xl pl-9 pr-4 py-2 text-xs text-on-surface font-semibold focus:bg-surface-container-lowest focus:border-primary/50 transition-all focus:ring-2 focus:ring-primary/10 outline-none"
                />
              </div>

              {/* MODERN UI DIVISION DROPDOWN - System UI Matched */}
              <div className="relative group">
                <div className="flex items-center bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/20 hover:border-primary/50 rounded-xl px-3 py-1.5 transition-all shadow-xs">
                  <span className="material-symbols-outlined text-[17px] text-primary mr-1.5">apartment</span>
                  <select 
                    value={divisionFilter}
                    onChange={e => {
                      setDivisionFilter(e.target.value);
                      setDepartmentFilter('ALL');
                      setCurrentPage(1);
                    }}
                    className="bg-transparent border-none text-xs font-bold text-on-surface cursor-pointer outline-none focus:ring-0 pr-6 appearance-none"
                    title="Filter by Division"
                  >
                    {divisionsList.map(div => (
                      <option key={div} value={div} className="bg-surface-container-lowest text-on-surface font-semibold">
                        {div === 'ALL' ? '🏬 All Divisions' : div}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined text-[16px] text-outline absolute right-2 pointer-events-none group-hover:text-primary transition-colors">
                    expand_more
                  </span>
                </div>
              </div>

              {/* Month Select */}
              <div className="relative group">
                <div className="flex items-center bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/20 hover:border-primary/50 rounded-xl px-3 py-1.5 transition-all shadow-xs">
                  <span className="material-symbols-outlined text-[17px] text-secondary mr-1.5">calendar_month</span>
                  <select 
                    value={selectedMonth}
                    onChange={e => {
                      const m = parseInt(e.target.value);
                      setSelectedMonth(m);
                      updateDateRangeFromMonthYear(m, selectedYear);
                    }}
                    className="bg-transparent border-none text-xs font-bold text-on-surface cursor-pointer outline-none focus:ring-0 pr-6 appearance-none"
                  >
                    {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, idx) => (
                      <option key={month} value={idx} className="bg-surface-container-lowest text-on-surface font-semibold">{month}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined text-[16px] text-outline absolute right-2 pointer-events-none group-hover:text-secondary transition-colors">
                    expand_more
                  </span>
                </div>
              </div>

              {/* Year Select */}
              <div className="relative group">
                <div className="flex items-center bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/20 hover:border-primary/50 rounded-xl px-3 py-1.5 transition-all shadow-xs">
                  <select 
                    value={selectedYear}
                    onChange={e => {
                      const y = parseInt(e.target.value);
                      setSelectedYear(y);
                      updateDateRangeFromMonthYear(selectedMonth, y);
                    }}
                    className="bg-transparent border-none text-xs font-bold text-on-surface cursor-pointer outline-none focus:ring-0 pr-6 appearance-none"
                  >
                    {[2022, 2023, 2024, 2025, 2026].map(year => (
                      <option key={year} value={year} className="bg-surface-container-lowest text-on-surface font-semibold">{year}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined text-[16px] text-outline absolute right-2 pointer-events-none group-hover:text-primary transition-colors">
                    expand_more
                  </span>
                </div>
              </div>

              {/* Interactive Date Picker Button */}
              <div className="relative">
                <button 
                  onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  className="bg-surface-container-low hover:bg-surface-container-high px-3.5 py-1.5 rounded-xl border border-outline-variant/20 text-xs font-bold text-on-surface flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">date_range</span>
                  {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  <span className="material-symbols-outlined text-[15px] text-outline">expand_more</span>
                </button>
                
                {isDatePickerOpen && (
                  <div className="absolute left-0 mt-2 z-50 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 shadow-xl flex flex-col gap-3 min-w-[280px] animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-primary">Start Date</span>
                      <input 
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-transparent text-on-surface"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-primary">End Date</span>
                      <input 
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-transparent text-on-surface"
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

            {/* Total count badge */}
            <div className="text-[11px] font-bold text-on-surface-variant flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-xl border border-outline-variant/10">
              <span className="material-symbols-outlined text-[16px] text-primary">badge</span>
              <span>Total: <strong className="text-on-surface font-black">{filteredEmployees.length}</strong></span>
            </div>
          </div>

          {/* ALPHABETICAL FILTER KEYS & SORTING PILLS */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-outline-variant/10 text-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant mr-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-primary">sort_by_alpha</span>
              Alpha:
            </span>

            {/* A to Z Sort Toggle */}
            <button
              onClick={() => setNameSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                nameSortOrder === 'asc'
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-secondary/10 text-secondary border-secondary/20'
              }`}
              title="Toggle Ascending / Descending Name Sorting"
            >
              <span>{nameSortOrder === 'asc' ? 'A → Z' : 'Z → A'}</span>
              <span className="material-symbols-outlined text-[13px]">{nameSortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
            </button>

            {/* All Pill */}
            <button
              onClick={() => { setSelectedAlphaLetter('ALL'); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                selectedAlphaLetter === 'ALL'
                  ? 'bg-primary text-on-primary shadow-xs font-black'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              All
            </button>

            {/* Individual Letter Pills A-Z */}
            {['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'].map(char => (
              <button
                key={char}
                onClick={() => {
                  setSelectedAlphaLetter(selectedAlphaLetter === char ? 'ALL' : char);
                  setCurrentPage(1);
                }}
                className={`w-6 h-6 rounded-md text-[11px] font-bold flex items-center justify-center transition-all cursor-pointer ${
                  selectedAlphaLetter === char
                    ? 'bg-primary text-on-primary shadow-xs font-black scale-105'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                {char}
              </button>
            ))}

            {selectedAlphaLetter !== 'ALL' && (
              <span className="text-[11px] text-primary font-bold ml-2">
                Showing "{selectedAlphaLetter}" ({filteredEmployees.length} employees)
              </span>
            )}
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
                    <th key={day.date} colSpan="2" className="px-4 py-2 border-b border-l border-outline-variant/20 text-center bg-surface-container-low font-headline min-w-[240px]">
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{day.key}</span>
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
  function FieldCommentButton({ empId, dayKey, field, value, reasonField, disabled }) {
    const isSelected = activeComment?.empId === empId && activeComment?.dayKey === dayKey && activeComment?.field === reasonField;
    const reasonText = value[reasonField] || '';
    const hasReason = reasonText.trim().length > 0;

    if (disabled) {
      if (!hasReason) return null;
      return (
        <div className="relative flex items-center justify-center shrink-0 group">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center transition-all bg-primary/10 text-primary cursor-default"
            title={`Reason: ${reasonText}`}
          >
            <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              chat_bubble
            </span>
          </div>
          <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:block z-30 bg-slate-800 text-white text-[9px] font-bold py-1 px-2 rounded shadow-md whitespace-nowrap pointer-events-none">
            {reasonText}
          </div>
        </div>
      );
    }
    
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
        {/* Payroll Finalized Locked Notice Banner */}
        {isCurrentMonthFinalized && (
          <div className="bg-amber-500/10 border-2 border-amber-500/40 text-amber-950 dark:text-amber-100 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[22px] text-amber-700 shrink-0">lock</span>
              <div>
                <span className="font-headline font-black text-xs text-amber-900 uppercase block">Attendance Locked (Read-Only)</span>
                <span className="text-[11px] text-amber-800/90 font-medium">Payroll finalized for this month. Attendance records are read-only. Delete the finalized payroll from history to edit.</span>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-amber-500/20 text-amber-900 px-2.5 py-1 rounded-lg shrink-0">Finalized</span>
          </div>
        )}

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

            {/* Division Filter Dropdown (Saved per user) */}
            <div className="relative flex items-center bg-white border border-outline-variant/20 hover:border-primary/50 rounded-xl px-3 py-2 transition-all shadow-2xs group w-full sm:w-auto">
              <span className="material-symbols-outlined text-[16px] text-primary mr-1.5 group-hover:scale-110 transition-transform">apartment</span>
              <select
                value={divisionFilter}
                onChange={(e) => {
                  setDivisionFilter(e.target.value);
                  setDepartmentFilter('ALL');
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto bg-transparent border-none text-xs font-bold text-on-surface cursor-pointer outline-none focus:ring-0 pr-5 appearance-none"
                title="Filter by Division (Saved for your user profile)"
              >
                {divisionsList.map(div => (
                  <option key={div} value={div} className="bg-white text-on-surface">
                    {div === 'ALL' ? '🏬 All Divisions' : div}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined text-[14px] text-outline absolute right-2 pointer-events-none">arrow_drop_down</span>
            </div>

            {/* Department Filter Dropdown (Saved per user, Cascaded) */}
            <div className="relative flex items-center bg-white border border-outline-variant/20 hover:border-primary/50 rounded-xl px-3 py-2 transition-all shadow-2xs group w-full sm:w-auto">
              <span className="material-symbols-outlined text-[16px] text-primary mr-1.5 group-hover:scale-110 transition-transform">domain</span>
              <select
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto bg-transparent border-none text-xs font-bold text-on-surface cursor-pointer outline-none focus:ring-0 pr-5 appearance-none"
                title="Filter by Department (Saved for your user profile)"
              >
                {departmentsList.map(dept => (
                  <option key={dept} value={dept} className="bg-white text-on-surface">
                    {dept === 'ALL' ? '🏢 All Departments' : dept}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined text-[14px] text-outline absolute right-2 pointer-events-none">arrow_drop_down</span>
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

          {/* ALPHABETICAL FILTER KEYS & SORTING PILLS (Mobile Card View) */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-outline-variant/10 text-xs w-full">
            <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant mr-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-primary">sort_by_alpha</span>
              Alpha:
            </span>

            <button
              type="button"
              onClick={() => setNameSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                nameSortOrder === 'asc' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-secondary/10 text-secondary border-secondary/20'
              }`}
            >
              <span>{nameSortOrder === 'asc' ? 'A → Z' : 'Z → A'}</span>
            </button>

            <button
              type="button"
              onClick={() => { setSelectedAlphaLetter('ALL'); setCurrentPage(1); }}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                selectedAlphaLetter === 'ALL' ? 'bg-primary text-on-primary font-black' : 'bg-surface-container-low text-on-surface-variant'
              }`}
            >
              All
            </button>

            {['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'].map(char => (
              <button
                key={char}
                type="button"
                onClick={() => {
                  setSelectedAlphaLetter(selectedAlphaLetter === char ? 'ALL' : char);
                  setCurrentPage(1);
                }}
                className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center transition-all cursor-pointer ${
                  selectedAlphaLetter === char ? 'bg-primary text-on-primary font-black scale-105' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {char}
              </button>
            ))}

            <div className="ml-auto text-[10px] font-bold text-on-surface-variant">
              Total: <strong className="text-on-surface">{filteredEmployees.length}</strong>
            </div>
          </div>
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
                        className={`flex-none w-[190px] border border-outline-variant/20 rounded-xl p-3 snap-center space-y-2.5 transition-all ${
                          rec.status === 'present' ? 'bg-emerald-500/5 border-emerald-500/20' :
                          rec.status === 'absent' ? 'bg-red-500/5 border-red-500/20' :
                          rec.status === 'leave' ? 'bg-amber-500/5 border-amber-500/20' :
                          rec.status === 'holiday' ? 'bg-blue-500/5 border-blue-500/20' :
                          'bg-slate-500/5 border-slate-500/20'
                        }`}
                      >
                        {/* Day & Date Header */}
                        <div className="text-center border-b border-outline-variant/10 pb-1.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-none">{day.key}</span>
                          <span className="text-sm font-black text-on-surface block leading-tight mt-0.5">{day.num}</span>
                        </div>

                        {/* Status Tap-to-Cycle Button (No Dropdown) */}
                        {effectiveActiveConditions.attendance && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Status</span>
                            <div className="flex gap-1.5 items-center">
                              <button
                                type="button"
                                disabled={!canEditAttendance || isCurrentMonthFinalized || isDateFinalized(day.date || day.key)}
                                onClick={() => canEditAttendance && !isCurrentMonthFinalized && !isDateFinalized(day.date || day.key) && handleCycleStatus(emp.id, day.date || day.key, rec.status)}
                                className={`flex-1 rounded-xl px-2.5 py-1.5 text-xs font-black transition-all flex items-center justify-between shadow-2xs ${(!canEditAttendance || isCurrentMonthFinalized || isDateFinalized(day.date || day.key)) ? 'cursor-not-allowed opacity-75' : 'cursor-pointer active:scale-95'} ${
                                  rec.status === 'present' ? 'text-emerald-700 bg-emerald-500/15 border border-emerald-500/30' :
                                  rec.status === 'absent' ? 'text-red-700 bg-red-500/15 border border-red-500/30' :
                                  rec.status === 'leave' ? 'text-amber-700 bg-amber-500/15 border border-amber-500/30' :
                                  rec.status === 'holiday' ? 'text-blue-700 bg-blue-500/15 border border-blue-500/30' :
                                  'text-indigo-700 bg-indigo-500/15 border border-indigo-500/30'
                                }`}
                                title={isCurrentMonthFinalized || isDateFinalized(day.date || day.key) ? "Locked by Finalized Payroll" : "Tap to cycle status"}
                              >
                                <span className="capitalize">{rec.status || 'absent'}</span>
                                {canEditAttendance && !isCurrentMonthFinalized && !isDateFinalized(day.date || day.key) && <span className="material-symbols-outlined text-[13px] opacity-70">sync</span>}
                              </button>
                              {canEditAttendance && (
                                <FieldCommentButton 
                                  empId={emp.id} 
                                  dayKey={day.date || day.key} 
                                  field="statusReason" 
                                  value={rec} 
                                  reasonField="statusReason" 
                                  disabled={!canEditAttendance || isCurrentMonthFinalized || isDateFinalized(day.date || day.key)}
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
        
        {/* Payroll Finalized Locked Notice Banner */}
        {isCurrentMonthFinalized && (
          <div className="bg-amber-500/10 border-2 border-amber-500/40 text-amber-950 dark:text-amber-100 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
                <span className="material-symbols-outlined text-[24px]">lock</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-headline font-black text-sm text-amber-900 dark:text-amber-100 uppercase tracking-wide">
                    Attendance Locked (Read-Only Mode)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/25 text-amber-800 dark:text-amber-200 uppercase">
                    Salary Finalized
                  </span>
                </div>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/90 font-medium mt-0.5">
                  Payroll for <strong>{monthsList[selectedMonth]?.name} {selectedYear}</strong> has been finalized. Attendance is locked in read-only mode. To modify records, please delete the finalized payroll from Salary Generation History.
                </p>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-200 bg-amber-500/20 px-3.5 py-1.5 rounded-xl border border-amber-500/30 flex items-center gap-1.5 shadow-2xs">
                <span className="material-symbols-outlined text-[15px]">lock_clock</span>
                Locked by Payroll
              </span>
            </div>
          </div>
        )}
        
        {/* Dynamic Action Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="font-headline text-3xl font-black text-on-surface tracking-tight leading-tight">Workforce Verification Grid</h1>
            <p className="font-body text-xs text-on-surface-variant mt-1.5 font-medium">Review and reconcile attendance, overtime, and policy logs for manufacturing squads.</p>
          </div>
          
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {/* Pulsing Unsaved Changes Indicator Button */}
            {canEditAttendance && (
              <button 
                onClick={handleSaveChanges}
                disabled={isCurrentMonthFinalized}
                title={isCurrentMonthFinalized ? "Locked: Salary finalized for this month" : "Save Changes"}
                className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all active:scale-[0.97] relative shadow-lg ${
                  isCurrentMonthFinalized
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 cursor-not-allowed opacity-75'
                    : isDirty 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse cursor-pointer' 
                    : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 cursor-default opacity-85'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isCurrentMonthFinalized ? 'lock' : 'save'}
                </span>
                {isCurrentMonthFinalized ? 'Payroll Finalized (Locked)' : 'Save Changes'}
                {isDirty && !isCurrentMonthFinalized && (
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
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col gap-3">
          <div className="flex flex-col xl:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-3 w-full xl:w-auto flex-wrap">
              {/* Quick search employees */}
              <div className="relative flex-1 sm:flex-initial">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant text-[16px]">search</span>
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  placeholder="Quick search employees..."
                  className="w-full sm:w-56 bg-surface-container-low border border-outline-variant/15 rounded-xl pl-9 pr-4 py-2 text-xs text-on-surface font-semibold focus:bg-surface-container-lowest focus:border-primary/50 transition-all focus:ring-0 outline-none"
                />
              </div>

              {/* MODERN UI DIVISION DROPDOWN - System UI Matched */}
              <div className="relative group">
                <div className="flex items-center bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/20 hover:border-primary/50 rounded-xl px-3 py-1.5 transition-all shadow-xs">
                  <span className="material-symbols-outlined text-[17px] text-primary mr-1.5">apartment</span>
                  <select 
                    value={divisionFilter}
                    onChange={e => {
                      setDivisionFilter(e.target.value);
                      setDepartmentFilter('ALL');
                      setCurrentPage(1);
                    }}
                    className="bg-transparent border-none text-xs font-bold text-on-surface cursor-pointer outline-none focus:ring-0 pr-6 appearance-none"
                    title="Filter by Division"
                  >
                    {divisionsList.map(div => (
                      <option key={div} value={div} className="bg-surface-container-lowest text-on-surface font-semibold">
                        {div === 'ALL' ? '🏬 All Divisions' : div}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined text-[16px] text-outline absolute right-2 pointer-events-none group-hover:text-primary transition-colors">
                    expand_more
                  </span>
                </div>
              </div>
              
              {/* Month Select, Year Select & Date Picker */}
              {canUseDateFilter && (
                <>
                  {/* Month Select */}
                  <div className="relative group">
                    <div className="flex items-center bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/20 hover:border-primary/50 rounded-xl px-3 py-1.5 transition-all shadow-xs">
                      <span className="material-symbols-outlined text-[16px] text-secondary mr-1">calendar_month</span>
                      <select 
                        value={selectedMonth}
                        onChange={e => {
                          const m = parseInt(e.target.value);
                          setSelectedMonth(m);
                          updateDateRangeFromMonthYear(m, selectedYear);
                        }}
                        className="bg-transparent border-none text-xs font-bold text-on-surface cursor-pointer outline-none focus:ring-0 pr-6 appearance-none"
                      >
                        {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, idx) => (
                          <option key={month} value={idx} className="bg-surface-container-lowest text-on-surface font-semibold">{month}</option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined text-[16px] text-outline absolute right-2 pointer-events-none group-hover:text-secondary transition-colors">
                        expand_more
                      </span>
                    </div>
                  </div>

                  {/* Year Select */}
                  <div className="relative group">
                    <div className="flex items-center bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/20 hover:border-primary/50 rounded-xl px-3 py-1.5 transition-all shadow-xs">
                      <select 
                        value={selectedYear}
                        onChange={e => {
                          const y = parseInt(e.target.value);
                          setSelectedYear(y);
                          updateDateRangeFromMonthYear(selectedMonth, y);
                        }}
                        className="bg-transparent border-none text-xs font-bold text-on-surface cursor-pointer outline-none focus:ring-0 pr-6 appearance-none"
                      >
                        {[2022, 2023, 2024, 2025, 2026].map(year => (
                          <option key={year} value={year} className="bg-surface-container-lowest text-on-surface font-semibold">{year}</option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined text-[16px] text-outline absolute right-2 pointer-events-none group-hover:text-primary transition-colors">
                        expand_more
                      </span>
                    </div>
                  </div>

                  {/* Interactive Date Picker Button */}
                  <div className="relative">
                    <button 
                      onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                      className="bg-surface-container-low hover:bg-surface-container-high px-3.5 py-1.5 rounded-xl border border-outline-variant/20 text-xs font-bold text-on-surface flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[16px] text-primary">calendar_month</span>
                      {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      <span className="material-symbols-outlined text-[15px] text-outline">expand_more</span>
                    </button>
                    
                    {isDatePickerOpen && (
                      <div className="absolute left-0 mt-2 z-50 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 shadow-xl flex flex-col gap-3 min-w-[280px] animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] uppercase tracking-wider font-bold text-primary">Start Date</span>
                          <input 
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-transparent text-on-surface"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] uppercase tracking-wider font-bold text-primary">End Date</span>
                          <input 
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-transparent text-on-surface"
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
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        activeConditions.attendance 
                          ? 'bg-primary-fixed text-on-primary-fixed shadow-2xs' 
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
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        activeConditions.overtime 
                          ? 'bg-primary-fixed text-on-primary-fixed shadow-2xs' 
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
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        activeConditions.fines 
                          ? 'bg-primary-fixed text-on-primary-fixed shadow-2xs' 
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
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        activeConditions.deductions 
                          ? 'bg-primary-fixed text-on-primary-fixed shadow-2xs' 
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

          {/* ALPHABETICAL FILTER KEYS & SORTING PILLS */}
          <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-outline-variant/10 text-xs w-full">
            <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant mr-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-primary">sort_by_alpha</span>
              Alpha:
            </span>

            {/* A to Z Sort Toggle */}
            <button
              type="button"
              onClick={() => setNameSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                nameSortOrder === 'asc'
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-secondary/10 text-secondary border-secondary/20'
              }`}
              title="Toggle Ascending / Descending Name Sorting"
            >
              <span>{nameSortOrder === 'asc' ? 'A → Z' : 'Z → A'}</span>
              <span className="material-symbols-outlined text-[13px]">{nameSortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
            </button>

            {/* All Pill */}
            <button
              type="button"
              onClick={() => { setSelectedAlphaLetter('ALL'); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                selectedAlphaLetter === 'ALL'
                  ? 'bg-primary text-on-primary shadow-xs font-black'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              All
            </button>

            {/* Individual Letter Pills A-Z */}
            {['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'].map(char => (
              <button
                key={char}
                type="button"
                onClick={() => {
                  setSelectedAlphaLetter(selectedAlphaLetter === char ? 'ALL' : char);
                  setCurrentPage(1);
                }}
                className={`w-6 h-6 rounded-md text-[11px] font-bold flex items-center justify-center transition-all cursor-pointer ${
                  selectedAlphaLetter === char
                    ? 'bg-primary text-on-primary shadow-xs font-black scale-105'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                {char}
              </button>
            ))}

            {selectedAlphaLetter !== 'ALL' && (
              <span className="text-[11px] text-primary font-bold ml-2">
                Showing "{selectedAlphaLetter}" ({filteredEmployees.length} employees)
              </span>
            )}

            {/* Total count badge */}
            <div className="ml-auto text-[11px] font-bold text-on-surface-variant flex items-center gap-1.5 bg-surface-container-low px-3 py-1 rounded-xl border border-outline-variant/10">
              <span className="material-symbols-outlined text-[15px] text-primary">badge</span>
              <span>Total: <strong className="text-on-surface font-black">{filteredEmployees.length}</strong></span>
            </div>
          </div>
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
                        className="px-6 py-3 border-b border-l border-outline-variant/20 relative bg-surface-container-low text-center"
                      >
                        <div className="flex flex-col items-center relative">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{day.key}</span>
                          <div className="flex items-center gap-1.5 mt-0.5 justify-center">
                            <span className="text-base font-black text-on-surface">{day.num}</span>
                            {canEditAttendance && !isCurrentMonthFinalized && !isDateFinalized(day.date) && (
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
                        draggable={canEditAttendance && !isCurrentMonthFinalized}
                        onDragStart={(e) => canEditAttendance && !isCurrentMonthFinalized && handleDragStart(e, emp.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => canEditAttendance && !isCurrentMonthFinalized && handleDrop(e, emp.id)}
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

                        if (livePunchRec && !rec.userEdited) {
                          rec = {
                            ...rec,
                            status: 'present',
                            inTime: livePunchRec.inTime || rec.inTime,
                            outTime: livePunchRec.outTime || rec.outTime,
                            duration: livePunchRec.duration || rec.duration,
                            ot: parseFloat(livePunchRec.ot || 0) > 0 ? parseFloat(livePunchRec.ot) : rec.ot,
                            explicitStatus: true
                          };
                        } else if (approvedOtReq && parseFloat(approvedOtReq.hours || 0) > 0 && !rec.userEdited) {
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
                        
                        // Force clean default 'present' records without punches to show as 'absent' (or 'off day' for Sunday)
                        const isSunday = (day.key === 'Sun') || (day.date && new Date(day.date).getDay() === 0);
                        if (!rec.explicitStatus && !rec.inTime && !rec.outTime && !rec.ot && !rec.fines && !rec.deductions && !rec.statusReason && !rec.otReason && !rec.finesReason && !rec.deductionsReason) {
                          if (isSunday) {
                            rec = { ...rec, status: 'off day' };
                          } else if (rec.status === 'present') {
                            rec = { ...rec, status: 'absent' };
                          }
                        }
                        const isPresent = rec.status === 'present';
                        const isDayLocked = isCurrentMonthFinalized || isDateFinalized(day.date || day.key);
                        
                        return (
                          <td 
                            key={colKey} 
                            style={{ width: cWidth, minWidth: cWidth, maxWidth: cWidth }}
                            className={`p-4 border-l border-outline-variant/20 transition-all ${
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
                                      disabled={!canEditAttendance || isDayLocked}
                                      onChange={(e) => canEditAttendance && !isDayLocked && handleStatusChange(emp.id, day.date || day.key, e.target.value)}
                                      className={`flex-1 bg-white border border-outline-variant/20 rounded-xl px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent transition-all ${(!canEditAttendance || isDayLocked) ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'} ${
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
                                        disabled={!canEditAttendance || isDayLocked}
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
                                <div className={`flex flex-col gap-1 ${(!isPresent || !canEditAttendance || isDayLocked) ? 'opacity-40 pointer-events-none' : ''}`}>
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Overtime</span>
                                  <div className="flex gap-1.5 items-center">
                                    <div className="relative flex-1 flex items-center">
                                      <span className="absolute left-2.5 text-[9px] font-bold text-slate-400 select-none">OT:</span>
                                      <input 
                                        type="text"
                                        value={isPresent ? `${rec.ot}h` : '-'}
                                        disabled={!isPresent || !canEditAttendance || isDayLocked}
                                        readOnly={isDayLocked}
                                        onChange={(e) => {
                                          if (!canEditAttendance || isDayLocked) return;
                                          const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                                          handleValueChange(emp.id, day.date || day.key, 'ot', parseFloat(cleaned) || 0);
                                        }}
                                        className={`w-full bg-surface-container-low border border-outline-variant/15 rounded px-2 pl-8 py-1 text-[11px] text-right font-black transition-all outline-none ${
                                          isDayLocked ? 'cursor-not-allowed opacity-75 text-slate-500' : 'text-primary focus:bg-surface-container-lowest focus:ring-0 focus:border-primary/50'
                                        }`}
                                      />
                                    </div>
                                    {canEditAttendance && (
                                      <FieldCommentButton 
                                        empId={emp.id} 
                                        dayKey={day.date || day.key} 
                                        field="otReason" 
                                        value={rec} 
                                        reasonField="otReason" 
                                        disabled={!canEditAttendance || isDayLocked}
                                      />
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Fines input */}
                              {effectiveActiveConditions.fines && (
                                <div className={`flex flex-col gap-1 ${(!canEditAttendance || isDayLocked) ? 'opacity-60 pointer-events-none' : ''}`}>
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Fine</span>
                                  <div className="flex gap-1.5 items-center">
                                    <div className="relative flex-1 flex items-center">
                                      <span className="absolute left-2.5 text-[9px] font-bold text-slate-400 select-none">FINE:</span>
                                      <input 
                                        type="number"
                                        value={rec.fines || ''}
                                        disabled={!canEditAttendance || isDayLocked}
                                        readOnly={isDayLocked}
                                        onChange={(e) => canEditAttendance && !isDayLocked && handleValueChange(emp.id, day.date || day.key, 'fines', parseFloat(e.target.value) || 0)}
                                        placeholder="0"
                                        className={`w-full bg-surface-container-low border border-outline-variant/15 rounded px-2 pl-10 py-1 text-[11px] text-right font-semibold text-on-surface transition-all outline-none ${
                                          isDayLocked ? 'cursor-not-allowed opacity-75' : 'focus:bg-surface-container-lowest focus:ring-0 focus:border-primary/50'
                                        }`}
                                      />
                                    </div>
                                    {canEditAttendance && (
                                      <FieldCommentButton 
                                        empId={emp.id} 
                                        dayKey={day.date || day.key} 
                                        field="finesReason" 
                                        value={rec} 
                                        reasonField="finesReason" 
                                        disabled={!canEditAttendance || isDayLocked}
                                      />
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Late coming deduction input (Upgraded time deduction in hours) */}
                              {effectiveActiveConditions.deductions && (
                                <div className={`flex flex-col gap-1 ${(!canEditAttendance || isDayLocked) ? 'opacity-60 pointer-events-none' : ''}`}>
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Late Coming</span>
                                  <div className="flex gap-1.5 items-center">
                                    <div className="relative flex-1 flex items-center">
                                      <span className="absolute left-2.5 text-[8px] font-bold text-slate-400 select-none">LATE:</span>
                                      <input 
                                        type="text"
                                        value={rec.deductions ? `${rec.deductions}h` : ''}
                                        disabled={!canEditAttendance || isDayLocked}
                                        readOnly={isDayLocked}
                                        onChange={(e) => {
                                          if (!canEditAttendance || isDayLocked) return;
                                          const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                                          handleValueChange(emp.id, day.date || day.key, 'deductions', parseFloat(cleaned) || 0);
                                        }}
                                        placeholder="hours"
                                        className={`w-full bg-surface-container-low border border-outline-variant/15 rounded px-2 pl-10 py-1 text-[11px] text-right font-semibold text-on-surface transition-all outline-none ${
                                          isDayLocked ? 'cursor-not-allowed opacity-75' : 'focus:bg-surface-container-lowest focus:ring-0 focus:border-primary/50'
                                        }`}
                                      />
                                    </div>
                                    {canEditAttendance && (
                                      <FieldCommentButton 
                                        empId={emp.id} 
                                        dayKey={day.date || day.key} 
                                        field="deductionsReason" 
                                        value={rec} 
                                        reasonField="deductionsReason" 
                                        disabled={!canEditAttendance || isDayLocked}
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
