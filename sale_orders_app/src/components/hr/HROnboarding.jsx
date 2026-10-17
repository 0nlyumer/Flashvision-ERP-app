import React, { useState, useEffect } from 'react';
import CustomSelect from '../ui/CustomSelect';
import { useApp } from '../../context/AppContext';

const INITIAL_WIZARD_DATA = {
  fullName: '',
  fatherName: '',
  dob: '',
  maritalStatus: '',
  phone: '',
  cnic: '',
  academicDetails: '',
  workHistory: [
    { id: 1, company: '', role: '', start: '', end: '' }
  ],
  grossSalary: '',
  basicSalary: '',
  overtimeAllowed: false,
  bonusesEligible: true,
  allowancesEligible: true,
  joiningDate: '',
  manager: '',
  shift: '',
  department: '',
  section: '',
  designation: '' // Added dynamic designation
};

export default function HROnboarding({ isMobile }) {
  const [formData, setFormData] = useState(INITIAL_WIZARD_DATA);
  const [photo, setPhoto] = useState(null); // Simulated photo upload
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Layout View Mode & Active Editing State
  const [currentView, setCurrentView] = useState('wizard'); // 'wizard' | 'history'
  const [editingEntryId, setEditingEntryId] = useState(null);

  // PDF Viewer & E-Signature controls states
  const [zoom, setZoom] = useState(1.0);
  const [viewingEntry, setViewingEntry] = useState(null);
  const [signatureType, setSignatureType] = useState('draw'); // 'draw' | 'type'
  const [typedName, setTypedName] = useState('');
  const [handwritingStyle, setHandwritingStyle] = useState('font-signature-1');
  const [canvasRef, setCanvasRef] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [historyDeptFilter, setHistoryDeptFilter] = useState('ALL');
  const [historyDivFilter, setHistoryDivFilter] = useState('ALL');

  // Designations State loaded dynamically from HR Settings key
  const [designations, setDesignations] = useState([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('hr_designations_config');
      if (saved) {
        setDesignations(JSON.parse(saved));
      } else {
        const defaultDesigs = ['Associate', 'Supervisor', 'Manager', 'Senior Engineer', 'Director', 'Quality Inspector', 'Line Operator'];
        setDesignations(defaultDesigs);
        localStorage.setItem('hr_designations_config', JSON.stringify(defaultDesigs));
      }
    } catch (e) {
      console.error("Error loading designations in wizard:", e);
    }
  }, [currentView]);

  // Onboarding History Records List State
  const [onboardingHistory, setOnboardingHistory] = useState([]);

  // Load and initialize onboarding history database key and auto-seed missing employee records
  const { state, setCollection, currencySymbol, startRoutingWorkflow } = useApp();
  const employees = state?.hr_employees_list || [];

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('hr_onboarding_history');
      let historyList = savedHistory ? JSON.parse(savedHistory) : [];
      let updated = false;

      if (employees.length > 0) {
        employees.forEach(emp => {
          const hasEntry = historyList.some(item => item.id === emp.id || item.fullName === emp.name);
          if (!hasEntry) {
            const generatedEntry = {
              id: emp.id,
              fullName: emp.name,
              joiningDate: emp.joiningDate || emp.startDate || '2023-10-20',
              status: 'Submitted',
              formData: {
                fullName: emp.name,
                dob: '1995-01-01',
                phone: emp.phone || 'N/A',
                cnic: '35201-1234567-1',
                joiningDate: emp.joiningDate || emp.startDate || '2023-10-20',
                department: emp.department || 'Production Department',
                section: emp.section || 'Foam Mixing',
                designation: emp.designation || emp.role || 'Worker',
                basicSalary: emp.basicSalary || 20000,
                bankAccount: 'PK12ALPH0000000000123456',
                emergencyContact: '0300-1234567',
                emergencyName: 'Family Member',
                medicalNotes: 'None',
                providentFund: true,
                socialSecurity: true,
                workHistory: [
                  { id: 1, company: 'Previous Industry', role: emp.designation || emp.role || 'Worker', start: '2020-01-01', end: '2023-01-01' }
                ]
              },
              photo: emp.avatar || null,
              signature: emp.signature || 'Auto Seeded Onboarded'
            };
            historyList.push(generatedEntry);
            updated = true;
          }
        });
      }

      if (updated || !savedHistory) {
        localStorage.setItem('hr_onboarding_history', JSON.stringify(historyList));
      }
      setOnboardingHistory(historyList);
    } catch (e) {
      console.error("Error loading onboarding history:", e);
    }
  }, [employees]);

  const saveOnboardingHistory = (updatedHistory) => {
    setOnboardingHistory(updatedHistory);
    localStorage.setItem('hr_onboarding_history', JSON.stringify(updatedHistory));
  };

  const interns = employees.filter(emp => emp.paidInternship === true);

  // Load departments from configuration dynamically
  const [departmentsConfig, setDepartmentsConfig] = useState([]);

  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('hr_departments_config');
      if (savedConfig) {
        setDepartmentsConfig(JSON.parse(savedConfig));
      } else {
        // Fallback / Init from global database (aj_synthetic_erp)
        const erpState = JSON.parse(localStorage.getItem('aj_synthetic_erp') || '{}');
        const globalDepts = erpState.departments || [
          { label: 'Production Department', value: 'Production Department' },
          { label: 'Assembly Division', value: 'Assembly Division' },
          { label: 'Quality Assurance', value: 'Quality Assurance' }
        ];
        const initialConfig = globalDepts.map((d, index) => ({
          id: 100 + index + 1,
          name: d.value || d.label,
          tagline: d.value === 'Production Department' ? 'Core Manufacturing Unit' :
                   d.value === 'Assembly Division' ? 'Precision Product Assembly' : 'Product Quality Control',
          subSections: d.value === 'Production Department' ? ['Foam Mixing', 'Adhesive', 'Packing'] :
                       d.value === 'Assembly Division' ? ['Line A', 'Line B'] : ['Inspection', 'Testing'],
          isGlobal: true
        }));
        setDepartmentsConfig(initialConfig);
        localStorage.setItem('hr_departments_config', JSON.stringify(initialConfig));
      }
    } catch (err) {
      console.error("Error loading departments configuration:", err);
    }
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      try {
        const savedConfig = localStorage.getItem('hr_departments_config');
        if (savedConfig) {
          setDepartmentsConfig(JSON.parse(savedConfig));
        }
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener('hr_departments_config_updated', handleUpdate);
    return () => window.removeEventListener('hr_departments_config_updated', handleUpdate);
  }, []);

  const handleSelectIntern = (e) => {
    const internId = e.target.value;
    if (!internId) return;
    const intern = interns.find(emp => emp.id === internId);
    if (intern) {
      setFormData(prev => ({
        ...prev,
        fullName: intern.name,
        phone: intern.phone || ''
      }));
      if (intern.avatar) {
        setPhoto(intern.avatar);
      }
    }
  };

  const handleInputChange = (field, val) => {
    setFormData(prev => {
      const next = { ...prev, [field]: val };
      if (field === 'department') {
        next.section = ''; // Reset section when department changes
      }
      return next;
    });
  };

  // Toggle buttons logic for Pay structure
  const handleToggleChange = (field) => {
    setFormData(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Work History Row Actions
  const handleAddRow = () => {
    const nextId = formData.workHistory.length 
      ? Math.max(...formData.workHistory.map(row => row.id)) + 1 
      : 1;
    setFormData(prev => ({
      ...prev,
      workHistory: [...prev.workHistory, { id: nextId, company: '', role: '', start: '', end: '' }]
    }));
  };

  const handleDeleteRow = (id) => {
    if (formData.workHistory.length === 1) {
      alert("At least one work history row is required.");
      return;
    }
    setFormData(prev => ({
      ...prev,
      workHistory: prev.workHistory.filter(row => row.id !== id)
    }));
  };

  const handleRowChange = (id, field, value) => {
    setFormData(prev => ({
      ...prev,
      workHistory: prev.workHistory.map(row => {
        if (row.id !== id) return row;
        return { ...row, [field]: value };
      })
    }));
  };

  // Canvas E-Signature Drawing Logic
  const startDrawing = (e) => {
    if (!canvasRef) return;
    const ctx = canvasRef.getContext('2d');
    const rect = canvasRef.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || !canvasRef) return;
    const ctx = canvasRef.getContext('2d');
    const rect = canvasRef.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (!canvasRef) return;
    const ctx = canvasRef.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
  };

  const saveSignature = () => {
    let sigValue = '';
    
    if (signatureType === 'draw') {
      if (!canvasRef) return;
      const ctx = canvasRef.getContext('2d');
      const buffer = new Uint32Array(ctx.getImageData(0, 0, canvasRef.width, canvasRef.height).data.buffer);
      const isCanvasEmpty = !buffer.some(color => color !== 0);
      if (isCanvasEmpty) {
        alert("Please draw your signature first before saving.");
        return;
      }
      sigValue = canvasRef.toDataURL('image/png');
    } else {
      if (!typedName.trim()) {
        alert("Please type your name for the signature.");
        return;
      }
      sigValue = typedName.trim();
    }

    const updatedHistory = onboardingHistory.map(item => {
      if (item.id === viewingEntry.id) {
        return { ...item, signature: sigValue };
      }
      return item;
    });

    saveOnboardingHistory(updatedHistory);
    
    if (viewingEntry.status === 'Submitted') {
      const updatedList = employees.map(emp => {
        if (emp.id === viewingEntry.id) {
          return { ...emp, signature: sigValue };
        }
        return emp;
      });
      setCollection('hr_employees_list', updatedList);
    }

    setViewingEntry(prev => ({ ...prev, signature: sigValue }));
    alert("E-Signature successfully verified and embedded into employee's onboarding profile!");
    clearCanvas();
  };

  // Simulated capture and upload photo
  const handlePhotoUpload = () => {
    setPhoto('https://lh3.googleusercontent.com/aida-public/AB6AXuDG__0P4T6hror-vCHiRpSqP6WHrzFlsfyPfV-h0xSlwPUrzKRj94fEqTfct9f2OsJTwNjSJU_dxCItXniNMgE02yWPAWAv7BtSgMKQwM0k6ltYRhP-sX-YkJFmKyXrf9lMkkuCK0e1o-skZszMgFNtrHkD7EDsnfBv0fyeL2Xc7YGBYvBvFtK0T9kNSJvJ3grwZi340chVZmaVyh6qMqB5H4I_161XW4o83aSCth4U4Gm07mQ-wKk3-Te6wxhPblisYK9LU98RyyWi');
    alert("Simulated profile photo successfully uploaded!");
  };

  const handlePhotoCapture = () => {
    setPhoto('https://lh3.googleusercontent.com/aida-public/AB6AXuDG__0P4T6hror-vCHiRpSqP6WHrzFlsfyPfV-h0xSlwPUrzKRj94fEqTfct9f2OsJTwNjSJU_dxCItXniNMgE02yWPAWAv7BtSgMKQwM0k6ltYRhP-sX-YkJFmKyXrf9lMkkuCK0e1o-skZszMgFNtrHkD7EDsnfBv0fyeL2Xc7YGBYvBvFtK0T9kNSJvJ3grwZi340chVZmaVyh6qMqB5H4I_161XW4o83aSCth4U4Gm07mQ-wKk3-Te6wxhPblisYK9LU98RyyWi');
    alert("Camera capture simulated successfully!");
  };

  // Operational Workflow Actions
  const handleSaveDraft = () => {
    setIsAutoSaving(true);
    
    const draftEntry = {
      id: editingEntryId || `ONB-draft-${Date.now()}`,
      fullName: formData.fullName || 'New Draft Onboarding',
      joiningDate: formData.joiningDate || new Date().toISOString().split('T')[0],
      status: 'Draft',
      formData: { ...formData },
      photo: photo
    };

    let updated;
    if (editingEntryId) {
      updated = onboardingHistory.map(item => item.id === editingEntryId ? draftEntry : item);
    } else {
      updated = [draftEntry, ...onboardingHistory];
    }

    setTimeout(() => {
      setIsAutoSaving(false);
      saveOnboardingHistory(updated);
      alert("Draft of " + (formData.fullName || "new profile") + " has been auto-saved to onboarding history!");
      setFormData(INITIAL_WIZARD_DATA);
      setPhoto(null);
      setEditingEntryId(null);
      setCurrentView('history');
    }, 600);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.fullName || !formData.dob || !formData.phone || !formData.cnic || !formData.joiningDate || !formData.designation) {
      alert("Please fill out all mandatory fields, including job designation.");
      return;
    }

    // Sequential Employee ID generator starting from 001
    const generateId = () => {
      const list = employees;
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

    const savedStart = localStorage.getItem('hr_attendance_start_date') || "2023-10-20";
    const savedEnd = localStorage.getItem('hr_attendance_end_date') || "2023-10-24";
    
    const getWeekdays = () => {
      const start = new Date(savedStart);
      const end = new Date(savedEnd);
      const result = [];
      const temp = new Date(start);
      let count = 0;
      while (temp <= end && count < 32) {
        count++;
        const dateString = temp.toISOString().split('T')[0];
        result.push(dateString);
        temp.setDate(temp.getDate() + 1);
      }
      return result;
    };
    
    const activeDates = getWeekdays();
    const defaultAttendance = {};
    activeDates.forEach(dateStr => {
      defaultAttendance[dateStr] = { status: 'present', ot: 0, fines: 0, deductions: 0 };
    });
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(dayName => {
      if (!defaultAttendance[dayName]) {
        defaultAttendance[dayName] = { status: 'present', ot: 0, fines: 0, deductions: 0 };
      }
    });

    const newEmpObject = {
      id: newId,
      name: formData.fullName,
      phone: formData.phone,
      paidInternship: false, // Onboarded as full-time employee!
      avatar: photo || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDG__0P4T6hror-vCHiRpSqP6WHrzFlsfyPfV-h0xSlwPUrzKRj94fEqTfct9f2OsJTwNjSJU_dxCItXniNMgE02yWPAWAv7BtSgMKQwM0k6ltYRhP-sX-YkJFmKyXrf9lMkkuCK0e1o-skZszMgFNtrHkD7EDsnfBv0fyeL2Xc7YGBYvBvFtK0T9kNSJvJ3grwZi340chVZmaVyh6qMqB5H4I_161XW4o83aSCth4U4Gm07mQ-wKk3-Te6wxhPblisYK9LU98RyyWi',
      department: formData.department,
      section: formData.section,
      designation: formData.designation,
      joiningDate: formData.joiningDate,
      status: 'Active',
      attendance: defaultAttendance
    };

    try {
      const list = employees;
      // Upgrade intern (remove old intern record matching name)
      const filteredList = list.filter(emp => emp.name.toLowerCase() !== formData.fullName.toLowerCase());
      const newList = [newEmpObject, ...filteredList];
      setCollection('hr_employees_list', newList);
    } catch (err) {
      console.error("Error saving onboarded employee:", err);
    }

    // Now update onboarding history logs
    const historyEntry = {
      id: newId,
      fullName: formData.fullName,
      joiningDate: formData.joiningDate,
      status: 'Submitted',
      formData: { ...formData },
      photo: photo
    };

    let updatedHistory;
    if (editingEntryId) {
      updatedHistory = onboardingHistory.map(item => item.id === editingEntryId ? historyEntry : item);
    } else {
      updatedHistory = [historyEntry, ...onboardingHistory];
    }

    saveOnboardingHistory(updatedHistory);

    // Trigger routing workflow for 'Onboarding Document'
    const doc = {
      id: newId,
      title: `Onboarding Profile - ${formData.fullName}`,
      type: 'Onboarding Document',
      createdBy: state.currentUser?.username || 'admin',
      details: `Full Name: ${formData.fullName}, Department: ${formData.department}, Designation: ${formData.designation}, Joining Date: ${formData.joiningDate}`
    };
    startRoutingWorkflow(doc);

    alert(`Success! Profile for ${formData.fullName} has been created with ID ${newId} and synced to active HR records.`);
    setFormData(INITIAL_WIZARD_DATA);
    setPhoto(null);
    setEditingEntryId(null);
    setCurrentView('history');
  };

  const deptOptions = departmentsConfig.map(d => ({ label: d.name, value: d.name }));
  const chosenDeptConfig = departmentsConfig.find(d => d.name === formData.department);
  const sectionOptions = chosenDeptConfig ? chosenDeptConfig.subSections.map(s => ({ label: s, value: s })) : [];

  if (currentView === 'history') {
    return renderHistoryScreen();
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in pb-16 select-none w-full">
      
      {/* Header Panel */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-on-surface tracking-tight mb-2">Employee Onboarding Wizard</h1>
          <p className="text-on-surface-variant text-xs font-medium max-w-2xl">
            Complete the comprehensive profile setup for new personnel. Ensure all mandatory fields marked with an asterisk are accurately populated before submission.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button 
            type="button"
            onClick={() => {
              setEditingEntryId(null);
              setCurrentView('history');
            }}
            className="flex items-center gap-2 bg-primary hover:bg-primary-container text-on-primary py-2.5 px-5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-[0.98] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
            Onboarding History
          </button>
          <div className="flex items-center gap-2 bg-surface-container-low py-2.5 px-4 rounded-xl border border-outline-variant/20 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-bold text-on-surface-variant">
              {isAutoSaving ? 'Auto-saving...' : 'Cloud Synced'}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* SECTION 1: Personal Info */}
        <section className="wizard-section" id="section-1">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-outline-variant/10">
            <div className="w-8 h-8 rounded bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs">1</div>
            <h2 className="font-headline text-lg font-bold text-on-surface">Personal Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Photo Upload Area */}
            <div className="md:col-span-3 flex flex-col items-center gap-4">
              <div className="w-32 h-32 rounded-full bg-surface-container border-2 border-dashed border-outline-variant flex flex-col items-center justify-center text-on-surface-variant overflow-hidden relative group shrink-0">
                {photo ? (
                  <img src={photo} className="w-full h-full object-cover" alt="Profile Preview" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-4xl mb-1 text-outline">person</span>
                    <span className="text-[9px] uppercase font-bold tracking-wider">No Photo</span>
                  </>
                )}
                <div 
                  onClick={handlePhotoUpload}
                  className="absolute inset-0 bg-inverse-surface/80 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                >
                  <span className="material-symbols-outlined text-sm">photo_camera</span>
                  <span className="text-[8px] font-bold uppercase mt-1">Upload</span>
                </div>
              </div>
              
              <div className="flex flex-col w-full gap-2">
                <button 
                  onClick={handlePhotoUpload}
                  type="button" 
                  className="w-full bg-secondary-container hover:bg-secondary-fixed text-on-secondary-container py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Upload Image
                </button>
                <button 
                  onClick={handlePhotoCapture}
                  type="button" 
                  className="w-full border border-outline-variant text-on-surface-variant hover:bg-surface-container py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Capture Photo
                </button>
              </div>
            </div>

            {/* Form Fields */}
            <div className="md:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Load Intern Profile Dropdown */}
              <div className="relative group col-span-1 md:col-span-2">
                <select 
                  onChange={handleSelectIntern}
                  className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all outline-none cursor-pointer"
                >
                  <option value="">-- Select Intern to Load Profile --</option>
                  {interns.map(intern => (
                    <option key={intern.id} value={intern.id}>
                      {intern.name} ({intern.id})
                    </option>
                  ))}
                </select>
                <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider text-primary">Load Intern Profile</label>
              </div>

              <div className="relative group">
                <input 
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={e => handleInputChange('fullName', e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all outline-none"
                />
                <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider text-primary">Full Name <span className="required-mark">*</span></label>
              </div>
              
              <div className="relative group">
                <input 
                  type="text"
                  required
                  value={formData.fatherName}
                  onChange={e => handleInputChange('fatherName', e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all outline-none"
                />
                <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider text-primary">Father's Name <span className="required-mark">*</span></label>
              </div>
              
              <div className="relative group">
                <input 
                  type="date"
                  required
                  value={formData.dob}
                  onChange={e => handleInputChange('dob', e.target.value)}
                  className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all outline-none"
                />
                <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider text-primary">Date of Birth <span className="required-mark">*</span></label>
              </div>
              
              <CustomSelect
                name="maritalStatus"
                value={formData.maritalStatus}
                onChange={e => handleInputChange('maritalStatus', e.target.value)}
                options={[
                  { label: 'Single', value: 'single' },
                  { label: 'Married', value: 'married' },
                  { label: 'Divorced', value: 'divorced' },
                  { label: 'Widowed', value: 'widowed' }
                ]}
                label="Marital Status *"
                placeholder="Select status..."
              />
            </div>
          </div>
        </section>

        {/* SECTION 2: Contact Info */}
        <section className="wizard-section animate-in fade-in slide-in-from-bottom-3 duration-300" id="section-2">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-outline-variant/10">
            <div className="w-8 h-8 rounded bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs">2</div>
            <h2 className="font-headline text-lg font-bold text-on-surface">Contact Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative group">
              <input 
                type="tel"
                required
                value={formData.phone}
                onChange={e => handleInputChange('phone', e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all outline-none"
              />
              <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider text-primary">Phone Number <span className="required-mark">*</span></label>
            </div>
            
            <div className="relative group">
              <input 
                type="text"
                required
                value={formData.cnic}
                onChange={e => handleInputChange('cnic', e.target.value)}
                placeholder="00000-0000000-0"
                pattern="^\d{5}-\d{7}-\d{1}$"
                className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all outline-none"
              />
              <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider text-primary">National ID Card Number (CNIC) <span className="required-mark">*</span></label>
              <p className="text-[10px] text-on-surface-variant font-medium mt-1 pl-1">Format: XXXXX-XXXXXXX-X</p>
            </div>
          </div>
        </section>

        {/* SECTION 3: Education */}
        <section className="wizard-section animate-in fade-in slide-in-from-bottom-3 duration-300" id="section-3">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-outline-variant/10">
            <div className="w-8 h-8 rounded bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs">3</div>
            <h2 className="font-headline text-lg font-bold text-on-surface">Education &amp; Academic History</h2>
          </div>
          
          <div className="relative group">
            <div className="border border-outline-variant/30 rounded-t-xl bg-surface-container-low p-2 flex gap-2">
              <button 
                type="button"
                onClick={() => alert("Bold markdown formatting simulated.")} 
                className="p-1 text-on-surface-variant hover:text-primary rounded hover:bg-surface-container flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">format_bold</span>
              </button>
              <button 
                type="button"
                onClick={() => alert("Italic markdown formatting simulated.")} 
                className="p-1 text-on-surface-variant hover:text-primary rounded hover:bg-surface-container flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">format_italic</span>
              </button>
              <button 
                type="button"
                onClick={() => alert("Bullet list formatting simulated.")} 
                className="p-1 text-on-surface-variant hover:text-primary rounded hover:bg-surface-container flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
              </button>
            </div>
            <textarea 
              value={formData.academicDetails}
              onChange={e => handleInputChange('academicDetails', e.target.value)}
              placeholder="Enter degree, institution, graduation year, and any notable academic achievements..."
              className="w-full h-32 bg-surface border-x border-b border-outline-variant/30 p-4 text-xs focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent rounded-b-xl resize-y outline-none"
            />
            <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider text-primary">Academic Details</label>
          </div>
        </section>

        {/* SECTION 4: Work History */}
        <section className="wizard-section" id="section-4">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-outline-variant/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs">4</div>
              <h2 className="font-headline text-lg font-bold text-on-surface">Work History</h2>
            </div>
            <button 
              type="button" 
              onClick={handleAddRow}
              className="text-primary font-semibold text-xs flex items-center gap-1 hover:text-primary-container transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span> Add Row
            </button>
          </div>
          
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-surface-container-high text-[10px] uppercase tracking-wider text-on-surface-variant">
                  <th className="pb-3 font-semibold min-w-[200px]">Previous Company Name</th>
                  <th className="pb-3 font-semibold min-w-[200px]">Designation / Role</th>
                  <th className="pb-3 font-semibold min-w-[150px]">Start Date</th>
                  <th className="pb-3 font-semibold min-w-[150px]">End Date</th>
                  <th className="pb-3 font-semibold w-10"></th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {formData.workHistory.map(row => (
                  <tr key={row.id} className="border-b border-surface-container group hover:bg-surface-container-low transition-colors">
                    <td className="py-3 pr-4">
                      <input 
                        type="text" 
                        value={row.company}
                        onChange={e => handleRowChange(row.id, 'company', e.target.value)}
                        placeholder="Company Name" 
                        className="erp-input bg-transparent border-none p-1 text-xs focus:ring-0 focus:border-primary outline-none"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <input 
                        type="text" 
                        value={row.role}
                        onChange={e => handleRowChange(row.id, 'role', e.target.value)}
                        placeholder="Job Title" 
                        className="erp-input bg-transparent border-none p-1 text-xs focus:ring-0 focus:border-primary outline-none"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <input 
                        type="date" 
                        value={row.start}
                        onChange={e => handleRowChange(row.id, 'start', e.target.value)}
                        className="erp-input bg-transparent border-none p-1 text-xs focus:ring-0 focus:border-primary outline-none"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <input 
                        type="date" 
                        value={row.end}
                        onChange={e => handleRowChange(row.id, 'end', e.target.value)}
                        className="erp-input bg-transparent border-none p-1 text-xs focus:ring-0 focus:border-primary outline-none"
                      />
                    </td>
                    <td className="py-3">
                      <button 
                        type="button"
                        onClick={() => handleDeleteRow(row.id)}
                        className="text-outline hover:text-error opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-8 h-8 rounded-full hover:bg-error-container/10 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 5: Offers & Pay Structure */}
        <section className="wizard-section animate-in fade-in slide-in-from-bottom-3 duration-300" id="section-5">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-outline-variant/10">
            <div className="w-8 h-8 rounded bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs">5</div>
            <h2 className="font-headline text-lg font-bold text-on-surface">Offers &amp; Pay Structure</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="relative group">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-medium text-xs">{currencySymbol}</span>
                <input 
                  type="number"
                  value={formData.grossSalary}
                  onChange={e => handleInputChange('grossSalary', e.target.value)}
                  placeholder="0.00" 
                  className="w-full bg-surface border border-outline-variant/30 rounded-xl pl-8 pr-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all outline-none"
                />
                <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider text-primary">Gross Salary (Annual)</label>
              </div>
              
              <div className="relative group">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-medium text-xs">{currencySymbol}</span>
                <input 
                  type="number"
                  value={formData.basicSalary}
                  onChange={e => handleInputChange('basicSalary', e.target.value)}
                  placeholder="0.00" 
                  className="w-full bg-surface border border-outline-variant/30 rounded-xl pl-8 pr-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all outline-none"
                />
                <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider text-primary">Basic Salary (Monthly)</label>
              </div>
            </div>
            
            <div className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/10 space-y-4">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider mb-4">Eligibility Criteria</h3>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-xs text-on-surface">Overtime Allowed</p>
                  <p className="text-[10px] text-on-surface-variant">Eligible for 1.5x pay after 40 hours.</p>
                </div>
                <label className="erp-toggle">
                  <input 
                    type="checkbox"
                    checked={formData.overtimeAllowed}
                    onChange={() => handleToggleChange('overtimeAllowed')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t border-outline-variant/10">
                <div>
                  <p className="font-semibold text-xs text-on-surface">Bonuses Eligible</p>
                  <p className="text-[10px] text-on-surface-variant">Qualifies for annual performance bonus.</p>
                </div>
                <label className="erp-toggle">
                  <input 
                    type="checkbox"
                    checked={formData.bonusesEligible}
                    onChange={() => handleToggleChange('bonusesEligible')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t border-outline-variant/10">
                <div>
                  <p className="font-semibold text-xs text-on-surface">Allowances Eligible</p>
                  <p className="text-[10px] text-on-surface-variant">Housing, transport, and medical.</p>
                </div>
                <label className="erp-toggle">
                  <input 
                    type="checkbox"
                    checked={formData.allowancesEligible}
                    onChange={() => handleToggleChange('allowancesEligible')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6: Joining Details */}
        <section className="wizard-section animate-in fade-in slide-in-from-bottom-3 duration-300" id="section-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-outline-variant/10">
            <div className="w-8 h-8 rounded bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs">6</div>
            <h2 className="font-headline text-lg font-bold text-on-surface">Joining Details</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="relative group">
              <input 
                type="date"
                required
                value={formData.joiningDate}
                onChange={e => handleInputChange('joiningDate', e.target.value)}
                className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all outline-none"
              />
              <label className="absolute -top-2 left-3 bg-surface px-1 text-[10px] font-bold uppercase tracking-wider text-primary">Joining Date <span className="required-mark">*</span></label>
            </div>
            
            <CustomSelect
              name="manager"
              value={formData.manager}
              onChange={e => handleInputChange('manager', e.target.value)}
              options={[
                { label: 'Sarah Jenkins (Director of Ops)', value: 'sarah' },
                { label: 'Michael Chang (Tech Lead)', value: 'michael' },
                { label: 'Robert Fox (HR Manager)', value: 'robert' }
              ]}
              label="Reporting Manager"
              placeholder="Select Manager..."
            />
            
            <CustomSelect
              name="shift"
              value={formData.shift}
              onChange={e => handleInputChange('shift', e.target.value)}
              options={[
                { label: 'Morning (09:00 AM - 05:00 PM)', value: 'morning' },
                { label: 'Evening (02:00 PM - 10:00 PM)', value: 'evening' },
                { label: 'Night (10:00 PM - 06:00 AM)', value: 'night' }
              ]}
              label="Shift Selection"
              placeholder="Select Shift..."
            />
            
            <CustomSelect
              name="department"
              value={formData.department}
              onChange={e => handleInputChange('department', e.target.value)}
              options={deptOptions}
              label="Department Assignment"
              placeholder="Select Department..."
            />
            
            <CustomSelect
              name="section"
              value={formData.section}
              onChange={e => handleInputChange('section', e.target.value)}
              options={sectionOptions}
              label="Department Section"
              placeholder={formData.department ? "Select Section..." : "Select Department First..."}
              disabled={!formData.department}
            />

            <CustomSelect
              name="designation"
              value={formData.designation}
              onChange={e => handleInputChange('designation', e.target.value)}
              options={designations.map(d => ({ label: d, value: d }))}
              label="Job Designation *"
              placeholder="Select Designation..."
              required
            />
          </div>
        </section>

        {/* Action Footer (Sticky) */}
        <div className="sticky bottom-4 bg-surface-container-lowest/90 backdrop-blur border border-outline-variant/15 p-4 rounded-2xl shadow-lg flex justify-between items-center z-30">
          <button 
            type="button" 
            onClick={() => { setFormData(INITIAL_WIZARD_DATA); setPhoto(null); }}
            className="text-on-surface-variant font-bold text-xs hover:text-on-surface px-6 py-2 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          
          <div className="flex gap-3">
            <button 
              type="button" 
              onClick={handleSaveDraft}
              className="bg-secondary-container hover:bg-secondary-fixed text-on-secondary-container px-6 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              Save Draft
            </button>
            <button 
              type="submit"
              className="primary-gradient text-on-primary px-8 py-2.5 rounded-xl font-bold text-xs shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              Submit Profile
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  // Dynamic Onboarding History Screen Renderer
  function renderHistoryScreen() {
    
  const historyDeptsList = React.useMemo(() => {
    const set = new Set();
    onboardingHistory.forEach(item => {
      const d = item.formData?.department || item.department;
      if (d) set.add(d);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [onboardingHistory]);

  const historyDivsList = React.useMemo(() => {
    const set = new Set();
    onboardingHistory.forEach(item => {
      const div = item.formData?.section || item.formData?.division || item.section || item.division;
      const d = item.formData?.department || item.department;
      if (div && (historyDeptFilter === 'ALL' || !historyDeptFilter || d === historyDeptFilter)) {
        set.add(div);
      }
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [onboardingHistory, historyDeptFilter]);

    // Dynamic KPI statistics
    const submittedCount = onboardingHistory.filter(item => item.status === 'Submitted').length;
    const draftCount = onboardingHistory.filter(item => item.status === 'Draft').length;
    const internshipCount = interns.length;

    // Filtered logs list
    const filteredLogs = onboardingHistory.filter(log => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        (log.fullName && log.fullName.toLowerCase().includes(q)) ||
        (log.id && log.id.toLowerCase().includes(q)) ||
        (log.status && log.status.toLowerCase().includes(q));

      const logDept = log.formData?.department || log.department || '';
      const logDiv = log.formData?.section || log.formData?.division || log.section || log.division || '';
      const matchesDept = historyDeptFilter === 'ALL' || !historyDeptFilter || logDept === historyDeptFilter;
      const matchesDiv = historyDivFilter === 'ALL' || !historyDivFilter || logDiv === historyDivFilter;

      return matchesSearch && matchesDept && matchesDiv;
    });

    const handleEdit = (item) => {
      setFormData(item.formData);
      setPhoto(item.photo);
      setEditingEntryId(item.id);
      setCurrentView('wizard');
    };

    const handlePrint = (item) => {
      const printWindow = window.open('', '_blank', 'width=800,height=900');
      const styles = `
        body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
        .header { border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
        .title { font-size: 26px; font-weight: 900; color: #0f766e; margin: 0; }
        .subtitle { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-top: 5px; font-weight: bold; }
        .section-title { font-size: 13px; font-weight: 900; color: #0f766e; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 35px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.5px; }
        .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 15px; }
        .field { font-size: 12px; margin-bottom: 8px; }
        .label { font-weight: 700; color: #475569; }
        .value { color: #0f172a; }
        .signature-block { margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end; }
        .sig-line { border-top: 1px solid #94a3b8; width: 220px; text-align: center; font-size: 11px; color: #64748b; padding-top: 6px; margin-top: 40px; }
        .sig-image { max-height: 50px; display: block; margin: 0 auto 5px auto; }
        .sig-typed { font-family: 'Brush Script MT', cursive, sans-serif; font-size: 26px; text-align: center; color: #0f766e; margin-bottom: 2px; }
      `;
      
      let sigHTML = '';
      if (item.signature) {
        if (item.signature.startsWith('data:image')) {
          sigHTML = `<img src="${item.signature}" class="sig-image" />`;
        } else {
          sigHTML = `<div class="sig-typed">${item.signature}</div>`;
        }
      }
      
      printWindow.document.write(`
        <html>
          <head>
            <title>Onboarding Document - ${item.fullName}</title>
            <style>${styles}</style>
          </head>
          <body>
            <div class="header">
              <div class="title">Employee Onboarding Record</div>
              <div class="subtitle">Official HR Department File • ID: ${item.id}</div>
            </div>
            
            <div class="section-title">Personal Information</div>
            <div class="grid">
              <div class="field"><span class="label">Full Name:</span> <span class="value">${item.formData.fullName}</span></div>
              <div class="field"><span class="label">Father's Name:</span> <span class="value">${item.formData.fatherName}</span></div>
              <div class="field"><span class="label">Date of Birth:</span> <span class="value">${item.formData.dob}</span></div>
              <div class="field"><span class="label">Marital Status:</span> <span class="value">${item.formData.maritalStatus}</span></div>
            </div>

            <div class="section-title">Contact &amp; Identification</div>
            <div class="grid">
              <div class="field"><span class="label">Phone Number:</span> <span class="value">${item.formData.phone}</span></div>
              <div class="field"><span class="label">CNIC Number:</span> <span class="value">${item.formData.cnic}</span></div>
            </div>

            <div class="section-title">Joining &amp; Assignment Details</div>
            <div class="grid">
              <div class="field"><span class="label">Joining Date:</span> <span class="value">${item.joiningDate}</span></div>
              <div class="field"><span class="label">Designation:</span> <span class="value">${item.formData.designation || 'Associate'}</span></div>
              <div class="field"><span class="label">Department:</span> <span class="value">${item.formData.department}</span></div>
              <div class="field"><span class="label">Section:</span> <span class="value">${item.formData.section || 'N/A'}</span></div>
              <div class="field"><span class="label">Reporting Manager:</span> <span class="value">${item.formData.manager || 'Sarah Jenkins'}</span></div>
              <div class="field"><span class="label">Shift Selection:</span> <span class="value">${item.formData.shift || 'Morning'}</span></div>
            </div>

            <div class="section-title">Compensation &amp; Salary Structure</div>
            <div class="grid">
              <div class="field"><span class="label">Gross Salary (Annual):</span> <span class="value">${currencySymbol}${Number(item.formData.grossSalary || 0).toLocaleString()}</span></div>
              <div class="field"><span class="label">Basic Salary (Monthly):</span> <span class="value">${currencySymbol}${Number(item.formData.basicSalary || 0).toLocaleString()}</span></div>
              <div class="field"><span class="label">Overtime Allowed:</span> <span class="value">${item.formData.overtimeAllowed ? 'Yes' : 'No'}</span></div>
              <div class="field"><span class="label">Bonuses Eligible:</span> <span class="value">${item.formData.bonusesEligible ? 'Yes' : 'No'}</span></div>
            </div>

            <div class="signature-block">
              <div class="sig-line">
                HR Administrator Signature
              </div>
              <div class="sig-line">
                ${sigHTML}
                Employee Verification Signature
              </div>
            </div>
            
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    };

    return (
      <div className="flex flex-col gap-8 animate-fade-in pb-16 select-none w-full font-body">
        
        {/* Header Panel */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 shrink-0">
          <div>
            <h1 className="font-display text-3xl font-bold text-on-surface tracking-tight mb-2">Onboarding History & Logs</h1>
            <p className="text-on-surface-variant text-xs font-medium max-w-2xl">
              Track past onboarding wizard profiles, review dynamic workflows, print verification documents, and embed validated E-Signatures.
            </p>
          </div>
          
          <button 
            onClick={() => {
              setFormData(INITIAL_WIZARD_DATA);
              setPhoto(null);
              setEditingEntryId(null);
              setCurrentView('wizard');
            }}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-container text-on-primary py-2.5 px-5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-[0.98] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            New Onboarding Wizard
          </button>
        </div>

        {/* Dynamic Statistics KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* KPI 1: Total Submitted */}
          <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-5 shadow-sm flex items-center justify-between min-h-[90px] relative overflow-hidden">
            <div className="absolute right-2 top-2 opacity-10 text-primary pointer-events-none">
              <span className="material-symbols-outlined text-[60px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Total Submitted</span>
              <h2 className="font-headline text-3xl font-black text-on-surface mt-1 leading-none">{submittedCount}</h2>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
            </div>
          </div>

          {/* KPI 2: Save as Draft */}
          <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-5 shadow-sm flex items-center justify-between min-h-[90px] relative overflow-hidden">
            <div className="absolute right-2 top-2 opacity-10 text-amber-500 pointer-events-none">
              <span className="material-symbols-outlined text-[60px]" style={{ fontVariationSettings: "'FILL' 1" }}>drafts</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Save as Draft</span>
              <h2 className="font-headline text-3xl font-black text-on-surface mt-1 leading-none">{draftCount}</h2>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">drafts</span>
            </div>
          </div>

          {/* KPI 3: On Internship */}
          <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-5 shadow-sm flex items-center justify-between min-h-[90px] relative overflow-hidden">
            <div className="absolute right-2 top-2 opacity-10 text-sky-500 pointer-events-none">
              <span className="material-symbols-outlined text-[60px]" style={{ fontVariationSettings: "'FILL' 1" }}>badge</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">On Internship</span>
              <h2 className="font-headline text-3xl font-black text-on-surface mt-1 leading-none">{internshipCount}</h2>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">badge</span>
            </div>
          </div>
        </div>

        {/* Real-time Records Table Container */}
        <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl shadow-sm p-6 flex flex-col gap-5 overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 border-b border-outline-variant/10 pb-4">
            <h3 className="font-headline font-bold text-sm text-on-surface">Onboarding Entries Logbook</h3>
            
            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant text-[14px]">search</span>
              <input 
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search history by name, ID..."
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl pl-9 pr-4 py-2 text-xs text-on-surface focus:bg-surface-container-lowest focus:border-primary/50 outline-none transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-container-high text-[9px] uppercase tracking-wider font-bold text-on-surface-variant select-none">
                  <th className="pb-3 pl-4 font-semibold">Employee ID</th>
                  <th className="pb-3 font-semibold">Employee Name</th>
                  <th className="pb-3 font-semibold">Joining Date</th>
                  <th className="pb-3 font-semibold">Designation</th>
                  <th className="pb-3 font-semibold">Workflow Status</th>
                  <th className="pb-3 text-right pr-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs font-medium text-on-surface">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-12 text-on-surface-variant/80">
                      No onboarding logs found.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(item => (
                    <tr key={item.id} className="border-b border-surface-container/60 hover:bg-surface-container-low/40 transition-colors">
                      <td className="py-4 pl-4 font-mono font-bold text-primary">{item.id}</td>
                      <td className="py-4 font-bold">{item.fullName}</td>
                      <td className="py-4 text-on-surface-variant">{item.joiningDate}</td>
                      <td className="py-4 font-semibold">{item.formData.designation || 'Associate'}</td>
                      <td className="py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                          item.status === 'Submitted'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {item.status === 'Submitted' ? 'Submitted' : 'Draft'}
                        </span>
                      </td>
                      <td className="py-4 text-right pr-4">
                        <div className="flex justify-end gap-1.5">
                          {/* Edit Draft */}
                          <button 
                            onClick={() => handleEdit(item)}
                            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high hover:text-primary transition-colors flex items-center justify-center text-on-surface-variant cursor-pointer"
                            title="Edit Draft"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                          </button>
                          
                          {/* Print document */}
                          <button 
                            onClick={() => handlePrint(item)}
                            disabled={item.status !== 'Submitted'}
                            className={`w-8 h-8 rounded-full transition-colors flex items-center justify-center cursor-pointer ${
                              item.status === 'Submitted'
                                ? 'bg-surface-container hover:bg-surface-container-high hover:text-primary text-on-surface-variant'
                                : 'bg-surface-container/40 text-outline-variant/60 cursor-not-allowed'
                            }`}
                            title="Print Record"
                          >
                            <span className="material-symbols-outlined text-[15px]">print</span>
                          </button>

                          {/* PDF Preview View */}
                          <button 
                            onClick={() => {
                              setZoom(1.0);
                              setViewingEntry(item);
                            }}
                            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high hover:text-primary transition-colors flex items-center justify-center text-on-surface-variant cursor-pointer"
                            title="View Document"
                          >
                            <span className="material-symbols-outlined text-[15px]">visibility</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center text-[9px] text-outline font-bold mt-2 uppercase tracking-wide">
            <span>Showing {filteredLogs.length} of {onboardingHistory.length} logs</span>
            <span className="text-primary">Database sync online</span>
          </div>
        </div>

        {/* View Dialog modal inside renderHistoryScreen */}
        {viewingEntry && renderViewModal()}
      </div>
    );
  }

  // PDF-style interactive preview dialog modal
  function renderViewModal() {
    if (!viewingEntry) return null;

    const styles = `
      .pdf-paper {
        width: 610px;
        min-height: 800px;
        background: white;
        color: #1e293b;
        padding: 40px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        font-family: system-ui, -apple-system, sans-serif;
        line-height: 1.5;
        border-radius: 4px;
        transition: transform 0.2s ease-out;
        transform-origin: top center;
        text-align: left;
      }
    `;

    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[1000] flex flex-col overflow-hidden animate-fade-in font-body">
        <style>{styles}</style>
        
        {/* PDF Reader Toolbar */}
        <header className="h-16 bg-slate-900 border-b border-white/10 px-6 flex items-center justify-between shrink-0 text-white z-50 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-[20px]">picture_as_pdf</span>
            <div>
              <h4 className="font-headline text-xs font-black truncate max-w-xs md:max-w-md">
                onboarding_packet_${viewingEntry.id}.pdf
              </h4>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold font-mono">Native PDF-Style Reader</p>
            </div>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-4 bg-slate-800/80 border border-white/10 px-3.5 py-1.5 rounded-full text-xs font-bold">
            <button 
              onClick={() => setZoom(z => Math.max(0.6, z - 0.1))}
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-slate-700 active:scale-90 transition-all cursor-pointer text-white"
              title="Zoom Out"
            >
              <span className="material-symbols-outlined text-[15px]">remove</span>
            </button>
            <span className="font-mono text-[10px] w-12 text-center text-slate-300">
              {Math.round(zoom * 100)}%
            </span>
            <button 
              onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-slate-700 active:scale-90 transition-all cursor-pointer text-white"
              title="Zoom In"
            >
              <span className="material-symbols-outlined text-[15px]">add</span>
            </button>
            <div className="w-px h-3.5 bg-white/10"></div>
            <button 
              onClick={() => setZoom(1.0)}
              className="text-[10px] hover:text-primary transition-colors cursor-pointer text-slate-300"
            >
              Reset
            </button>
          </div>

          {/* Close button */}
          <button 
            onClick={() => setViewingEntry(null)}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </header>

        {/* PDF Reader Workspace */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-950/40 relative">
          
          {/* Document Sheet Viewer Panel */}
          <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-slate-950/60 custom-scrollbar relative">
            <div 
              className="pdf-paper"
              style={{ transform: `scale(${zoom})`, marginBottom: `${Math.max(20, (zoom - 1) * 300)}px` }}
            >
              {/* PDF Document Head */}
              <div className="border-b-2 border-emerald-500 pb-4 mb-6 flex justify-between items-end">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">Employee Onboarding Record</h2>
                  <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mt-1.5">Official HR Department File</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono font-bold text-slate-600 block">ID: {viewingEntry.id}</span>
                  <span className="text-[9px] font-semibold text-slate-500 block uppercase mt-0.5">{viewingEntry.status === 'Submitted' ? 'Submitted' : 'Draft Copy'}</span>
                </div>
              </div>

              {/* PDF Document Content */}
              <div className="space-y-6 text-slate-800 text-xs">
                
                {/* Section 1 */}
                <div>
                  <h3 className="text-[11px] font-bold text-teal-800 border-b border-slate-200 pb-1 mb-2 uppercase tracking-wide">1. Personal Information</h3>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-6">
                    <div><span className="font-bold text-slate-500">Full Name:</span> <span className="text-slate-900 font-semibold">{viewingEntry.formData.fullName}</span></div>
                    <div><span className="font-bold text-slate-500">Father's Name:</span> <span className="text-slate-900">{viewingEntry.formData.fatherName}</span></div>
                    <div><span className="font-bold text-slate-500">Date of Birth:</span> <span className="text-slate-900">{viewingEntry.formData.dob}</span></div>
                    <div><span className="font-bold text-slate-500">Marital Status:</span> <span className="text-slate-900 uppercase">{viewingEntry.formData.maritalStatus}</span></div>
                  </div>
                </div>

                {/* Section 2 */}
                <div>
                  <h3 className="text-[11px] font-bold text-teal-800 border-b border-slate-200 pb-1 mb-2 uppercase tracking-wide">2. Contact &amp; Identification</h3>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-6">
                    <div><span className="font-bold text-slate-500">Phone Number:</span> <span className="text-slate-900">{viewingEntry.formData.phone}</span></div>
                    <div><span className="font-bold text-slate-500">CNIC Number:</span> <span className="text-slate-900 font-mono">{viewingEntry.formData.cnic}</span></div>
                  </div>
                </div>

                {/* Section 3 */}
                <div>
                  <h3 className="text-[11px] font-bold text-teal-800 border-b border-slate-200 pb-1 mb-2 uppercase tracking-wide">3. Academic History</h3>
                  <p className="text-slate-700 leading-relaxed italic pr-4 pl-2 border-l-2 border-slate-200 py-1">
                    {viewingEntry.formData.academicDetails || 'No academic details provided.'}
                  </p>
                </div>

                {/* Section 4 */}
                <div>
                  <h3 className="text-[11px] font-bold text-teal-800 border-b border-slate-200 pb-1 mb-2 uppercase tracking-wide">4. Joining &amp; Assignment details</h3>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-6">
                    <div><span className="font-bold text-slate-500">Joining Date:</span> <span className="text-slate-900 font-semibold">{viewingEntry.joiningDate}</span></div>
                    <div><span className="font-bold text-slate-500">Designation / Role:</span> <span className="text-slate-900 font-bold text-teal-800">{viewingEntry.formData.designation || 'Associate'}</span></div>
                    <div><span className="font-bold text-slate-500">Department:</span> <span className="text-slate-900 font-semibold">{viewingEntry.formData.department}</span></div>
                    <div><span className="font-bold text-slate-500">Department Section:</span> <span className="text-slate-900">{viewingEntry.formData.section || 'N/A'}</span></div>
                    <div><span className="font-bold text-slate-500">Reporting Manager:</span> <span className="text-slate-900">{viewingEntry.formData.manager || 'Sarah Jenkins'}</span></div>
                    <div><span className="font-bold text-slate-500">Shift Selection:</span> <span className="text-slate-900 uppercase">{viewingEntry.formData.shift || 'Morning'}</span></div>
                  </div>
                </div>

                {/* Section 5 */}
                <div>
                  <h3 className="text-[11px] font-bold text-teal-800 border-b border-slate-200 pb-1 mb-2 uppercase tracking-wide">5. Offers &amp; Salary Structure</h3>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-6">
                    <div><span className="font-bold text-slate-500">Gross Salary (Annual):</span> <span className="text-slate-900 font-semibold">{currencySymbol}{Number(viewingEntry.formData.grossSalary || 0).toLocaleString()}</span></div>
                    <div><span className="font-bold text-slate-500">Basic Salary (Monthly):</span> <span className="text-slate-900 font-semibold">{currencySymbol}{Number(viewingEntry.formData.basicSalary || 0).toLocaleString()}</span></div>
                    <div><span className="font-bold text-slate-500">Overtime Allowed:</span> <span className="text-slate-900">{viewingEntry.formData.overtimeAllowed ? 'Yes' : 'No'}</span></div>
                    <div><span className="font-bold text-slate-500">Bonuses Eligible:</span> <span className="text-slate-900">{viewingEntry.formData.bonusesEligible ? 'Yes' : 'No'}</span></div>
                  </div>
                </div>

                {/* PDF Signatures bottom line */}
                <div className="pt-8 mt-8 border-t border-dashed border-slate-300 flex justify-between items-end">
                  <div className="flex flex-col items-center">
                    <div className="w-40 border-b border-slate-400 text-center pb-2 text-[10px] text-slate-400 uppercase tracking-widest font-mono">Authorized Sig</div>
                    <span className="text-[9px] font-semibold text-slate-500 mt-1.5 uppercase font-mono">HR Administrator</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="w-40 border-b border-slate-400 text-center pb-1 relative min-h-[45px] flex items-end justify-center">
                      {viewingEntry.signature ? (
                        viewingEntry.signature.startsWith('data:image') ? (
                          <img src={viewingEntry.signature} className="max-h-[40px] max-w-[150px] object-contain mb-0.5" alt="E-Sign" />
                        ) : (
                          <span className="text-teal-800 font-semibold tracking-wide text-[16px] mb-1 select-none" style={{ fontFamily: "'Brush Script MT', cursive, sans-serif" }}>
                            {viewingEntry.signature}
                          </span>
                        )
                      ) : (
                        <span className="text-[9px] text-slate-400 italic mb-1 uppercase font-mono tracking-widest">Pending Sign</span>
                      )}
                    </div>
                    <span className="text-[9px] font-semibold text-slate-500 mt-1.5 uppercase font-mono">Employee Signature</span>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* E-Signature Control Panel (Right Side Pane) */}
          <div className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-l border-white/10 p-6 flex flex-col gap-6 text-white shrink-0 z-40 overflow-y-auto">
            <div>
              <h4 className="font-headline text-sm font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[20px]">draw</span>
                E-Signature Verification
              </h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Draw or type the digital signature below to securely sign and verify this official employee profile record.
              </p>
            </div>

            {/* Toggle signature types */}
            <div className="flex bg-slate-800 p-1 rounded-xl border border-white/5 text-[10px] font-bold">
              <button 
                type="button"
                onClick={() => setSignatureType('draw')}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  signatureType === 'draw' ? 'bg-primary text-on-primary shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Draw Signature
              </button>
              <button 
                type="button"
                onClick={() => setSignatureType('type')}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  signatureType === 'type' ? 'bg-primary text-on-primary shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Type Signature
              </button>
            </div>

            {signatureType === 'draw' ? (
              /* Canvas Drawing Block */
              <div className="flex flex-col gap-2 shrink-0">
                <label className="text-[9px] uppercase font-black tracking-widest text-slate-400">Drawing Board</label>
                <div className="relative w-full h-32 bg-slate-950 rounded-xl border border-white/10 overflow-hidden cursor-crosshair">
                  <canvas 
                    ref={canvasElement => {
                      if (canvasElement && !canvasRef) {
                        setCanvasRef(canvasElement);
                      }
                    }}
                    width="280"
                    height="128"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-full"
                  />
                  {/* Subtle placeholder text inside canvas */}
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[8px] text-slate-600 font-bold uppercase tracking-widest font-mono pointer-events-none select-none">
                    Sign Here
                  </span>
                </div>
                <button 
                  type="button"
                  onClick={clearCanvas}
                  className="self-end text-[10px] font-bold text-primary hover:text-primary-container transition-colors cursor-pointer"
                >
                  Clear Drawing Pad
                </button>
              </div>
            ) : (
              /* Type handwriting block */
              <div className="flex flex-col gap-4 shrink-0 font-body">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] uppercase font-black tracking-widest text-slate-400">Type Name</label>
                  <input 
                    type="text"
                    value={typedName}
                    onChange={e => setTypedName(e.target.value)}
                    placeholder="e.g. Elena Rodriguez"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-primary/50 outline-none transition-all placeholder:text-slate-600 font-bold"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] uppercase font-black tracking-widest text-slate-400 font-body">Handwriting style</label>
                  <div className="grid grid-cols-3 gap-2 text-[11px] select-none font-bold">
                    <button 
                      type="button"
                      onClick={() => setHandwritingStyle('font-signature-1')}
                      className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                        handwritingStyle === 'font-signature-1' ? 'border-primary bg-primary/10 text-white' : 'border-white/5 bg-slate-950/50 text-slate-400'
                      }`}
                      style={{ fontFamily: "'Brush Script MT', cursive" }}
                    >
                      Style 1
                    </button>
                    <button 
                      type="button"
                      onClick={() => setHandwritingStyle('font-signature-2')}
                      className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                        handwritingStyle === 'font-signature-2' ? 'border-primary bg-primary/10 text-white' : 'border-white/5 bg-slate-950/50 text-slate-400'
                      }`}
                      style={{ fontFamily: "'Dancing Script', 'Lucida Handwriting', cursive" }}
                    >
                      Style 2
                    </button>
                    <button 
                      type="button"
                      onClick={() => setHandwritingStyle('font-signature-3')}
                      className={`p-2 rounded-lg border text-center font-mono font-black transition-all cursor-pointer ${
                        handwritingStyle === 'font-signature-3' ? 'border-primary bg-primary/10 text-white' : 'border-white/5 bg-slate-950/50 text-slate-400'
                      }`}
                    >
                      Style 3
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button 
              type="button"
              onClick={saveSignature}
              className="w-full bg-primary hover:bg-primary-container text-on-primary py-3 rounded-xl text-xs font-black transition-all shadow-md active:scale-[0.98] cursor-pointer mt-auto shrink-0"
            >
              Verify &amp; Save Signature
            </button>
          </div>

        </div>
      </div>
    );
  }
}
