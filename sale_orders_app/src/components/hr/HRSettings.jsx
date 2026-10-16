import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import PayrollAccountMapping from './PayrollAccountMapping';
import SalaryAllowanceConfig from './SalaryAllowanceConfig';

export default function HRSettings({ isMobile }) {
  const { state, setCollection } = useApp();
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
      
      // 1. Remove departments from hrDepts that no longer exist in globalDepts (skip hrOnly departments like AAA)
      const initialLength = hrDepts.length;
      hrDepts = hrDepts.filter(hrD => 
        hrD.hrOnly || globalDepts.some(gD => gD.id === hrD.id || (gD.name || gD.label) === hrD.name)
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
          if (!hrDepts[existingIdx].division) {
            hrDepts[existingIdx].division = hrDepts[existingIdx].name === 'AAA' ? 'AAA' : 'AJ Synthetic';
            hasChanges = true;
          }
        } else {
          hrDepts.push({
            id: gD.id,
            name: gName,
            division: 'AJ Synthetic',
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

      // 3. Ensure AAA department exists under AAA division with hrOnly: true
      const hasAAA = hrDepts.some(d => d.name === 'AAA');
      if (!hasAAA) {
        hrDepts.push({
          id: 'dept_aaa',
          name: 'AAA',
          division: 'AAA',
          tagline: 'AAA Division',
          hrOnly: true,
          managers: [],
          operators: [],
          incharges: [],
          sections: [],
          subSections: []
        });
        hasChanges = true;
      } else {
        const aaaIdx = hrDepts.findIndex(d => d.name === 'AAA');
        if (aaaIdx > -1 && (!hrDepts[aaaIdx].hrOnly || hrDepts[aaaIdx].division !== 'AAA')) {
          hrDepts[aaaIdx] = { ...hrDepts[aaaIdx], hrOnly: true, division: 'AAA' };
          hasChanges = true;
        }
      }

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
    division: 'AJ Synthetic',
    hrOnly: false,
    managers: [], // Array of employee IDs
    operators: [], // Array of employee IDs
    incharges: [], // Array of employee IDs
    sections: [] // Array of section objects: { id, name, incharges: [], employees: [] }
  });

  const employees = state?.hr_employees_list || [];
  const divisions = state?.hr_divisions || [
    { id: 'div_aj_synthetic', name: 'AJ Synthetic', code: 'AJS', description: 'AJ Synthetic Leather & footware Industries Pvt. Limited' },
    { id: 'div_aaa', name: 'AAA', code: 'AAA', description: 'AAA Division' }
  ];

  // Division filter for departments view
  const [selectedDivisionFilter, setSelectedDivisionFilter] = useState('ALL');

  // Duty Hours & Shifts state
  const [dutyHoursSearch, setDutyHoursSearch] = useState('');
  const [dutyHoursDivisionFilter, setDutyHoursDivisionFilter] = useState('ALL');
  const [dutyHoursDeptFilter, setDutyHoursDeptFilter] = useState('ALL');
  const [editingDutyHoursId, setEditingDutyHoursId] = useState(null);
  const [dutyHoursVal, setDutyHoursVal] = useState(8);
  const [dutyShiftVal, setDutyShiftVal] = useState('GENERAL SHIFT');
  const [dutySuccessToast, setDutySuccessToast] = useState('');

  // Category list with Divisions above Department
  const categories = [
    { id: 'divisions', label: 'Divisions', icon: 'corporate_fare' },
    { id: 'departments', label: 'Departments', icon: 'domain' },
    { id: 'duty_hours', label: 'Duty Hours & Shifts', icon: 'schedule' },
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
      division: 'AJ Synthetic',
      hrOnly: false,
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
      division: dept.division || (dept.name === 'AAA' ? 'AAA' : 'AJ Synthetic'),
      hrOnly: dept.hrOnly || false,
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

    const divName = activeDept.division || (activeDept.name === 'AAA' ? 'AAA' : 'AJ Synthetic');
    const isHrOnly = divName === 'AAA' || activeDept.name === 'AAA' || !!activeDept.hrOnly;

    const payload = {
      id: activeDept.id || newId,
      name: activeDept.name,
      division: divName,
      hrOnly: isHrOnly,
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
  const filteredDepts = departments.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.tagline && d.tagline.toLowerCase().includes(searchQuery.toLowerCase()));
    const divOfDept = d.division || (d.name === 'AAA' ? 'AAA' : 'AJ Synthetic');
    const matchesDiv = selectedDivisionFilter === 'ALL' || divOfDept === selectedDivisionFilter;
    return matchesSearch && matchesDiv;
  });

  const handleSaveDutyHours = (empId, newHours, newShift) => {
    const updatedEmployees = employees.map(emp => {
      const match = emp.id === empId || (emp.sheetId && emp.sheetId === empId);
      if (match) {
        return {
          ...emp,
          dutyHours: Number(newHours) || 8,
          shift: newShift || emp.shift || 'GENERAL SHIFT'
        };
      }
      return emp;
    });
    setCollection('hr_employees_list', updatedEmployees);
    try {
      localStorage.setItem('hr_employees_list', JSON.stringify(updatedEmployees));
    } catch (e) {}
    setDutySuccessToast(`Saved duty hours config (${newHours}h / ${newShift})`);
    setTimeout(() => setDutySuccessToast(''), 3000);
    setEditingDutyHoursId(null);
  };

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
              {/* Divisions App-Style Card */}
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
                    <span className="material-symbols-outlined text-[32px] icon-fill">corporate_fare</span>
                  </div>
                  <span className="material-symbols-outlined text-outline-variant group-hover:text-indigo-600 transition-colors text-[20px] font-bold">arrow_forward</span>
                </div>
                
                <div className="mt-6 relative z-10">
                  <h3 className="font-headline text-md font-black text-on-surface leading-tight group-hover:text-indigo-600 transition-colors">Divisions</h3>
                  <p className="font-body text-[11px] text-on-surface-variant mt-1.5 font-medium leading-relaxed">
                    Corporate & entity structure: AJ Synthetic & AAA divisions for payroll segmentation.
                  </p>
                </div>
                
                <div className="mt-4 pt-4 border-t border-outline-variant/10 flex items-center justify-between relative z-10 text-[10px] uppercase tracking-wider font-bold">
                  <span className="text-indigo-600 font-body">2 Divisions Configured</span>
                  <span className="text-on-surface-variant font-body">HR-Scoped</span>
                </div>
              </div>

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
                  <span className="text-primary font-body">{departments.length} Departments</span>
                  <span className="text-on-surface-variant font-body">{employees.length} Headcount</span>
                </div>
              </div>

              {/* Duty Hours & Shifts App-Style Card */}
              <div 
                onClick={() => {
                  setActiveCategory('duty_hours');
                  setViewMode('departments');
                }}
                className="group relative bg-gradient-to-br from-surface-container-lowest via-surface-container-lowest to-emerald-500/5 border border-outline-variant/15 hover:border-emerald-500/30 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer flex flex-col justify-between min-h-[190px] overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-all duration-300 animate-pulse"></div>
                
                <div className="flex items-start justify-between relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <span className="material-symbols-outlined text-[32px] icon-fill">schedule</span>
                  </div>
                  <span className="material-symbols-outlined text-outline-variant group-hover:text-emerald-600 transition-colors text-[20px] font-bold">arrow_forward</span>
                </div>
                
                <div className="mt-6 relative z-10">
                  <h3 className="font-headline text-md font-black text-on-surface leading-tight group-hover:text-emerald-600 transition-colors">Duty Hours & Shifts</h3>
                  <p className="font-body text-[11px] text-on-surface-variant mt-1.5 font-medium leading-relaxed">
                    Per-employee shift hours (8h standard, 240h monthly divisor) and shift schedules.
                  </p>
                </div>
                
                <div className="mt-4 pt-4 border-t border-outline-variant/10 flex items-center justify-between relative z-10 text-[10px] uppercase tracking-wider font-bold">
                  <span className="text-emerald-600 font-body">Hourly = Basic / 240</span>
                  <span className="text-on-surface-variant font-body">Configurable</span>
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
                      {filteredDepts.length} Active
                    </span>
                  )}
                  {activeCategory === 'divisions' && (
                    <span className="px-2.5 py-0.5 bg-indigo-500/15 text-indigo-600 text-[10px] font-bold rounded-full">
                      {divisions.length} Divisions
                    </span>
                  )}
                  {activeCategory === 'duty_hours' && (
                    <span className="px-2.5 py-0.5 bg-emerald-500/15 text-emerald-600 text-[10px] font-bold rounded-full">
                      {employees.length} Employees
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
                      placeholder="Search departments..."
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl pl-9 pr-4 py-1.5 text-xs text-on-surface focus:bg-surface-container-lowest focus:border-primary/50 focus:ring-0 transition-all placeholder:text-outline/75"
                    />
                  </div>
                )}
              </div>
            </header>

            {/* Canvas Scroll Area */}
            <div className={`flex-1 flex flex-col h-full min-h-0 overflow-y-auto ${activeCategory === 'payroll_mapping' ? 'p-4' : 'p-8'} custom-scrollbar w-full`}>
              {activeCategory === 'divisions' && renderDesktopDivisions()}
              {activeCategory === 'departments' && renderDesktopDepartments()}
              {activeCategory === 'duty_hours' && renderDesktopDutyHours()}
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

        {/* Deletion Confirm Modal */}
        {deleteConfirm.show && renderDeleteConfirmModal()}
      </div>
    );
  }

  // ==========================================
  // DESKTOP CATEGORY RENDERERS
  // ==========================================
  
  function renderDesktopDivisions() {
    const ajEmployees = employees.filter(e => (e.division || 'AJ Synthetic').toLowerCase().includes('aj') || !e.division);
    const aaaEmployees = employees.filter(e => (e.division || '').toUpperCase() === 'AAA');
    const ajDepts = departments.filter(d => (d.division || (d.name === 'AAA' ? 'AAA' : 'AJ Synthetic')) === 'AJ Synthetic');
    const aaaDepts = departments.filter(d => (d.division || (d.name === 'AAA' ? 'AAA' : 'AJ Synthetic')) === 'AAA');

    return (
      <div className="flex flex-col gap-6 animate-fade-in pb-8">
        {/* Banner Notice */}
        <div className="p-5 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[22px]">corporate_fare</span>
          </div>
          <div className="flex-1">
            <h3 className="font-headline text-sm font-bold text-on-surface">HR Enterprise Divisions</h3>
            <p className="font-body text-xs text-on-surface-variant mt-1 leading-relaxed">
              Divisions sit above departments as the primary organizational & payroll boundary. 
              The two designated divisions are <strong className="text-on-surface">AJ Synthetic</strong> (encompassing primary manufacturing departments) and <strong className="text-on-surface">AAA</strong> (HR-scoped standalone unit). 
              Divisions are strictly HR/payroll scoped and preserve global manufacturing pipeline integrity.
            </p>
          </div>
        </div>

        {/* Division Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: AJ Synthetic */}
          <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/15 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-primary-fixed"></div>
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-lg">
                    AJS
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-headline text-lg font-black text-on-surface">AJ Synthetic</h2>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-primary-fixed/30 text-primary">Primary</span>
                    </div>
                    <p className="font-body text-xs text-on-surface-variant">AJ Synthetic Leather & Footwear Industries Pvt. Limited</p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 my-4 p-3 bg-surface-container-low rounded-2xl border border-outline-variant/10 text-center">
                <div>
                  <span className="font-body text-[9px] text-on-surface-variant uppercase font-bold block">Headcount</span>
                  <span className="font-headline text-base font-black text-primary mt-0.5">{ajEmployees.length}</span>
                </div>
                <div>
                  <span className="font-body text-[9px] text-on-surface-variant uppercase font-bold block">Departments</span>
                  <span className="font-headline text-base font-black text-on-surface mt-0.5">{ajDepts.length}</span>
                </div>
                <div>
                  <span className="font-body text-[9px] text-on-surface-variant uppercase font-bold block">Active Roster</span>
                  <span className="font-headline text-base font-black text-emerald-600 mt-0.5">
                    {ajEmployees.filter(e => (e.status || '').toUpperCase() === 'ACTIVE').length}
                  </span>
                </div>
              </div>

              {/* Sub-departments listing */}
              <div className="mb-4">
                <span className="font-body text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block mb-2">Attached Departments:</span>
                <div className="flex flex-wrap gap-2">
                  {ajDepts.map(d => (
                    <span key={d.id} className="px-2.5 py-1 bg-surface-container rounded-lg text-xs font-semibold text-on-surface border border-outline-variant/10">
                      {d.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-outline-variant/10 flex justify-end">
              <button
                onClick={() => {
                  setSelectedDivisionFilter('AJ Synthetic');
                  setActiveCategory('departments');
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                <span>Manage AJ Synthetic Departments</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>

          {/* Card 2: AAA */}
          <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/15 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-secondary to-secondary-fixed"></div>
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center font-black text-lg">
                    AAA
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-headline text-lg font-black text-on-surface">AAA</h2>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-secondary-fixed/30 text-secondary">Division</span>
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">HR Scoped</span>
                    </div>
                    <p className="font-body text-xs text-on-surface-variant">AAA Division Operations & Staff</p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 my-4 p-3 bg-surface-container-low rounded-2xl border border-outline-variant/10 text-center">
                <div>
                  <span className="font-body text-[9px] text-on-surface-variant uppercase font-bold block">Headcount</span>
                  <span className="font-headline text-base font-black text-secondary mt-0.5">{aaaEmployees.length}</span>
                </div>
                <div>
                  <span className="font-body text-[9px] text-on-surface-variant uppercase font-bold block">Departments</span>
                  <span className="font-headline text-base font-black text-on-surface mt-0.5">{aaaDepts.length}</span>
                </div>
                <div>
                  <span className="font-body text-[9px] text-on-surface-variant uppercase font-bold block">Active Roster</span>
                  <span className="font-headline text-base font-black text-emerald-600 mt-0.5">
                    {aaaEmployees.filter(e => (e.status || '').toUpperCase() === 'ACTIVE').length}
                  </span>
                </div>
              </div>

              {/* Sub-departments listing */}
              <div className="mb-4">
                <span className="font-body text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block mb-2">Attached Departments:</span>
                <div className="flex flex-wrap gap-2">
                  {aaaDepts.map(d => (
                    <span key={d.id} className="px-2.5 py-1 bg-surface-container rounded-lg text-xs font-semibold text-on-surface border border-outline-variant/10 flex items-center gap-1.5">
                      {d.name}
                      <span className="text-[9px] text-amber-600 font-bold">(hrOnly)</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-outline-variant/10 flex justify-end">
              <button
                onClick={() => {
                  setSelectedDivisionFilter('AAA');
                  setActiveCategory('departments');
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                <span>Manage AAA Departments</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderDesktopDepartments() {
    return (
      <div className="flex flex-col gap-6 animate-fade-in pb-8">
        {/* Division Filter Bar & Add Department Button */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mr-2">Filter Division:</span>
            {['ALL', 'AJ Synthetic', 'AAA'].map(divKey => (
              <button
                key={divKey}
                onClick={() => setSelectedDivisionFilter(divKey)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedDivisionFilter === divKey
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {divKey === 'ALL' ? 'All Divisions' : divKey}
              </button>
            ))}
          </div>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl font-bold text-xs shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add Department
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredDepts.length === 0 ? (
            <div className="col-span-full text-center py-12 text-on-surface-variant font-body text-sm bg-surface-container-lowest rounded-2xl border border-outline-variant/10">
              No departments found matching your search and division filter.
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
              const deptDiv = dept.division || (dept.name === 'AAA' ? 'AAA' : 'AJ Synthetic');

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
                        <div className="flex items-center gap-2">
                          <h3 className="font-headline text-sm font-bold text-on-surface leading-tight">{dept.name}</h3>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${
                            deptDiv === 'AAA'
                              ? 'bg-secondary/15 text-secondary border border-secondary/20'
                              : 'bg-primary/15 text-primary border border-primary/20'
                          }`}>
                            {deptDiv}
                          </span>
                          {dept.hrOnly && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                              HR-Only
                            </span>
                          )}
                        </div>
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
      </div>
    );
  }

  function renderDesktopDutyHours() {
    const filteredEmployees = employees.filter(emp => {
      const q = dutyHoursSearch.toLowerCase();
      const matchSearch = !q || (emp.name && emp.name.toLowerCase().includes(q)) || (emp.id && emp.id.toLowerCase().includes(q)) || (emp.designation && emp.designation.toLowerCase().includes(q));
      const empDiv = emp.division || 'AJ Synthetic';
      const matchDiv = dutyHoursDivisionFilter === 'ALL' || empDiv === dutyHoursDivisionFilter;
      const empDept = emp.department || '';
      const matchDept = dutyHoursDeptFilter === 'ALL' || empDept.toLowerCase() === dutyHoursDeptFilter.toLowerCase();
      return matchSearch && matchDiv && matchDept;
    });

    return (
      <div className="flex flex-col gap-6 animate-fade-in pb-8">
        {/* Toast Alert */}
        {dutySuccessToast && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/50 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            {dutySuccessToast}
          </div>
        )}

        {/* Rule Summary Card */}
        <div className="p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">timer</span>
            </div>
            <div>
              <h3 className="font-headline text-sm font-bold text-on-surface">Standard Salary Calculation Core</h3>
              <p className="font-body text-xs text-on-surface-variant mt-0.5">
                Hourly Rate = <code className="px-1.5 py-0.5 bg-surface-container rounded text-primary font-bold">Basic Salary / 240</code> (based on 30 calendar days × 8 hours daily shift).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant bg-surface-container-low px-3 py-1.5 rounded-xl border border-outline-variant/10">
            <span>OT Amount = OT Hrs × Hourly</span>
            <span>•</span>
            <span>Ded Amount = Ded Hrs × Hourly</span>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant text-[16px]">search</span>
              <input
                type="text"
                value={dutyHoursSearch}
                onChange={(e) => setDutyHoursSearch(e.target.value)}
                placeholder="Search employee name, EMP ID, or designation..."
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl pl-9 pr-3 py-2 text-xs text-on-surface outline-none focus:border-primary/50"
              />
            </div>

            {/* Division Filter */}
            <select
              value={dutyHoursDivisionFilter}
              onChange={(e) => setDutyHoursDivisionFilter(e.target.value)}
              className="bg-surface-container-low border border-outline-variant/20 rounded-xl px-3 py-2 text-xs text-on-surface font-semibold outline-none cursor-pointer"
            >
              <option value="ALL">All Divisions</option>
              <option value="AJ Synthetic">AJ Synthetic</option>
              <option value="AAA">AAA</option>
            </select>

            {/* Department Filter */}
            <select
              value={dutyHoursDeptFilter}
              onChange={(e) => setDutyHoursDeptFilter(e.target.value)}
              className="bg-surface-container-low border border-outline-variant/20 rounded-xl px-3 py-2 text-xs text-on-surface font-semibold outline-none cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          <span className="text-xs font-bold text-on-surface-variant">
            Showing {filteredEmployees.length} of {employees.length} employees
          </span>
        </div>

        {/* Employee Duty Hours Table */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant font-body text-[10px] uppercase font-bold tracking-wider border-b border-outline-variant/10">
                  <th className="p-3.5 pl-5">EMP ID</th>
                  <th className="p-3.5">Employee</th>
                  <th className="p-3.5">Division</th>
                  <th className="p-3.5">Department</th>
                  <th className="p-3.5">Basic Salary</th>
                  <th className="p-3.5">Assigned Shift</th>
                  <th className="p-3.5 text-center">Duty Hours / Day</th>
                  <th className="p-3.5 text-center">Hourly Divisor</th>
                  <th className="p-3.5 text-right pr-5">Action</th>
                </tr>
              </thead>
              <tbody className="text-xs font-medium divide-y divide-outline-variant/5">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="p-8 text-center text-on-surface-variant">
                      No employees found matching the filters.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.slice(0, 100).map(emp => {
                    const isEditing = editingDutyHoursId === (emp.id || emp.sheetId);
                    const dutyHrs = emp.dutyHours || 8;
                    const shiftName = emp.shift || 'GENERAL SHIFT';
                    const empDiv = emp.division || 'AJ Synthetic';

                    return (
                      <tr key={emp.id || emp.sheetId} className="hover:bg-surface-container-low/40 transition-colors">
                        <td className="p-3.5 pl-5 font-mono font-bold text-primary">
                          {emp.id || <span className="text-[10px] font-normal text-outline italic">No ID</span>}
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            <img src={emp.avatar} className="w-7 h-7 rounded-full object-cover border border-outline-variant/20" alt="" />
                            <div>
                              <div className="font-bold text-on-surface">{emp.name}</div>
                              <div className="text-[10px] text-on-surface-variant">{emp.designation || 'Staff'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            empDiv === 'AAA' ? 'bg-secondary/15 text-secondary' : 'bg-primary/15 text-primary'
                          }`}>
                            {empDiv}
                          </span>
                        </td>
                        <td className="p-3.5 text-on-surface-variant font-medium">
                          {emp.department || '—'}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-on-surface">
                          ₨ {Number(emp.basicSalary || emp.salary || 0).toLocaleString()}
                        </td>
                        <td className="p-3.5">
                          {isEditing ? (
                            <select
                              value={dutyShiftVal}
                              onChange={(e) => setDutyShiftVal(e.target.value)}
                              className="bg-surface border border-primary/40 rounded-lg px-2 py-1 text-xs text-on-surface font-semibold outline-none"
                            >
                              <option value="GENERAL SHIFT">GENERAL SHIFT</option>
                              <option value="8 HOURS SHIFT">8 HOURS SHIFT</option>
                            </select>
                          ) : (
                            <span className="text-on-surface font-semibold">{shiftName}</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              min="4"
                              max="16"
                              value={dutyHoursVal}
                              onChange={(e) => setDutyHoursVal(e.target.value)}
                              className="w-16 bg-surface border border-primary/40 rounded-lg px-2 py-1 text-xs text-center font-bold text-primary outline-none"
                            />
                          ) : (
                            <span className="px-2.5 py-1 bg-surface-container rounded-lg font-bold text-primary">
                              {dutyHrs}h
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-center font-mono text-[11px] text-on-surface-variant">
                          {30 * (isEditing ? (Number(dutyHoursVal) || 8) : dutyHrs)} hrs
                        </td>
                        <td className="p-3.5 text-right pr-5">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleSaveDutyHours(emp.id || emp.sheetId, dutyHoursVal, dutyShiftVal)}
                                className="px-2.5 py-1 bg-primary text-on-primary rounded-lg text-xs font-bold hover:opacity-90 cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingDutyHoursId(null)}
                                className="px-2 py-1 bg-surface-container hover:bg-surface-container-high rounded-lg text-xs text-on-surface-variant cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingDutyHoursId(emp.id || emp.sheetId);
                                setDutyHoursVal(dutyHrs);
                                setDutyShiftVal(shiftName);
                              }}
                              className="px-2.5 py-1 bg-surface-container hover:bg-primary/10 hover:text-primary rounded-lg text-xs font-bold text-on-surface-variant cursor-pointer transition-colors"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {filteredEmployees.length > 100 && (
            <div className="p-3 text-center text-xs text-on-surface-variant bg-surface-container-low border-t border-outline-variant/10">
              Showing first 100 employees. Use search to find specific personnel.
            </div>
          )}
        </div>
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

    return (
      <div className="flex flex-col gap-6 animate-fade-in pb-20 select-none">
        {/* Welcome Header */}
        <header className="flex flex-col gap-1">
          <h1 className="font-headline text-2xl font-black text-on-surface tracking-tight leading-tight">HR Control Center</h1>
          <p className="font-body text-[10px] text-on-surface-variant font-bold uppercase tracking-wider text-primary">System Administrator</p>
        </header>

        {/* Bento Grid Settings Categories (Accordion Style for Mobile) */}
        <section className="flex flex-col gap-4">
          
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Parent Division (HR Scoped)</label>
                <select
                  value={activeDept.division || (activeDept.name === 'AAA' ? 'AAA' : 'AJ Synthetic')}
                  onChange={(e) => setActiveDept({...activeDept, division: e.target.value, hrOnly: e.target.value === 'AAA' || activeDept.name === 'AAA'})}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-xs text-on-surface focus:bg-surface-container-lowest focus:border-primary/50 focus:ring-0 outline-none transition-all font-bold"
                >
                  <option value="AJ Synthetic">AJ Synthetic</option>
                  <option value="AAA">AAA</option>
                </select>
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
