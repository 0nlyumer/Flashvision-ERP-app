import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import GranularPermissionsModal from './GranularPermissionsModal';
import TelegramFields from './TelegramFields';
import { normalizeTelegramUsername, isValidTelegramChatId } from '../../utils/telegram';

export default function AddNewUser({ initialUser, onCancel }) {
  const { state, addUser, updateUser, addNotification } = useApp();
  const [activeModal, setActiveModal] = useState(null); // stores the module key to open modal
  const [showPassword, setShowPassword] = useState(false);

  const [departments, setDepartments] = useState([
    'Global Logistics',
    'Supply Chain Finance',
    'Quality Assurance',
    'Strategic Operations'
  ]);
  const [jobTitles, setJobTitles] = useState([
    'Senior Operator',
    'Fleet Manager',
    'Sales Executive',
    'System Administrator',
    'Warehouse Manager',
    'Admin'
  ]);
  const [employeesList, setEmployeesList] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    telegramUsername: '',
    telegramChatId: '',
    department: 'Global Logistics',
    jobTitle: 'Senior Operator',
    image: null,
    permissions: {
      dashboard: false,
      salesOrders: false,
      oms: false,
      productionPlanning: false,
      inventory: false,
      delivery: false,
      userManagement: false,
      settings: true,
      hr: false,
      chat: false,
      finance: false,
      flasham: false
    },
    granularPermissions: {
      settings: {
        displayScale: { _enabled: true, view: true, edit: true }
      }
    },
    requirePasswordChange: true,
    password: 'Temporary2024!',
    amPin: ''
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('hr_employees_list');
      if (saved) {
        setEmployeesList(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Error reading employees from localStorage:", e);
    }
  }, []);

  useEffect(() => {
    if (initialUser) {
      const perms = {
        salesOrders: false,
        oms: false,
        productionPlanning: false,
        inventory: false,
        delivery: false,
        userManagement: false,
        settings: false,
        hr: false,
        chat: false,
        finance: false,
        flasham: false
      };
      if (Array.isArray(initialUser.permissions)) {
        initialUser.permissions.forEach(p => { perms[p] = true; });
      } else if (typeof initialUser.permissions === 'object') {
        Object.assign(perms, initialUser.permissions);
      }

      if (initialUser.department && !departments.includes(initialUser.department)) {
        setDepartments(prev => [...prev, initialUser.department]);
      }
      if (initialUser.jobTitle && !jobTitles.includes(initialUser.jobTitle)) {
        setJobTitles(prev => [...prev, initialUser.jobTitle]);
      }

      setFormData({
        name: initialUser.name || '',
        username: initialUser.username || '',
        email: initialUser.email || '',
        phone: initialUser.phone || '',
        telegramUsername: normalizeTelegramUsername(initialUser.telegramUsername),
        telegramChatId: initialUser.telegramChatId || '',
        department: initialUser.department || 'Global Logistics',
        jobTitle: initialUser.jobTitle || 'Senior Operator',
        image: initialUser.image || null,
        permissions: perms,
        granularPermissions: initialUser.granularPermissions || {},
        allowedDepartments: initialUser.allowedDepartments || (state.departments || []).map(d => d.name || d.label || d.value || d),
        requirePasswordChange: initialUser.requirePasswordChange ?? true,
        password: initialUser.password || 'Temporary2024!',
        amPin: initialUser.amPin || ''
      });
    } else {
      setFormData(prev => ({
        ...prev,
        allowedDepartments: (state.departments || []).map(d => d.name || d.label || d.value || d)
      }));
    }
  }, [initialUser, state.departments]);

  const handleEmployeeSelect = (e) => {
    const selectedName = e.target.value;
    setSelectedEmployee(selectedName);

    if (selectedName) {
      const emp = employeesList.find(e => e.name === selectedName);
      if (emp) {
        if (emp.department && !departments.includes(emp.department)) {
          setDepartments(prev => [...prev, emp.department]);
        }
        if (emp.designation && !jobTitles.includes(emp.designation)) {
          setJobTitles(prev => [...prev, emp.designation]);
        }

        const autoUsername = emp.name.toLowerCase().replace(/[^a-z0-9]/g, '');

        setFormData(prev => ({
          ...prev,
          name: emp.name,
          username: autoUsername,
          email: emp.email || `${autoUsername}@company.com`,
          phone: emp.phone || '0300-1234567',
          department: emp.department || prev.department,
          jobTitle: emp.designation || prev.jobTitle,
          image: emp.avatar || null
        }));
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePermissionChange = (perm) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [perm]: !prev.permissions[perm]
      }
    }));
  };

  const handleDeptPermissionChange = (deptName) => {
    setFormData(prev => {
      const current = prev.allowedDepartments || [];
      const exists = current.includes(deptName);
      const nextAllowed = exists 
        ? current.filter(d => d !== deptName)
        : [...current, deptName];
      return {
        ...prev,
        allowedDepartments: nextAllowed
      };
    });
  };

  const handleSaveUser = () => {
    const requiredFields = ['name', 'username', 'email', 'phone', 'department', 'jobTitle'];
    const missingFields = requiredFields.filter(f => !formData[f]);
    
    if (missingFields.length > 0) {
      const fieldNames = missingFields.map(f => f.charAt(0).toUpperCase() + f.slice(1).replace(/([A-Z])/g, ' $1'));
      alert(`Profile Setup Incomplete!\n\nPlease fill in all required profile fields:\n- ${fieldNames.join('\n- ')}`);
      return;
    }

    const usernameExists = state?.users?.some(u =>
      u.username?.toLowerCase() === formData.username?.trim().toLowerCase() &&
      (!initialUser || u.id !== initialUser.id)
    );
    if (usernameExists) {
      alert(`Username Error!\n\nThe username "@${formData.username}" is already taken. Please choose a different username.`);
      return;
    }

    const amPinValue = (formData.amPin || '').trim();
    if (amPinValue && !/^\d{4,6}$/.test(amPinValue)) {
      alert(`Flash AM PIN Error!\n\nThe Flash AM PIN must be 4 to 6 numeric digits, or left empty to clear it.`);
      return;
    }

    const telegramChatIdValue = (formData.telegramChatId || '').trim();
    if (telegramChatIdValue && !isValidTelegramChatId(telegramChatIdValue)) {
      alert(`Telegram Chat ID Error!\n\nThe Telegram Chat ID must be numeric digits only (a leading minus is allowed for groups/channels), or left empty to unlink.`);
      return;
    }

    const userData = {
      name: formData.name,
      username: formData.username,
      email: formData.email,
      phone: formData.phone,
      telegramUsername: normalizeTelegramUsername(formData.telegramUsername),
      telegramChatId: telegramChatIdValue,
      department: formData.department,
      jobTitle: formData.jobTitle,
      role: formData.jobTitle,
      image: formData.image,
      status: 'Active',
      initials: formData.name.substring(0, 2).toUpperCase(),
      permissions: Object.keys(formData.permissions).filter(k => formData.permissions[k]),
      granularPermissions: formData.granularPermissions,
      allowedDepartments: formData.allowedDepartments || (state.departments || []).map(d => d.name || d.label || d.value || d),
      requirePasswordChange: formData.requirePasswordChange,
      password: formData.password,
      amPin: amPinValue
    };

    if (initialUser) {
      updateUser(initialUser.id, userData);
    } else {
      userData.id = Date.now();
      addUser(userData);
    }
    
    if (onCancel) onCancel();
  };

  const handleSaveGranular = (moduleKey, savedPermissions) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleKey]: true
      },
      granularPermissions: {
        ...prev.granularPermissions,
        [moduleKey]: savedPermissions
      }
    }));
    setActiveModal(null);
  };

  return (
    <div className="animate-in fade-in duration-500 pb-24">
      {/* Page Header */}
      <div className="mb-10 flex flex-col items-start">
        <button onClick={onCancel} className="mb-4 flex items-center gap-2 text-primary hover:underline text-sm font-bold bg-primary/5 hover:bg-primary/10 px-4 py-2 rounded-xl transition-colors">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to Directory
        </button>
        <div>
          <h2 className="text-4xl font-extrabold text-on-surface tracking-tight mb-2">{initialUser ? 'Edit User Profile' : 'Add New User'}</h2>
          <p className="text-on-surface-variant max-w-md text-sm">
            {initialUser ? 'Modify user details and granular permissions.' : 'Onboard a new member to the Flashvision ecosystem with specific permissions.'}
          </p>
        </div>
      </div>

      {/* Form Sectioning via Tonal Shifts */}
      <div className="space-y-8">
        {/* User Information Section */}
        <section className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/10">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>person_add</span>
            <h3 className="text-lg font-extrabold font-headline">User Information</h3>
          </div>

          {/* Link Employee Profile Lookup */}
          {!initialUser && (
            <div className="mb-8 space-y-2 max-w-md">
              <label className="text-[10px] font-bold text-primary uppercase tracking-widest ml-1">
                Link Employee Profile (Auto-fills details)
              </label>
              <div className="relative">
                <select
                  onChange={handleEmployeeSelect}
                  defaultValue=""
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-xl px-4 py-3 outline-none transition-all appearance-none cursor-pointer text-sm font-semibold text-on-surface"
                >
                  <option value="" disabled>-- Select Employee to Auto-fill --</option>
                  {employeesList.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.id} - {emp.department})
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">arrow_drop_down</span>
              </div>
            </div>
          )}

          {/* Profile Picture Upload */}
          <div className="mb-8 flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-surface-dim border-2 border-outline-variant/30 flex items-center justify-center overflow-hidden shrink-0">
              {formData.image ? (
                <img src={formData.image} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-3xl text-outline-variant">person</span>
              )}
            </div>
            <div>
              <label className="cursor-pointer bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl text-xs font-bold transition-colors inline-block mb-2 shadow-sm">
                Upload Picture
                <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                  const file = e.target.files[0];
                  if(file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setFormData(prev => ({ ...prev, image: reader.result }));
                    };
                    reader.readAsDataURL(file);
                  }
                }} />
              </label>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Recommended: Square image, max 1MB</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">Full Name</label>
              <input 
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full bg-surface-container-lowest border border-outline-variant/20 focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-xl px-4 py-3 outline-none transition-all placeholder:text-outline-variant/60 text-sm font-semibold" 
                placeholder="e.g. Jonathan Aris" 
                type="text" 
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">Username</label>
                {formData.username.trim() !== '' && (
                  state?.users?.some(u => u.username?.toLowerCase() === formData.username.trim().toLowerCase() && (!initialUser || u.id !== initialUser.id)) ? (
                    <span className="text-red-500 text-[10px] font-bold">username already taken</span>
                  ) : (
                    <span className="text-green-500 text-[10px] font-bold flex items-center gap-0.5 animate-pulse">
                      <span className="material-symbols-outlined text-[12px] font-bold">check_circle</span>
                      available
                    </span>
                  )
                )}
              </div>
              <div className="relative">
                <input 
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className={`w-full bg-surface-container-lowest border rounded-xl px-4 py-3 outline-none transition-all placeholder:text-outline-variant/60 text-sm font-semibold ${formData.username.trim() !== '' ? (state?.users?.some(u => u.username?.toLowerCase() === formData.username.trim().toLowerCase() && (!initialUser || u.id !== initialUser.id)) ? 'border-red-500 focus:ring-2 focus:ring-red-200' : 'border-green-500 focus:ring-2 focus:ring-green-200') : 'border-outline-variant/20 focus:ring-2 focus:ring-primary/20 focus:border-primary'}`} 
                  placeholder="j_aris_flash" 
                  type="text" 
                />
                {formData.username.trim() !== '' && (
                  <span className={`material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] ${state?.users?.some(u => u.username?.toLowerCase() === formData.username.trim().toLowerCase() && (!initialUser || u.id !== initialUser.id)) ? 'text-red-500' : 'text-green-500'}`}>
                    {state?.users?.some(u => u.username?.toLowerCase() === formData.username.trim().toLowerCase() && (!initialUser || u.id !== initialUser.id)) ? 'cancel' : 'check_circle'}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">Email Address</label>
              <input 
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full bg-surface-container-lowest border border-outline-variant/20 focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-xl px-4 py-3 outline-none transition-all placeholder:text-outline-variant/60 text-sm font-semibold" 
                placeholder="j.aris@flashvision.com" 
                type="email" 
              />
            </div>
            <div className="space-y-2 md:col-span-3">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">Phone Number</label>
              <input 
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full bg-surface-container-lowest border border-outline-variant/20 focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-xl px-4 py-3 outline-none transition-all placeholder:text-outline-variant/60 text-sm font-semibold" 
                placeholder="+1 (555) 000-0000" 
                type="tel" 
              />
            </div>
          </div>
        </section>

        {/* Telegram Section — link only; sending stays OFF until the owner enables it */}
        <section className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/10">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
            <h3 className="text-lg font-extrabold font-headline">Telegram</h3>
          </div>
          <TelegramFields
            telegramUsername={formData.telegramUsername}
            telegramChatId={formData.telegramChatId}
            onUsernameChange={(v) => setFormData(prev => ({ ...prev, telegramUsername: v }))}
            onChatIdChange={(v) => setFormData(prev => ({ ...prev, telegramChatId: v }))}
            inputClassName="w-full bg-surface-container-lowest border border-outline-variant/20 focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-xl px-4 py-3 outline-none transition-all placeholder:text-outline-variant/60 text-sm font-semibold"
          />
        </section>

        {/* Account Details Section */}
        <section className="bg-surface-container p-8 rounded-xl border border-outline-variant/10">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>corporate_fare</span>
            <h3 className="text-lg font-extrabold font-headline">Account Details</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">Department</label>
              <div className="relative">
                <select 
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-xl px-4 py-3 outline-none transition-all appearance-none cursor-pointer text-sm font-semibold text-on-surface"
                >
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">arrow_drop_down</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">Job Title</label>
              <div className="relative">
                <select 
                  name="jobTitle"
                  value={formData.jobTitle}
                  onChange={handleInputChange}
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-xl px-4 py-3 outline-none transition-all appearance-none cursor-pointer text-sm font-semibold text-on-surface"
                >
                  {jobTitles.map(job => (
                    <option key={job} value={job}>{job}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">arrow_drop_down</span>
              </div>
            </div>
          </div>
        </section>

        {/* Module Access Permissions Section */}
        <section className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>key</span>
              <h3 className="text-lg font-extrabold font-headline">Module Access Permissions</h3>
            </div>
            
            {/* Full Access Toggle */}
            <label className="flex items-center gap-3 cursor-pointer group select-none">
              <span className="text-xs font-bold text-on-surface-variant group-hover:text-primary transition-colors uppercase tracking-wider">Full Access</span>
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="peer sr-only" 
                  checked={Object.values(formData.permissions).every(Boolean)}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    const nextPerms = {};
                    Object.keys(formData.permissions).forEach(k => {
                      nextPerms[k] = isChecked;
                    });
                    if (isChecked) {
                      setJobTitles(prev => prev.includes('Super Admin') ? prev : [...prev, 'Super Admin']);
                    }
                    setFormData(prev => ({
                      ...prev,
                      jobTitle: isChecked ? 'Super Admin' : prev.jobTitle,
                      permissions: nextPerms
                    }));
                  }}
                />
                <div className={`w-10 h-5 rounded-full transition-colors relative duration-200 ${Object.values(formData.permissions).every(Boolean) ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/50'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all duration-200 ${Object.values(formData.permissions).every(Boolean) ? 'left-[22px]' : 'left-0.5'}`}></div>
                </div>
              </div>
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-8">
            {Object.keys(formData.permissions).map((perm) => (
              <div 
                key={perm} 
                className="flex items-center justify-between bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 hover:border-primary/30 transition-all select-none"
              >
                <label className="flex items-center gap-4 cursor-pointer group flex-grow">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="peer sr-only" 
                      checked={formData.permissions[perm]}
                      onChange={() => handlePermissionChange(perm)}
                    />
                    <div className={`w-6 h-6 border-2 rounded-lg flex items-center justify-center transition-all ${formData.permissions[perm] ? 'bg-primary border-primary' : 'border-outline-variant'}`}>
                      <span className={`material-symbols-outlined text-white text-sm transition-transform ${formData.permissions[perm] ? 'scale-100' : 'scale-0'}`}>check</span>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold transition-colors ${formData.permissions[perm] ? 'text-primary' : 'text-on-surface group-hover:text-primary'}`}>
                    {perm === 'salesOrders' ? 'Sales Orders' : 
                     perm === 'oms' ? 'OMS' :
                     perm === 'productionPlanning' ? 'Production Planning' :
                     perm === 'inventory' ? 'Inventory' :
                     perm === 'delivery' ? 'Delivery' :
                     perm === 'settings' ? 'Settings' :
                     perm === 'hr' ? 'HR Management' :
                     perm === 'chat' ? 'Chat Module' :
                     perm === 'finance' ? 'Finance Module' :
                     perm === 'flasham' ? 'Flash AM Terminal' :
                     'User Management'}
                  </span>
                </label>
                
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    if (formData.permissions[perm]) {
                      setActiveModal(perm);
                    } else {
                      addNotification('Enable Module First', 'Please enable the module before configuring granular permissions.', 'info');
                    }
                  }}
                  className={`ml-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 shrink-0 ${
                    formData.permissions[perm] 
                      ? 'bg-primary/10 text-primary hover:bg-primary hover:text-on-primary' 
                      : 'bg-surface-dim text-on-surface-variant/40 hover:bg-surface-variant/10 cursor-pointer'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  Open
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Department Access Rights Section */}
        <section className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>corporate_fare</span>
              <div>
                <h3 className="text-lg font-extrabold font-headline">Department Access Rights</h3>
                <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                  Select which departments this user can view & access in system dropdowns.
                </p>
              </div>
            </div>
            
            {/* Allow All Departments Toggle */}
            <label className="flex items-center gap-3 cursor-pointer group select-none">
              <span className="text-xs font-bold text-on-surface-variant group-hover:text-primary transition-colors uppercase tracking-wider">All Departments</span>
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="peer sr-only" 
                  checked={(state.departments || []).length > 0 && (formData.allowedDepartments || []).length === (state.departments || []).length}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    const allDeptNames = (state.departments || []).map(d => d.name || d.label || d.value || d);
                    setFormData(prev => ({
                      ...prev,
                      allowedDepartments: isChecked ? allDeptNames : []
                    }));
                  }}
                />
                <div className={`w-10 h-5 rounded-full transition-colors relative duration-200 ${(state.departments || []).length > 0 && (formData.allowedDepartments || []).length === (state.departments || []).length ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/50'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all duration-200 ${(state.departments || []).length > 0 && (formData.allowedDepartments || []).length === (state.departments || []).length ? 'left-[22px]' : 'left-0.5'}`}></div>
                </div>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(state.departments || []).map((dept) => {
              const deptName = typeof dept === 'string' ? dept : (dept.name || dept.label || dept.value || dept.id);
              const isChecked = (formData.allowedDepartments || []).includes(deptName) || (formData.allowedDepartments || []).includes(dept.id);

              return (
                <div 
                  key={dept.id || deptName}
                  onClick={() => handleDeptPermissionChange(deptName)}
                  className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all select-none ${
                    isChecked ? 'bg-primary/5 border-primary/30 shadow-xs' : 'bg-surface-container-lowest border-outline-variant/10 hover:border-outline-variant/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${isChecked ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>
                      <span className="material-symbols-outlined text-base">domain</span>
                    </div>
                    <span className={`text-xs font-bold ${isChecked ? 'text-primary' : 'text-on-surface'}`}>
                      {deptName}
                    </span>
                  </div>

                  <div className="relative inline-block w-8 h-4 shrink-0">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={isChecked}
                      onChange={() => handleDeptPermissionChange(deptName)}
                    />
                    <div className={`block w-8 h-4 rounded-full transition-all duration-200 ${isChecked ? 'bg-primary' : 'bg-slate-300'}`}>
                      <div className={`absolute left-0.5 top-0.5 bg-white w-3 h-3 rounded-full transition-transform duration-200 ${isChecked ? 'translate-x-4' : ''}`}></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Security Section */}
        <section className="bg-surface-container-high p-8 rounded-xl border border-outline-variant/10">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
            <h3 className="text-lg font-extrabold font-headline">Security & Access</h3>
          </div>
          <div className="space-y-6">
            <div className="max-w-md space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">Temporary Password</label>
              <div className="relative">
                <input 
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-xl px-4 py-3 outline-none transition-all text-sm font-semibold text-on-surface" 
                  type={showPassword ? "text" : "password"} 
                />
                <span 
                  onClick={() => setShowPassword(!showPassword)}
                  className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant cursor-pointer text-[18px] hover:text-primary transition-colors select-none"
                >
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </div>
            </div>
            <div className="max-w-md space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest ml-1">Flash AM PIN (Reset)</label>
              <div className="relative">
                <input
                  name="amPin"
                  value={formData.amPin || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, amPin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  placeholder="Not set"
                  inputMode="numeric"
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-xl px-4 py-3 outline-none transition-all text-sm font-semibold text-on-surface"
                  type="text"
                />
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] select-none">pin</span>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">4–6 digit PIN this user enters on the Flash AM terminal. Type a new PIN to reset it, or leave empty to clear it.</p>
            </div>
            <label className="flex items-center gap-4 cursor-pointer group">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="peer sr-only" 
                  checked={formData.requirePasswordChange}
                  onChange={(e) => setFormData(prev => ({ ...prev, requirePasswordChange: e.target.checked }))}
                />
                <div className={`w-6 h-6 border-2 rounded-lg flex items-center justify-center transition-all ${formData.requirePasswordChange ? 'bg-primary border-primary' : 'border-outline-variant'}`}>
                  <span className={`material-symbols-outlined text-white text-sm transition-transform ${formData.requirePasswordChange ? 'scale-100' : 'scale-0'}`}>check</span>
                </div>
              </div>
              <span className={`text-sm font-semibold transition-colors ${formData.requirePasswordChange ? 'text-on-surface' : 'text-on-surface-variant group-hover:text-primary'}`}>
                Require password change on first login
              </span>
            </label>
          </div>
        </section>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-4 pt-6">
          <button onClick={onCancel} className="px-6 py-2.5 text-on-surface-variant font-bold hover:bg-surface-container hover:text-on-surface rounded-xl transition-all text-sm">
            Cancel
          </button>
          <button onClick={handleSaveUser} className="px-6 py-2.5 bg-primary text-on-primary font-bold rounded-xl shadow-sm flex items-center gap-2 hover:shadow-md hover:bg-primary/90 transition-all text-sm">
            <span>{initialUser ? 'Save Changes' : 'Create User'}</span>
            <span className="material-symbols-outlined text-[18px]">{initialUser ? 'save' : 'arrow_forward'}</span>
          </button>
        </div>
      </div>

      {activeModal && (
        <GranularPermissionsModal
          moduleKey={activeModal}
          initialPermissions={formData.granularPermissions[activeModal] || {}}
          userName={formData.name || formData.username}
          onSave={(perms) => handleSaveGranular(activeModal, perms)}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
