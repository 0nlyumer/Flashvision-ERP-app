import { getEffectiveDutyHours } from '../../utils/hrDutyHours';
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import PayrollAccountMapping from './PayrollAccountMapping';
import SalaryAllowanceConfig from './SalaryAllowanceConfig';



export default function HRSettings({ isMobile }) {
  const { state, setCollection } = useApp();
  const employees = state?.hr_employees_list || [];
  const [designations, setDesignations] = useState(() => {
    try {
      const saved = localStorage.getItem('hr_designations_config');
      return saved ? JSON.parse(saved) : ['Associate', 'Supervisor', 'Manager', 'Senior Engineer', 'Director', 'Quality Inspector', 'Line Operator'];
    } catch (e) {
      return ['Associate', 'Supervisor', 'Manager', 'Senior Engineer', 'Director', 'Quality Inspector', 'Line Operator'];
    }
  });

  useEffect(() => {
    localStorage.setItem('hr_designations_config', JSON.stringify(designations));
  }, [designations]);

  const [newDesignation, setNewDesignation] = useState('');

  // Pre-populated departments state - dynamically loaded from localStorage
  const [departments, setDepartments] = useState(() => {
    try {
      const savedConfig = localStorage.getItem('hr_departments_config');
      return savedConfig ? JSON.parse(savedConfig) : [];
    } catch (e) {
      console.error("Error initializing departments:", e);
      return [];
    }
  });

  // Persist departments configuration to localStorage on change
  useEffect(() => {
    localStorage.setItem('hr_departments_config', JSON.stringify(departments));
  }, [departments]);

  // Safe real-time sync of departments from global state to HR settings
  useEffect(() => {
    try {
      const globalDepts = state?.departments || [];
      if (globalDepts.length === 0) return; // Ignore empty global state on initial startup load

      const savedConfig = localStorage.getItem('hr_departments_config');
      let hrDepts = savedConfig ? JSON.parse(savedConfig) : [];

      let hasChanges = false;
      
      // 1. Remove departments from hrDepts that no longer exist in globalDepts
      const initialLength = hrDepts.length;
      hrDepts = hrDepts.filter(hrD => 
        globalDepts.some(gD => gD.id === hrD.id || (gD.name || gD.label) === hrD.name)
      );
      if (hrDepts.length !== initialLength) {
        hasChanges = true;
      }

      // 2. Add or update departments from globalDepts
      globalDepts.forEach(gD => {
        const gName = gD.name || gD.label || '';
        if (!gName) return;

        const existingIdx = hrDepts.findIndex(hrD => hrD.id === gD.id || hrD.name === gName);
        if (existingIdx > -1) {
          if (hrDepts[existingIdx].name !== gName || hrDepts[existingIdx].id !== gD.id) {
            hrDepts[existingIdx].name = gName;
            hrDepts[existingIdx].id = gD.id;
            hasChanges = true;
          }
        } else {
          hrDepts.push({
            id: gD.id,
            name: gName,
            tagline: gD.tagline || 'Custom Division',
            managers: [],
            operators: [],
            incharges: [],
            sections: [],
            subSections: []
          });
          hasChanges = true;
        }
      });

      if (hasChanges) {
        localStorage.setItem('hr_departments_config', JSON.stringify(hrDepts));
        setDepartments(hrDepts);
      }
    } catch (e) {
      console.error("Error syncing global departments with HR settings:", e);
    }
  }, [state?.departments]);

  useEffect(() => {
    const handleUpdate = () => {
      try {
        const savedConfig = localStorage.getItem('hr_departments_config');
        const parsed = savedConfig ? JSON.parse(savedConfig) : [];
        setDepartments(parsed);
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener('hr_departments_config_updated', handleUpdate);
    return () => window.removeEventListener('hr_departments_config_updated', handleUpdate);
  }, []);

  // Sidebar category states
  const [activeCategory, setActiveCategory] = useState('departments'); // 'departments', 'subsections', 'permissions', 'roles', 'audit'

  // Desktop navigation view mode ('grid' or 'departments')
  const [viewMode, setViewMode] = useState('grid');

  // Deletion confirm modal state
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, deptId: null, deptName: '' });

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [settingsDeptFilter, setSettingsDeptFilter] = useState('ALL');
  const [settingsDivFilter, setSettingsDivFilter] = useState('ALL');


  
  const settingsDeptsList = React.useMemo(() => {
    const set = new Set();
    departments.forEach(d => {
      if (d.name) set.add(d.name);
    });
    employees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [departments, employees]);

  const settingsDivsList = React.useMemo(() => {
    const set = new Set();
    departments.forEach(d => {
      (d.sections || []).forEach(s => {
        if (s.name && (settingsDeptFilter === 'ALL' || d.name === settingsDeptFilter)) {
          set.add(s.name);
        }
      });
    });
    employees.forEach(e => {
      const div = e.division || e.section;
      if (div && (settingsDeptFilter === 'ALL' || e.department === settingsDeptFilter)) {
        set.add(div);
      }
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [departments, employees, settingsDeptFilter]);

  // Get active employee profiles in real-time
  const getActiveEmployees = () => {
    return state.hr_employees_list || [];
  };

  // Interactive toggle states
  const [permissions, setPermissions] = useState({
    payroll: true,
    leaves: false,
    profiles: true,
    audit: false,
    onboarding: true
  });

  // Modal states for CRUD operations
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [activeDept, setActiveDept] = useState({
    id: null,
    name: '',
    tagline: '',
    managers: [], // Array of employee IDs
    operators: [], // Array of employee IDs
    incharges: [], // Array of employee IDs
    sections: [] // Array of section objects: { id, name, incharges: [], employees: [] }
  });



  // ==========================================
  // DIVISIONS STATE & HANDLERS
  // ==========================================
  const [divisions, setDivisions] = useState(() => {
    try {
      const saved = localStorage.getItem('hr_divisions_config');
      if (saved) return JSON.parse(saved);
      return [
        { id: 1, name: 'AJ Synthetic', code: 'AJS', description: 'AJ Synthetic Core Division', head: '' },
        { id: 2, name: 'AAA', code: 'AAA', description: 'AAA Operations Wing', head: '' }
      ];
    } catch (e) {
      return [
        { id: 1, name: 'AJ Synthetic', code: 'AJS', description: 'AJ Synthetic Core Division', head: '' },
        { id: 2, name: 'AAA', code: 'AAA', description: 'AAA Operations Wing', head: '' }
      ];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('hr_divisions_config', JSON.stringify(divisions));
    } catch (e) {}
  }, [divisions]);

  const [showDivisionModal, setShowDivisionModal] = useState(false);
  const [divisionModalMode, setDivisionModalMode] = useState('add');
  const [activeDivision, setActiveDivision] = useState({
    id: null,
    name: '',
    code: '',
    description: '',
    head: ''
  });

  const handleOpenAddDivision = () => {
    setDivisionModalMode('add');
    setActiveDivision({
      id: null,
      name: '',
      code: '',
      description: '',
      head: ''
    });
    setShowDivisionModal(true);
  };

  const handleOpenEditDivision = (div) => {
    setDivisionModalMode('edit');
    setActiveDivision({
      id: div.id,
      name: div.name,
      code: div.code || '',
      description: div.description || '',
      head: div.head || ''
    });
    setShowDivisionModal(true);
  };

  const handleDeleteDivision = (id) => {
    if (confirm('Are you sure you want to delete this division?')) {
      setDivisions(prev => prev.filter(d => d.id !== id));
    }
  };

  const handleSaveDivisionSubmit = (e) => {
    if (e) e.preventDefault();
    if (!activeDivision.name) {
      alert('Division name is required.');
      return;
    }

    if (divisionModalMode === 'add') {
      const newId = divisions.length ? Math.max(...divisions.map(d => Number(d.id) || 0)) + 1 : 1;
      const newDiv = {
        id: newId,
        name: activeDivision.name.trim(),
        code: activeDivision.code ? activeDivision.code.trim().toUpperCase() : activeDivision.name.slice(0, 3).toUpperCase(),
        description: activeDivision.description.trim(),
        head: activeDivision.head || ''
      };
      setDivisions(prev => [...prev, newDiv]);
    } else {
      setDivisions(prev => prev.map(d => d.id === activeDivision.id ? {
        ...d,
        name: activeDivision.name.trim(),
        code: activeDivision.code ? activeDivision.code.trim().toUpperCase() : d.code,
        description: activeDivision.description.trim(),
        head: activeDivision.head || ''
      } : d));
    }

    setShowDivisionModal(false);
  };

  // ==========================================
  // DUTY SETTINGS & SHIFTS STATE & HANDLERS
  // ==========================================
  const [dutySubTab, setDutySubTab] = useState('global'); // 'global' | 'divisions' | 'departments' | 'employees'
  const [empDutySearch, setEmpDutySearch] = useState('');
  const [empDutyDivFilter, setEmpDutyDivFilter] = useState('ALL');
  const [empDutyDeptFilter, setEmpDutyDeptFilter] = useState('ALL');
  const [empDutyAlphaFilter, setEmpDutyAlphaFilter] = useState('ALL');
  const [batchDutyHours, setBatchDutyHours] = useState(8);

  const [dutySettings, setDutySettings] = useState(() => {
    const defaultDuty = {
      standardHours: 8,
      gracePeriodMinutes: 15,
      halfDayThresholdHours: 4,
      dutyHoursAdjustable: true,
      divisionDutyHours: {},
      departmentDutyHours: {},
      employeeDutyHours: {},
      overtimeCalculation: {
        rateMultiplier: 1.5,
        weekendMultiplier: 2.0,
        holidayMultiplier: 3.0,
        type: 'formula', // 'formula' | 'flat'
        flatHourlyRate: 200
      },
      shifts: [
        { id: 1, name: 'GENERAL SHIFT', startTime: '09:00', endTime: '17:00', hours: 8, status: 'Active' },
        { id: 2, name: 'MORNING SHIFT', startTime: '06:00', endTime: '14:00', hours: 8, status: 'Active' },
        { id: 3, name: 'EVENING SHIFT', startTime: '14:00', endTime: '22:00', hours: 8, status: 'Active' },
        { id: 4, name: 'NIGHT SHIFT', startTime: '22:00', endTime: '06:00', hours: 8, status: 'Active' }
      ]
    };
    try {
      const saved = localStorage.getItem('hr_duty_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.overtimeCalculation) {
          parsed.overtimeCalculation = defaultDuty.overtimeCalculation;
        }
        return parsed;
      }
    } catch (e) {}
    return defaultDuty;
  });

  function getEmpEffectiveDutyHours(emp) {
    return getEffectiveDutyHours(emp, dutySettings);
  }

  const saveDutySettings = (updated) => {
    setDutySettings(updated);
    try {
      localStorage.setItem('hr_duty_settings', JSON.stringify(updated));
      if (setCollection) {
        setCollection('hr_duty_settings', updated);
      }
      window.dispatchEvent(new CustomEvent('fv-duty-settings-updated', { detail: updated }));
    } catch (e) {}
  };

  const handleSetEmployeeDutyHours = (emp, hours) => {
    const empId = typeof emp === 'object' ? (emp.id || emp.employeeCode || emp.employeeId) : emp;
    const empCode = typeof emp === 'object' ? (emp.employeeCode || emp.employeeId || emp.id) : emp;
    
    const updatedEmpHours = {
      ...(dutySettings.employeeDutyHours || {}),
      [empId]: Number(hours)
    };
    if (empCode && empCode !== empId) {
      updatedEmpHours[empCode] = Number(hours);
    }
    const updatedSettings = {
      ...dutySettings,
      employeeDutyHours: updatedEmpHours
    };
    saveDutySettings(updatedSettings);

    const targetIdStr = String(empId).trim();
    const targetCodeStr = String(empCode).trim();
    const updatedList = (state?.hr_employees_list || employees || []).map(e => {
      const eId = String(e.id || '').trim();
      const eCode = String(e.employeeCode || e.employeeId || '').trim();
      if ((targetIdStr && eId === targetIdStr) || (targetCodeStr && eCode === targetCodeStr)) {
        return { ...e, dutyHours: Number(hours), dailyHours: Number(hours) };
      }
      return e;
    });

    if (setCollection) {
      setCollection('hr_employees_list', updatedList);
    }
    try {
      localStorage.setItem('hr_employees_list', JSON.stringify(updatedList));
    } catch (e) {}
  };

  const handleResetEmployeeDutyHours = (emp) => {
    const empId = typeof emp === 'object' ? (emp.id || emp.employeeCode || emp.employeeId) : emp;
    const empCode = typeof emp === 'object' ? (emp.employeeCode || emp.employeeId || emp.id) : emp;

    const updatedEmpHours = { ...(dutySettings.employeeDutyHours || {}) };
    if (empId) delete updatedEmpHours[empId];
    if (empCode) delete updatedEmpHours[empCode];

    const updatedSettings = {
      ...dutySettings,
      employeeDutyHours: updatedEmpHours
    };
    saveDutySettings(updatedSettings);

    const targetIdStr = String(empId).trim();
    const targetCodeStr = String(empCode).trim();
    const updatedList = (state?.hr_employees_list || employees || []).map(e => {
      const eId = String(e.id || '').trim();
      const eCode = String(e.employeeCode || e.employeeId || '').trim();
      if ((targetIdStr && eId === targetIdStr) || (targetCodeStr && eCode === targetCodeStr)) {
        const copy = { ...e };
        delete copy.dutyHours;
        delete copy.dailyHours;
        return copy;
      }
      return e;
    });

    if (setCollection) {
      setCollection('hr_employees_list', updatedList);
    }
    try {
      localStorage.setItem('hr_employees_list', JSON.stringify(updatedList));
    } catch (e) {}
  };

  const handleSetDivisionDutyHours = (divName, hours) => {
    const updated = {
      ...dutySettings,
      divisionDutyHours: {
        ...(dutySettings.divisionDutyHours || {}),
        [divName]: Number(hours)
      }
    };
    saveDutySettings(updated);
  };

  const handleResetDivisionDutyHours = (divName) => {
    const updatedDiv = { ...(dutySettings.divisionDutyHours || {}) };
    delete updatedDiv[divName];
    const updated = {
      ...dutySettings,
      divisionDutyHours: updatedDiv
    };
    saveDutySettings(updated);
  };

  const handleSetDepartmentDutyHours = (deptName, hours) => {
    const updated = {
      ...dutySettings,
      departmentDutyHours: {
        ...(dutySettings.departmentDutyHours || {}),
        [deptName]: Number(hours)
      }
    };
    saveDutySettings(updated);
  };

  const handleResetDepartmentDutyHours = (deptName) => {
    const updatedDept = { ...(dutySettings.departmentDutyHours || {}) };
    delete updatedDept[deptName];
    const updated = {
      ...dutySettings,
      departmentDutyHours: updatedDept
    };
    saveDutySettings(updated);
  };

  const handleBatchApplyDutyHours = (filteredList, targetHours) => {
    if (!filteredList || filteredList.length === 0) return;
    const hrs = Number(targetHours) || 8;
    const updatedEmpHours = { ...(dutySettings.employeeDutyHours || {}) };
    const empIdsToUpdate = new Set();
    filteredList.forEach(emp => {
      if (emp.id) {
        updatedEmpHours[emp.id] = hrs;
        empIdsToUpdate.add(emp.id);
      }
      if (emp.employeeCode) {
        updatedEmpHours[emp.employeeCode] = hrs;
        empIdsToUpdate.add(emp.employeeCode);
      }
    });

    const updatedSettings = {
      ...dutySettings,
      employeeDutyHours: updatedEmpHours
    };
    saveDutySettings(updatedSettings);

    const updatedList = (state?.hr_employees_list || employees || []).map(e => {
      if (empIdsToUpdate.has(e.id) || empIdsToUpdate.has(e.employeeCode)) {
        return { ...e, dutyHours: hrs, dailyHours: hrs };
      }
      return e;
    });

    if (setCollection) {
      setCollection('hr_employees_list', updatedList);
    }
    try {
      localStorage.setItem('hr_employees_list', JSON.stringify(updatedList));
    } catch (e) {}
  };

  const handleBatchResetDutyHours = (filteredList) => {
    if (!filteredList || filteredList.length === 0) return;
    const updatedEmpHours = { ...(dutySettings.employeeDutyHours || {}) };
    const empIdsToReset = new Set();
    filteredList.forEach(emp => {
      if (emp.id) {
        delete updatedEmpHours[emp.id];
        empIdsToReset.add(emp.id);
      }
      if (emp.employeeCode) {
        delete updatedEmpHours[emp.employeeCode];
        empIdsToReset.add(emp.employeeCode);
      }
    });

    const updatedSettings = {
      ...dutySettings,
      employeeDutyHours: updatedEmpHours
    };
    saveDutySettings(updatedSettings);

    const updatedList = (state?.hr_employees_list || employees || []).map(e => {
      if (empIdsToReset.has(e.id) || empIdsToReset.has(e.employeeCode)) {
        const copy = { ...e };
        delete copy.dutyHours;
        delete copy.dailyHours;
        return copy;
      }
      return e;
    });

    if (setCollection) {
      setCollection('hr_employees_list', updatedList);
    }
    try {
      localStorage.setItem('hr_employees_list', JSON.stringify(updatedList));
    } catch (e) {}
  };


  const handleSyncStandardHoursToAllEmployees = () => {
    const hrs = dutySettings.standardHours || 8;
    if (confirm(`Do you want to update standard duty hours to ${hrs}h for all active employees?`)) {
      const updatedList = (state?.hr_employees_list || []).map(emp => ({
        ...emp,
        dutyHours: hrs,
        dailyHours: hrs
      }));
      if (setCollection) {
        setCollection('hr_employees_list', updatedList);
      }
      alert(`Updated ${updatedList.length} employees with ${hrs} standard duty hours.`);
    }
  };

  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftModalMode, setShiftModalMode] = useState('add');
  const [activeShift, setActiveShift] = useState({
    id: null,
    name: '',
    startTime: '09:00',
    endTime: '17:00',
    hours: 8,
    status: 'Active'
  });

  const handleOpenAddShift = () => {
    setShiftModalMode('add');
    setActiveShift({
      id: null,
      name: '',
      startTime: '09:00',
      endTime: '17:00',
      hours: 8,
      status: 'Active'
    });
    setShowShiftModal(true);
  };

  const handleOpenEditShift = (shift) => {
    setShiftModalMode('edit');
    setActiveShift({
      id: shift.id,
      name: shift.name,
      startTime: shift.startTime || '09:00',
      endTime: shift.endTime || '17:00',
      hours: shift.hours || 8,
      status: shift.status || 'Active'
    });
    setShowShiftModal(true);
  };

  const handleDeleteShift = (id) => {
    if (confirm('Are you sure you want to delete this shift?')) {
      const updatedShifts = (dutySettings.shifts || []).filter(s => s.id !== id);
      saveDutySettings({ ...dutySettings, shifts: updatedShifts });
    }
  };

  const handleSaveShiftSubmit = (e) => {
    if (e) e.preventDefault();
    if (!activeShift.name) {
      alert('Shift name is required.');
      return;
    }

    const currentShifts = dutySettings.shifts || [];
    let updatedShifts;

    if (shiftModalMode === 'add') {
      const newId = currentShifts.length ? Math.max(...currentShifts.map(s => Number(s.id) || 0)) + 1 : 1;
      const newShift = {
        id: newId,
        name: activeShift.name.trim().toUpperCase(),
        startTime: activeShift.startTime,
        endTime: activeShift.endTime,
        hours: Number(activeShift.hours) || 8,
        status: activeShift.status || 'Active'
      };
      updatedShifts = [...currentShifts, newShift];
    } else {
      updatedShifts = currentShifts.map(s => s.id === activeShift.id ? {
        ...s,
        name: activeShift.name.trim().toUpperCase(),
        startTime: activeShift.startTime,
        endTime: activeShift.endTime,
        hours: Number(activeShift.hours) || 8,
        status: activeShift.status || 'Active'
      } : s);
    }

    saveDutySettings({ ...dutySettings, shifts: updatedShifts });
    setShowShiftModal(false);
  };

  // Category list
  const categories = [
    { id: 'departments', label: 'Departments', icon: 'domain' },
    { id: 'duty_hours', label: 'Duty Hours & Shifts', icon: 'schedule' },
    { id: 'divisions', label: 'Divisions Management', icon: 'apartment' },
    { id: 'payroll_mapping', label: 'Payroll Account Mapping', icon: 'account_balance' },
    { id: 'salary_allowance_config', label: 'Salary & Allowance Configuration', icon: 'payments' },
    { id: 'subsections', label: 'Sub-sections', icon: 'account_tree' },
    { id: 'permissions', label: 'HR Permissions', icon: 'verified_user' },
    { id: 'roles', label: 'Role Management', icon: 'admin_panel_settings' },
    { id: 'audit', label: 'Audit Settings', icon: 'history_edu' }
  ];

  // Handle toggle change
  const handleToggle = (key) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Add/Edit Department Handlers
  const handleOpenAddModal = () => {
    setModalMode('add');
    setActiveDept({
      id: null,
      name: '',
      tagline: '',
      managers: [],
      operators: [],
      incharges: [],
      sections: []
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (dept) => {
    setModalMode('edit');
    setActiveDept({
      id: dept.id,
      name: dept.name,
      tagline: dept.tagline || '',
      managers: dept.managers || [],
      operators: dept.operators || [],
      incharges: dept.incharges || [],
      sections: dept.sections || []
    });
    setShowModal(true);
  };

  const handleDeleteDept = (id, name) => {
    setDeleteConfirm({ show: true, deptId: id, deptName: name });
  };

  const handleSaveDept = (e) => {
    if (e) e.preventDefault();
    if (!activeDept.name) {
      alert("Department Name is required");
      return;
    }

    const subList = activeDept.sections ? activeDept.sections.map(s => s.name) : [];
    const newId = departments.length ? Math.max(...departments.map(d => d.id)) + 1 : 1;

    const payload = {
      id: activeDept.id || newId,
      name: activeDept.name,
      tagline: activeDept.tagline || 'Custom Division',
      managers: activeDept.managers || [],
      operators: activeDept.operators || [],
      incharges: activeDept.incharges || [],
      sections: activeDept.sections || [],
      subSections: subList
    };

    // Update designations of all managers to 'Manager' and others to their respective roles
    const updatedEmployees = [...employees];
    const applyDesignation = (empId, nextDesig) => {
      const idx = updatedEmployees.findIndex(emp => emp.id === empId);
      if (idx !== -1) {
        updatedEmployees[idx] = { 
          ...updatedEmployees[idx], 
          designation: nextDesig, 
          role: nextDesig 
        };
      }
    };

    payload.managers.forEach(id => applyDesignation(id, 'Manager'));
    payload.operators.forEach(id => applyDesignation(id, 'Line Operator'));
    payload.incharges.forEach(id => applyDesignation(id, 'Supervisor'));
    
    payload.sections.forEach(sec => {
      if (sec.incharges) {
        sec.incharges.forEach(id => applyDesignation(id, 'Supervisor'));
      }
    });

    setCollection('hr_employees_list', updatedEmployees);
    localStorage.setItem('hr_employees_list', JSON.stringify(updatedEmployees));

    if (modalMode === 'add') {
      setDepartments(prev => [...prev, payload]);
    } else {
      setDepartments(prev => prev.map(d => d.id === activeDept.id ? payload : d));
    }
    setShowModal(false);
  };

  // Filtered departments list
  const filteredDepts = departments.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.tagline && d.tagline.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (isMobile) {
    return renderMobileView();
  }

  return renderDesktopView();

  // ==========================================
  // DESKTOP VIEWPORT
  // ==========================================
  function renderDesktopView() {
    return (
      <div className="flex flex-1 w-full h-full min-h-[calc(100vh-5rem)] overflow-hidden bg-surface-container-low rounded-3xl border border-outline-variant/15 shadow-2xl relative select-none animate-fade-in">
        {viewMode === 'grid' ? (
          /* Grid of Apps Control Center */
          <main className="flex-1 flex flex-col bg-surface overflow-hidden relative p-8">
            <div className="mb-8">
              <h1 className="font-headline text-2xl font-black text-on-surface tracking-tight leading-tight">HR Control Center</h1>
              <p className="font-body text-xs text-primary font-bold uppercase tracking-wider mt-1">System Administration & Settings</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {/* Departments App-Style Card */}
              <div 
                onClick={() => {
                  setActiveCategory('departments');
                  setViewMode('departments');
                }}
                className="group relative bg-gradient-to-br from-surface-container-lowest via-surface-container-lowest to-primary/5 border border-outline-variant/15 hover:border-primary/30 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer flex flex-col justify-between min-h-[190px] overflow-hidden"
              >
                {/* Visual glow element inside card */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-300 animate-pulse"></div>
                
                <div className="flex items-start justify-between relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <span className="material-symbols-outlined text-[32px] icon-fill">domain</span>
                  </div>
                  <span className="material-symbols-outlined text-outline-variant group-hover:text-primary transition-colors text-[20px] font-bold">arrow_forward</span>
                </div>
                
                <div className="mt-6 relative z-10">
                  <h3 className="font-headline text-md font-black text-on-surface leading-tight group-hover:text-on-surface transition-colors">Departments</h3>
                  <p className="font-body text-[11px] text-on-surface-variant mt-1.5 font-medium leading-relaxed">
                    Manage company structure, headcounts, managers, and operational units.
                  </p>
                </div>
                
                <div className="mt-4 pt-4 border-t border-outline-variant/10 flex items-center justify-between relative z-10 text-[10px] uppercase tracking-wider font-bold">
                  <span className="text-primary font-body">{departments.length} Active Divisions</span>
                  <span className="text-on-surface-variant font-body">{departments.reduce((sum, d) => sum + d.headcount, 0)} Headcount</span>
                </div>
              </div>

              
              {/* Divisions Management App-Style Card */}
              <div 
                onClick={() => {
                  setActiveCategory('divisions');
                  setViewMode('departments');
                }}
                className="group relative bg-gradient-to-br from-surface-container-lowest via-surface-container-lowest to-indigo-500/5 border border-outline-variant/15 hover:border-indigo-500/30 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer flex flex-col justify-between min-h-[190px] overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-all duration-300 animate-pulse"></div>
                
                <div className="flex items-start justify-between relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <span className="material-symbols-outlined text-[32px] icon-fill">apartment</span>
                  </div>
                  <span className="material-symbols-outlined text-outline-variant group-hover:text-indigo-600 transition-colors text-[20px] font-bold">arrow_forward</span>
                </div>
                
                <div className="mt-6 relative z-10">
                  <h3 className="font-headline text-md font-black text-on-surface leading-tight group-hover:text-indigo-600 transition-colors">Divisions Management</h3>
                  <p className="font-body text-[11px] text-on-surface-variant mt-1.5 font-medium leading-relaxed">
                    Corporate divisions, business units, division heads, and employee assignments.
                  </p>
                </div>
                
                <div className="mt-4 pt-4 border-t border-outline-variant/10 flex items-center justify-between relative z-10 text-[10px] uppercase tracking-wider font-bold">
                  <span className="text-indigo-600 font-body">{divisions.length} Active Divisions</span>
                  <span className="text-on-surface-variant font-body">{employees.filter(e => e.division || e.section).length} Assigned</span>
                </div>
              </div>

              {/* Duty Hours & Shifts App-Style Card */}
              <div 
                onClick={() => {
                  setActiveCategory('duty_hours');
                  setViewMode('departments');
                }}
                className="group relative bg-gradient-to-br from-surface-container-lowest via-surface-container-lowest to-amber-500/5 border border-outline-variant/15 hover:border-amber-500/30 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-amber-500/5 hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer flex flex-col justify-between min-h-[190px] overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-all duration-300 animate-pulse"></div>
                
                <div className="flex items-start justify-between relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <span className="material-symbols-outlined text-[32px] icon-fill">schedule</span>
                  </div>
                  <span className="material-symbols-outlined text-outline-variant group-hover:text-amber-600 transition-colors text-[20px] font-bold">arrow_forward</span>
                </div>
                
                <div className="mt-6 relative z-10">
                  <h3 className="font-headline text-md font-black text-on-surface leading-tight group-hover:text-amber-600 transition-colors">Duty Hours & Shifts</h3>
                  <p className="font-body text-[11px] text-on-surface-variant mt-1.5 font-medium leading-relaxed">
                    Standard shift hours, grace periods, half-day thresholds, and schedule management.
                  </p>
                </div>
                
                <div className="mt-4 pt-4 border-t border-outline-variant/10 flex items-center justify-between relative z-10 text-[10px] uppercase tracking-wider font-bold">
                  <span className="text-amber-600 font-body">{dutySettings.standardHours}h Standard Shift</span>
                  <span className="text-on-surface-variant font-body">{(dutySettings.shifts || []).length} Shifts</span>
                </div>
              </div>

              {/* Payroll Account Mapping App-Style Card */}
              <div 
                onClick={() => {
                  setActiveCategory('payroll_mapping');
                  setViewMode('departments');
                }}
                className="group relative bg-gradient-to-br from-surface-container-lowest via-surface-container-lowest to-secondary/5 border border-outline-variant/15 hover:border-secondary/30 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-secondary/5 hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer flex flex-col justify-between min-h-[190px] overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full blur-3xl group-hover:bg-secondary/10 transition-all duration-300 animate-pulse"></div>
                
                <div className="flex items-start justify-between relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <span className="material-symbols-outlined text-[32px] icon-fill">account_balance</span>
                  </div>
                  <span className="material-symbols-outlined text-outline-variant group-hover:text-secondary transition-colors text-[20px] font-bold">arrow_forward</span>
                </div>
                
                <div className="mt-6 relative z-10">
                  <h3 className="font-headline text-md font-black text-on-surface leading-tight group-hover:text-secondary transition-colors">Payroll Account Mapping</h3>
                  <p className="font-body text-[11px] text-on-surface-variant mt-1.5 font-medium leading-relaxed">
                    Map payroll expense categories to General Ledger accounts for automated reporting.
                  </p>
                </div>
                
                <div className="mt-4 pt-4 border-t border-outline-variant/10 flex items-center justify-between relative z-10 text-[10px] uppercase tracking-wider font-bold">
                  <span className="text-secondary font-body">GL Sync Active</span>
                  <span className="text-on-surface-variant font-body">12 Categories</span>
                </div>
              </div>

              {/* Salary & Allowance Configuration App-Style Card */}
              <div 
                onClick={() => {
                  setActiveCategory('salary_allowance_config');
                  setViewMode('departments');
                }}
                className="group relative bg-gradient-to-br from-surface-container-lowest via-surface-container-lowest to-blue-500/5 border border-outline-variant/15 hover:border-blue-500/30 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer flex flex-col justify-between min-h-[190px] overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-all duration-300 animate-pulse"></div>
                
                <div className="flex items-start justify-between relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <span className="material-symbols-outlined text-[32px] icon-fill">payments</span>
                  </div>
                  <span className="material-symbols-outlined text-outline-variant group-hover:text-primary transition-colors text-[20px] font-bold">arrow_forward</span>
                </div>
                
                <div className="mt-6 relative z-10">
                  <h3 className="font-headline text-md font-black text-on-surface leading-tight group-hover:text-primary transition-colors">Salary & Allowance Configuration</h3>
                  <p className="font-body text-[11px] text-on-surface-variant mt-1.5 font-medium leading-relaxed">
                    Configure core compensation rules, overtime factors, and attendance allowance triggers.
                  </p>
                </div>
                
                <div className="mt-4 pt-4 border-t border-outline-variant/10 flex items-center justify-between relative z-10 text-[10px] uppercase tracking-wider font-bold">
                  <span className="text-blue-600 font-body">Rules Active</span>
                  <span className="text-on-surface-variant font-body">Global Scope</span>
                </div>
              </div>
            </div>
          </main>
        ) : (
          /* Full Screen View of the activeCategory (e.g. Departments) */
          <main className="flex-1 flex flex-col bg-surface overflow-hidden relative">
            {/* Header Bar */}
            <header className="h-16 flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/85 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setViewMode('grid')}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all active:scale-[0.92] cursor-pointer border border-outline-variant/10"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </button>
                
                <div className="flex items-center gap-3">
                  <h2 className="font-headline text-md font-extrabold text-on-surface">
                    {categories.find(c => c.id === activeCategory)?.label} Overview
                  </h2>
                  {activeCategory === 'departments' && (
                    <span className="px-2.5 py-0.5 bg-primary-fixed/20 text-primary text-[10px] font-bold rounded-full">
                      {departments.length} Active
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                {activeCategory === 'departments' && (
                  <div className="relative w-56">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant text-[14px]">search</span>
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search divisions..."
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl pl-9 pr-4 py-1.5 text-xs text-on-surface focus:bg-surface-container-lowest focus:border-primary/50 focus:ring-0 transition-all placeholder:text-outline/75"
                    />
                  </div>
                )}
              </div>
            </header>

            {/* Canvas Scroll Area */}
            <div className={`flex-1 flex flex-col h-full min-h-0 overflow-y-auto ${activeCategory === 'payroll_mapping' ? 'p-4' : 'p-8'} custom-scrollbar w-full`}>
              {activeCategory === 'departments' && renderDesktopDepartments()}
              {activeCategory === 'duty_hours' && renderDesktopDutyHours()}
              {activeCategory === 'divisions' && renderDesktopDivisions()}
              {activeCategory === 'payroll_mapping' && <PayrollAccountMapping isMobile={isMobile} onBack={() => setViewMode('grid')} />}
              {activeCategory === 'salary_allowance_config' && <SalaryAllowanceConfig isMobile={isMobile} onBack={() => setViewMode('grid')} />}
              {activeCategory === 'subsections' && renderDesktopSubsections()}
              {activeCategory === 'permissions' && renderDesktopPermissions()}
              {activeCategory === 'roles' && renderDesktopRoles()}
              {activeCategory === 'audit' && renderDesktopAudit()}
            </div>
          </main>
        )}

        {/* Stateful Add/Edit Modal */}
        {showModal && renderFormModal()}

        
        {/* Division Modal */}
        {showDivisionModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-surface-container-lowest rounded-3xl p-6 w-full max-w-lg border border-outline-variant/20 shadow-2xl relative animate-scale-up text-on-surface">
              <header className="flex justify-between items-center mb-5 pb-3 border-b border-outline-variant/15">
                <h3 className="font-headline font-black text-lg text-on-surface">
                  {divisionModalMode === 'add' ? 'Add New Division' : 'Edit Division'}
                </h3>
                <button
                  onClick={() => setShowDivisionModal(false)}
                  className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </header>

              <form onSubmit={handleSaveDivisionSubmit} className="space-y-4 text-xs font-body">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Division Name *</label>
                  <input
                    type="text"
                    required
                    value={activeDivision.name}
                    onChange={(e) => setActiveDivision({ ...activeDivision, name: e.target.value })}
                    placeholder="e.g. AJ Synthetic, AAA"
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 font-bold text-on-surface outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Division Code</label>
                  <input
                    type="text"
                    value={activeDivision.code}
                    onChange={(e) => setActiveDivision({ ...activeDivision, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. AJS, AAA"
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 font-mono font-bold text-on-surface outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={activeDivision.description}
                    onChange={(e) => setActiveDivision({ ...activeDivision, description: e.target.value })}
                    placeholder="Description of division operations and scope..."
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-on-surface outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Head of Division</label>
                  <select
                    value={activeDivision.head}
                    onChange={(e) => setActiveDivision({ ...activeDivision, head: e.target.value })}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 font-bold text-on-surface outline-none"
                  >
                    <option value="">Select Division Head...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.name}>{emp.name} ({emp.id} - {emp.designation || 'Staff'})</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/15">
                  <button
                    type="button"
                    onClick={() => setShowDivisionModal(false)}
                    className="px-4 py-2 border border-outline-variant/30 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md cursor-pointer"
                  >
                    {divisionModalMode === 'add' ? 'Create Division' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Shift Modal */}
        {showShiftModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-surface-container-lowest rounded-3xl p-6 w-full max-w-md border border-outline-variant/20 shadow-2xl relative animate-scale-up text-on-surface">
              <header className="flex justify-between items-center mb-5 pb-3 border-b border-outline-variant/15">
                <h3 className="font-headline font-black text-lg text-on-surface">
                  {shiftModalMode === 'add' ? 'Add Shift Schedule' : 'Edit Shift Schedule'}
                </h3>
                <button
                  onClick={() => setShowShiftModal(false)}
                  className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </header>

              <form onSubmit={handleSaveShiftSubmit} className="space-y-4 text-xs font-body">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Shift Name *</label>
                  <input
                    type="text"
                    required
                    value={activeShift.name}
                    onChange={(e) => setActiveShift({ ...activeShift, name: e.target.value.toUpperCase() })}
                    placeholder="e.g. GENERAL SHIFT, NIGHT SHIFT"
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 font-bold text-on-surface outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Start Time</label>
                    <input
                      type="time"
                      required
                      value={activeShift.startTime}
                      onChange={(e) => setActiveShift({ ...activeShift, startTime: e.target.value })}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 font-mono font-bold text-on-surface outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">End Time</label>
                    <input
                      type="time"
                      required
                      value={activeShift.endTime}
                      onChange={(e) => setActiveShift({ ...activeShift, endTime: e.target.value })}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 font-mono font-bold text-on-surface outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Duty Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      required
                      value={activeShift.hours}
                      onChange={(e) => setActiveShift({ ...activeShift, hours: Number(e.target.value) || 8 })}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 font-bold text-on-surface outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Status</label>
                    <select
                      value={activeShift.status}
                      onChange={(e) => setActiveShift({ ...activeShift, status: e.target.value })}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 font-bold text-on-surface outline-none"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/15">
                  <button
                    type="button"
                    onClick={() => setShowShiftModal(false)}
                    className="px-4 py-2 border border-outline-variant/30 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md cursor-pointer"
                  >
                    {shiftModalMode === 'add' ? 'Create Shift' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Deletion Confirm Modal */}
        {deleteConfirm.show && renderDeleteConfirmModal()}
      </div>
    );
  }

  // ==========================================
  // DESKTOP CATEGORY RENDERERS
  // ==========================================
  
  function renderDesktopDepartments() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-fade-in pb-8">
        {filteredDepts.length === 0 ? (
          <div className="col-span-full text-center py-12 text-on-surface-variant font-body text-sm">
            No departments found matching your search.
          </div>
        ) : (
          filteredDepts.map(dept => {
            const deptEmployees = getActiveEmployees().filter(e => 
              e.department && e.department.toLowerCase() === dept.name.toLowerCase()
            );
            const dynamicHeadcount = deptEmployees.length;
            
            const managerNames = (dept.managers || [])
              .map(id => employees.find(e => e.id === id)?.name || id)
              .join(', ') || 'Not Assigned';
            
            const operatorCount = dept.operators?.length || 0;
            const inchargeCount = dept.incharges?.length || 0;
            const sectionsList = dept.sections || [];

            return (
              <div 
                key={dept.id} 
                className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/10 hover:shadow-md hover:border-primary/20 transition-all group relative overflow-hidden flex flex-col h-auto min-h-[220px] justify-between"
              >
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-primary-fixed group-hover:bg-primary transition-colors"></div>
                
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-fixed/20 flex items-center justify-center text-primary shrink-0">
                      <span className="material-symbols-outlined text-[20px]">
                        {dept.name.includes('Eng') ? 'developer_mode' : 
                         dept.name.includes('Log') ? 'local_shipping' : 
                         dept.name.includes('Prod') ? 'precision_manufacturing' : 'domain'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-headline text-sm font-bold text-on-surface leading-tight">{dept.name}</h3>
                      <p className="font-body text-[10px] text-on-surface-variant mt-0.5">{dept.tagline}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-1 shrink-0">
                    <button 
                      onClick={() => handleOpenEditModal(dept)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">edit</span>
                    </button>
                  </div>
                </div>

                {/* Managers Row */}
                <div className="mb-3 px-3 py-2 bg-surface rounded-xl border border-outline-variant/10 text-xs">
                  <span className="font-body text-[8px] text-on-surface-variant uppercase tracking-wider font-bold block mb-0.5">Managers</span>
                  <span className="font-sans font-bold text-on-surface line-clamp-1">{managerNames}</span>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-2 mb-3 text-center p-2.5 bg-surface-container-low rounded-xl border border-outline-variant/5">
                  <div className="flex flex-col">
                    <span className="font-body text-[8px] text-on-surface-variant uppercase tracking-wider font-bold">Incharges</span>
                    <span className="font-headline text-xs font-black text-on-surface mt-0.5">{inchargeCount}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-body text-[8px] text-on-surface-variant uppercase tracking-wider font-bold">Operators</span>
                    <span className="font-headline text-xs font-black text-on-surface mt-0.5">{operatorCount}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-body text-[8px] text-on-surface-variant uppercase tracking-wider font-bold">Sections</span>
                    <span className="font-headline text-xs font-black text-on-surface mt-0.5">{sectionsList.length}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-body text-[8px] text-on-surface-variant uppercase tracking-wider font-bold">Headcount</span>
                    <span className="font-headline text-xs font-black text-primary mt-0.5">{dynamicHeadcount}</span>
                  </div>
                </div>

                {/* Sections Chips list */}
                <div className="mt-1">
                  <div className="flex flex-wrap gap-1.5 max-h-[50px] overflow-hidden">
                    {sectionsList.length === 0 ? (
                      <span className="text-[9px] text-outline/50 italic">No sections defined</span>
                    ) : (
                      sectionsList.map((sec, idx) => (
                        <span key={sec.id || idx} className="px-2 py-0.5 bg-surface border border-outline-variant/10 text-on-surface-variant text-[9px] font-semibold rounded-md whitespace-nowrap">
                          {sec.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  function renderDesktopSubsections() {
    return (
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant font-body text-[10px] uppercase font-bold tracking-wider border-b border-outline-variant/10">
              <th className="p-4 pl-6">Sub-section Name</th>
              <th className="p-4">Parent Division</th>
              <th className="p-4">Manager Responsible</th>
              <th className="p-4">Operational Status</th>
            </tr>
          </thead>
          <tbody className="text-xs font-medium">
            {departments.flatMap(dept => 
              (dept.sections || []).map((sec, idx) => {
                const managerNames = (dept.managers || []).map(id => employees.find(e => e.id === id)?.name || id).join(', ') || 'Not Assigned';
                return (
                  <tr key={`${dept.id}-${sec.id || idx}`} className="border-b border-outline-variant/5 last:border-0 hover:bg-surface-container-low/50 transition-colors">
                    <td className="p-4 pl-6 font-bold text-on-surface">{sec.name}</td>
                    <td className="p-4 text-primary font-semibold">{dept.name}</td>
                    <td className="p-4 text-on-surface-variant">{managerNames}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/50 rounded-md font-bold text-[9px] uppercase tracking-wide">
                        Active
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  }

  function renderDesktopPermissions() {
    return (
      <div className="max-w-2xl bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10 shadow-sm space-y-6">
        <div>
          <h3 className="font-headline font-bold text-sm text-on-surface mb-1">Global HR Policy Switches</h3>
          <p className="font-body text-xs text-on-surface-variant">Toggle administrative locks and dynamic access controls globally.</p>
        </div>

        <div className="space-y-4 pt-2">
          {/* Payroll toggle */}
          <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-outline-variant/5">
            <div className="flex flex-col gap-0.5">
              <span className="font-headline font-bold text-xs text-on-surface">Manage Payroll Data</span>
              <span className="font-body text-[10px] text-on-surface-variant">Allow payroll processing and salary updates inside dashboard.</span>
            </div>
            <button 
              onClick={() => handleToggle('payroll')}
              className={`w-11 h-6 rounded-full transition-colors relative duration-200 cursor-pointer ${
                permissions.payroll ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/50'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all duration-200 ${
                permissions.payroll ? 'left-6' : 'left-1'
              }`}></div>
            </button>
          </div>

          {/* Leaves toggle */}
          <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-outline-variant/5">
            <div className="flex flex-col gap-0.5">
              <span className="font-headline font-bold text-xs text-on-surface">Approve Leaves Globally</span>
              <span className="font-body text-[10px] text-on-surface-variant">Self-approve standard leaves without manual admin signature.</span>
            </div>
            <button 
              onClick={() => handleToggle('leaves')}
              className={`w-11 h-6 rounded-full transition-colors relative duration-200 cursor-pointer ${
                permissions.leaves ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/50'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all duration-200 ${
                permissions.leaves ? 'left-6' : 'left-1'
              }`}></div>
            </button>
          </div>

          {/* Profiles toggle */}
          <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-outline-variant/5">
            <div className="flex flex-col gap-0.5">
              <span className="font-headline font-bold text-xs text-on-surface">Edit Employee Profiles</span>
              <span className="font-body text-[10px] text-on-surface-variant">Allow department managers to edit sub-section user details.</span>
            </div>
            <button 
              onClick={() => handleToggle('profiles')}
              className={`w-11 h-6 rounded-full transition-colors relative duration-200 cursor-pointer ${
                permissions.profiles ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/50'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all duration-200 ${
                permissions.profiles ? 'left-6' : 'left-1'
              }`}></div>
            </button>
          </div>

          {/* Audit toggle */}
          <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-outline-variant/5">
            <div className="flex flex-col gap-0.5">
              <span className="font-headline font-bold text-xs text-on-surface">View Salary Audits</span>
              <span className="font-body text-[10px] text-on-surface-variant">Enable historical salary change reports in the audit logs.</span>
            </div>
            <button 
              onClick={() => handleToggle('audit')}
              className={`w-11 h-6 rounded-full transition-colors relative duration-200 cursor-pointer ${
                permissions.audit ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/50'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all duration-200 ${
                permissions.audit ? 'left-6' : 'left-1'
              }`}></div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderDesktopRoles() {
    const handleAddDesignation = (e) => {
      e.preventDefault();
      if (!newDesignation.trim()) return;
      if (designations.map(d => d.toLowerCase()).includes(newDesignation.trim().toLowerCase())) {
        alert("This designation already exists!");
        return;
      }
      setDesignations(prev => [...prev, newDesignation.trim()]);
      setNewDesignation('');
    };

    const handleDeleteDesignation = (desig) => {
      if (designations.length <= 1) {
        alert("At least one active designation is required in the system.");
        return;
      }
      setDesignations(prev => prev.filter(d => d !== desig));
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
        {/* Left pane - Access Roles */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden shadow-sm p-6 flex flex-col gap-4">
          <div>
            <h3 className="font-headline font-bold text-sm text-on-surface">System Access Roles</h3>
            <p className="font-body text-[10px] text-on-surface-variant mt-0.5">Configure system access permissions for administrative accounts.</p>
          </div>
          <table className="w-full text-left border-collapse mt-2">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-body text-[9px] uppercase font-bold tracking-wider border-b border-outline-variant/10">
                <th className="p-3 pl-4">Role Name</th>
                <th className="p-3">Personnel</th>
                <th className="p-3">Read</th>
                <th className="p-3">Write</th>
                <th className="p-3">Scope</th>
              </tr>
            </thead>
            <tbody className="text-xs font-medium text-on-surface">
              <tr className="border-b border-outline-variant/5 hover:bg-surface-container-low/50">
                <td className="p-3 pl-4 font-bold">HR Administrator</td>
                <td className="p-3">3 active</td>
                <td className="p-3 text-emerald-600 font-bold">YES</td>
                <td className="p-3 text-emerald-600 font-bold">YES</td>
                <td className="p-3">Full Access</td>
              </tr>
              <tr className="border-b border-outline-variant/5 hover:bg-surface-container-low/50">
                <td className="p-3 pl-4 font-bold">Department Manager</td>
                <td className="p-3">12 active</td>
                <td className="p-3 text-emerald-600 font-bold">YES</td>
                <td className="p-3 text-error font-bold">NO</td>
                <td className="p-3">Dept Only</td>
              </tr>
              <tr className="border-b border-outline-variant/5 hover:bg-surface-container-low/50">
                <td className="p-3 pl-4 font-bold">General Operator</td>
                <td className="p-3">1.2k active</td>
                <td className="p-3 text-error font-bold">NO</td>
                <td className="p-3 text-error font-bold">NO</td>
                <td className="p-3">No Access</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Right pane - Job Designations Config */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm p-6 flex flex-col gap-5">
          <div>
            <h3 className="font-headline font-bold text-sm text-on-surface">Job Designations Configuration</h3>
            <p className="font-body text-[10px] text-on-surface-variant mt-0.5">Manage active company designations that populate the Onboarding dropdowns dynamically.</p>
          </div>

          {/* Add Designation form */}
          <form onSubmit={handleAddDesignation} className="flex gap-2 shrink-0">
            <input 
              type="text"
              value={newDesignation}
              onChange={e => setNewDesignation(e.target.value)}
              placeholder="e.g. Senior Analyst, Specialist"
              className="flex-1 bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50 outline-none placeholder:text-outline/65"
            />
            <button 
              type="submit"
              className="bg-primary hover:bg-primary-container text-on-primary text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm active:scale-[0.98] cursor-pointer"
            >
              Add Role
            </button>
          </form>

          {/* Designations list */}
          <div className="flex-1 overflow-y-auto max-h-[160px] custom-scrollbar border border-outline-variant/5 rounded-xl p-2.5 space-y-1.5">
            {designations.map((desig, idx) => (
              <div 
                key={idx}
                className="flex items-center justify-between bg-surface-container-low/50 border border-outline-variant/5 px-3 py-2 rounded-lg hover:bg-surface-container-low transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary">badge</span>
                  <span className="text-xs font-semibold text-on-surface">{desig}</span>
                </div>
                <button 
                  type="button"
                  onClick={() => handleDeleteDesignation(desig)}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-outline hover:text-error hover:bg-error-container/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">delete</span>
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center text-[9px] text-outline font-bold mt-2 uppercase tracking-wide">
            <span>Total Configured: {designations.length}</span>
            <span className="text-primary">Wizard Dropdowns Synced</span>
          </div>
        </div>
      </div>
    );
  }

  function renderDesktopAudit() {
    return (
      <div className="max-w-xl bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10 shadow-sm space-y-6">
        <div>
          <h3 className="font-headline font-bold text-sm text-on-surface mb-1">HR Operations Audit Logging</h3>
          <p className="font-body text-xs text-on-surface-variant">Establish retention and tracking scopes for payroll and access alterations.</p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-on-surface">Log Retention Period</label>
            <select className="bg-surface-container-low border border-outline-variant/20 rounded-xl text-xs font-body font-semibold text-on-surface py-2.5 px-3 outline-none cursor-pointer focus:ring-1 focus:ring-primary/25">
              <option>90 Days (Recommended)</option>
              <option>180 Days</option>
              <option>1 Year</option>
              <option>Infinite (Enterprise Plan)</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="font-body text-xs text-on-surface-variant font-medium">Auto-Archiving Enabled</span>
            <button 
              onClick={() => handleToggle('onboarding')}
              className={`w-9 h-5 rounded-full transition-colors relative duration-200 cursor-pointer ${
                permissions.onboarding ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/40'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all duration-200 ${
                permissions.onboarding ? 'left-5' : 'left-0.5'
              }`}></div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // MOBILE VIEWPORT
  // ==========================================
  function renderMobileView() {
    if (activeCategory === 'payroll_mapping') {
      return <PayrollAccountMapping isMobile={true} onBack={() => setActiveCategory('departments')} />;
    }
    if (activeCategory === 'salary_allowance_config') {
      return <SalaryAllowanceConfig isMobile={true} onBack={() => setActiveCategory('departments')} />;
    }
    if (activeCategory === 'duty_hours') {
      return renderMobileDutyHours();
    }
    if (activeCategory === 'divisions') {
      return renderMobileDivisions();
    }

    return (
      <div className="flex flex-col gap-6 animate-fade-in pb-20 select-none">
        {/* Welcome Header */}
        <header className="flex flex-col gap-1">
          <h1 className="font-headline text-2xl font-black text-on-surface tracking-tight leading-tight">HR Control Center</h1>
          <p className="font-body text-[10px] text-on-surface-variant font-bold uppercase tracking-wider text-primary">System Administrator</p>
        </header>

        {/* Bento Grid Settings Categories (Accordion Style for Mobile) */}
        <section className="flex flex-col gap-4">
          
          
          {/* Divisions Management Bento Block */}
          <div 
            onClick={() => setActiveCategory('divisions')}
            className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/15 shadow-sm cursor-pointer hover:border-indigo-500/30 transition-all flex justify-between items-center"
          >
            <div className="flex items-center gap-3 text-indigo-600">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">apartment</span>
              </div>
              <div>
                <h2 className="font-headline text-sm font-bold text-on-surface">Divisions Management</h2>
                <p className="font-body text-[10px] text-on-surface-variant">{divisions.length} Divisions • AJ Synthetic</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-outline-variant text-[20px]">chevron_right</span>
          </div>

          {/* Duty Hours & Shifts Bento Block */}
          <div 
            onClick={() => setActiveCategory('duty_hours')}
            className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/15 shadow-sm cursor-pointer hover:border-amber-500/30 transition-all flex justify-between items-center"
          >
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">schedule</span>
              </div>
              <div>
                <h2 className="font-headline text-sm font-bold text-on-surface">Duty Hours & Shifts</h2>
                <p className="font-body text-[10px] text-on-surface-variant font-medium">{dutySettings.standardHours}h Standard • {(dutySettings.shifts || []).length} Shifts</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-outline-variant text-[20px]">chevron_right</span>
          </div>

          {/* Payroll Account Mapping Bento Block */}
          <div 
            onClick={() => setActiveCategory('payroll_mapping')}
            className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/15 shadow-sm cursor-pointer hover:border-secondary/30 transition-all flex justify-between items-center"
          >
            <div className="flex items-center gap-3 text-secondary">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">account_balance</span>
              </div>
              <div>
                <h2 className="font-headline text-sm font-bold text-on-surface">Payroll Account Mapping</h2>
                <p className="font-body text-[10px] text-on-surface-variant">General Ledger & Expense Rules</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-outline-variant text-[20px]">chevron_right</span>
          </div>

          {/* Salary & Allowance Configuration Bento Block */}
          <div 
            onClick={() => setActiveCategory('salary_allowance_config')}
            className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/15 shadow-sm cursor-pointer hover:border-blue-500/30 transition-all flex justify-between items-center"
          >
            <div className="flex items-center gap-3 text-blue-600">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">payments</span>
              </div>
              <div>
                <h2 className="font-headline text-sm font-bold text-on-surface">Salary & Allowance Configuration</h2>
                <p className="font-body text-[10px] text-on-surface-variant font-medium">Overtime & Attendance Triggers</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-outline-variant text-[20px]">chevron_right</span>
          </div>

          {/* Departments Bento Block */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/15 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2.5 text-primary">
                <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>domain</span>
                <h2 className="font-headline text-sm font-bold">Departments</h2>
              </div>
            </div>

            {/* Department mini-list inside card */}
            <div className="space-y-2">
              {departments.map(dept => {
                const managerNames = (dept.managers || []).map(id => employees.find(e => e.id === id)?.name || id).join(', ') || 'None';
                const headcount = getActiveEmployees().filter(e => e.department && e.department.toLowerCase() === dept.name.toLowerCase()).length;
                return (
                  <div key={dept.id} className="flex justify-between items-center bg-surface-container-low/60 p-3 rounded-xl border border-outline-variant/5">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-headline text-xs font-extrabold text-on-surface">{dept.name}</span>
                      <span className="font-body text-[9px] text-on-surface-variant">Mgr: {managerNames} • H/C: {headcount}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button 
                        onClick={() => handleOpenEditModal(dept)}
                        className="w-7 h-7 rounded-full bg-surface flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* HR Permissions Bento Block */}
          <div className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant/15">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2.5 text-on-primary-fixed-variant">
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                <h2 className="font-headline text-sm font-bold">HR Permissions</h2>
              </div>
            </div>
            
            {/* Toggles */}
            <div className="space-y-3.5">
              <div className="flex justify-between items-center">
                <span className="font-body text-xs font-semibold text-on-surface-variant">Manage Payroll Data</span>
                <button 
                  onClick={() => handleToggle('payroll')}
                  className={`w-9 h-5 rounded-full transition-colors relative duration-200 cursor-pointer ${
                    permissions.payroll ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/40'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all duration-200 ${
                    permissions.payroll ? 'left-5' : 'left-0.5'
                  }`}></div>
                </button>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-body text-xs font-semibold text-on-surface-variant">Approve Leaves</span>
                <button 
                  onClick={() => handleToggle('leaves')}
                  className={`w-9 h-5 rounded-full transition-colors relative duration-200 cursor-pointer ${
                    permissions.leaves ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/40'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all duration-200 ${
                    permissions.leaves ? 'left-5' : 'left-0.5'
                  }`}></div>
                </button>
              </div>
            </div>
          </div>

          {/* Double Stack Card: Sub-sections & Role Management */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-container-low rounded-2xl p-4 flex flex-col items-center justify-center gap-2 border border-outline-variant/10 text-center">
              <span className="material-symbols-outlined text-[26px] text-secondary">account_tree</span>
              <h3 className="font-headline text-xs font-bold text-on-surface">Sub-sections</h3>
              <span className="text-[9px] font-semibold text-on-surface-variant">11 Active Sections</span>
            </div>

            <div className="bg-surface-container-low rounded-2xl p-4 flex flex-col items-center justify-center gap-2 border border-outline-variant/10 text-center">
              <span className="material-symbols-outlined text-[26px] text-secondary">admin_panel_settings</span>
              <h3 className="font-headline text-xs font-bold text-on-surface">Role Management</h3>
              <span className="text-[9px] font-semibold text-on-surface-variant">4 Defined Roles</span>
            </div>
          </div>

          {/* Audit Settings Card */}
          <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/10 flex justify-between items-center">
            <div className="flex items-center gap-3 text-tertiary">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>history_edu</span>
              <h3 className="font-headline text-xs font-bold text-on-surface">Audit Settings</h3>
            </div>
            <span className="text-[9px] font-bold text-on-surface-variant bg-surface px-2 py-0.5 rounded-md border border-outline-variant/10">90 Days</span>
          </div>

        </section>

        {/* Form Modal in mobile */}
        {showModal && renderFormModal()}
      </div>
    );
  }

  // ==========================================
  // SHARED FORM INPUT MODAL (PREMIUM & STYLISH)
  // ==========================================
  // ==========================================
  // SHARED FORM INPUT MODAL (PREMIUM & REDESIGNED)
  // ==========================================

  // ==========================================
  // DIVISIONS RENDERERS
  // ==========================================
  function renderDesktopDivisions() {
    return (
      <div className="space-y-6 animate-fade-in pb-12">
        {/* Info banner */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/15 flex justify-between items-center">
          <div>
            <h3 className="font-headline text-base font-bold text-on-surface">Corporate Divisions Structure</h3>
            <p className="font-body text-xs text-on-surface-variant mt-1">
              Divisions group operational departments and employees under dedicated operational wings.
            </p>
          </div>
          <button
            onClick={handleOpenAddDivision}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Division
          </button>
        </div>

        {/* Division Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {divisions.map(div => {
            const divEmployees = employees.filter(e => (e.division === div.name || e.section === div.name));
            const divDepts = Array.from(new Set(divEmployees.map(e => e.department).filter(Boolean)));

            return (
              <div
                key={div.id}
                className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/15 shadow-sm hover:shadow-lg hover:border-indigo-500/30 transition-all flex flex-col justify-between relative group"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black text-sm">
                        {div.code || 'DIV'}
                      </div>
                      <div>
                        <h4 className="font-headline text-base font-black text-on-surface leading-tight">{div.name}</h4>
                        <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 mt-1">
                          Code: {div.code || 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditDivision(div)}
                        className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-indigo-600 transition-colors cursor-pointer"
                        title="Edit Division"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      {div.name !== 'AJ Synthetic' && (
                        <button
                          onClick={() => handleDeleteDivision(div.id)}
                          className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-error transition-colors cursor-pointer"
                          title="Delete Division"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-on-surface-variant mb-4 line-clamp-2">
                    {div.description || 'No description provided.'}
                  </p>

                  <div className="space-y-2 bg-surface-container-low/50 p-3.5 rounded-xl border border-outline-variant/10 text-xs mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant font-medium">Head of Division:</span>
                      <span className="font-bold text-on-surface">{div.head || 'Not Assigned'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant font-medium">Headcount:</span>
                      <span className="font-bold text-indigo-600">{divEmployees.length} Staff</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant font-medium">Active Departments:</span>
                      <span className="font-bold text-on-surface">{divDepts.length}</span>
                    </div>
                  </div>
                </div>

                {divDepts.length > 0 && (
                  <div className="border-t border-outline-variant/10 pt-3">
                    <span className="text-[10px] uppercase tracking-wider text-outline block mb-1.5 font-bold">Departments</span>
                    <div className="flex flex-wrap gap-1.5">
                      {divDepts.slice(0, 4).map(d => (
                        <span key={d} className="px-2 py-0.5 rounded-md bg-surface-container text-[10px] font-semibold text-on-surface-variant truncate max-w-[120px]">
                          {d}
                        </span>
                      ))}
                      {divDepts.length > 4 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-surface-container text-[10px] font-bold text-on-surface-variant">
                          +{divDepts.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderMobileDivisions() {
    return (
      <div className="flex flex-col gap-5 pb-20 animate-fade-in select-none">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveCategory('departments')}
              className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <div>
              <h2 className="font-headline text-lg font-black text-on-surface leading-tight">Divisions Management</h2>
              <p className="text-[10px] text-on-surface-variant">Corporate Structure</p>
            </div>
          </div>
          <button
            onClick={handleOpenAddDivision}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold"
          >
            + Add
          </button>
        </header>

        <div className="space-y-3">
          {divisions.map(div => {
            const count = employees.filter(e => (e.division === div.name || e.section === div.name)).length;
            return (
              <div key={div.id} className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/15 flex flex-col gap-2 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-headline font-black text-sm text-on-surface">{div.name}</h3>
                    <span className="text-[10px] font-bold text-indigo-600">Code: {div.code || 'N/A'} • {count} Employees</span>
                  </div>
                  <button
                    onClick={() => handleOpenEditDivision(div)}
                    className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                  </button>
                </div>
                <p className="text-[11px] text-on-surface-variant">{div.description || 'No description.'}</p>
                <div className="text-[10px] text-outline font-semibold">
                  Head: <span className="text-on-surface font-bold">{div.head || 'Not Assigned'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==========================================
  // DUTY HOURS & SHIFTS RENDERERS (COMPREHENSIVE)
  // ==========================================
// Duty handlers hoisted above render

    function renderDesktopDutyHours() {
    const ALPHABET_KEYS = ['ALL', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    
    // Distinct divisions list
    const divNamesList = Array.from(new Set([
      ...divisions.map(d => d.name),
      ...employees.map(e => e.division || e.section).filter(Boolean)
    ])).sort();

    // Distinct departments list
    const deptNamesList = departments.map(d => d.name);

    // Filtered employees for employee-wise tab
    const filteredEmpDutyList = employees.filter(emp => {
      const query = empDutySearch.trim().toLowerCase();
      const matchesSearch = !query || (
        (emp.name || '').toLowerCase().includes(query) ||
        (emp.id || '').toLowerCase().includes(query) ||
        (emp.designation || '').toLowerCase().includes(query) ||
        (emp.phone || '').toLowerCase().includes(query)
      );
      const matchesDiv = empDutyDivFilter === 'ALL' || (emp.division === empDutyDivFilter || emp.section === empDutyDivFilter);
      const matchesDept = empDutyDeptFilter === 'ALL' || emp.department === empDutyDeptFilter;
      const matchesAlpha = empDutyAlphaFilter === 'ALL' || (emp.name || '').trim().toUpperCase().startsWith(empDutyAlphaFilter);
      return matchesSearch && matchesDiv && matchesDept && matchesAlpha;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const customOverrideCount = employees.filter(e => 
      (dutySettings.employeeDutyHours?.[e.id] && Number(dutySettings.employeeDutyHours[e.id]) > 0) ||
      (e.dutyHours && Number(e.dutyHours) > 0)
    ).length;

    return (
      <div className="space-y-6 animate-fade-in pb-12 select-none">
        {/* Top Header Card */}
        <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-amber-600 text-[26px]">schedule</span>
              <h3 className="font-headline text-lg font-black text-on-surface">Duty Hours & Shifts Configuration</h3>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              Configure baseline shift hours, division defaults, department rules, and individual employee duty hours.
            </p>
          </div>
          
          <div className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-2xl border border-outline-variant/20 shadow-xs">
            <span className="text-[10px] font-bold text-on-surface-variant px-2 uppercase">Formula:</span>
            <span className="px-2.5 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-mono font-bold border border-amber-500/20">
              Basic Salary ÷ Days ÷ Duty Hours = Hourly Rate
            </span>
          </div>
        </div>

        {/* Sub-Tab Navigation Bar */}
        <div className="flex items-center gap-2 border-b border-outline-variant/15 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setDutySubTab('global')}
            className={`px-4 py-2.5 rounded-xl font-headline font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              dutySubTab === 'global'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            Standard Shift & Overtime Rules
          </button>

          <button
            type="button"
            onClick={() => setDutySubTab('divisions')}
            className={`px-4 py-2.5 rounded-xl font-headline font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              dutySubTab === 'divisions'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">apartment</span>
            Division-Wise Duty Hours ({divNamesList.length})
          </button>

          <button
            type="button"
            onClick={() => setDutySubTab('departments')}
            className={`px-4 py-2.5 rounded-xl font-headline font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              dutySubTab === 'departments'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">domain</span>
            Department-Wise Duty Hours ({departments.length})
          </button>

          <button
            type="button"
            onClick={() => setDutySubTab('employees')}
            className={`px-4 py-2.5 rounded-xl font-headline font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              dutySubTab === 'employees'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">badge</span>
            Employee-Wise Custom Hours ({employees.length})
          </button>
        </div>

        {/* TAB 1: GLOBAL STANDARD & OVERTIME */}
        {dutySubTab === 'global' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Standard Duty Hours */}
              <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5 text-amber-600 mb-3">
                    <span className="material-symbols-outlined text-[24px]">timer</span>
                    <h4 className="font-headline text-sm font-bold text-on-surface">Standard Duty Hours</h4>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-4">
                    Global default working hours per day for standard salary & overtime calculation.
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {[8, 9, 10, 12].map(hrs => (
                      <button
                        key={hrs}
                        type="button"
                        onClick={() => saveDutySettings({ ...dutySettings, standardHours: hrs })}
                        className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          dutySettings.standardHours === hrs
                            ? 'bg-amber-600 text-white shadow-md scale-102'
                            : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                        }`}
                      >
                        {hrs}h
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSyncStandardHoursToAllEmployees}
                  className="mt-5 w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">sync</span>
                  Apply Baseline to All Personnel
                </button>
              </div>

              {/* Card 2: Grace & Penalty Rules */}
              <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 text-blue-600">
                  <span className="material-symbols-outlined text-[24px]">timelapse</span>
                  <h4 className="font-headline text-sm font-bold text-on-surface">Grace & Penalty Rules</h4>
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-bold text-on-surface">Grace Period for Late Arrival</span>
                    <span className="font-mono font-bold text-blue-600">{dutySettings.gracePeriodMinutes || 15} Mins</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="5"
                    value={dutySettings.gracePeriodMinutes || 15}
                    onChange={(e) => saveDutySettings({ ...dutySettings, gracePeriodMinutes: Number(e.target.value) || 0 })}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-bold text-on-surface">Half-Day Threshold Hours</span>
                    <span className="font-mono font-bold text-blue-600">{dutySettings.halfDayThresholdHours || 4} Hours</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="8"
                    step="0.5"
                    value={dutySettings.halfDayThresholdHours || 4}
                    onChange={(e) => saveDutySettings({ ...dutySettings, halfDayThresholdHours: Number(e.target.value) || 0 })}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Card 3: Shift Customization Access */}
              <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5 text-emerald-600 mb-3">
                    <span className="material-symbols-outlined text-[24px]">shield_person</span>
                    <h4 className="font-headline text-sm font-bold text-on-surface">Flexible Duty Customization</h4>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Allows managers to set custom duty hours per division, department, or individual employee.
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-outline-variant/10 flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface">Custom Duty Hours Active</span>
                  <button
                    type="button"
                    onClick={() => saveDutySettings({ ...dutySettings, dutyHoursAdjustable: !dutySettings.dutyHoursAdjustable })}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      dutySettings.dutyHoursAdjustable ? 'bg-emerald-600' : 'bg-surface-container-highest border border-outline-variant/30'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      dutySettings.dutyHoursAdjustable ? 'left-7' : 'left-1'
                    }`}></div>
                  </button>
                </div>
              </div>
            </div>

            {/* Overtime Calculation & Rates */}
            <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-outline-variant/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <span className="material-symbols-outlined text-[22px]">calculate</span>
                  </div>
                  <div>
                    <h4 className="font-headline text-sm font-black text-on-surface">Overtime Calculation & Shift Overtime Rates</h4>
                    <p className="text-xs text-on-surface-variant">Configure how overtime hourly pay is computed from basic salary and duty hours.</p>
                  </div>
                </div>

                {/* Calculation Type Toggle */}
                <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-2xl border border-outline-variant/20 shadow-xs">
                  <button
                    type="button"
                    onClick={() => saveDutySettings({
                      ...dutySettings,
                      overtimeCalculation: { ...(dutySettings.overtimeCalculation || {}), type: 'formula' }
                    })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      (dutySettings.overtimeCalculation?.type || 'formula') === 'formula'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Standard Formula
                  </button>
                  <button
                    type="button"
                    onClick={() => saveDutySettings({
                      ...dutySettings,
                      overtimeCalculation: { ...(dutySettings.overtimeCalculation || {}), type: 'flat' }
                    })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      dutySettings.overtimeCalculation?.type === 'flat'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Flat Hourly Rate
                  </button>
                </div>
              </div>

              {/* Multipliers Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-surface-container-low/50 p-4 rounded-2xl border border-outline-variant/15">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-on-surface">Regular Day Overtime Multiplier</span>
                    <span className="text-xs font-mono font-black text-amber-600">{dutySettings.overtimeCalculation?.rateMultiplier || 1.5}x</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1.0, 1.25, 1.5, 2.0].map(mult => (
                      <button
                        key={mult}
                        type="button"
                        onClick={() => saveDutySettings({
                          ...dutySettings,
                          overtimeCalculation: { ...(dutySettings.overtimeCalculation || {}), rateMultiplier: mult }
                        })}
                        className={`py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          Number(dutySettings.overtimeCalculation?.rateMultiplier || 1.5) === mult
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                        }`}
                      >
                        {mult}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-surface-container-low/50 p-4 rounded-2xl border border-outline-variant/15">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-on-surface">Weekend / Off-Day Multiplier</span>
                    <span className="text-xs font-mono font-black text-blue-600">{dutySettings.overtimeCalculation?.weekendMultiplier || 2.0}x</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1.5, 2.0, 2.5, 3.0].map(mult => (
                      <button
                        key={mult}
                        type="button"
                        onClick={() => saveDutySettings({
                          ...dutySettings,
                          overtimeCalculation: { ...(dutySettings.overtimeCalculation || {}), weekendMultiplier: mult }
                        })}
                        className={`py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          Number(dutySettings.overtimeCalculation?.weekendMultiplier || 2.0) === mult
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                        }`}
                      >
                        {mult}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-surface-container-low/50 p-4 rounded-2xl border border-outline-variant/15">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-on-surface">Public Holiday Multiplier</span>
                    <span className="text-xs font-mono font-black text-purple-600">{dutySettings.overtimeCalculation?.holidayMultiplier || 3.0}x</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[2.0, 2.5, 3.0, 3.5].map(mult => (
                      <button
                        key={mult}
                        type="button"
                        onClick={() => saveDutySettings({
                          ...dutySettings,
                          overtimeCalculation: { ...(dutySettings.overtimeCalculation || {}), holidayMultiplier: mult }
                        })}
                        className={`py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          Number(dutySettings.overtimeCalculation?.holidayMultiplier || 3.0) === mult
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                        }`}
                      >
                        {mult}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="bg-surface-container-low/60 rounded-2xl p-4 border border-outline-variant/15">
                <div className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-amber-600">visibility</span>
                  Live Formula Breakdown (Example for Rs. 30,000 Basic Salary, 31-day month, 8h Duty):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                  <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
                    <div className="text-[10px] text-on-surface-variant font-bold">1 DAY AMOUNT</div>
                    <div className="text-sm font-bold text-on-surface mt-1">Rs. 967.74</div>
                    <div className="text-[9px] text-on-surface-variant mt-0.5">Rs. 30,000 ÷ 31 Days</div>
                  </div>
                  <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
                    <div className="text-[10px] text-on-surface-variant font-bold">1 HOUR AMOUNT</div>
                    <div className="text-sm font-bold text-on-surface mt-1">Rs. 120.97</div>
                    <div className="text-[9px] text-on-surface-variant mt-0.5">Rs. 967.74 ÷ 8 Hours</div>
                  </div>
                  <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                    <div className="text-[10px] text-amber-700 dark:text-amber-300 font-bold">OT HOURLY RATE (1.5x)</div>
                    <div className="text-sm font-black text-amber-600 dark:text-amber-400 mt-1">Rs. 181.45</div>
                    <div className="text-[9px] text-amber-700/80 mt-0.5">Rs. 120.97 × 1.5 Multiplier</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Shift List Master */}
            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/15 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-amber-600 text-[24px]">view_timeline</span>
                  <div>
                    <h4 className="font-headline text-sm font-black text-on-surface">Configured Work Shifts</h4>
                    <p className="text-xs text-on-surface-variant">Default shift start, end, and duration templates.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddShift}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Add Shift
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-surface-container-low/50 text-[10px] uppercase font-bold text-on-surface-variant border-b border-outline-variant/10">
                    <tr>
                      <th className="px-6 py-3.5">Shift Name</th>
                      <th className="px-6 py-3.5">Timing</th>
                      <th className="px-6 py-3.5 text-center">Duty Duration</th>
                      <th className="px-6 py-3.5 text-center">Status</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 font-medium">
                    {(dutySettings.shifts || []).map(shift => (
                      <tr key={shift.id} className="hover:bg-surface-container-low/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-on-surface">{shift.name}</td>
                        <td className="px-6 py-4 font-mono text-on-surface-variant">{shift.startTime} — {shift.endTime}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono font-bold text-xs">
                            {shift.hours} Hours
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                            {shift.status || 'Active'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditShift(shift)}
                              className="w-7 h-7 rounded-lg bg-surface-container hover:bg-amber-500/10 hover:text-amber-600 flex items-center justify-center text-on-surface-variant transition-colors"
                            >
                              <span className="material-symbols-outlined text-[15px]">edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteShift(shift.id)}
                              className="w-7 h-7 rounded-lg bg-surface-container hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-on-surface-variant transition-colors"
                            >
                              <span className="material-symbols-outlined text-[15px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DIVISION-WISE DUTY HOURS */}
        {dutySubTab === 'divisions' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-sm flex justify-between items-center">
              <div>
                <h4 className="font-headline text-base font-bold text-on-surface">Division-Wise Duty Hours Configuration</h4>
                <p className="text-xs text-on-surface-variant mt-1">
                  Set baseline duty hours for entire operational divisions (e.g. Factory vs Head Office). Employees in this division will inherit these hours unless overridden by department or employee profile.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {divNamesList.map(divName => {
                const divEmps = employees.filter(e => (e.division === divName || e.section === divName));
                const customHours = dutySettings.divisionDutyHours?.[divName];
                const effectiveHours = customHours || dutySettings.standardHours || 8;

                return (
                  <div key={divName} className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-sm flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-indigo-600 text-[22px]">apartment</span>
                          <h5 className="font-headline text-sm font-bold text-on-surface">{divName}</h5>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600">
                          {divEmps.length} Employees
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant mb-4">
                        {customHours ? `Custom division duty hours: ${customHours}h` : `Inheriting global standard (${dutySettings.standardHours || 8}h)`}
                      </p>

                      <div className="grid grid-cols-4 gap-1.5">
                        {[8, 9, 10, 12].map(hrs => (
                          <button
                            key={hrs}
                            type="button"
                            onClick={() => handleSetDivisionDutyHours(divName, hrs)}
                            className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                              effectiveHours === hrs
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                            }`}
                          >
                            {hrs}h
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-outline-variant/10 flex justify-between items-center text-xs">
                      {customHours ? (
                        <button
                          type="button"
                          onClick={() => handleResetDivisionDutyHours(divName)}
                          className="text-[11px] text-rose-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                          Revert to Standard ({dutySettings.standardHours || 8}h)
                        </button>
                      ) : (
                        <span className="text-[10px] text-on-surface-variant italic">Using Global Standard</span>
                      )}
                      <span className="font-mono font-bold text-indigo-600">{effectiveHours}h / Day</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: DEPARTMENT-WISE DUTY HOURS */}
        {dutySubTab === 'departments' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-sm flex justify-between items-center">
              <div>
                <h4 className="font-headline text-base font-bold text-on-surface">Department-Wise Duty Hours Configuration</h4>
                <p className="text-xs text-on-surface-variant mt-1">
                  Customize shift durations by department (e.g. Security: 12h, Weaving: 9h, Accounts: 8h). Takes precedence over division defaults.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {departments.map(dept => {
                const deptEmps = employees.filter(e => e.department === dept.name);
                const customHours = dutySettings.departmentDutyHours?.[dept.name];
                const divDefault = (dept.division && dutySettings.divisionDutyHours?.[dept.division]) || dutySettings.standardHours || 8;
                const effectiveHours = customHours || divDefault;

                return (
                  <div key={dept.id || dept.name} className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-sm flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-amber-600 text-[22px]">domain</span>
                          <h5 className="font-headline text-sm font-bold text-on-surface">{dept.name}</h5>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300">
                          {deptEmps.length} Employees
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant mb-4">
                        {customHours 
                          ? `Custom Department Rule: ${customHours}h / day`
                          : `Inheriting division/standard (${divDefault}h)`}
                      </p>

                      <div className="grid grid-cols-4 gap-1.5">
                        {[8, 9, 10, 12].map(hrs => (
                          <button
                            key={hrs}
                            type="button"
                            onClick={() => handleSetDepartmentDutyHours(dept.name, hrs)}
                            className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                              effectiveHours === hrs
                                ? 'bg-amber-600 text-white shadow-md'
                                : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                            }`}
                          >
                            {hrs}h
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-outline-variant/10 flex justify-between items-center text-xs">
                      {customHours ? (
                        <button
                          type="button"
                          onClick={() => handleResetDepartmentDutyHours(dept.name)}
                          className="text-[11px] text-rose-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                          Revert to Division Default ({divDefault}h)
                        </button>
                      ) : (
                        <span className="text-[10px] text-on-surface-variant italic">Defaulting to {divDefault}h</span>
                      )}
                      <span className="font-mono font-bold text-amber-600">{effectiveHours}h / Day</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: EMPLOYEE-WISE DUTY HOURS (EVERY EMPLOYEE CUSTOMIZABLE) */}
        {dutySubTab === 'employees' && (
          <div className="space-y-5 animate-fade-in">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/15 shadow-sm">
                <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Total Personnel</div>
                <div className="text-xl font-headline font-black text-on-surface mt-1">{employees.length} Employees</div>
                <div className="text-[10px] text-on-surface-variant mt-0.5">Active across all operational wings</div>
              </div>

              <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/15 shadow-sm">
                <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Custom Employee Duty Hours</div>
                <div className="text-xl font-headline font-black text-amber-600 mt-1">{customOverrideCount} Employees</div>
                <div className="text-[10px] text-on-surface-variant mt-0.5">Individually tailored duty hours</div>
              </div>

              <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/15 shadow-sm">
                <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Dept / Division Inherited</div>
                <div className="text-xl font-headline font-black text-indigo-600 mt-1">{employees.length - customOverrideCount} Employees</div>
                <div className="text-[10px] text-on-surface-variant mt-0.5">Automatically following group shift rules</div>
              </div>
            </div>

            {/* Filter and Action Bar */}
            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/15 shadow-sm space-y-3">
              <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  {/* Search */}
                  <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant text-[15px]">search</span>
                    <input
                      type="text"
                      value={empDutySearch}
                      onChange={(e) => setEmpDutySearch(e.target.value)}
                      placeholder="Search by name, code..."
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl pl-8 pr-3 py-1.5 text-xs text-on-surface outline-none focus:border-amber-500/50"
                    />
                  </div>

                  {/* Division Filter */}
                  <select
                    value={empDutyDivFilter}
                    onChange={(e) => setEmpDutyDivFilter(e.target.value)}
                    className="bg-surface-container-low border border-outline-variant/20 rounded-xl px-2.5 py-1.5 text-xs font-bold text-on-surface outline-none"
                  >
                    <option value="ALL">🏬 All Divisions</option>
                    {divNamesList.map(div => <option key={div} value={div}>{div}</option>)}
                  </select>

                  {/* Department Filter */}
                  <select
                    value={empDutyDeptFilter}
                    onChange={(e) => setEmpDutyDeptFilter(e.target.value)}
                    className="bg-surface-container-low border border-outline-variant/20 rounded-xl px-2.5 py-1.5 text-xs font-bold text-on-surface outline-none"
                  >
                    <option value="ALL">🏢 All Departments</option>
                    {deptNamesList.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                  </select>
                </div>

                {/* Batch Action Tool */}
                <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-outline-variant/10">
                  <span className="text-[11px] font-bold text-on-surface-variant">Batch Set:</span>
                  <select
                    value={batchDutyHours}
                    onChange={(e) => setBatchDutyHours(Number(e.target.value))}
                    className="bg-surface-container-low border border-outline-variant/20 rounded-xl px-2 py-1 text-xs font-mono font-bold text-on-surface outline-none"
                  >
                    <option value={8}>8 Hours</option>
                    <option value={9}>9 Hours</option>
                    <option value={10}>10 Hours</option>
                    <option value={12}>12 Hours</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleBatchApplyDutyHours(filteredEmpDutyList, batchDutyHours)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">done_all</span>
                    Apply to Filtered ({filteredEmpDutyList.length})
                  </button>
                </div>
              </div>

              {/* Alphabet A-Z bar */}
              <div className="flex items-center gap-1 overflow-x-auto py-1 custom-scrollbar">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mr-1 shrink-0">A-Z:</span>
                {ALPHABET_KEYS.map(letter => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setEmpDutyAlphaFilter(letter)}
                    className={`h-6 min-w-[26px] px-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                      empDutyAlphaFilter === letter
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>

            {/* Personnel Duty Hours Table */}
            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/15 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-surface-container-low/50 text-[10px] uppercase font-bold text-on-surface-variant border-b border-outline-variant/10">
                    <tr>
                      <th className="px-6 py-3.5">Emp Code</th>
                      <th className="px-6 py-3.5">Personnel Name</th>
                      <th className="px-6 py-3.5">Division & Department</th>
                      <th className="px-6 py-3.5">Effective Duty Rule</th>
                      <th className="px-6 py-3.5 text-center">Duty Hours</th>
                      <th className="px-6 py-3.5 text-right">Customize Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 font-medium">
                    {filteredEmpDutyList.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-12 text-on-surface-variant">
                          No personnel found matching the current search / filters.
                        </td>
                      </tr>
                    ) : (
                      filteredEmpDutyList.map(emp => {
                        const eff = getEmpEffectiveDutyHours(emp);
                        const isCustom = eff.type === 'custom';

                        return (
                          <tr key={emp.id} className="hover:bg-surface-container-low/30 transition-colors">
                            <td className="px-6 py-4 font-mono font-bold text-secondary text-[11px]">{emp.id}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-[10px]">
                                  {(emp.name || 'E').substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-on-surface">{emp.name}</div>
                                  <div className="text-[10px] text-on-surface-variant">{emp.designation || 'Staff'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-xs font-bold text-on-surface">{emp.department || 'General'}</div>
                              <div className="text-[10px] text-on-surface-variant">{emp.division || emp.section || 'AJ Synthetic'}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                isCustom
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                  : 'bg-surface-container text-on-surface-variant border-outline-variant/15'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isCustom ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
                                {eff.source}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`font-mono text-sm font-black px-2.5 py-1 rounded-xl ${
                                isCustom ? 'bg-amber-600 text-white shadow-xs' : 'bg-surface-container text-on-surface'
                              }`}>
                                {eff.hours} Hours
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {[8, 9, 10, 12].map(hrs => (
                                  <button
                                    key={hrs}
                                    type="button"
                                    onClick={() => handleSetEmployeeDutyHours(emp, hrs)}
                                    className={`h-7 px-2.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                      eff.hours === hrs
                                        ? 'bg-amber-600 text-white shadow-xs'
                                        : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                                    }`}
                                    title={`Set ${hrs}h for ${emp.name}`}
                                  >
                                    {hrs}h
                                  </button>
                                ))}
                                {isCustom && (
                                  <button
                                    type="button"
                                    onClick={() => handleResetEmployeeDutyHours(emp)}
                                    className="h-7 px-2 rounded-lg bg-surface-container hover:bg-rose-500/10 hover:text-rose-600 text-on-surface-variant text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                                    title="Reset to Department/Division Default"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                                    Reset
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderMobileDutyHours() {
    const ALPHABET_KEYS = ['ALL', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    const divNamesList = Array.from(new Set([
      ...divisions.map(d => d.name),
      ...employees.map(e => e.division || e.section).filter(Boolean)
    ])).sort();

    return (
      <div className="flex flex-col gap-5 pb-20 animate-fade-in select-none">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveCategory('departments')}
              className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <div>
              <h2 className="font-headline text-lg font-black text-on-surface leading-tight">Duty Hours & Shifts</h2>
              <p className="text-[10px] text-on-surface-variant">Customizable Shift Timings</p>
            </div>
          </div>
          <button
            onClick={handleOpenAddShift}
            className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-bold"
          >
            + Add Shift
          </button>
        </header>

        {/* Mobile Sub-Tab Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          <button
            type="button"
            onClick={() => setDutySubTab('global')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 ${dutySubTab === 'global' ? 'bg-amber-600 text-white shadow-xs' : 'bg-surface-container-lowest text-on-surface-variant'}`}
          >
            Global Rules
          </button>
          <button
            type="button"
            onClick={() => setDutySubTab('divisions')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 ${dutySubTab === 'divisions' ? 'bg-amber-600 text-white shadow-xs' : 'bg-surface-container-lowest text-on-surface-variant'}`}
          >
            Divisions
          </button>
          <button
            type="button"
            onClick={() => setDutySubTab('departments')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 ${dutySubTab === 'departments' ? 'bg-amber-600 text-white shadow-xs' : 'bg-surface-container-lowest text-on-surface-variant'}`}
          >
            Departments
          </button>
          <button
            type="button"
            onClick={() => setDutySubTab('employees')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 ${dutySubTab === 'employees' ? 'bg-amber-600 text-white shadow-xs' : 'bg-surface-container-lowest text-on-surface-variant'}`}
          >
            Employees
          </button>
        </div>

        {/* Global tab in Mobile */}
        {dutySubTab === 'global' && (
          <div className="space-y-4">
            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/15 flex flex-col gap-3">
              <span className="text-xs font-bold text-on-surface">Standard Working Hours</span>
              <div className="grid grid-cols-4 gap-2">
                {[8, 9, 10, 12].map(hrs => (
                  <button
                    key={hrs}
                    onClick={() => saveDutySettings({ ...dutySettings, standardHours: hrs })}
                    className={`py-2 rounded-xl text-xs font-black transition-all ${
                      dutySettings.standardHours === hrs ? 'bg-amber-600 text-white' : 'bg-surface-container text-on-surface'
                    }`}
                  >
                    {hrs}h
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/15 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-on-surface">Overtime Calculation</span>
                <span className="text-[10px] font-bold text-primary font-mono">(Basic ÷ Days) ÷ Duty</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[1.0, 1.25, 1.5, 2.0].map(mult => (
                  <button
                    key={mult}
                    type="button"
                    onClick={() => saveDutySettings({
                      ...dutySettings,
                      overtimeCalculation: { ...(dutySettings.overtimeCalculation || {}), rateMultiplier: mult }
                    })}
                    className={`py-1.5 rounded-lg text-[11px] font-black transition-all ${
                      Number(dutySettings.overtimeCalculation?.rateMultiplier || 1.5) === mult
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-surface-container text-on-surface'
                    }`}
                  >
                    {mult}x
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {(dutySettings.shifts || []).map(shift => (
                <div key={shift.id} className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/15 flex justify-between items-center shadow-sm">
                  <div>
                    <h4 className="font-headline font-black text-sm text-on-surface">{shift.name}</h4>
                    <p className="text-xs font-mono text-on-surface-variant mt-0.5">{shift.startTime} - {shift.endTime} ({shift.hours}h)</p>
                  </div>
                  <button
                    onClick={() => handleOpenEditShift(shift)}
                    className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Divisions in Mobile */}
        {dutySubTab === 'divisions' && (
          <div className="space-y-3">
            {divNamesList.map(divName => {
              const currentH = dutySettings.divisionDutyHours?.[divName] || dutySettings.standardHours || 8;
              return (
                <div key={divName} className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/15 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-on-surface">{divName}</span>
                    <span className="font-mono font-bold text-indigo-600 text-xs">{currentH}h / day</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[8, 9, 10, 12].map(hrs => (
                      <button
                        key={hrs}
                        type="button"
                        onClick={() => handleSetDivisionDutyHours(divName, hrs)}
                        className={`py-1.5 rounded-xl text-xs font-black ${currentH === hrs ? 'bg-indigo-600 text-white' : 'bg-surface-container text-on-surface'}`}
                      >
                        {hrs}h
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Departments in Mobile */}
        {dutySubTab === 'departments' && (
          <div className="space-y-3">
            {departments.map(dept => {
              const currentH = dutySettings.departmentDutyHours?.[dept.name] || dutySettings.standardHours || 8;
              return (
                <div key={dept.name} className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/15 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-on-surface">{dept.name}</span>
                    <span className="font-mono font-bold text-amber-600 text-xs">{currentH}h / day</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[8, 9, 10, 12].map(hrs => (
                      <button
                        key={hrs}
                        type="button"
                        onClick={() => handleSetDepartmentDutyHours(dept.name, hrs)}
                        className={`py-1.5 rounded-xl text-xs font-black ${currentH === hrs ? 'bg-amber-600 text-white' : 'bg-surface-container text-on-surface'}`}
                      >
                        {hrs}h
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Employees in Mobile */}
        {dutySubTab === 'employees' && (
          <div className="space-y-3">
            <input
              type="text"
              value={empDutySearch}
              onChange={(e) => setEmpDutySearch(e.target.value)}
              placeholder="Search personnel..."
              className="w-full bg-surface-container-lowest border border-outline-variant/15 rounded-xl py-2 px-3 text-xs text-on-surface outline-none"
            />
            {employees.filter(e => !empDutySearch || e.name?.toLowerCase().includes(empDutySearch.toLowerCase())).slice(0, 30).map(emp => {
              const eff = getEmpEffectiveDutyHours(emp);
              return (
                <div key={emp.id} className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/15 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-xs text-on-surface">{emp.name}</div>
                      <div className="text-[10px] text-on-surface-variant font-mono">{emp.id} • {emp.department || 'General'}</div>
                    </div>
                    <span className="font-mono font-black text-amber-600 text-xs">{eff.hours}h</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[8, 9, 10, 12].map(hrs => (
                      <button
                        key={hrs}
                        type="button"
                        onClick={() => handleSetEmployeeDutyHours(emp.id, hrs)}
                        className={`py-1 rounded-lg text-[10px] font-black ${eff.hours === hrs ? 'bg-amber-600 text-white' : 'bg-surface-container text-on-surface'}`}
                      >
                        {hrs}h
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
function renderFormModal() {
    // Helper to render custom multi-select selector with search
    function EmployeeMultiSelect({ label, selectedIds, onChange, placeholder }) {
      const [isOpen, setIsOpen] = useState(false);
      const [search, setSearch] = useState('');
      
      const filtered = employees.filter(emp => 
        emp.name.toLowerCase().includes(search.toLowerCase()) ||
        emp.id.toLowerCase().includes(search.toLowerCase())
      );
      
      const toggleSelect = (id) => {
        if (selectedIds.includes(id)) {
          onChange(selectedIds.filter(x => x !== id));
        } else {
          onChange([...selectedIds, id]);
        }
      };

      return (
        <div className="flex flex-col gap-1.5 w-full relative">
          <label className="text-[10px] font-bold uppercase tracking-wider text-primary">{label}</label>
          <div 
            onClick={() => setIsOpen(!isOpen)}
            className="min-h-[44px] bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 flex flex-wrap gap-1.5 items-center cursor-pointer hover:bg-surface-container-lowest transition-colors"
          >
            {selectedIds.length === 0 ? (
              <span className="text-xs text-outline/65 font-medium">{placeholder || 'Select personnel...'}</span>
            ) : (
              selectedIds.map(id => {
                const emp = employees.find(e => e.id === id);
                return (
                  <span key={id} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-lg border border-primary/20">
                    {emp ? emp.name : id}
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(id);
                      }}
                      className="material-symbols-outlined text-[12px] hover:text-error transition-colors"
                    >
                      close
                    </span>
                  </span>
                );
              })
            )}
          </div>
          
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-outline-variant/30 rounded-xl shadow-xl z-50 p-3 max-h-52 overflow-y-auto flex flex-col gap-2 animate-in fade-in duration-100">
              <input 
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Search employees..."
                className="w-full bg-slate-50 border border-outline-variant/15 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary/50 text-on-surface"
              />
              <div className="flex flex-col gap-0.5 overflow-y-auto custom-scrollbar">
                {filtered.length === 0 ? (
                  <span className="text-[10px] text-slate-400 p-2 text-center">No employee found</span>
                ) : (
                  filtered.map(emp => {
                    const isChecked = selectedIds.includes(emp.id);
                    return (
                      <div 
                        key={emp.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(emp.id);
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors ${
                          isChecked ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 text-left">
                          <img src={emp.avatar} className="w-6 h-6 rounded-full object-cover border" alt="" />
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-on-surface">{emp.name}</span>
                            <span className="text-[9px] font-semibold text-primary">{emp.id} • {emp.designation || emp.role}</span>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-[16px] text-primary">
                          {isChecked ? 'check_box' : 'check_box_outline_blank'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Designation options configured in System
    const availableDesignations = designations.length > 0 ? designations : ['Associate', 'Supervisor', 'Manager', 'Senior Engineer', 'Director', 'Quality Inspector', 'Line Operator', 'Helper', 'Worker'];

    const updateEmployeeDesignationDirectly = (empId, nextDesig) => {
      const updated = employees.map(emp => {
        if (emp.id === empId) {
          return { ...emp, designation: nextDesig, role: nextDesig };
        }
        return emp;
      });
      setCollection('hr_employees_list', updated);
      localStorage.setItem('hr_employees_list', JSON.stringify(updated));
    };

    // Calculate all unique selected employee IDs in this department to edit designations
    const allSelectedIds = Array.from(new Set([
      ...(activeDept.managers || []),
      ...(activeDept.operators || []),
      ...(activeDept.incharges || []),
      ...(activeDept.sections || []).flatMap(s => [
        ...(s.incharges || []),
        ...(s.employees || [])
      ])
    ]));

    // Section handler utilities
    const handleAddSection = () => {
      const nextSecId = `SEC-${Date.now()}`;
      const newSec = {
        id: nextSecId,
        name: '',
        incharges: [],
        employees: []
      };
      setActiveDept(prev => ({
        ...prev,
        sections: [...(prev.sections || []), newSec]
      }));
    };

    const handleRemoveSection = (secId) => {
      setActiveDept(prev => ({
        ...prev,
        sections: prev.sections.filter(s => s.id !== secId)
      }));
    };

    const handleSectionChange = (secId, key, val) => {
      setActiveDept(prev => ({
        ...prev,
        sections: prev.sections.map(s => s.id === secId ? { ...s, [key]: val } : s)
      }));
    };

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-surface-container-lowest rounded-3xl p-6 w-full max-w-4xl border border-outline-variant/20 shadow-2xl relative animate-scale-up text-on-surface max-h-[90vh] flex flex-col overflow-hidden">
          
          <header className="flex justify-between items-center mb-5 shrink-0 border-b border-outline-variant/15 pb-4">
            <div>
              <h3 className="font-headline font-black text-lg text-on-surface">
                {modalMode === 'add' ? 'Redesign Department Config' : 'Edit Department Config'}
              </h3>
              <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Configure divisions, hierarchy structures, multi-sections, and employee roles.</p>
            </div>
            <button 
              onClick={() => setShowModal(false)}
              className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </header>

          <form onSubmit={handleSaveDept} className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar pb-4">
            
            {/* Row 1: General Specs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Department Name</label>
                <input 
                  type="text"
                  required
                  value={activeDept.name}
                  onChange={(e) => setActiveDept({...activeDept, name: e.target.value})}
                  placeholder="e.g. Mixing Division, Quality Control"
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-xs text-on-surface focus:bg-surface-container-lowest focus:border-primary/50 focus:ring-0 outline-none transition-all placeholder:text-outline/60 font-bold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Tagline / Mission</label>
                <input 
                  type="text"
                  value={activeDept.tagline}
                  onChange={(e) => setActiveDept({...activeDept, tagline: e.target.value})}
                  placeholder="e.g. Core polymer foam Mixing unit"
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-xs text-on-surface focus:bg-surface-container-lowest focus:border-primary/50 focus:ring-0 outline-none transition-all placeholder:text-outline/60"
                />
              </div>
            </div>

            {/* Row 2: Department-Level Roles Configuration */}
            <div className="bg-surface-container-low/40 p-4 rounded-2xl border border-outline-variant/10 space-y-4">
              <h4 className="text-xs font-black text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[18px]">badge</span>
                Department-Level Personnel (Multiple Selection)
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <EmployeeMultiSelect 
                  label="Managers"
                  selectedIds={activeDept.managers || []}
                  onChange={(val) => setActiveDept({ ...activeDept, managers: val })}
                  placeholder="Select Managers..."
                />
                
                <EmployeeMultiSelect 
                  label="Incharges"
                  selectedIds={activeDept.incharges || []}
                  onChange={(val) => setActiveDept({ ...activeDept, incharges: val })}
                  placeholder="Select Incharges..."
                />

                <EmployeeMultiSelect 
                  label="Operators"
                  selectedIds={activeDept.operators || []}
                  onChange={(val) => setActiveDept({ ...activeDept, operators: val })}
                  placeholder="Select Operators..."
                />
              </div>
            </div>

            {/* Row 3: Multi Section Management */}
            <div className="bg-surface-container-low/40 p-4 rounded-2xl border border-outline-variant/10 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-black text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[18px]">account_tree</span>
                  Multi Section Configuration
                </h4>
                <button 
                  type="button"
                  onClick={handleAddSection}
                  className="px-3.5 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-bold rounded-lg border border-primary/20 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">add</span>
                  Add Section
                </button>
              </div>

              <div className="space-y-4">
                {(activeDept.sections || []).length === 0 ? (
                  <p className="text-[10px] text-slate-400 text-center py-4 italic">No sections defined yet. Click "Add Section" to create one.</p>
                ) : (
                  activeDept.sections.map((sec, sIdx) => (
                    <div key={sec.id} className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/15 flex flex-col gap-3 relative animate-in fade-in duration-150">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 flex-1 max-w-sm">
                          <span className="text-xs font-bold text-primary font-mono shrink-0">#{sIdx + 1}</span>
                          <input 
                            type="text"
                            required
                            value={sec.name}
                            onChange={(e) => handleSectionChange(sec.id, 'name', e.target.value)}
                            placeholder="Section Name (e.g. Mixing Lab, QA Team)"
                            className="bg-transparent border-b border-outline-variant/30 text-xs font-bold text-on-surface py-0.5 focus:border-primary outline-none flex-1"
                          />
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleRemoveSection(sec.id)}
                          className="w-7 h-7 rounded-lg hover:bg-error-container/20 text-slate-400 hover:text-error flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <EmployeeMultiSelect 
                          label="Section Incharges"
                          selectedIds={sec.incharges || []}
                          onChange={(val) => handleSectionChange(sec.id, 'incharges', val)}
                          placeholder="Select Incharges..."
                        />
                        <EmployeeMultiSelect 
                          label="Section Employees"
                          selectedIds={sec.employees || []}
                          onChange={(val) => handleSectionChange(sec.id, 'employees', val)}
                          placeholder="Select Employees..."
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Row 4: Real-time Designation Finalizer */}
            {allSelectedIds.length > 0 && (
              <div className="bg-surface-container-low/40 p-4 rounded-2xl border border-outline-variant/10 space-y-4">
                <h4 className="text-xs font-black text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
                  Designation Finalization Panel
                </h4>
                <p className="text-[10px] text-on-surface-variant leading-relaxed">
                  Changing designations below will **immediately lock** and update that employee's final system profile designation.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  {allSelectedIds.map(empId => {
                    const emp = employees.find(e => e.id === empId);
                    if (!emp) return null;

                    return (
                      <div key={empId} className="flex items-center justify-between p-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
                        <div className="flex items-center gap-2">
                          <img src={emp.avatar} className="w-8 h-8 rounded-full object-cover border border-outline-variant/15 shadow-sm" alt="" />
                          <div className="flex flex-col text-left">
                            <span className="text-xs font-bold text-on-surface">{emp.name}</span>
                            <span className="text-[9px] font-mono text-outline font-bold">{emp.id}</span>
                          </div>
                        </div>

                        <select
                          value={emp.designation || 'Worker'}
                          onChange={(e) => updateEmployeeDesignationDirectly(empId, e.target.value)}
                          className="bg-surface-container-low border border-outline-variant/30 rounded-lg text-[10px] font-bold text-on-surface py-1.5 px-2 outline-none cursor-pointer focus:ring-1 focus:ring-primary/20 shrink-0 max-w-[140px]"
                        >
                          {availableDesignations.map((d, dIdx) => (
                            <option key={dIdx} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </form>

          <footer className="flex justify-end gap-3 pt-4 border-t border-outline-variant/15 shrink-0 mt-2">
            <button 
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 border border-outline-variant/30 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all active:scale-[0.97] cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={() => handleSaveDept()}
              className="px-6 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-xl text-xs font-bold transition-all hover:shadow-md active:scale-[0.97] cursor-pointer"
            >
              {modalMode === 'add' ? 'Create Division' : 'Save Changes'}
            </button>
          </footer>
        </div>
      </div>
    );
  }

  function renderDeleteConfirmModal() {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-surface-container-lowest rounded-3xl p-6 w-full max-w-sm border border-outline-variant/20 shadow-2xl relative animate-scale-up text-on-surface select-none">
          <h3 className="font-headline font-black text-md text-on-surface mb-2">Delete Department</h3>
          <p className="font-body text-xs text-on-surface-variant mb-6">
            Are you sure you want to delete the <span className="font-bold text-on-surface">{deleteConfirm.deptName}</span> department? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button 
              type="button"
              onClick={() => setDeleteConfirm({ show: false, deptId: null, deptName: '' })}
              className="px-4 py-2 border border-outline-variant/20 rounded-xl text-xs font-bold text-on-surface hover:bg-surface-container transition-all active:scale-[0.97] cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={() => {
                setDepartments(prev => prev.filter(d => d.id !== deleteConfirm.deptId));
                setDeleteConfirm({ show: false, deptId: null, deptName: '' });
              }}
              className="px-5 py-2 bg-error text-white hover:bg-error/90 rounded-xl text-xs font-bold transition-all active:scale-[0.97] cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  }
}
