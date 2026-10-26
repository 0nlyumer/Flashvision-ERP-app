import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { seedHrDepartments } from '../../utils/hrDepartments';
import { loadOnboardingHistory } from '../../utils/onboardingHistory';
import { isProbationEmployee, isOnboardingPending } from '../../utils/probation';

export default function HRDashboard({ isMobile, onNavigateTab }) {
  const [approvedRequests, setApprovedRequests] = useState({});
  const [timeframe, setTimeframe] = useState('This Week');
  const [showTimeframeMenu, setShowTimeframeMenu] = useState(false);
  const [monthViewMode, setMonthViewMode] = useState('weekly'); // 'weekly' | 'daily'
  const [drillDownMetric, setDrillDownMetric] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredDayIndex, setHoveredDayIndex] = useState(null);
  const [showPendingOnboardingModal, setShowPendingOnboardingModal] = useState(false);

  // Quick Onboarding state variables
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmpForm, setNewEmpForm] = useState({
    name: '',
    phone: '',
    avatar: null,
    paidInternship: false
  });
  const [modalError, setModalError] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);

  const fileInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Helper to determine today's dynamic local date in YYYY-MM-DD format
  const getTodayDateString = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [selectedDate, setSelectedDate] = useState(getTodayDateString);
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [divisionFilter, setDivisionFilter] = useState('ALL');

  const { state, setCollection } = useApp();

  const [localDeptTrigger, setLocalDeptTrigger] = useState(0);
  useEffect(() => {
    const handleUpdate = () => setLocalDeptTrigger(t => t + 1);
    window.addEventListener('hr_departments_config_updated', handleUpdate);
    return () => window.removeEventListener('hr_departments_config_updated', handleUpdate);
  }, []);

  const configuredDepartments = useMemo(() => {
    try {
      const saved = localStorage.getItem('hr_departments_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const isDummy = parsed.length === 3 && parsed.some(d => (d.name === 'Production Department' || d.name === 'Assembly Division'));
          if (!isDummy) {
            return parsed
              .map(d => ({ ...d, name: (d && (d.name || d.label || d.value)) || '' }))
              .filter(d => typeof d.name === 'string' && d.name.trim() !== '');
          }
        }
      }
    } catch (e) {}
    // Fallback = HR's canonical five (Omer, 2026-10-25) — never the
    // global stock departments, which are a separate list.
    return seedHrDepartments()
      .map(d => ({ ...d, name: (d && (d.name || d.label || d.value)) || '' }))
      .filter(d => typeof d.name === 'string' && d.name.trim() !== '');
  }, [localDeptTrigger]);

  const [activePopupTab, setActivePopupTab] = useState(() => {
    return configuredDepartments[0]?.name || '';
  });

  // Update popup default tab on configured departments reload
  useEffect(() => {
    if (configuredDepartments.length > 0 && !activePopupTab) {
      setActivePopupTab(configuredDepartments[0].name);
    }
  }, [configuredDepartments]);

  // Dynamic Employees list loaded directly from the database registry
  const employees = state.hr_employees_list || [];
  const setEmployees = (updater) => {
    const nextList = typeof updater === 'function' ? updater(employees) : updater;
    setCollection('hr_employees_list', nextList);
  };

  const [onboardingList, setOnboardingList] = useState([]);
  useEffect(() => {
    try {
      const saved = loadOnboardingHistory();
      if (saved.length > 0) {
        setOnboardingList(saved.filter(item => item.status === 'Submitted').slice(0, 3));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Dynamic loader skeleton trigger
  const handleDateChange = (dateVal) => {
    setIsLoading(true);
    setSelectedDate(dateVal);
    setTimeout(() => {
      setIsLoading(false);
    }, 450); // Premium visual transition shimmers delay
  };

  // Close menus on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowTimeframeMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Biometric Camera trigger cleaning
  useEffect(() => {
    if (!isAddModalOpen) {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
      setIsCameraActive(false);
    }
  }, [isAddModalOpen]);

  // ==========================================
  // METRICS & DATABASE ENGINE
  // ==========================================

  
  // Distinct Departments & Divisions for Dashboard Filtering
  const departmentsList = React.useMemo(() => {
    const set = new Set();
    employees.forEach(emp => {
      if (emp.department) set.add(emp.department);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [employees]);

  const divisionsList = React.useMemo(() => {
    const set = new Set();
    employees.forEach(emp => {
      const div = emp.division || emp.section || 'AJ Synthetic';
      if (div && (departmentFilter === 'ALL' || !departmentFilter || emp.department === departmentFilter)) {
        set.add(div);
      }
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [employees, departmentFilter]);

  // 1. Get active workforce on selectedDate
  const activeEmployees = employees.filter(emp => {
    const matchesDept = departmentFilter === 'ALL' || !departmentFilter || emp.department === departmentFilter;
    const matchesDiv = divisionFilter === 'ALL' || !divisionFilter || ((emp.division || emp.section || 'AJ Synthetic') === divisionFilter);
    if (!matchesDept || !matchesDiv) return false;
    if (!emp.joiningDate) return true;
    return emp.joiningDate <= selectedDate;
  });

  const totalWorkforce = activeEmployees.length;

  // Get pending onboarding list (> 7 days joined)
  const pendingOnboardingEmployees = employees.filter(emp => {
    const historyList = loadOnboardingHistory();
    const isCompleted = historyList.some(item => (item.id === emp.id || item.fullName === emp.name) && item.status === 'Submitted');
    if (isCompleted) return false;

    // Gate-added employees (Omer, 2026-10-26): pending is decided by
    // the probation rule — 7 days over AND he kept coming (attendance-
    // based, utils/probation.js) — not by the joined-date alone.
    if (isProbationEmployee(emp)) return isOnboardingPending(emp);

    // Check if joined > 7 days ago
    const joinDateStr = emp.joiningDate || emp.startDate || '2023-10-20';
    const joinDate = new Date(joinDateStr);
    const today = new Date();
    const diffTime = Math.abs(today - joinDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 7;
  });

  // 2. Get weekday name for looking up attendance
  const getWeekdayName = (dateStr) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const d = new Date(dateStr);
    return days[d.getDay()];
  };

  const currentWeekday = getWeekdayName(selectedDate);

  // 3. Separate employees into categories for selectedDate
  const getEmployeeStatusOnDate = (emp, dateStr) => {
    const day = getWeekdayName(dateStr);
    
    // Check if there is an explicit record for dateStr
    const rec = emp.attendance?.[dateStr];
    if (rec && (rec.status === 'present' || rec.status === 'absent' || rec.status === 'leave' || rec.status === 'holiday' || rec.status === 'off day')) {
      return rec.status;
    }
    
    // Check weekday record
    const dayRec = emp.attendance?.[day];
    if (dayRec && dayRec.explicitStatus) {
      return dayRec.status;
    }
    
    return 'absent';
  };

  const presentList = activeEmployees.filter(emp => {
    const status = getEmployeeStatusOnDate(emp, selectedDate);
    return status === 'present' || status === 'late';
  });

  const absentList = activeEmployees.filter(emp => {
    const status = getEmployeeStatusOnDate(emp, selectedDate);
    return status === 'absent';
  });

  const leaveList = activeEmployees.filter(emp => {
    const status = getEmployeeStatusOnDate(emp, selectedDate);
    return status === 'leave' || status === 'on leave' || status === 'halfday';
  });

  // Calculate dynamic Workforce Trend "vs last month"
  const getWorkforceTrend = () => {
    const current = new Date(selectedDate);
    const prev = new Date(current);
    prev.setDate(prev.getDate() - 30);
    const prevDateStr = prev.toISOString().split('T')[0];

    const pastWorkforce = employees.filter(emp => {
      if (!emp.joiningDate) return true;
      return emp.joiningDate <= prevDateStr;
    }).length;

    const diff = totalWorkforce - pastWorkforce;
    return diff >= 0 ? `+${diff}` : `${diff}`;
  };

  const workforceTrend = getWorkforceTrend();

  // Helper matching to check if employee belongs to configured settings departments strictly
  const isEmpInConfiguredDept = (e, deptName) => {
if (!e || !e.department || !deptName) return false;
    return (e.department || '').trim().toLowerCase() === (deptName || '').trim().toLowerCase();
  };

  const getDeptSpreadData = () => {
    return configuredDepartments.map((dept, idx) => {
      const count = activeEmployees.filter(e => isEmpInConfiguredDept(e, dept.name)).length;
      const percent = totalWorkforce > 0 ? Math.round((count / totalWorkforce) * 100) : 0;
      
      const colors = ['bg-primary', 'bg-primary-container', 'bg-secondary', 'bg-secondary-container', 'bg-surface-tint', 'bg-tertiary', 'bg-tertiary-container'];
      const colorClass = colors[idx % colors.length];

      return {
        name: dept.name,
        count,
        percent,
        colorClass
      };
    });
  };

  // ==========================================
  // CHART DATA GENERATORS
  // ==========================================
  const getCurrentMonthYearLabel = () => {
    const d = new Date(selectedDate);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getChartData = () => {
    if (timeframe === 'Today') {
      return configuredDepartments.map(dept => {
        const activeInDept = activeEmployees.filter(e => isEmpInConfiguredDept(e, dept.name));
        const presentInDept = activeInDept.filter(e => {
          const status = getEmployeeStatusOnDate(e, selectedDate);
          return status === 'present' || status === 'late';
        });
        
        const percent = activeInDept.length > 0 ? Math.round((presentInDept.length / activeInDept.length) * 100) : 0;
        return {
          label: dept.name,
          val: presentInDept.length,
          subVal: activeInDept.length - presentInDept.length,
          percent: percent,
          labelShort: dept.name.length > 12 ? dept.name.substring(0, 12) + '..' : dept.name
        };
      });
    } else if (timeframe === 'This Week') {
      const current = new Date(selectedDate);
      const day = current.getDay();
      const diffToMonday = current.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(current.setDate(diffToMonday));
      const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      
      return daysOfWeek.map((dayName, idx) => {
        const tempDate = new Date(monday);
        tempDate.setDate(monday.getDate() + idx);
        const dateStr = tempDate.toISOString().split('T')[0];
        
        const activeOnDay = employees.filter(e => (!e.joiningDate || e.joiningDate <= dateStr) && (e.status || 'Active').toLowerCase() === 'active');
        const presentOnDay = activeOnDay.filter(e => {
          const status = getEmployeeStatusOnDate(e, dateStr);
          return status === 'present' || status === 'late';
        });
        const leaveOnDay = activeOnDay.filter(e => {
          const status = getEmployeeStatusOnDate(e, dateStr);
          return status === 'leave' || status === 'on leave' || status === 'halfday';
        });
        
        const percent = activeOnDay.length > 0 ? Math.round((presentOnDay.length / activeOnDay.length) * 100) : 0;
        return {
          label: dayName,
          val: presentOnDay.length,
          subVal: leaveOnDay.length,
          percent: percent,
          labelShort: dayName
        };
      });
    } else {
      // timeframe === 'This Month' Week-by-Week Aggregate
      const year = new Date(selectedDate).getFullYear();
      const month = new Date(selectedDate).getMonth();
      const weeks = [];
      
      for (let w = 0; w < 4; w++) {
        const startDay = w * 7 + 1;
        const endDay = w === 3 ? new Date(year, month + 1, 0).getDate() : (w + 1) * 7;
        
        let totalPresent = 0;
        let totalLeave = 0;
        let totalActive = 0;
        let countDays = 0;
        
        for (let d = startDay; d <= endDay; d++) {
          const tempDate = new Date(year, month, d);
          if (tempDate.getDay() === 0 || tempDate.getDay() === 6) continue;
          
          const dateStr = tempDate.toISOString().split('T')[0];
          const activeOnDay = employees.filter(e => (!e.joiningDate || e.joiningDate <= dateStr) && (e.status || 'Active').toLowerCase() === 'active');
          const presentOnDay = activeOnDay.filter(e => {
            const status = getEmployeeStatusOnDate(e, dateStr);
            return status === 'present' || status === 'late';
          });
          const leaveOnDay = activeOnDay.filter(e => {
            const status = getEmployeeStatusOnDate(e, dateStr);
            return status === 'leave' || status === 'on leave' || status === 'halfday';
          });
          
          totalPresent += presentOnDay.length;
          totalLeave += leaveOnDay.length;
          totalActive += activeOnDay.length;
          countDays++;
        }
        
        const avgPresent = countDays > 0 ? Math.round(totalPresent / countDays) : 0;
        const avgLeave = countDays > 0 ? Math.round(totalLeave / countDays) : 0;
        const avgActive = countDays > 0 ? Math.round(totalActive / countDays) : 0;
        const percent = avgActive > 0 ? Math.round((avgPresent / avgActive) * 100) : 0;
        
        weeks.push({
          label: `Week ${w + 1}`,
          val: avgPresent,
          subVal: avgLeave,
          percent: percent,
          labelShort: `Wk ${w + 1}`
        });
      }
      return weeks;
    }
  };

  // Granular monthly daily sparkline chart generator
  const getDaysInMonthData = () => {
    const date = new Date(selectedDate);
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const daysData = [];
    for (let d = 1; d <= totalDays; d++) {
      const tempDate = new Date(year, month, d);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      
      const activeOnDay = employees.filter(e => (!e.joiningDate || e.joiningDate <= dateStr) && (e.status || 'Active').toLowerCase() === 'active');
      const presentOnDay = activeOnDay.filter(e => {
        const status = getEmployeeStatusOnDate(e, dateStr);
        return status === 'present' || status === 'late';
      });
      const leaveOnDay = activeOnDay.filter(e => {
        const status = getEmployeeStatusOnDate(e, dateStr);
        return status === 'leave' || status === 'on leave' || status === 'halfday';
      });
      
      const percent = activeOnDay.length > 0 ? Math.round((presentOnDay.length / activeOnDay.length) * 100) : 0;
      
      daysData.push({
        label: `${d}`,
        val: presentOnDay.length,
        subVal: leaveOnDay.length,
        percent: percent,
        labelShort: `${d}`
      });
    }
    return daysData;
  };

  // SVG dynamic trend line path generator for Attendance Trend (Actual)
  const getAttendanceTrendPath = (data) => {
    if (data.length < 2) return '';
    const points = data.map((item, idx) => {
      const x = data.length > 1 ? (idx / (data.length - 1)) * 100 : 50;
      const y = 100 - item.percent;
      return { x, y };
    });
    
    // Create a smooth cubic bezier path
    let path = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const cpX1 = curr.x + (next.x - curr.x) / 3;
      const cpY1 = curr.y;
      const cpX2 = curr.x + 2 * (next.x - curr.x) / 3;
      const cpY2 = next.y;
      path += ` C ${cpX1.toFixed(2)},${cpY1.toFixed(2)} ${cpX2.toFixed(2)},${cpY2.toFixed(2)} ${next.x.toFixed(2)},${next.y.toFixed(2)}`;
    }
    return path;
  };

  // SVG dynamic trend line path generator for Reference Target Trend (85%)
  const getTargetTrendPath = (data) => {
    if (data.length < 2) return '';
    const points = data.map((item, idx) => {
      const x = data.length > 1 ? (idx / (data.length - 1)) * 100 : 50;
      const y = 100 - 85; // Reference level at 85%
      return { x, y };
    });
    return `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)} L ${points[points.length - 1].x.toFixed(2)},${points[points.length - 1].y.toFixed(2)}`;
  };

  // ==========================================
  // QUICK ADD NEW EMPLOYEE HANDLERS
  // ==========================================
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
      alert("Could not access camera. Please check camera permissions in your browser.");
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

    const generateId = () => {
      const list = employees;
      const nums = list.map(emp => {
        const parts = emp.id?.split('-');
        if (parts && parts.length === 2 && !isNaN(parseInt(parts[1]))) {
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

    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const defaultAttendance = {};
    weekdays.forEach(day => {
      defaultAttendance[day] = { status: 'present', ot: 0, fines: 0, deductions: 0 };
    });

    const defaultDept = configuredDepartments.length > 0 ? configuredDepartments[0].name : 'Operations';

    const newEmpObject = {
      id: newId,
      name: newEmpForm.name,
      phone: newEmpForm.phone,
      paidInternship: newEmpForm.paidInternship,
      avatar: newEmpForm.avatar || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDG__0P4T6hror-vCHiRpSqP6WHrzFlsfyPfV-h0xSlwPUrzKRj94fEqTfct9f2OsJTwNjSJU_dxCItXniNMgE02yWPAWAv7BtSgMKQwM0k6ltYRhP-sX-YkJFmKyXrf9lMkkuCK0e1o-skZszMgFNtrHkD7EDsnfBv0fyeL2Xc7YGBYvBvFtK0T9kNSJvJ3grwZi340chVZmaVyh6qMqB5H4I_161XW4o83aSCth4U4Gm07mQ-wKk3-Te6wxhPblisYK9LU98RyyWi',
      attendance: defaultAttendance,
      joiningDate: selectedDate,
      gender: 'Male',
      status: 'Active',
      designation: 'Associate',
      department: defaultDept
    };

    const updated = [newEmpObject, ...employees];
    setEmployees(updated);

    setIsAddModalOpen(false);
    setNewEmpForm({
      name: '',
      phone: '',
      avatar: null,
      paidInternship: false
    });
    setModalError('');
    alert(`Employee ${newEmpForm.name} registered successfully!`);
  };

  const handleLeaveRequestAction = (id, name, action) => {
    setApprovedRequests(prev => ({ ...prev, [id]: action }));
    alert(`Leave Request for ${name} has been ${action === 'approved' ? 'approved successfully' : 'rejected'}.`);
  };

  if (isMobile) {
    return renderMobileView();
  }

  return renderDesktopView();

  // ==========================================
  // MOBILE PREVIEW VIEWPORT
  // ==========================================
  function renderMobileView() {
    const attendancePercent = totalWorkforce > 0 ? Math.round((presentList.length / totalWorkforce) * 100) : 0;
    
    return (
      <div className="flex flex-col gap-6 animate-fade-in pb-12 select-none">
        {/* Welcome Header */}
        <header className="flex flex-col gap-1.5 px-2">
          <div className="flex justify-between items-center">
            <div className="relative flex items-center bg-surface-container-low border border-outline-variant/10 rounded-xl px-2.5 py-1.5 font-body text-[10px] font-bold text-on-surface transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-[14px] text-primary mr-1">calendar_today</span>
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-transparent text-on-surface outline-none cursor-pointer font-bold text-[10px] border-none focus:ring-0 w-24 uppercase"
              />
            </div>
            <p className="font-body text-[10px] text-on-surface-variant font-bold uppercase tracking-wider text-primary">Live Dashboard</p>
          </div>
          <h1 className="font-headline text-2xl font-black text-on-surface tracking-tight leading-tight mt-2">Morning, Sarah</h1>
          <p className="font-body text-xs text-on-surface-variant leading-relaxed">
            Review live attendance metrics, department spreads, and register personnel in real-time.
          </p>
        </header>

        {/* KPI Cards (Asymmetric Bento Style) */}
        <section className="grid grid-cols-2 gap-4">
          {/* Primary KPI - Total Workforce */}
          <div 
            onClick={() => setDrillDownMetric('Workforce')}
            className="col-span-2 bg-primary rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px] shadow-lg cursor-pointer active:scale-95 transition-all"
          >
            <div className="absolute -right-6 -top-6 opacity-20 pointer-events-none select-none">
              <span className="material-symbols-outlined text-[100px] text-white">groups</span>
            </div>
            <div className="relative z-10 flex items-center gap-2 text-primary-fixed-dim">
              <span className="material-symbols-outlined text-[18px]">groups</span>
              <span className="font-body font-semibold text-xs tracking-wider">Total Workforce</span>
            </div>
            <div className="relative z-10 mt-2">
              {isLoading ? (
                <div className="h-9 w-24 bg-white/20 rounded animate-pulse"></div>
              ) : (
                <div className="font-headline text-3xl font-black text-white">{totalWorkforce}</div>
              )}
              <div className="flex items-center gap-1 mt-0.5 text-blue-200 font-body text-[10px]">
                <span className="material-symbols-outlined text-[12px]">{Number(workforceTrend) >= 0 ? 'trending_up' : 'trending_down'}</span>
                <span>{workforceTrend} vs last month</span>
              </div>
            </div>
          </div>

          {/* Secondary KPI 1 - Present Today */}
          <div 
            onClick={() => setDrillDownMetric('Present')}
            className="bg-surface-container-low rounded-2xl p-4 flex flex-col justify-between border border-outline-variant/15 min-h-[130px] cursor-pointer active:scale-95 transition-all"
          >
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="font-body font-semibold text-xs text-on-surface-variant">Present</span>
              <span className="material-symbols-outlined text-[18px] text-emerald-500 animate-pulse">check_circle</span>
            </div>
            <div className="mt-2">
              {isLoading ? (
                <div className="h-6 w-12 bg-outline-variant/20 rounded animate-pulse"></div>
              ) : (
                <div className="font-headline text-xl font-black text-on-surface">{presentList.length}</div>
              )}
              <div className="text-primary font-body text-[10px] mt-0.5 font-bold">{attendancePercent}% Rate</div>
            </div>
          </div>

          {/* Secondary KPI 2 - On Leave */}
          <div 
            onClick={() => setDrillDownMetric('Leave')}
            className="bg-surface-container-lowest rounded-2xl p-4 flex flex-col justify-between border border-outline-variant/15 min-h-[130px] cursor-pointer active:scale-95 transition-all"
          >
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="font-body font-semibold text-xs text-on-surface-variant">On Leave</span>
              <span className="material-symbols-outlined text-[18px] text-primary">flight_takeoff</span>
            </div>
            <div className="mt-2">
              {isLoading ? (
                <div className="h-6 w-12 bg-outline-variant/20 rounded animate-pulse"></div>
              ) : (
                <div className="font-headline text-xl font-black text-on-surface">{leaveList.length}</div>
              )}
              <div className="text-secondary font-body text-[10px] mt-0.5 font-bold">{absentList.length} Absent</div>
            </div>
          </div>
        </section>

        {/* Attendance Pulse */}
        <section className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant/15 flex flex-col gap-4">
          <header className="flex justify-between items-end">
            <div>
              <h2 className="font-headline font-bold text-sm text-on-surface">Daily Attendance</h2>
              <p className="font-body text-[10px] text-on-surface-variant mt-0.5">Real-time presence tracking</p>
            </div>
            {isLoading ? (
              <div className="h-6 w-10 bg-outline-variant/20 rounded animate-pulse"></div>
            ) : (
              <div className="font-headline font-black text-primary text-lg">{attendancePercent}%</div>
            )}
          </header>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px] font-body text-on-surface-variant">
              <span>{presentList.length} Present</span>
              <span>{absentList.length} Absent</span>
            </div>
            <div className="w-full bg-primary-fixed/20 h-1.5 rounded-full overflow-hidden relative">
              <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${attendancePercent}%` }}></div>
            </div>
          </div>
        </section>

        {/* Dynamic Settings Mapped Department Headcounts Spread */}
        <section className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/15 flex flex-col gap-4">
          <header>
            <h2 className="font-headline font-bold text-sm text-on-surface">Department Headcounts</h2>
            <p className="font-body text-[10px] text-on-surface-variant mt-0.5">Settings Configured Departments Spread</p>
          </header>
          <div className="flex flex-col gap-3">
            {configuredDepartments.length === 0 ? (
              <div className="text-center py-6 text-on-surface-variant text-xs">No active departments configured.</div>
            ) : (
              getDeptSpreadData().map(dept => (
                <div key={dept.name} className="flex flex-col">
                  <div className="flex justify-between text-[10px] font-body font-bold text-on-surface-variant mb-1">
                    <span>{dept.name}</span>
                    <span>{dept.percent}% ({dept.count})</span>
                  </div>
                  <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                    <div className={`${dept.colorClass} h-full rounded-full`} style={{ width: `${dept.percent}%` }}></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Modals & input renderers */}
        {drillDownMetric && renderDrillDownModal()}
        {isAddModalOpen && renderAddEmployeeModal()}
      </div>
    );
  }

  // ==========================================
  // DESKTOP VIEWPORT
  // ==========================================
  function renderDesktopView() {
    const attendancePercent = totalWorkforce > 0 ? Math.round((presentList.length / totalWorkforce) * 100) : 0;
    
    return (
      <div className="flex flex-col gap-8 animate-fade-in select-none">
        {/* Page Header */}
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="font-body text-xs text-on-surface-variant mb-1 uppercase tracking-widest font-bold">Overview</p>
            <h1 className="font-headline text-4xl font-black text-on-surface tracking-tight leading-none">Today's Pulse</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Khobsurat Division Filter Dropdown */}
            <div className="relative flex items-center bg-surface-container-low border border-outline-variant/15 hover:border-primary/40 rounded-xl px-3.5 py-2 font-body text-xs font-bold text-on-surface transition-all shadow-sm group">
              <span className="material-symbols-outlined text-[18px] text-primary mr-2 group-hover:scale-110 transition-transform">apartment</span>
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="bg-transparent text-on-surface outline-none cursor-pointer font-bold text-xs border-none focus:ring-0 pr-6 appearance-none"
                title="Filter Workforce & Pulse by Division"
              >
                {divisionsList.map(div => (
                  <option key={div} value={div} className="bg-surface-container-lowest text-on-surface">
                    {div === 'ALL' ? '🏬 All Divisions' : div}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined text-[16px] text-outline-variant absolute right-2.5 pointer-events-none">arrow_drop_down</span>
            </div>

            {/* Date Picker */}
            <div className="relative flex items-center bg-surface-container-low border border-outline-variant/10 rounded-xl px-3.5 py-2.5 font-body text-xs font-bold text-on-surface hover:bg-surface-container transition-colors cursor-pointer group shadow-sm">
              <span className="material-symbols-outlined text-[16px] text-primary mr-2">calendar_today</span>
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-transparent text-on-surface outline-none cursor-pointer font-bold text-xs border-none focus:ring-0 w-28 uppercase"
              />
            </div>
          </div>
        </div>

        {/* KPIs Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {/* Total Employees (Hero Card) */}
          <div 
            onClick={() => setDrillDownMetric('Workforce')}
            className="lg:col-span-2 bg-surface-container-lowest hover:bg-surface-container-low/40 rounded-2xl p-6 shadow-sm border border-outline-variant/10 relative overflow-hidden flex flex-col justify-between h-40 cursor-pointer active:scale-[0.99] transition-all"
          >
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none"></div>
            <div>
              <div className="flex justify-between items-start">
                <p className="font-body text-sm font-semibold text-on-surface-variant">Total Workforce</p>
                <span className="material-symbols-outlined text-primary bg-primary-fixed/20 p-2 rounded-xl">groups</span>
              </div>
              {isLoading ? (
                <span className="inline-block h-8 w-16 bg-outline-variant/20 rounded animate-pulse mt-2"></span>
              ) : (
                <h2 className="font-headline text-4xl font-black text-on-surface mt-2 leading-none">{totalWorkforce}</h2>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-body mt-4">
              <span className={`font-bold flex items-center gap-0.5 ${Number(workforceTrend) >= 0 ? 'text-primary' : 'text-error'}`}>
                <span className="material-symbols-outlined text-[14px]">
                  {Number(workforceTrend) >= 0 ? 'trending_up' : 'trending_down'}
                </span> 
                {workforceTrend}
              </span>
              <span className="text-outline-variant font-medium">vs last month</span>
            </div>
          </div>

          {/* Present Today */}
          <div 
            onClick={() => setDrillDownMetric('Present')}
            className="bg-surface-container-lowest hover:bg-surface-container-low/40 rounded-2xl p-6 shadow-sm border border-outline-variant/10 flex flex-col justify-between h-40 cursor-pointer active:scale-[0.99] transition-all"
          >
            <div className="flex justify-between items-start">
              <p className="font-body text-sm font-semibold text-on-surface-variant">Present Today</p>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 animate-pulse"></span>
            </div>
            <div>
              {isLoading ? (
                <span className="inline-block h-8 w-16 bg-outline-variant/20 rounded animate-pulse"></span>
              ) : (
                <h2 className="font-headline text-3xl font-black text-on-surface leading-none">{presentList.length}</h2>
              )}
              <div className="w-full bg-surface-container-high h-2 rounded-full mt-3 overflow-hidden">
                <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${attendancePercent}%` }}></div>
              </div>
              <p className="text-[11px] text-outline font-body mt-1.5 text-right font-semibold">{attendancePercent}% Attendance</p>
            </div>
          </div>

          {/* Absent & Leave Stack */}
          <div className="flex flex-col gap-4 h-40">
            <div 
              onClick={() => setDrillDownMetric('Absent')}
              className="bg-surface-container-lowest hover:bg-surface-container-low/40 rounded-2xl p-4 shadow-sm border border-outline-variant/10 flex-1 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all"
            >
              <div>
                <p className="font-body text-xs font-semibold text-on-surface-variant">Absent</p>
                {isLoading ? (
                  <span className="inline-block h-4 w-8 bg-outline-variant/20 rounded animate-pulse mt-0.5"></span>
                ) : (
                  <h2 className="font-headline text-lg font-black text-on-surface mt-0.5">{absentList.length}</h2>
                )}
              </div>
              <div className="w-9 h-9 rounded-xl bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed-variant">
                <span className="material-symbols-outlined text-[18px]">person_off</span>
              </div>
            </div>
            <div 
              onClick={() => setDrillDownMetric('Leave')}
              className="bg-surface-container-lowest hover:bg-surface-container-low/40 rounded-2xl p-4 shadow-sm border border-outline-variant/10 flex-1 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all"
            >
              <div>
                <p className="font-body text-xs font-semibold text-on-surface-variant">On Leave</p>
                {isLoading ? (
                  <span className="inline-block h-4 w-8 bg-outline-variant/20 rounded animate-pulse mt-0.5"></span>
                ) : (
                  <h2 className="font-headline text-lg font-black text-on-surface mt-0.5">{leaveList.length}</h2>
                )}
              </div>
              <div className="w-9 h-9 rounded-xl bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed-variant">
                <span className="material-symbols-outlined text-[18px]">flight_takeoff</span>
              </div>
            </div>
          </div>

          {/* Pending Verifications */}
          <div 
            onClick={() => setShowPendingOnboardingModal(true)}
            className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-tertiary-fixed/30 bg-gradient-to-b from-surface-container-lowest to-tertiary-fixed/5 flex flex-col justify-between h-40 cursor-pointer hover:bg-tertiary-fixed/10 active:scale-[0.99] transition-all"
          >
            <div className="flex justify-between items-start">
              <p className="font-body text-sm font-semibold text-tertiary-container">Pending Action</p>
              <span className="material-symbols-outlined text-tertiary-container bg-tertiary-fixed/30 p-1.5 rounded-lg text-[20px]">assignment_late</span>
            </div>
            <div>
              <h2 className="font-headline text-3xl font-black text-tertiary leading-none">
                {1 + pendingOnboardingEmployees.length}
              </h2>
              <p className="text-[10px] text-on-tertiary-fixed-variant font-body mt-2 leading-relaxed">
                {pendingOnboardingEmployees.length > 0 
                  ? `${pendingOnboardingEmployees.length} pending onboarding (>7 days) + 1 approval`
                  : 'Verifications requiring approval'}
              </p>
            </div>
          </div>
        </div>

        {/* Charts & Spread Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Attendance Chart Canvas */}
          <div className="lg:col-span-2 bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/10 flex flex-col justify-between min-h-[380px]">
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-headline font-bold text-lg text-on-surface flex items-center gap-2">
                  Attendance Trend
                  <span className="text-[10px] text-primary bg-primary-fixed/20 px-2.5 py-0.5 rounded-lg font-bold font-body select-none tracking-tight">
                    {getCurrentMonthYearLabel()}
                  </span>
                </h3>
                
                <div className="flex items-center gap-3">
                  {/* Dynamic Week-by-Week vs Date-by-Date Toggle for Month View */}
                  {timeframe === 'This Month' && (
                    <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant/10 select-none">
                      <button
                        onClick={() => setMonthViewMode('weekly')}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          monthViewMode === 'weekly' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        Week-by-Week
                      </button>
                      <button
                        onClick={() => setMonthViewMode('daily')}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          monthViewMode === 'daily' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        Date-by-Date
                      </button>
                    </div>
                  )}

                  {/* Sleek Custom Filter Timeframe selector */}
                  <div className="relative" ref={dropdownRef}>
                    <button 
                      onClick={() => setShowTimeframeMenu(prev => !prev)}
                      className="px-4 py-2 bg-surface-container-low text-on-surface rounded-xl font-body text-xs font-bold hover:bg-surface-container border border-outline-variant/10 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[16px] text-primary">schedule</span>
                      <span>{timeframe}</span>
                      <span className="material-symbols-outlined text-[14px] text-outline-variant transition-transform duration-200" style={{ transform: showTimeframeMenu ? 'rotate(180deg)' : 'rotate(0)' }}>keyboard_arrow_down</span>
                    </button>
                    
                    {showTimeframeMenu && (
                      <div className="absolute right-0 mt-2 w-44 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-2 shadow-xl z-50 animate-scale-up text-on-surface select-none">
                        {['Today', 'This Week', 'This Month'].map(opt => (
                          <button
                            key={opt}
                            onClick={() => {
                              setTimeframe(opt);
                              setShowTimeframeMenu(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold hover:bg-surface-container-low transition-all cursor-pointer ${
                              timeframe === opt ? 'text-primary' : 'text-on-surface-variant'
                            }`}
                          >
                            <span>{opt}</span>
                            {timeframe === opt && <span className="material-symbols-outlined text-[16px]">check</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Weekly/Monthly/Today Chart representation */}
              <div className="h-60 w-full relative flex items-end justify-between gap-2 pt-6 overflow-hidden">
                {/* Y-Axis Labels */}
                <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] text-outline-variant font-body pb-6 font-semibold select-none z-20">
                  <span>{totalWorkforce > 0 ? totalWorkforce : 100}</span>
                  <span>{Math.round(totalWorkforce * 0.75)}</span>
                  <span>{Math.round(totalWorkforce * 0.5)}</span>
                  <span>{Math.round(totalWorkforce * 0.25)}</span>
                  <span>0</span>
                </div>
                
                {/* Grid Lines */}
                <div className="absolute left-8 right-0 top-0 h-full flex flex-col justify-between pb-6 z-0 select-none pointer-events-none">
                  <div className="w-full border-t border-outline-variant/15"></div>
                  <div className="w-full border-t border-outline-variant/15"></div>
                  <div className="w-full border-t border-outline-variant/15"></div>
                  <div className="w-full border-t border-outline-variant/15"></div>
                  <div className="w-full border-t border-outline-variant/30"></div>
                </div>

                {/* Unified Scrollable Wrapper for Bars, X-Axis, and Dynamic SVG Trend */}
                <div className="flex-1 ml-8 h-full relative z-10 select-none">
                  {(() => {
                    const chartDataset = timeframe === 'This Month' && monthViewMode === 'daily' ? getDaysInMonthData() : getChartData();
                    return (
                      <div className="w-full h-full relative flex flex-col justify-between overflow-visible">
                        
                        {/* SVG Trend Lines as responsive absolute overlay */}
                        <div className="absolute inset-x-0 top-0 bottom-6 pointer-events-none z-20 overflow-visible">
                          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                            <defs>
                              <filter id="emerald-glow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="1.5" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                              </filter>
                            </defs>
                            
                            {/* 1. Target Trend Line (Brown/Amber dashed) */}
                            <path 
                              d={getTargetTrendPath(chartDataset)} 
                              fill="none" 
                              stroke="#b45309" 
                              strokeDasharray="4 4"
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth="1.6"
                              className="opacity-70"
                            ></path>

                            {/* 2. Attendance Trend Line (Smooth emerald-500 curve with glowing reflection) */}
                            <path 
                              d={getAttendanceTrendPath(chartDataset)} 
                              fill="none" 
                              stroke="#10b981" 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth="2.6"
                              filter="url(#emerald-glow)"
                              className="transition-all duration-300 ease-out"
                            ></path>
                          </svg>
                        </div>

                        {/* Interactive Invisible Hover Columns & Active Bar Container */}
                        <div 
                          className="absolute inset-x-0 top-0 bottom-6 z-30"
                          onMouseLeave={() => setHoveredDayIndex(null)}
                        >
                          {chartDataset.map((item, idx) => {
                            const isHovered = hoveredDayIndex === idx;
                            const leftPercent = chartDataset.length > 1 ? (idx / (chartDataset.length - 1)) * 100 : 50;
                            const hitboxWidth = 100 / chartDataset.length;
                            const hitboxLeft = (idx / chartDataset.length) * 100;
                            
                            return (
                              <React.Fragment key={idx}>
                                {/* Contiguous mouse trigger hitbox */}
                                <div
                                  style={{ 
                                    left: `${hitboxLeft}%`,
                                    width: `${hitboxWidth}%`
                                  }}
                                  className="absolute top-0 bottom-0 cursor-pointer z-40"
                                  onMouseEnter={() => setHoveredDayIndex(idx)}
                                ></div>

                                {/* Active Single Green Bar & Premium Tooltip */}
                                {isHovered && (
                                  <div 
                                    style={{ 
                                      left: `${leftPercent}%`,
                                      height: '100%'
                                    }}
                                    className="absolute bottom-0 w-[18px] md:w-[22px] -translate-x-1/2 flex flex-col justify-end pointer-events-none z-30 animate-fade-in"
                                  >
                                    {/* Glass reflection track */}
                                    <div className="absolute inset-0 bg-emerald-500/5 rounded-t-xl border-x border-emerald-500/10"></div>

                                    {/* Solid Green Fill representing the actual attendance rate */}
                                    <div 
                                      style={{ height: `${item.percent}%` }}
                                      className="w-full bg-emerald-500 rounded-t-xl transition-all duration-300 ease-out shadow-[0_0_15px_rgba(16,185,129,0.4)] relative"
                                    >
                                      {/* Top shiny highlight strip */}
                                      <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-300 rounded-t-xl opacity-80"></div>
                                    </div>

                                    {/* Premium Glassmorphic Tooltip */}
                                    <div className="absolute bottom-[calc(100%+14px)] left-1/2 -translate-x-1/2 bg-slate-950/95 text-slate-100 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/15 shadow-2xl text-[10px] whitespace-nowrap font-body font-bold flex flex-col items-center gap-1 z-[150] animate-scale-up">
                                      <div className="text-[11px] text-white flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[12px] text-emerald-400">calendar_today</span>
                                        <span>
                                          {timeframe === 'This Month' && monthViewMode === 'daily' 
                                            ? `Day ${item.label}` 
                                            : item.label}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-slate-300">
                                        Present: <span className="text-emerald-400">{item.val}</span> | Leave/Absent: <span className="text-sky-300">{item.subVal}</span>
                                      </div>
                                      <div className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md font-black mt-0.5 border border-emerald-500/20">
                                        {item.percent}% Attendance
                                      </div>
                                      {/* Tooltip Arrow */}
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-950/95"></div>
                                    </div>
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>

                        {/* X-Axis Labels aligned underneath */}
                        <div className="absolute bottom-0 left-0 right-0 h-6 relative overflow-visible">
                          {chartDataset.map((item, idx) => {
                            const leftPercent = chartDataset.length > 1 ? (idx / (chartDataset.length - 1)) * 100 : 50;
                            const isToday = 
                              timeframe === 'Today' || 
                              (timeframe === 'This Week' && item.labelShort === getWeekdayName(selectedDate)) ||
                              (timeframe === 'This Month' && monthViewMode === 'daily' && item.labelShort === String(new Date(selectedDate).getDate()));
                              
                            return (
                              <span 
                                key={idx} 
                                style={{ 
                                  left: `${leftPercent}%`,
                                }}
                                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-[9px] font-body font-semibold select-none whitespace-nowrap transition-all duration-200 ${
                                  isToday ? "font-black text-primary text-[10px] scale-110" : "text-on-surface-variant/80"
                                }`}
                              >
                                {item.labelShort}
                              </span>
                            );
                          })}
                        </div>

                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-6 mt-4 text-xs font-body font-semibold text-on-surface-variant select-none border-t border-outline-variant/10 pt-4">
              <div className="flex items-center gap-2"><span className="w-4 h-1 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.3)]"></span> Attendance Trend</div>
              <div className="flex items-center gap-2"><span className="w-4 h-1 rounded-full bg-amber-700 border-t border-dashed"></span> Target Trend (85%)</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-md bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]"></span> Active Day (Hover)</div>
            </div>
          </div>

          {/* Dynamic Settings Configured Department Headcounts Spread */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/10 flex flex-col justify-between min-h-[380px]">
            <h3 className="font-headline font-bold text-lg text-on-surface mb-6">Department Headcounts</h3>
            <div className="flex-1 flex flex-col justify-around gap-4">
              {configuredDepartments.length === 0 ? (
                <div className="text-center py-16 text-on-surface-variant text-xs">No active departments configured.</div>
              ) : (
                getDeptSpreadData().map(dept => (
                  <div key={dept.name}>
                    <div className="flex justify-between text-xs font-body font-semibold mb-1.5">
                      <span className="text-on-surface">{dept.name}</span>
                      <span className="text-on-surface-variant font-bold">{dept.percent}% ({dept.count})</span>
                    </div>
                    <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                      <div className={`${dept.colorClass} h-full rounded-full transition-all duration-500`} style={{ width: `${dept.percent}%` }}></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Live Activity Feed */}
          <div className="lg:col-span-2 bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline font-bold text-lg text-on-surface">Live Activity</h3>
              <button className="text-xs font-body font-bold text-primary hover:text-primary-container transition-colors">View All</button>
            </div>
            <div className="space-y-6">
              {onboardingList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                  <span className="material-symbols-outlined text-outline/35 text-4xl animate-pulse">feed</span>
                  <p className="text-xs text-on-surface-variant font-medium">No recent employee activities logged yet.</p>
                </div>
              ) : (
                onboardingList.map((onb, idx) => (
                  <div key={onb.id || idx} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary-fixed flex-shrink-0 flex items-center justify-center text-on-primary-fixed border border-primary-fixed-dim/30">
                      <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
                    </div>
                    <div className="flex-1 pb-6 border-b border-outline-variant/10 last:border-0 last:pb-0">
                      <div className="flex justify-between items-start">
                        <p className="font-body text-sm text-on-surface">
                          <span className="font-black">New Onboarding</span> completed for <span className="font-semibold text-primary">{onb.fullName}</span>
                        </p>
                        <span className="text-xs text-outline-variant font-body font-semibold">Joined: {onb.joiningDate}</span>
                      </div>
                      <p className="text-xs text-on-surface-variant font-body mt-1 leading-relaxed">
                        {onb.formData?.department || 'Production'} • {onb.formData?.designation || 'Worker'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Tasks */}
          <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 flex flex-col justify-between">
            <div>
              <h3 className="font-headline font-bold text-lg text-on-surface mb-5">Quick Tasks</h3>
              <div className="space-y-3">
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/15 hover:border-primary/40 hover:shadow-sm transition-all group active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">person_add</span>
                    <span className="font-body text-sm font-bold text-on-surface">Add Employee</span>
                  </div>
                  <span className="material-symbols-outlined text-outline-variant group-hover:text-primary transition-colors">chevron_right</span>
                </button>
                <button 
                  onClick={() => alert("Quick Action: Post Announcement triggered.")}
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/15 hover:border-primary/40 hover:shadow-sm transition-all group active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">campaign</span>
                    <span className="font-body text-sm font-bold text-on-surface">Post Announcement</span>
                  </div>
                  <span className="material-symbols-outlined text-outline-variant group-hover:text-primary transition-colors">chevron_right</span>
                </button>
                <button 
                  onClick={() => alert("Quick Action: Process Payroll triggered.")}
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/15 hover:border-primary/40 hover:shadow-sm transition-all group active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">receipt_long</span>
                    <span className="font-body text-sm font-bold text-on-surface">Process Payroll</span>
                  </div>
                  <span className="material-symbols-outlined text-outline-variant group-hover:text-primary transition-colors">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Ambient Illustrator banner */}
            <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-secondary-container/50 to-primary-container/20 border border-primary-fixed-dim/30 relative overflow-hidden select-none">
              <div className="absolute -right-6 -bottom-6 w-16 h-16 bg-primary/10 rounded-full blur-xl"></div>
              <p className="font-body text-xs text-on-secondary-container text-center font-bold relative z-10 leading-relaxed">
                System is running optimally.<br/>{employees.length} employee records synced.
              </p>
            </div>
          </div>
        </div>

        {/* Modals & input renderers */}
        {drillDownMetric && renderDrillDownModal()}
        {isAddModalOpen && renderAddEmployeeModal()}
        {showPendingOnboardingModal && renderPendingOnboardingModal()}
      </div>
    );
  }

  // ==========================================
  // PENDING ONBOARDING ACTIONS MODAL COMPONENT
  // ==========================================
  function renderPendingOnboardingModal() {
    if (!showPendingOnboardingModal) return null;
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-inverse-surface/40 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-lg bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-2xl p-6 flex flex-col gap-5 animate-in zoom-in-95 duration-200 text-on-surface">
          
          <div className="flex items-center justify-between border-b border-outline-variant/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary text-2xl">pending_actions</span>
              <h3 className="font-headline text-lg font-black tracking-tight text-on-surface">Pending Actions (Onboarding Required)</h3>
            </div>
            <button 
              onClick={() => setShowPendingOnboardingModal(false)}
              className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-slate-400 hover:text-on-surface cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-3 custom-scrollbar pr-1">
            {pendingOnboardingEmployees.length === 0 ? (
              <div className="text-center py-6 text-xs text-on-surface-variant font-medium">
                No employees with pending onboarding (&gt; 7 days).
              </div>
            ) : (
              pendingOnboardingEmployees.map(emp => (
                <div key={emp.id} className="flex items-center justify-between p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/10">
                  <div className="flex items-center gap-3">
                    <img className="w-10 h-10 rounded-full object-cover border border-outline-variant/10 shadow-sm" src={emp.avatar} alt={emp.name} />
                    <div>
                      <h4 className="font-headline font-bold text-xs text-on-surface leading-tight">{emp.name}</h4>
                      <p className="text-[9px] font-bold text-primary leading-none mt-0.5">{emp.id} • {emp.designation || emp.role || 'Worker'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Joined Date</span>
                    <span className="text-[10px] font-mono text-tertiary font-bold">{emp.joiningDate || emp.startDate || '2023-10-20'}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-outline-variant/10">
            <button 
              onClick={() => setShowPendingOnboardingModal(false)}
              className="px-5 py-2.5 bg-primary text-on-primary text-xs font-black rounded-xl shadow transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // DRILL-DOWN POPUP MODAL COMPONENT
  // ==========================================
  function renderDrillDownModal() {
    if (!drillDownMetric) return null;

    let title = '';
    let filteredEmployees = [];

    if (drillDownMetric === 'Workforce') {
      title = 'Total Workforce Records';
      filteredEmployees = activeEmployees;
    } else if (drillDownMetric === 'Present') {
      title = 'Present Employees';
      filteredEmployees = presentList;
    } else if (drillDownMetric === 'Absent') {
      title = 'Absent Employees';
      filteredEmployees = absentList;
    } else if (drillDownMetric === 'Leave') {
      title = 'On Leave Employees';
      filteredEmployees = leaveList;
    }

    const deptEmployees = filteredEmployees.filter(e => isEmpInConfiguredDept(e, activePopupTab));

    return (
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-fade-in animate-duration-200">
        <div className="bg-surface-container-lowest rounded-3xl p-6 w-full max-w-2xl border border-outline-variant/20 shadow-2xl relative animate-scale-up text-on-surface max-h-[85vh] flex flex-col overflow-hidden select-none font-body">
          
          <header className="flex justify-between items-center mb-5 shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">
                  {drillDownMetric === 'Workforce' ? 'groups' : drillDownMetric === 'Present' ? 'check_circle' : drillDownMetric === 'Absent' ? 'person_off' : 'flight_takeoff'}
                </span>
                <h3 className="font-headline font-black text-md text-on-surface">
                  {title}
                </h3>
              </div>
              <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mt-0.5">
                Dynamic Drill-Down • Date: {selectedDate} ({currentWeekday})
              </p>
            </div>
            <button 
              onClick={() => setDrillDownMetric(null)}
              className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </header>

          {/* Settings Configured Department Tabs */}
          <div className="flex gap-2 border-b border-outline-variant/10 pb-3 mb-4 overflow-x-auto shrink-0 scrollbar-none">
            {configuredDepartments.length === 0 ? (
              <div className="text-xs text-on-surface-variant font-bold">No active departments.</div>
            ) : (
              configuredDepartments.map(dept => {
                const count = filteredEmployees.filter(e => isEmpInConfiguredDept(e, dept.name)).length;
                return (
                  <button
                    key={dept.id}
                    onClick={() => setActivePopupTab(dept.name)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all relative whitespace-nowrap cursor-pointer ${
                      activePopupTab === dept.name
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    {dept.name} ({count})
                  </button>
                );
              })
            )}
          </div>

          {/* Employees List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 pr-1">
            {deptEmployees.length === 0 ? (
              <div className="text-center py-16 text-on-surface-variant/70 text-xs font-body">
                No matching employees in <strong>{activePopupTab}</strong> for {selectedDate}.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4">
                {deptEmployees.map(emp => (
                  <div key={emp.id} className="bg-surface-container-low/60 hover:bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/10 flex items-center gap-3 transition-colors">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant/15 bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-xs shrink-0">
                      {emp.avatar ? (
                        <img src={emp.avatar} className="w-full h-full object-cover" alt="" />
                      ) : (
                        emp.name.split(' ').map(n=>n[0]).join('').substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-on-surface truncate">{emp.name}</div>
                      <div className="text-[10px] text-primary font-mono mt-0.5 font-bold">{emp.id}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-[9px] text-on-surface-variant bg-surface-container-highest/65 px-2 py-0.5 rounded-full font-bold font-body">
                        {emp.designation || 'Associate'}
                      </span>
                      {drillDownMetric !== 'Workforce' && (
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                          getEmployeeStatusOnDate(emp, selectedDate) === 'present' || getEmployeeStatusOnDate(emp, selectedDate) === 'late' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          getEmployeeStatusOnDate(emp, selectedDate) === 'absent' ? 'bg-red-50 text-red-600 border border-red-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {getEmployeeStatusOnDate(emp, selectedDate)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-outline-variant/10 mt-4 shrink-0 text-[10px] text-outline font-semibold">
            <span>Showing {deptEmployees.length} of {filteredEmployees.length} filtered entries</span>
            <span className="text-primary font-bold">Real-time sync verified</span>
          </div>

        </div>
      </div>
    );
  }

  // ==========================================
  // QUICK ADD EMPLOYEE ONBOARDING MODAL COMPONENT
  // ==========================================
  function renderAddEmployeeModal() {
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-inverse-surface/40 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-2xl p-6 flex flex-col gap-6 animate-in zoom-in-95 duration-200 text-on-surface select-none">
          
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
            
            {/* Visual Avatar Upload Preview */}
            <div className="flex flex-col gap-3 bg-surface-container-low p-3 rounded-xl border border-outline-variant/10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-surface border border-outline-variant/30 flex items-center justify-center overflow-hidden shrink-0">
                  {newEmpForm.avatar ? (
                    <img src={newEmpForm.avatar} className="w-full h-full object-cover" alt="Avatar Preview" />
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

              {/* Camera Video Stream Biometric Snap */}
              {isCameraActive && (
                <div className="flex flex-col gap-2 bg-black/95 p-2 rounded-xl border border-outline-variant/20 overflow-hidden mt-1 animate-in fade-in">
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
                      className="px-3 py-1.5 border border-white/20 text-white hover:bg-white/10 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel Camera
                    </button>
                    <button 
                      type="button" 
                      onClick={handleCaptureSnapshot}
                      className="px-3 py-1.5 bg-primary text-on-primary text-[10px] font-black rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
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
                className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all outline-none font-body font-bold"
              />
              <label className="absolute -top-2 left-3 bg-surface-container-lowest px-1 text-[10px] font-bold uppercase tracking-wider text-primary">Employee Name *</label>
            </div>

            <div className="relative group">
              <input 
                type="tel" 
                required
                value={newEmpForm.phone}
                onChange={e => { setNewEmpForm(prev => ({ ...prev, phone: e.target.value })); if(modalError) setModalError(''); }}
                placeholder="e.g. +92 300 1234567"
                className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all outline-none font-body font-bold"
              />
              <label className="absolute -top-2 left-3 bg-surface-container-lowest px-1 text-[10px] font-bold uppercase tracking-wider text-primary">Mobile Number *</label>
            </div>

            {/* Paid Internship */}
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
    );
  }
}
