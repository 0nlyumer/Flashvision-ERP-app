import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';

export default function SalaryAllowanceConfig({ isMobile, onBack }) {
  const { state, setCollection, currencySymbol } = useApp() || {};
  const currSym = currencySymbol || state?.adminSetup?.baseCurrency?.match(/\(([^)]+)\)/)?.[1] || 'Rs';

  // Initial State with localStorage & AppContext fallback
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('hr_salary_allowance_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Could not load salary allowance config from localStorage:", e);
    }
    return {
      effectivePeriod: 'July 2026',
      globalApply: true,
      basicSalary: {
        calculationBasis: 'Fixed Monthly Amount',
        calculationDivisor: 'Fixed (30 Days)',
        minBasicRate: '2,500.00',
        arrearsCalc: 'Pro-rata', // 'Pro-rata' | 'Full Month'
        applicableFilters: ['Global (All Employees)']
      },
      overtimeMultipliers: {
        weekday: 1.0,
        weekend: 2.0,
        holiday: 3.0
      },
      overtimeAllowance: {
        enabled: true,
        thresholdHours: 40,
        departments: ['Operations', 'Logistics']
      },
      attendanceAllowance: {
        enabled: true,
        zeroAbsences: true,
        fullAttendance: true,
        zeroLate: false,
        noUnpaidLeaves: true,
        shiftCompliance: false,
        targetLevel: 'All Staff',
        bonusAmount: 150.0,
        filters: ['All Staff']
      },
      lastModified: 'Admin (HR-01) today at 09:42 AM'
    };
  });

  const [newFilterText, setNewFilterText] = useState('');
  const [activeFilterModal, setActiveFilterModal] = useState(null); // 'basic' | 'overtime' | 'attendance'
  const [showNotification, setShowNotification] = useState(true);
  const [saveSuccessToast, setSaveSuccessToast] = useState(false);

  // Employee-wise Allowance Configuration State (Default PKR 1500)
  const [showEmployeeAllowanceModal, setShowEmployeeAllowanceModal] = useState(false);
  const [allowanceDivisionFilter, setAllowanceDivisionFilter] = useState('ALL');
  const [allowanceDepartmentFilter, setAllowanceDepartmentFilter] = useState('ALL');
  const [allowanceSearchQuery, setAllowanceSearchQuery] = useState('');
  const [employeeAllowanceMap, setEmployeeAllowanceMap] = useState(() => {
    try {
      const saved = localStorage.getItem('hr_employee_allowance_map');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    const initial = {};
    (state?.hr_employees_list || []).forEach(emp => {
      const val = emp.allowance !== undefined && emp.allowance !== null && Number(emp.allowance) > 0 
        ? Number(emp.allowance) 
        : 1500;
      initial[emp.id] = val;
    });
    return initial;
  });

  // Distinct divisions for allowance modal
  const allowanceDivisionsList = React.useMemo(() => {
    const set = new Set();
    (state?.hr_employees_list || []).forEach(emp => {
      const div = emp.division || emp.section;
      if (div) set.add(div);
    });
    if (set.size === 0) ['AAA', 'AJ Synthetic', 'Operations'].forEach(d => set.add(d));
    return ['ALL', ...Array.from(set).sort()];
  }, [state?.hr_employees_list]);

  // Cascaded departments for allowance modal
  const allowanceDepartmentsList = React.useMemo(() => {
    const set = new Set();
    (state?.hr_employees_list || []).forEach(emp => {
      const div = emp.division || emp.section;
      if (allowanceDivisionFilter === 'ALL' || !allowanceDivisionFilter || div === allowanceDivisionFilter) {
        if (emp.department) set.add(emp.department);
      }
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [state?.hr_employees_list, allowanceDivisionFilter]);

  // Filtered employees for allowance modal
  const filteredAllowanceEmployees = React.useMemo(() => {
    const query = allowanceSearchQuery.toLowerCase().trim();
    return (state?.hr_employees_list || []).filter(emp => {
      const isAct = (emp.status || 'Active').toLowerCase() === 'active';
      if (!isAct) return false;
      const div = emp.division || emp.section || '';
      if (allowanceDivisionFilter !== 'ALL' && div !== allowanceDivisionFilter) return false;
      if (allowanceDepartmentFilter !== 'ALL' && emp.department !== allowanceDepartmentFilter) return false;
      if (query) {
        const nameMatch = (emp.name || '').toLowerCase().includes(query);
        const idMatch = (emp.id || '').toLowerCase().includes(query);
        const roleMatch = (emp.designation || '').toLowerCase().includes(query);
        if (!nameMatch && !idMatch && !roleMatch) return false;
      }
      return true;
    });
  }, [state?.hr_employees_list, allowanceDivisionFilter, allowanceDepartmentFilter, allowanceSearchQuery]);

  const handleSetAllTo1500 = () => {
    setEmployeeAllowanceMap(prev => {
      const next = { ...prev };
      filteredAllowanceEmployees.forEach(emp => {
        next[emp.id] = 1500;
      });
      return next;
    });
  };

  const handleSaveEmployeeAllowances = () => {
    try {
      localStorage.setItem('hr_employee_allowance_map', JSON.stringify(employeeAllowanceMap));
      if (setCollection && state?.hr_employees_list) {
        const updatedEmployees = state.hr_employees_list.map(emp => ({
          ...emp,
          allowance: employeeAllowanceMap[emp.id] !== undefined ? employeeAllowanceMap[emp.id] : 1500
        }));
        setCollection('hr_employees_list', updatedEmployees);
      }
      window.dispatchEvent(new CustomEvent('hr_employee_allowance_updated'));
      setSaveSuccessToast(true);
      setTimeout(() => setSaveSuccessToast(false), 3000);
      setShowEmployeeAllowanceModal(false);
    } catch (e) {
      console.error("Error saving employee allowances:", e);
    }
  };

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('hr_salary_allowance_config', JSON.stringify(config));
    } catch (e) {
      console.warn(e);
    }
  }, [config]);

  // Save handler
  const handleSaveConfig = () => {
    const updated = {
      ...config,
      lastModified: `Admin (HR-01) today at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    };
    setConfig(updated);
    if (setCollection) {
      setCollection('hr_salary_allowance_config', [updated]);
    }
    setSaveSuccessToast(true);
    setTimeout(() => setSaveSuccessToast(false), 3000);
  };

  // Discard handler
  const handleDiscardChanges = () => {
    try {
      const saved = localStorage.getItem('hr_salary_allowance_config');
      if (saved) {
        setConfig(JSON.parse(saved));
      }
    } catch (e) {
      console.warn(e);
    }
  };

  // Filter tag add/remove helpers
  const handleRemoveFilter = (section, index) => {
    setConfig((prev) => {
      if (section === 'basic') {
        const next = [...prev.basicSalary.applicableFilters];
        next.splice(index, 1);
        return { ...prev, basicSalary: { ...prev.basicSalary, applicableFilters: next } };
      }
      if (section === 'overtime') {
        const next = [...prev.overtimeAllowance.departments];
        next.splice(index, 1);
        return { ...prev, overtimeAllowance: { ...prev.overtimeAllowance, departments: next } };
      }
      if (section === 'attendance') {
        const next = [...prev.attendanceAllowance.filters];
        next.splice(index, 1);
        return { ...prev, attendanceAllowance: { ...prev.attendanceAllowance, filters: next } };
      }
      return prev;
    });
  };

  const handleAddFilterSubmit = () => {
    if (!newFilterText.trim() || !activeFilterModal) return;
    const val = newFilterText.trim();
    setConfig((prev) => {
      if (activeFilterModal === 'basic') {
        return {
          ...prev,
          basicSalary: {
            ...prev.basicSalary,
            applicableFilters: [...prev.basicSalary.applicableFilters, val]
          }
        };
      }
      if (activeFilterModal === 'overtime') {
        return {
          ...prev,
          overtimeAllowance: {
            ...prev.overtimeAllowance,
            departments: [...prev.overtimeAllowance.departments, val]
          }
        };
      }
      if (activeFilterModal === 'attendance') {
        return {
          ...prev,
          attendanceAllowance: {
            ...prev.attendanceAllowance,
            filters: [...prev.attendanceAllowance.filters, val]
          }
        };
      }
      return prev;
    });
    setNewFilterText('');
    setActiveFilterModal(null);
  };

  return (
    <div className="w-full bg-[#f8f9fb] text-[#191c1e] font-sans min-h-full flex flex-col p-4 md:p-6 rounded-2xl animate-fade-in relative">
      {/* Toast Notification */}
      {saveSuccessToast && (
        <div className="fixed top-6 right-6 z-50 bg-blue-600 text-white px-5 py-3 rounded-xl shadow-2xl font-semibold text-xs flex items-center gap-2 animate-bounce">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          Salary & Allowance Rules Saved Successfully!
        </div>
      )}

      {/* Top Header & Global Controls */}
      <div className="max-w-[1200px] w-full mx-auto mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
              title="Back"
            >
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
          )}
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 font-headline">
              Salary & Allowance Configuration
            </h1>
            <p className="text-xs text-slate-500">
              Configure core compensation structures, overtime multipliers, and automated allowance triggers.
            </p>
          </div>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col px-2">
            <label className="text-[10px] uppercase font-bold text-slate-400">Effective Period</label>
            <select
              value={config.effectivePeriod}
              onChange={(e) => setConfig({ ...config, effectivePeriod: e.target.value })}
              className="bg-transparent border-none font-bold text-blue-600 focus:ring-0 cursor-pointer p-0 text-xs"
            >
              <option value="July 2026">July 2026</option>
              <option value="August 2026">August 2026</option>
              <option value="September 2026">September 2026</option>
              <option value="October 2023">October 2023</option>
              <option value="November 2023">November 2023</option>
              <option value="December 2023">December 2023</option>
            </select>
          </div>

          <div className="h-6 w-[1px] bg-slate-200"></div>

          <div className="flex items-center gap-2 px-2">
            <input
              id="apply-all-header"
              type="checkbox"
              checked={config.globalApply}
              onChange={(e) => setConfig({ ...config, globalApply: e.target.checked })}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
            />
            <label htmlFor="apply-all-header" className="font-semibold text-slate-700 cursor-pointer text-xs">
              Global Apply
            </label>
          </div>

          <button
            onClick={handleSaveConfig}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-bold transition-all text-xs shadow-md active:scale-95 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">save</span>
            Save Config
          </button>
        </div>
      </div>

      {/* Main Grid Workstation */}
      <div className="max-w-[1200px] w-full mx-auto grid grid-cols-12 gap-6">
        {/* 1. Basic Salary Setup Card */}
        <div className="col-span-12 lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-2xl">payments</span>
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Basic Salary Setup</h3>
                <p className="text-[11px] text-slate-500">Core monthly payroll baseline and calculation divisor</p>
              </div>
            </div>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-3 py-1 rounded-full uppercase font-bold tracking-wider">
              System Default
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            {/* Calculation Basis */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 text-xs">Calculation Basis</label>
              <select
                value={config.basicSalary.calculationBasis}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    basicSalary: { ...config.basicSalary, calculationBasis: e.target.value }
                  })
                }
                className="w-full border border-slate-200 rounded-xl font-semibold text-xs py-2.5 px-3 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-all"
              >
                <option value="Fixed Monthly Amount">Fixed Monthly Amount</option>
                <option value="Daily Rated (30 Days)">Daily Rated (30 Days)</option>
                <option value="Hourly Rated">Hourly Rated</option>
              </select>
            </div>

            {/* Calculation Divisor */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 text-xs">Calculation Divisor</label>
              <select
                value={config.basicSalary.calculationDivisor}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    basicSalary: { ...config.basicSalary, calculationDivisor: e.target.value }
                  })
                }
                className="w-full border border-slate-200 rounded-xl font-semibold text-xs py-2.5 px-3 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-all"
              >
                <option value="Fixed (30 Days)">Fixed (30 Days)</option>
                <option value="Actual Month Days">Actual Month Days</option>
              </select>
            </div>



            {/* Arrears Calculation */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 text-xs">Arrears Calculation</label>
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl h-[42px]">
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      basicSalary: { ...config.basicSalary, arrearsCalc: 'Pro-rata' }
                    })
                  }
                  className={`flex-1 h-full rounded-lg font-bold text-xs transition-all ${
                    config.basicSalary.arrearsCalc === 'Pro-rata'
                      ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Pro-rata
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      basicSalary: { ...config.basicSalary, arrearsCalc: 'Full Month' }
                    })
                  }
                  className={`flex-1 h-full rounded-lg font-bold text-xs transition-all ${
                    config.basicSalary.arrearsCalc === 'Full Month'
                      ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Full Month
                </button>
              </div>
            </div>
          </div>

          {/* Applicable Filters */}
          <div className="pt-4 border-t border-slate-100">
            <label className="font-bold text-slate-700 text-xs block mb-2">Applicable Scope</label>
            <div className="flex flex-wrap gap-2 items-center">
              {config.basicSalary.applicableFilters.map((filter, fIdx) => (
                <span
                  key={fIdx}
                  className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold rounded-lg flex items-center gap-1.5"
                >
                  {filter}
                  <span
                    onClick={() => handleRemoveFilter('basic', fIdx)}
                    className="material-symbols-outlined text-sm cursor-pointer hover:text-red-500 transition-colors"
                  >
                    close
                  </span>
                </span>
              ))}
              <button
                type="button"
                onClick={() => setActiveFilterModal('basic')}
                className="px-3 py-1 border border-dashed border-slate-300 text-slate-500 hover:text-slate-800 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors"
              >
                + Add Filter
              </button>
            </div>
          </div>
        </div>

        {/* 2. Overtime Multipliers Card */}
        <div className="col-span-12 lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-2xl">schedule</span>
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Multiplier Rates</h3>
              <p className="text-[11px] text-slate-500">Statutory overtime factors</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors">
              <span className="text-xs font-semibold text-slate-800">Normal Weekday</span>
              <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200">
                <span className="text-xs text-slate-400 font-bold">x</span>
                <input
                  type="number"
                  step="0.1"
                  value={config.overtimeMultipliers.weekday}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      overtimeMultipliers: {
                        ...config.overtimeMultipliers,
                        weekday: parseFloat(e.target.value) || 1.0
                      }
                    })
                  }
                  className="w-12 text-center font-mono font-bold text-xs text-blue-600 border-none outline-none p-0 focus:ring-0"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors">
              <span className="text-xs font-semibold text-slate-800">Weekend</span>
              <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200">
                <span className="text-xs text-slate-400 font-bold">x</span>
                <input
                  type="number"
                  step="0.1"
                  value={config.overtimeMultipliers.weekend}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      overtimeMultipliers: {
                        ...config.overtimeMultipliers,
                        weekend: parseFloat(e.target.value) || 1.0
                      }
                    })
                  }
                  className="w-12 text-center font-mono font-bold text-xs text-blue-600 border-none outline-none p-0 focus:ring-0"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors">
              <span className="text-xs font-semibold text-slate-800">Public Holiday</span>
              <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200">
                <span className="text-xs text-slate-400 font-bold">x</span>
                <input
                  type="number"
                  step="0.1"
                  value={config.overtimeMultipliers.holiday}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      overtimeMultipliers: {
                        ...config.overtimeMultipliers,
                        holiday: parseFloat(e.target.value) || 1.0
                      }
                    })
                  }
                  className="w-12 text-center font-mono font-bold text-xs text-blue-600 border-none outline-none p-0 focus:ring-0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. Overtime Allowance Configuration Card */}
        <div className="col-span-12 lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          <div className="flex justify-between items-start pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-2xl">more_time</span>
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Overtime Allowance</h3>
                <p className="text-[11px] text-slate-500">Threshold-based overtime eligibility rules</p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.overtimeAllowance.enabled}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    overtimeAllowance: { ...config.overtimeAllowance, enabled: e.target.checked }
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 text-xs">Overtime Threshold Hours</label>
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <input
                    type="number"
                    value={config.overtimeAllowance.thresholdHours}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        overtimeAllowance: {
                          ...config.overtimeAllowance,
                          thresholdHours: parseFloat(e.target.value) || 0
                        }
                      })
                    }
                    className="w-full border border-slate-200 rounded-xl font-bold text-xs py-2.5 px-3 pr-16 bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
                    placeholder="40"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                    hours
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-semibold">/ month</span>
              </div>
              <p className="text-[11px] text-slate-400 italic mt-1">
                Allowance triggers automatically after exceeding threshold hours.
              </p>
            </div>

            {/* Department Tag Filters */}
            <div className="space-y-2 pt-2">
              <label className="font-bold text-slate-700 text-xs">Applicable Departments</label>
              <div className="flex flex-wrap gap-2 items-center">
                {config.overtimeAllowance.departments.map((dept, dIdx) => (
                  <span
                    key={dIdx}
                    className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg flex items-center gap-1.5"
                  >
                    {dept}
                    <span
                      onClick={() => handleRemoveFilter('overtime', dIdx)}
                      className="material-symbols-outlined text-sm cursor-pointer hover:text-red-500 transition-colors"
                    >
                      close
                    </span>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setActiveFilterModal('overtime')}
                  className="px-3 py-1 border border-dashed border-slate-300 text-slate-500 hover:text-slate-800 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors"
                >
                  + Add Filter
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Attendance Allowance Configuration Card */}
        <div className="col-span-12 lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          <div className="flex justify-between items-start pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-2xl">event_available</span>
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Attendance Allowance</h3>
                <p className="text-[11px] text-slate-500">Performance and punctuality incentives</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Gear Icon Button for Employee-wise Allowance Configuration */}
              <button
                type="button"
                onClick={() => setShowEmployeeAllowanceModal(true)}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200/80 transition-all flex items-center justify-center cursor-pointer shadow-xs active:scale-95 group"
                title="Configure Employee-wise Allowance (Default: PKR 1500)"
              >
                <span className="material-symbols-outlined text-[18px] group-hover:rotate-45 transition-transform duration-300">settings</span>
              </button>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.attendanceAllowance.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      attendanceAllowance: { ...config.attendanceAllowance, enabled: e.target.checked }
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <label className="font-bold text-slate-700 text-xs block">Allowance Conditions</label>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={config.attendanceAllowance.zeroAbsences}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      attendanceAllowance: {
                        ...config.attendanceAllowance,
                        zeroAbsences: e.target.checked
                      }
                    })
                  }
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span className="text-xs font-semibold text-slate-800">Zero Absences Required</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={config.attendanceAllowance.fullAttendance}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      attendanceAllowance: {
                        ...config.attendanceAllowance,
                        fullAttendance: e.target.checked
                      }
                    })
                  }
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span className="text-xs font-semibold text-slate-800">100% Attendance</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={config.attendanceAllowance.zeroLate}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      attendanceAllowance: {
                        ...config.attendanceAllowance,
                        zeroLate: e.target.checked
                      }
                    })
                  }
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span className="text-xs font-semibold text-slate-800">Zero Late Arrivals</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={config.attendanceAllowance.noUnpaidLeaves}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      attendanceAllowance: {
                        ...config.attendanceAllowance,
                        noUnpaidLeaves: e.target.checked
                      }
                    })
                  }
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span className="text-xs font-semibold text-slate-800">No Unpaid Leaves</span>
              </label>
            </div>

            {/* Target Level & Filter Tags */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="font-bold text-slate-700 text-xs block mb-1">Target Employee Levels</label>
                <select
                  value={config.attendanceAllowance.targetLevel}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      attendanceAllowance: {
                        ...config.attendanceAllowance,
                        targetLevel: e.target.value
                      }
                    })
                  }
                  className="w-full border border-slate-200 rounded-xl font-semibold text-xs py-2 px-3 bg-slate-50 focus:bg-white outline-none"
                >
                  <option value="All Staff">All Staff</option>
                  <option value="Junior Staff (L1-L2)">Junior Staff (L1-L2)</option>
                  <option value="Mid-level (L3-L5)">Mid-level (L3-L5)</option>
                  <option value="Senior Leadership">Senior Leadership</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 text-xs block mb-1">Bonus Amount ($)</label>
                <input
                  type="number"
                  value={config.attendanceAllowance.bonusAmount}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      attendanceAllowance: {
                        ...config.attendanceAllowance,
                        bonusAmount: parseFloat(e.target.value) || 0
                      }
                    })
                  }
                  className="w-full border border-slate-200 rounded-xl font-bold font-mono text-xs py-2 px-3 bg-slate-50 focus:bg-white outline-none"
                  placeholder="150.00"
                />
              </div>
            </div>

            {/* Information Notice Box */}
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/60 flex items-start gap-2 text-xs text-emerald-900 mt-2">
              <span className="material-symbols-outlined text-emerald-600 text-base">info</span>
              <p className="leading-tight text-[11px]">
                Allowance will be calculated as a fixed <strong>{currSym} {config.attendanceAllowance.bonusAmount}</strong> monthly bonus if selected conditions are met.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Global Impact Notification Banner */}
      {showNotification && (
        <div className="max-w-[1200px] w-full mx-auto mt-6 bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">report_problem</span>
            </div>
            <div>
              <h4 className="font-bold text-xs text-amber-950">Global Impact Notification</h4>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Updating overtime or attendance rules will re-calculate pending payroll batches for 452 active employees. This action is logged for audit purposes.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowNotification(false)}
            className="text-amber-800 font-bold text-xs hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Bottom Action Footer */}
      <div className="max-w-[1200px] w-full mx-auto mt-8 mb-4 pt-4 border-t border-slate-200 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-slate-500 text-xs">
          <span className="material-symbols-outlined text-base">history</span>
          <span>Last modified by <strong>{config.lastModified}</strong></span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDiscardChanges}
            className="px-5 py-2 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-white hover:text-slate-900 transition-all text-xs"
          >
            Discard Changes
          </button>

          <button
            onClick={handleSaveConfig}
            className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all text-xs shadow-md active:scale-95 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">verified</span>
            Finalize Salary Rules
          </button>
        </div>
      </div>

      {/* Employee Allowance Configuration Modal */}
      {showEmployeeAllowanceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-2xl">payments</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    Employee Allowance Configuration
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      Default {currSym} 1,500
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Set customized attendance allowance limit for each employee. By default, everyone is set to PKR 1,500.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowEmployeeAllowanceModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Filter Toolbar */}
            <div className="p-4 border-b border-slate-100 bg-white grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
              {/* Search by Name or ID */}
              <div className="relative sm:col-span-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                <input
                  type="text"
                  value={allowanceSearchQuery}
                  onChange={(e) => setAllowanceSearchQuery(e.target.value)}
                  placeholder="Search employee..."
                  className="w-full pl-8 pr-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none transition-all"
                />
              </div>

              {/* Division Dropdown */}
              <div className="relative sm:col-span-1">
                <select
                  value={allowanceDivisionFilter}
                  onChange={(e) => {
                    setAllowanceDivisionFilter(e.target.value);
                    setAllowanceDepartmentFilter('ALL');
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none cursor-pointer"
                >
                  {allowanceDivisionsList.map(div => (
                    <option key={div} value={div}>
                      {div === 'ALL' ? '🏬 All Divisions' : div}
                    </option>
                  ))}
                </select>
              </div>

              {/* Department Dropdown (Cascaded) */}
              <div className="relative sm:col-span-1">
                <select
                  value={allowanceDepartmentFilter}
                  onChange={(e) => setAllowanceDepartmentFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none cursor-pointer"
                >
                  {allowanceDepartmentsList.map(dept => (
                    <option key={dept} value={dept}>
                      {dept === 'ALL' ? '🏢 All Departments' : dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Set All to 1500 button */}
              <div className="sm:col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={handleSetAllTo1500}
                  className="w-full px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  title="Reset all currently filtered employees to PKR 1,500"
                >
                  <span className="material-symbols-outlined text-[15px]">auto_fix_high</span>
                  Set All to {currSym} 1,500
                </button>
              </div>
            </div>

            {/* Employee Table */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-3">Employee</th>
                    <th className="p-3">Division</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Designation</th>
                    <th className="p-3 text-right">Max Allowance ({currSym})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAllowanceEmployees.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center py-10 text-xs text-slate-400 font-semibold">
                        No employees found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAllowanceEmployees.map(emp => {
                      const currentAllowance = employeeAllowanceMap[emp.id] !== undefined 
                        ? employeeAllowanceMap[emp.id] 
                        : (emp.allowance !== undefined && emp.allowance !== null && Number(emp.allowance) > 0 ? Number(emp.allowance) : 1500);

                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors group">
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200 uppercase">
                                {(emp.name || 'E').slice(0, 2)}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-800">{emp.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{emp.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                              {emp.division || emp.section || 'General'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="text-xs font-semibold text-emerald-700">
                              {emp.department || 'General'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="text-xs text-slate-600">{emp.designation || 'Worker'}</span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="inline-flex items-center relative w-36 ml-auto">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">{currSym}</span>
                              <input
                                type="number"
                                min="0"
                                step="100"
                                value={currentAllowance}
                                onChange={(e) => {
                                  const val = Math.max(0, Number(e.target.value) || 0);
                                  setEmployeeAllowanceMap(prev => ({ ...prev, [emp.id]: val }));
                                }}
                                className="w-full pl-10 pr-2.5 py-1.5 text-xs font-bold text-right text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap justify-between items-center gap-3">
              <div className="text-xs text-slate-500 font-medium">
                Showing <strong>{filteredAllowanceEmployees.length}</strong> of <strong>{(state?.hr_employees_list || []).length}</strong> employees
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowEmployeeAllowanceModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEmployeeAllowances}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Save & Sync Allowances
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Add Modal */}
      {activeFilterModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-sm text-slate-900">Add Applicable Scope Filter</h3>
            <input
              type="text"
              value={newFilterText}
              onChange={(e) => setNewFilterText(e.target.value)}
              placeholder="e.g. Quality Division, Level 2"
              className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:border-blue-500 outline-none"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setActiveFilterModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFilterSubmit}
                className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700"
              >
                Add Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
