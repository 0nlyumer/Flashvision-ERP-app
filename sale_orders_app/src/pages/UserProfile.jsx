import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import TelegramFields from '../components/usercontrol/TelegramFields';
import { normalizeTelegramUsername, isValidTelegramChatId } from '../utils/telegram';

export default function UserProfile() {
  const { state, updateUser, hasPermission, connectionId, triggerHeartbeat, currencySymbol } = useApp();
  const { appAlert } = useDialog();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const currentUser = state.currentUser || {
    id: 1,
    name: 'Admin',
    username: 'admin',
    role: 'Super Admin',
    email: 'admin@flashvision.corp',
    phone: '+92 300 1234567',
    dateOfJoining: '12-Oct-2023',
    permissions: []
  };

  const forceChangeParam = searchParams.get('forceChange') === 'true';
  const isForceChange = forceChangeParam || currentUser.requirePasswordChange;

  const parseUA = (dbDeviceInfo, connId, currentConnId) => {
    let ua = dbDeviceInfo || '';
    let customName = "";
    if (dbDeviceInfo && dbDeviceInfo.includes('|')) {
      const parts = dbDeviceInfo.split('|');
      customName = parts[0];
      ua = parts[1];
    }
    
    let os = "Unknown OS";
    let browser = "Unknown Browser";
    let icon = "devices";
    
    if (ua) {
      // OS detection
      if (/windows/i.test(ua)) {
        os = "Windows PC";
        icon = "desktop_windows";
      } else if (/macintosh|mac os x/i.test(ua) && !/iphone|ipad|ipod/i.test(ua)) {
        os = "MacBook / iMac";
        icon = "laptop_mac";
      } else if (/iphone/i.test(ua)) {
        os = "iPhone";
        icon = "phone_iphone";
      } else if (/ipad/i.test(ua)) {
        os = "iPad";
        icon = "tablet_mac";
      } else if (/android/i.test(ua)) {
        os = "Android Device";
        icon = "phone_android";
      } else if (/linux/i.test(ua)) {
        os = "Linux Workstation";
        icon = "desktop_windows";
      }

      // Browser detection
      if (/edg/i.test(ua)) {
        browser = "Microsoft Edge";
      } else if (/chrome|crios/i.test(ua) && !/opr|opios|edg/i.test(ua)) {
        browser = "Google Chrome";
      } else if (/safari/i.test(ua) && !/chrome|crios|opr|opios|edg/i.test(ua)) {
        browser = "Apple Safari";
      } else if (/firefox|fxios/i.test(ua)) {
        browser = "Mozilla Firefox";
      } else if (/opr|opios/i.test(ua)) {
        browser = "Opera";
      }
    }

    // Attempt to extract mobile model if Android
    if (ua && /android/i.test(ua)) {
      const match = ua.match(/\(([^)]+)\)/);
      if (match && match[1]) {
        const parts = match[1].split(';');
        const modelPart = parts.find(p => p.includes('Build/') || /samsung|redmi|xiaomi|pixel|huawei|oppo|vivo|oneplus|moto|lg/i.test(p));
        if (modelPart) {
          const cleanModel = modelPart.replace(/Build\/.*/, '').trim();
          if (cleanModel) os = cleanModel;
        } else if (parts.length >= 3) {
          const lastPart = parts[parts.length - 1].trim();
          if (!lastPart.includes('Android') && !lastPart.includes('Linux') && lastPart.length < 30) {
            os = lastPart;
          }
        }
      }
    }

    const isCurrent = connId === currentConnId;
    const deviceName = customName || os;
    const versionDetails = `${browser}${isCurrent ? ' • This Device' : ''}`;

    return {
      deviceName,
      versionDetails,
      icon,
      isCurrent
    };
  };

  const [activeDevices, setActiveDevices] = useState([]);

  useEffect(() => {
    if (!currentUser?.username) return;

    const fetchDevices = async () => {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('username', currentUser.username);

      if (!error && data) {
        setActiveDevices(data);
      }
    };

    fetchDevices();
    const interval = setInterval(fetchDevices, 10000); // polling every 10s
    return () => clearInterval(interval);
  }, [currentUser?.username]);

  const handleEditDeviceName = () => {
    const currentName = localStorage.getItem('custom_device_name') || '';
    const newName = prompt("Enter a custom name for this device (e.g. My MacBook Pro, Umer's Phone):", currentName);
    if (newName !== null) {
      const trimmed = newName.trim();
      localStorage.setItem('custom_device_name', trimmed);
      
      // Update local state immediately
      setActiveDevices(prev => prev.map(dev => {
        if (dev.connection_id === connectionId) {
          const ua = dev.device_info.includes('|') ? dev.device_info.split('|')[1] : dev.device_info;
          return {
            ...dev,
            device_info: trimmed ? `${trimmed}|${ua}` : ua
          };
        }
        return dev;
      }));

      // Trigger heartbeat to sync immediately to DB
      if (triggerHeartbeat) {
        triggerHeartbeat();
      }
    }
  };

  // Profile data state
  const [fullName, setFullName] = useState(currentUser.name || '');
  const [username, setUsername] = useState(currentUser.username || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [phone, setPhone] = useState(currentUser.phone || '+92 300 1234567');
  const [telegramUsername, setTelegramUsername] = useState(normalizeTelegramUsername(currentUser.telegramUsername));
  const [telegramChatId, setTelegramChatId] = useState(currentUser.telegramChatId || '');
  const [dateOfJoining, setDateOfJoining] = useState(currentUser.dateOfJoining || '12-Oct-2023');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Accordion state
  const [expandedSections, setExpandedSections] = useState({
    account: true,
    password: false,
    devices: true,
    telegram: false,
    compensation: false,
    benefits: false
  });

  // Time Tracker state
  const [timerSecs, setTimerSecs] = useState(13500); // 3h 45m (03:45)
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerIntervalRef = useRef(null);

  // Onboarding Tasks State
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Client Meeting', time: 'Sep 12, 09:30', completed: true },
    { id: 2, text: 'Design Review', time: 'Sep 13, 10:30', completed: true },
    { id: 3, text: 'Project Update', time: 'Sep 18, 13:00', completed: true },
    { id: 4, text: 'Discuss QS Goals', time: 'Sep 19, 14:45', completed: false },
    { id: 5, text: 'HR Policy Review', time: 'Sep 20, 11:30', completed: false },
    { id: 6, text: 'IT Setup and Installation', time: 'Sep 21, 15:00', completed: false },
    { id: 7, text: 'Security Protocol Signoff', time: 'Sep 22, 10:00', completed: false },
    { id: 8, text: 'Direct Deposit & Benefits Setup', time: 'Sep 23, 16:30', completed: false }
  ]);

  // Sync user profile values when currentUser loads/changes
  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.name || '');
      setUsername(currentUser.username || '');
      setEmail(currentUser.email || '');
      setPhone(currentUser.phone || '+92 300 1234567');
      setTelegramUsername(normalizeTelegramUsername(currentUser.telegramUsername));
      setTelegramChatId(currentUser.telegramChatId || '');
      setDateOfJoining(currentUser.dateOfJoining || '12-Oct-2023');
    }
  }, [state.currentUser]);

  useEffect(() => {
    if (isForceChange) {
      setExpandedSections(prev => ({
        ...prev,
        account: false,
        password: true,
        devices: false,
        compensation: false,
        benefits: false
      }));
    }
  }, [isForceChange]);

  // Toggle Accordion Panels
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Timer Tick Action
  useEffect(() => {
    if (isTimerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSecs(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isTimerRunning]);

  const handleTimerPlayPause = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const handleTimerReset = () => {
    setIsTimerRunning(false);
    setTimerSecs(13500); // Reset to 3h 45m
  };

  // Format Timer output
  const formatTimer = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return {
      formatted: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      secondsFormatted: String(seconds).padStart(2, '0'),
      totalFormatted: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    };
  };

  const timeData = formatTimer(timerSecs);

  // Toggle Task Completion
  const handleToggleTask = (taskId) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
  };

  // Calculations for Onboarding Progress
  const completedTasksCount = tasks.filter(t => t.completed).length;
  const totalTasksCount = tasks.length;
  const onboardingPercentage = Math.round((completedTasksCount / totalTasksCount) * 100);

  // Save Account Profile Changes
  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      appAlert('Full Name cannot be empty.', 'error');
      return;
    }
    if (!username.trim()) {
      appAlert('Username cannot be empty.', 'error');
      return;
    }

    const telegramChatIdValue = (telegramChatId || '').trim();
    if (telegramChatIdValue && !isValidTelegramChatId(telegramChatIdValue)) {
      appAlert('Telegram Chat ID must be numeric digits only (a leading minus is allowed for groups/channels), or left empty to unlink.', 'error');
      return;
    }

    // Check if username is taken by another user
    const usernameExists = (state.users || []).some(
      u => u.username.toLowerCase() === username.trim().toLowerCase() && u.id !== currentUser.id
    );
    if (usernameExists) {
      appAlert('Username is already taken by another employee.', 'error');
      return;
    }

    updateUser(currentUser.id, {
      name: fullName.trim(),
      username: username.trim(),
      email: email.trim(),
      phone: phone.trim(),
      telegramUsername: normalizeTelegramUsername(telegramUsername),
      telegramChatId: telegramChatIdValue,
      dateOfJoining: dateOfJoining.trim()
    });

    appAlert('Account settings updated successfully.', 'success');
  };

  // Save Password Change
  const handleSavePassword = (e) => {
    e.preventDefault();
    if (!currentPassword) {
      appAlert('Please enter your current password.', 'error');
      return;
    }
    if (currentUser.password && currentPassword !== currentUser.password) {
      appAlert('Current password does not match.', 'error');
      return;
    }
    if (!newPassword) {
      appAlert('New password cannot be empty.', 'error');
      return;
    }
    if (newPassword.length < 4) {
      appAlert('Password must be at least 4 characters long.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      appAlert('Confirm password does not match new password.', 'error');
      return;
    }

    updateUser(currentUser.id, {
      password: newPassword,
      requirePasswordChange: false
    });

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setExpandedSections(prev => ({ ...prev, password: false }));
    appAlert('Password updated successfully.', 'success');
    navigate('/profile', { replace: true });
  };

  return (
    <Layout subNavConfig={null}>
      <div className="min-h-screen bg-[#eef2f6] text-slate-800 -m-8 lg:-m-12 p-6 lg:p-8 font-sans">
        {/* Custom Premium Header matching the Crextio Layout */}
        <header className="flex items-center justify-between bg-white rounded-[24px] px-8 py-4 mb-6 shadow-sm border border-slate-100 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#1d4ed8]/10 flex items-center justify-center text-[#1d4ed8]">
              <span className="material-symbols-outlined text-[20px] font-bold">settings</span>
            </div>
            <span className="text-xl font-extrabold text-[#0f172a] tracking-tight font-headline">Settings & Profile</span>
          </div>

          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors text-slate-500 relative">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-600 rounded-full"></span>
            </button>
            <div
              onClick={() => !isForceChange && navigate('/profile')}
              className={`w-10 h-10 rounded-full overflow-hidden border border-slate-200 shadow-sm ${isForceChange ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCpE_7nq3cQA2WhQwuKWRDeRExnrwDZ2H4cLF9MyG5b8jJwrnmbawBaT3K0ZvtOEBBws0978SY6nNpxxcGodOkJF4gaHFTMaOSc2FXlK-TIZp-2Vgr33JIbpf0eUnfbhhr3MIq1NPxu47bJgK2ot6dCu1P9p381UKWpXqz30L-69ajlaIe17bTDt5BIAT4GFF2fOSyYtsb4IFTfqUvFtSShYTbXFw1paQT1RfoSsoH2r-XNYODxmk9Xc-XziXFtdFLNwzH_TJu_V1_6"
                alt="Profile Avatar"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </header>

        {/* Sub Header Welcome row */}
        <section className="mb-6 px-2">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
            Welcome in, {currentUser.name}
          </h1>
        </section>

        {/* Bento Grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT SIDEBAR: PROFILE CARD & ACCORDION FORM */}
          <div className="md:col-span-1 lg:col-span-3 flex flex-col gap-6">
            
            {/* Image card with avatar */}
            <div className="bg-gradient-to-br from-[#bfdbfe] to-[#eff6ff] rounded-[32px] p-6 text-center shadow-sm border border-white/40 relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
              
              <div className="relative w-28 h-28 mx-auto mb-4 rounded-full overflow-hidden border-4 border-white shadow-md">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCpE_7nq3cQA2WhQwuKWRDeRExnrwDZ2H4cLF9MyG5b8jJwrnmbawBaT3K0ZvtOEBBws0978SY6nNpxxcGodOkJF4gaHFTMaOSc2FXlK-TIZp-2Vgr33JIbpf0eUnfbhhr3MIq1NPxu47bJgK2ot6dCu1P9p381UKWpXqz30L-69ajlaIe17bTDt5BIAT4GFF2fOSyYtsb4IFTfqUvFtSShYTbXFw1paQT1RfoSsoH2r-XNYODxmk9Xc-XziXFtdFLNwzH_TJu_V1_6"
                  alt="Alex Chen Profile"
                  className="w-full h-full object-cover"
                />
              </div>

              <h2 className="text-xl font-black text-slate-800 tracking-tight leading-snug">{currentUser.name}</h2>
              <p className="text-xs text-slate-500 font-semibold mb-1">{currentUser.role || 'UX/UI Designer'}</p>
            </div>

            {/* Collapsible details panel */}
            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 flex flex-col gap-4">
              
              {/* Account Details Accordion */}
              <div className="border-b border-slate-100 pb-3">
                <button
                  onClick={() => toggleSection('account')}
                  className="w-full flex items-center justify-between py-2 text-sm font-bold text-slate-800 hover:text-blue-600 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">badge</span>
                    Account Details
                  </span>
                  <span className="material-symbols-outlined text-[18px]">
                    {expandedSections.account ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {expandedSections.account && (
                  <form onSubmit={handleSaveProfile} className="mt-3 space-y-3.5 animate-fade-in">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all font-semibold"
                      />
                    </div>
                     <div className="flex flex-col gap-1">
                       <div className="flex items-center justify-between">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Username</label>
                         {username.trim() !== '' && (
                           (state.users || []).some(u => u.username?.toLowerCase() === username.trim().toLowerCase() && u.id !== currentUser.id) ? (
                             <span className="text-red-500 text-[10px] font-bold font-sans">username already taken</span>
                           ) : (
                             <span className="text-green-500 text-[10px] font-bold flex items-center gap-0.5 animate-pulse font-sans">
                               <span className="material-symbols-outlined text-[12px] font-bold">check_circle</span>
                               available
                             </span>
                           )
                         )}
                       </div>
                       <div className="relative">
                         <input
                           type="text"
                           value={username}
                           onChange={(e) => setUsername(e.target.value)}
                           className={`w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 pr-10 text-xs text-slate-700 outline-none focus:bg-white transition-all font-semibold ${username.trim() !== '' ? ((state.users || []).some(u => u.username?.toLowerCase() === username.trim().toLowerCase() && u.id !== currentUser.id) ? 'border-red-500 focus:ring-2 focus:ring-red-100' : 'border-green-500 focus:ring-2 focus:ring-green-100') : 'border-slate-200/80 focus:border-blue-500'}`}
                         />
                         {username.trim() !== '' && (
                           <span className={`material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[16px] ${(state.users || []).some(u => u.username?.toLowerCase() === username.trim().toLowerCase() && u.id !== currentUser.id) ? 'text-red-500' : 'text-green-500'}`}>
                             {(state.users || []).some(u => u.username?.toLowerCase() === username.trim().toLowerCase() && u.id !== currentUser.id) ? 'cancel' : 'check_circle'}
                           </span>
                         )}
                       </div>
                     </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all font-semibold"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone / Ext</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all font-semibold"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date of Joining</label>
                      <input
                        type="text"
                        value={dateOfJoining}
                        disabled
                        className="bg-slate-100 border border-slate-200/50 rounded-xl px-3.5 py-2.5 text-xs text-slate-500 cursor-not-allowed font-semibold"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-blue-100"
                    >
                      <span className="material-symbols-outlined text-[14px]">save</span>
                      Save Changes
                    </button>
                  </form>
                )}
              </div>

              {/* Telegram Accordion — link only; sending stays OFF until the owner enables it */}
              <div className="border-b border-slate-100 pb-3">
                <button
                  onClick={() => toggleSection('telegram')}
                  className="w-full flex items-center justify-between py-2 text-sm font-bold text-slate-800 hover:text-blue-600 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    Telegram
                  </span>
                  <span className="material-symbols-outlined text-[18px]">
                    {expandedSections.telegram ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {expandedSections.telegram && (
                  <div className="mt-3 animate-fade-in">
                    <TelegramFields
                      telegramUsername={telegramUsername}
                      telegramChatId={telegramChatId}
                      onUsernameChange={setTelegramUsername}
                      onChatIdChange={setTelegramChatId}
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveProfile({ preventDefault: () => {} })}
                      className="w-full mt-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-blue-100"
                    >
                      <span className="material-symbols-outlined text-[14px]">save</span>
                      Save Telegram Details
                    </button>
                  </div>
                )}
              </div>

              {/* Change Password Accordion */}
              <div className="border-b border-slate-100 pb-3">
                <button
                  type="button"
                  disabled={isForceChange}
                  onClick={() => !isForceChange && toggleSection('password')}
                  className={`w-full flex items-center justify-between py-2 text-sm font-bold transition-colors ${isForceChange ? 'text-red-650 cursor-not-allowed' : 'text-slate-800 hover:text-blue-600'}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">lock</span>
                    Change Password {isForceChange && <span className="text-red-500 text-[10px] font-black uppercase tracking-wider animate-pulse ml-2">(Required)</span>}
                  </span>
                  <span className="material-symbols-outlined text-[18px]">
                    {expandedSections.password ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                 {expandedSections.password && (
                  <form onSubmit={handleSavePassword} className="mt-3 space-y-3 animate-fade-in">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Password</label>
                      <input
                        type="password"
                        placeholder="Current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className={`bg-slate-50 border rounded-xl px-3.5 py-2.5 text-xs text-slate-700 outline-none focus:bg-white transition-all ${isForceChange ? 'border-red-500 ring-2 ring-red-200 animate-pulse' : 'border-slate-200/80 focus:border-blue-500'}`}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Password</label>
                      <input
                        type="password"
                        placeholder="New password (min 4 chars)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={`bg-slate-50 border rounded-xl px-3.5 py-2.5 text-xs text-slate-700 outline-none focus:bg-white transition-all ${isForceChange ? 'border-red-500 ring-2 ring-red-200 animate-pulse' : 'border-slate-200/80 focus:border-blue-500'}`}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Confirm New Password</label>
                      <input
                        type="password"
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`bg-slate-50 border rounded-xl px-3.5 py-2.5 text-xs text-slate-700 outline-none focus:bg-white transition-all ${isForceChange ? 'border-red-500 ring-2 ring-red-200 animate-pulse' : 'border-slate-200/80 focus:border-blue-500'}`}
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full mt-2 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[14px]">vpn_key</span>
                      Save Password
                    </button>
                  </form>
                )}
              </div>

              {/* Devices Accordion */}
              <div className="border-b border-slate-100 pb-3">
                <button
                  onClick={() => toggleSection('devices')}
                  className="w-full flex items-center justify-between py-2 text-sm font-bold text-slate-800 hover:text-blue-600 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">devices</span>
                    Devices
                  </span>
                  <span className="material-symbols-outlined text-[18px]">
                    {expandedSections.devices ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {expandedSections.devices && (
                  <div className="mt-3 space-y-3 animate-fade-in">
                    {activeDevices.length === 0 ? (
                      <p className="text-[10px] text-slate-400 font-bold p-3 bg-slate-50 rounded-2xl border border-slate-100">No active devices detected.</p>
                    ) : (
                      activeDevices.map(session => {
                        const dev = parseUA(session.device_info, session.connection_id, connectionId);
                        return (
                          <div key={session.connection_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                                <span className="material-symbols-outlined text-[20px]">{dev.icon}</span>
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="text-xs font-bold text-slate-800 truncate max-w-[150px]">{dev.deviceName}</h4>
                                  {dev.isCurrent && (
                                    <span className="bg-blue-100 text-blue-800 text-[8px] px-1.5 py-0.5 rounded font-black uppercase shrink-0">Current</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{dev.versionDetails}</p>
                              </div>
                            </div>
                            {dev.isCurrent && (
                              <button
                                onClick={handleEditDeviceName}
                                className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                                title="Edit device name"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Compensation Summary Accordion */}
              <div className="border-b border-slate-100 pb-3">
                <button
                  onClick={() => toggleSection('compensation')}
                  className="w-full flex items-center justify-between py-2 text-sm font-bold text-slate-800 hover:text-blue-600 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">payments</span>
                    Compensation Summary
                  </span>
                  <span className="material-symbols-outlined text-[18px]">
                    {expandedSections.compensation ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {expandedSections.compensation && (
                  <div className="mt-3 space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-600 animate-fade-in">
                    <div className="flex justify-between font-semibold">
                      <span>Basic Salary:</span>
                      <span className="font-extrabold text-slate-800">{currencySymbol}1,500 /mo</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Allowances:</span>
                      <span className="font-extrabold text-slate-800">{currencySymbol}200 /mo</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t border-slate-200/55 pt-2">
                      <span>Pension Contribution:</span>
                      <span className="font-extrabold text-slate-800">8.5%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Employee Benefits Accordion */}
              <div className="pb-1">
                <button
                  onClick={() => toggleSection('benefits')}
                  className="w-full flex items-center justify-between py-2 text-sm font-bold text-slate-800 hover:text-blue-600 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">volunteer_activism</span>
                    Employee Benefits
                  </span>
                  <span className="material-symbols-outlined text-[18px]">
                    {expandedSections.benefits ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {expandedSections.benefits && (
                  <div className="mt-3 space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-600 animate-fade-in">
                    <div className="flex items-center gap-2 font-bold text-slate-700">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      <span>Premium Medical Insurance</span>
                    </div>
                    <div className="flex items-center gap-2 font-bold text-slate-700">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      <span>22 Annual Leaves (Paid)</span>
                    </div>
                    <div className="flex items-center gap-2 font-bold text-slate-700">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      <span>Work from Home Allowance</span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* CENTER: PROGRESS CHART, TIMER & CALENDAR */}
          <div className="md:col-span-1 lg:col-span-6 flex flex-col gap-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Progress Chart Widget */}
              <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    Progress
                  </span>
                  <span className="material-symbols-outlined text-slate-400 text-[18px] hover:text-blue-600 cursor-pointer">north_east</span>
                </div>
                
                <div className="mb-4">
                  <span className="text-3xl font-black text-slate-800 leading-none">6.1 h</span>
                  <span className="text-[10px] text-slate-400 font-bold block mt-1">Work Time this week</span>
                </div>

                {/* Simulated Chart Bars */}
                <div className="flex items-end justify-between h-32 pt-2 px-1 select-none relative">
                  
                  {/* Tooltip bubble on active Friday bar */}
                  <div className="absolute top-[-8px] left-[61%] -translate-x-1/2 bg-[#1e293b] text-white text-[9px] font-black px-2 py-1 rounded-lg shadow-md animate-bounce z-10 flex items-center gap-0.5">
                    9h 21m
                  </div>

                  {[
                    { day: 'S', height: '15%', active: false },
                    { day: 'M', height: '45%', active: false },
                    { day: 'T', height: '35%', active: false },
                    { day: 'W', height: '60%', active: false },
                    { day: 'T', height: '55%', active: false },
                    { day: 'F', height: '85%', active: true },
                    { day: 'S', height: '25%', active: false }
                  ].map((bar, idx) => (
                    <div key={idx} className="flex flex-col items-center flex-1">
                      <div className="w-4 bg-slate-100 rounded-full h-24 flex items-end">
                        <div
                          className={`w-full rounded-full transition-all duration-500 ${
                            bar.active
                              ? 'bg-blue-600 shadow-md shadow-blue-200'
                              : 'bg-slate-800'
                          }`}
                          style={{ height: bar.height }}
                        ></div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 mt-2">{bar.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time Tracker circular timer Widget */}
              <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-between">
                <div className="w-full flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-800">Time tracker</span>
                  <span className="material-symbols-outlined text-slate-400 text-[18px] hover:text-blue-600 cursor-pointer">north_east</span>
                </div>

                {/* Circular timer container */}
                <div className="relative w-32 h-32 flex items-center justify-center my-2">
                  {/* SVG progress circle */}
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="stroke-slate-100 fill-none"
                      strokeWidth="8"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="stroke-blue-600 fill-none transition-all duration-300"
                      strokeWidth="8"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 - (251.2 * Math.min(timerSecs, 28800)) / 28800} // Percentage of 8h standard
                      strokeLinecap="round"
                    />
                  </svg>
                  
                  {/* Inside timer text */}
                  <div className="absolute text-center flex flex-col">
                    <div className="flex items-center justify-center font-black text-2xl text-slate-800 tracking-tight leading-none">
                      <span>{timeData.formatted}</span>
                      <span className={`text-slate-400 ml-0.5 text-xs font-medium self-end mb-0.5 ${isTimerRunning ? 'animate-pulse' : ''}`}>
                        {timeData.secondsFormatted}
                      </span>
                    </div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 mt-1 tracking-wider">Work Time</span>
                  </div>
                </div>

                {/* Controls row */}
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={handleTimerPlayPause}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-all active:scale-95 border border-slate-100"
                  >
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: isTimerRunning ? "'FILL' 1" : undefined }}>
                      {isTimerRunning ? 'pause' : 'play_arrow'}
                    </span>
                  </button>
                  <button
                    onClick={handleTimerReset}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-all active:scale-95 border border-slate-100"
                    title="Reset timer"
                  >
                    <span className="material-symbols-outlined text-[20px]">restart_alt</span>
                  </button>
                  <button
                    onClick={() => appAlert(`Current Session: ${timeData.totalFormatted} logged.`, 'info')}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-all active:scale-95 border border-slate-100"
                  >
                    <span className="material-symbols-outlined text-[18px]">alarm</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Calendar weekly Scheduler Widget */}
            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 flex flex-col">
              
              {/* Calendar header tabs */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <span className="text-slate-400 text-xs font-bold hover:text-slate-800 cursor-pointer">August</span>
                <span className="text-sm font-black text-slate-800 tracking-tight">September 2024</span>
                <span className="text-slate-400 text-xs font-bold hover:text-slate-800 cursor-pointer">October</span>
              </div>

              {/* Week Calendar timeline headers */}
              <div className="grid grid-cols-6 gap-2 text-center mb-6">
                {[
                  { day: 'Mon', num: 22, active: true },
                  { day: 'Tue', num: 23 },
                  { day: 'Wed', num: 24 },
                  { day: 'Thu', num: 25 },
                  { day: 'Fri', num: 26 },
                  { day: 'Sat', num: 27 }
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className={`py-2 rounded-2xl transition-all ${
                      item.active ? 'bg-slate-50 text-slate-800 font-extrabold' : 'text-slate-400'
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider">{item.day}</div>
                    <div className={`text-base font-extrabold mt-1 mx-auto w-7 h-7 flex items-center justify-center rounded-full ${item.active ? 'bg-slate-800 text-white' : ''}`}>
                      {item.num}
                    </div>
                  </div>
                ))}
              </div>

              {/* Hour block events representation */}
              <div className="space-y-4">
                
                {/* Event 1 */}
                <div className="flex items-start gap-4">
                  <span className="text-[10px] font-bold text-slate-400 w-14 pt-1 text-right shrink-0">8:00 am</span>
                  <div className="flex-grow border-t border-dashed border-slate-100 pt-3"></div>
                </div>

                {/* Event 2 (Active Team meeting span) */}
                <div className="flex items-start gap-4">
                  <span className="text-[10px] font-bold text-slate-400 w-14 pt-1.5 text-right shrink-0">9:00 am</span>
                  <div className="flex-grow bg-[#eff6ff] border-l-4 border-blue-600 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm shadow-blue-50/50">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Weekly Team Sync</h4>
                      <p className="text-[10px] text-slate-500 font-semibold mt-1">Discuss progress on enterprise client modules.</p>
                    </div>
                    {/* User avatars group */}
                    <div className="flex -space-x-2 shrink-0">
                      <img className="w-6 h-6 rounded-full object-cover border-2 border-white" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80" alt="Avatar" />
                      <img className="w-6 h-6 rounded-full object-cover border-2 border-white" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80" alt="Avatar" />
                      <img className="w-6 h-6 rounded-full object-cover border-2 border-white" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80" alt="Avatar" />
                    </div>
                  </div>
                </div>

                {/* Event 3 */}
                <div className="flex items-start gap-4">
                  <span className="text-[10px] font-bold text-slate-400 w-14 pt-1.5 text-right shrink-0">10:00 am</span>
                  <div className="flex-grow border-t border-dashed border-slate-100 pt-3"></div>
                </div>

                {/* Event 4 (Onboarding session block) */}
                <div className="flex items-start gap-4">
                  <span className="text-[10px] font-bold text-slate-400 w-14 pt-1.5 text-right shrink-0">11:00 am</span>
                  <div className="flex-grow bg-[#2563eb] text-white rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm shadow-blue-100/50">
                    <div>
                      <h4 className="text-xs font-bold text-white">Onboarding Session</h4>
                      <p className="text-[10px] text-white/80 font-medium mt-1">Introduction for newly hired employees.</p>
                    </div>
                    {/* User avatars group */}
                    <div className="flex -space-x-2 shrink-0">
                      <img className="w-6 h-6 rounded-full object-cover border-2 border-[#2563eb]" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80" alt="Avatar" />
                      <img className="w-6 h-6 rounded-full object-cover border-2 border-[#2563eb]" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80" alt="Avatar" />
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* RIGHT SIDEBAR: ONBOARDING METRIC & TASK CHECKLIST */}
          <div className="md:col-span-2 lg:col-span-3 flex flex-col gap-6">
            
            {/* Onboarding progress dial widget */}
            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-slate-800">Onboarding</span>
                <span className="text-sm font-extrabold text-blue-600">{onboardingPercentage}%</span>
              </div>

              {/* Segmented layout progress bar */}
              <div className="flex gap-1.5 h-3 items-center mb-4">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    onboardingPercentage >= 35 ? 'bg-blue-600 flex-[42]' : 'bg-slate-100 flex-[42]'
                  }`}
                ></div>
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    onboardingPercentage >= 60 ? 'bg-blue-600 flex-[25]' : 'bg-slate-100 flex-[25]'
                  }`}
                ></div>
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    onboardingPercentage >= 90 ? 'bg-blue-600 flex-[33]' : 'bg-slate-100 flex-[33]'
                  }`}
                ></div>
              </div>

              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Task completion status
              </span>
            </div>

            {/* Task list widget container */}
            <div className="bg-[#1e293b] text-white rounded-[32px] p-6 shadow-sm flex flex-col">
              
              <div className="flex items-center justify-between mb-6 pb-2 border-b border-white/10">
                <span className="text-sm font-bold text-white">Onboarding Task</span>
                <span className="text-lg font-black text-blue-400 tracking-tight">
                  {completedTasksCount}/{totalTasksCount}
                </span>
              </div>

              {/* Task Items Scrollable List */}
              <div className="space-y-4 max-h-[460px] overflow-y-auto custom-scrollbar hide-scrollbar pr-1">
                {tasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task.id)}
                    className="flex items-center justify-between gap-3 p-3.5 bg-slate-900/40 hover:bg-slate-900/70 border border-white/5 rounded-2xl cursor-pointer transition-all active:scale-[0.99] select-none"
                  >
                    <div className="min-w-0">
                      <h4
                        className={`text-xs font-bold text-slate-200 truncate ${
                          task.completed ? 'line-through opacity-50' : ''
                        }`}
                      >
                        {task.text}
                      </h4>
                      <p className="text-[9px] text-slate-400 font-semibold mt-1">{task.time}</p>
                    </div>
                    
                    {/* Checkbox button */}
                    <button
                      type="button"
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                        task.completed ? 'bg-blue-600 text-white shadow-sm' : 'border border-white/20 text-transparent'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px] font-extrabold">check</span>
                    </button>
                  </div>
                ))}
              </div>

            </div>

          </div>

        </div>

      </div>
    </Layout>
  );
}
