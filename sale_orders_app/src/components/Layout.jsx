import AICopilot from './ui/AICopilot';
import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { applyTheme } from '../utils/theme';

export default function Layout({ children, hideSidebar = false, subNavigation = null, subNavConfig = null, hasDashboardBackground = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isPinned, setIsPinned] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isAICopilotOpen, setIsAICopilotOpen] = useState(false);
  const [isThemeSwitching, setIsThemeSwitching] = useState(false);
  const { 
      state, 
      setState, 
      updateThemeSettings, 
      markAllNotificationsAsRead, 
      addWidget, 
      hasPermission, 
      addNotification, 
      logout,
      isOnline = true,
      networkQuality = 'good',
      syncStatus = 'idle'
  } = useApp() || { 
      state: { notifications: [] }, 
      setState: () => {}, 
      updateThemeSettings: () => {}, 
      addWidget: () => {}, 
      hasPermission: () => true, 
      addNotification: () => {}, 
      logout: () => {},
      isOnline: true,
      networkQuality: 'good',
      syncStatus: 'idle'
  };
  
  const isDarkMode = state?.themeSettings?.colorMode === 'dark';
  const toggleThemeMode = () => {
    setIsThemeSwitching(true);
    const nextMode = isDarkMode ? 'light' : 'dark';
    const nextSettings = {
      ...(state?.themeSettings || { primaryColor: 'tradingview', fontStyle: 'inter', borderRadius: 'rounded' }),
      colorMode: nextMode
    };

    // 1. Instant 0ms DOM mutation + transition trigger
    const root = document.documentElement;
    root.classList.add('theme-morphing');
    if (nextMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // 2. Synchronous theme application
    try {
      applyTheme(nextSettings);
    } catch (e) {
      console.warn('applyTheme error:', e);
    }

    // 3. Update application state
    if (typeof updateThemeSettings === 'function') {
      updateThemeSettings(nextSettings);
    } else if (typeof setState === 'function') {
      setState(prev => ({ ...prev, themeSettings: nextSettings }));
    }

    // 4. Direct localStorage synchronization for all user cache keys
    try {
      const username = state?.currentUser?.username || 'admin';
      localStorage.setItem(`themeSettings_${username}_web`, JSON.stringify(nextSettings));
      localStorage.setItem('themeSettings', JSON.stringify(nextSettings));
    } catch (e) {
      console.warn('LocalStorage theme sync error:', e);
    }

    // 5. Complete morphing animation after 450ms
    setTimeout(() => {
      root.classList.remove('theme-morphing');
      setIsThemeSwitching(false);
    }, 450);
  };
  const notifications = state?.notifications || [];
  const unreadCount = notifications.filter(n => !n.read).length;
  
  const sidebarPosition = state?.displaySettings?.sidebarPosition || 'left';
  const isPinnedActive = isPinned && sidebarPosition !== 'bottom';
  const showSecondary = isPinnedActive || isHovered;
  
  // Dynamic SubNav State
  const [searchQuery, setSearchQuery] = useState('');
  const [navItems, setNavItems] = useState([]);
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null); // For 3-dot menu
  const [draggingLayout, setDraggingLayout] = useState(null); // 'sidebar' | 'submenu' | null

  // --- MOBILE PREVIEW & PLATFORM COMPATIBILITY STATES ---
  const [isMobileSim, setIsMobileSim] = useState(() => localStorage.getItem('isMobileSim') === 'true');
  const [isLandscapeSim, setIsLandscapeSim] = useState(() => localStorage.getItem('isLandscapeSim') === 'true');
  const [isRealMobile, setIsRealMobile] = useState(window.innerWidth < 768);
  const [isLandscape, setIsLandscape] = useState(() => window.innerWidth > window.innerHeight);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [simTime, setSimTime] = useState('');

  const isInsideSimFrame = window.self !== window.top;
  const isChatRoute = location.pathname === '/chat';
  const isMobileView = isChatRoute && (isRealMobile || isInsideSimFrame || isMobileSim) && !(isLandscape || isLandscapeSim);

  // Dynamic Viewport Manager
  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) return;

    if (isMobileView) {
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    } else if (isRealMobile || isInsideSimFrame || isMobileSim) {
      viewportMeta.setAttribute('content', 'width=1280, initial-scale=0.3, maximum-scale=1.0, user-scalable=yes');
    } else {
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0');
    }

    return () => {
      const defaultMeta = document.querySelector('meta[name="viewport"]');
      if (defaultMeta) {
        defaultMeta.setAttribute('content', 'width=device-width, initial-scale=1.0');
      }
    };
  }, [isMobileView, isRealMobile, isInsideSimFrame, isMobileSim]);

  // Sync iframe URL to parent URL in real-time
  useEffect(() => {
    if (isInsideSimFrame) {
      const currentHref = location.pathname + location.search;
      if (window.parent.location.pathname + window.parent.location.search !== currentHref) {
        window.parent.history.replaceState(null, '', currentHref);
      }
    }
  }, [location, isInsideSimFrame]);

  useEffect(() => {
    const handleResize = () => {
      setIsRealMobile(window.innerWidth < 768);
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // run immediately
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      setSimTime(`${hours}:${minutes} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleMobileSim = () => {
    const nextVal = !isMobileSim;
    setIsMobileSim(nextVal);
    localStorage.setItem('isMobileSim', String(nextVal));
    if (nextVal) {
      addNotification('Mobile Sandbox', 'Simulated Android Environment Activated!', 'success');
    } else {
      addNotification('Mobile Sandbox', 'Returned to full desktop ERP view.', 'success');
    }
  };

  const handleToggleLandscapeSim = () => {
    const nextVal = !isLandscapeSim;
    setIsLandscapeSim(nextVal);
    localStorage.setItem('isLandscapeSim', String(nextVal));
    addNotification('Screen Rotation', nextVal ? 'Landscape Mode Activated!' : 'Portrait Mode Activated!', 'success');
  };

  const getScreenTitle = () => {
    const path = window.location.pathname;
    if (path.includes('/dashboard')) return 'Overview Dashboard';
    if (path.includes('/sale-orders')) return 'Sales Orders';
    if (path.includes('/sale-order-return')) return 'Sales Returns';
    if (path.includes('/production-flow')) return 'OMS Flow';
    if (path.includes('/production')) return 'Production Module';
    if (path.includes('/inventory')) return 'Inventory Stock';
    if (path.includes('/delivery-dashboard')) return 'Dispatch & Logistics';
    if (path.includes('/hr')) return 'HR Dashboard';
    if (path.includes('/admin-setup')) return 'User Access Control';
    if (path.includes('/settings')) return 'System Settings';
    if (path.includes('/theme')) return 'Theme Settings';
    if (path.includes('/document-warehouse')) return 'Document Warehouse';
    return 'Flashvision App';
  };

  const mobileBottomLinks = [
    { to: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
    { to: '/sale-orders', icon: 'shopping_cart', label: 'Sales' },
    { to: '/production-flow', icon: 'account_tree', label: 'OMS' },
    { to: '/delivery-dashboard', icon: 'local_shipping', label: 'Delivery' },
    { to: '/inventory', icon: 'inventory_2', label: 'Inventory' }
  ].filter(link => {
    if (link.to === '/dashboard') return hasPermission('dashboard');
    if (link.to === '/sale-orders') return hasPermission('salesOrders');
    if (link.to === '/production-flow') return hasPermission('oms');
    if (link.to === '/delivery-dashboard') return hasPermission('delivery');
    if (link.to === '/inventory') return hasPermission('inventory');
    return false;
  });

  const renderMobileShell = () => (
    <div className="mobile-viewport flex flex-col h-full w-full bg-background relative text-on-surface overflow-hidden">
      {/* Top App Bar */}
      <header className="h-14 bg-surface-container border-b border-outline-variant/30 px-4 flex items-center justify-between shrink-0 select-none z-50">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setDrawerOpen(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant leading-none">Flashvision</span>
            <span className="text-sm font-bold text-on-surface leading-tight truncate max-w-[155px]">{getScreenTitle()}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-high relative cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-error rounded-full ring-2 ring-surface-container animate-pulse"></span>
            )}
          </button>
          <button 
            type="button"
            onClick={toggleThemeMode} 
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-high cursor-pointer transition-colors"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Obsidian Dark"}
          >
            <span className={`material-symbols-outlined text-[20px] text-primary transition-transform duration-500 ${isThemeSwitching ? "rotate-180 scale-125" : ""}`}>
              {isDarkMode ? "light_mode" : "dark_mode"}
            </span>
          </button>
          <NavLink to="/theme" className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-high cursor-pointer">
            <span className="material-symbols-outlined text-[22px]">palette</span>
          </NavLink>
        </div>
      </header>

      {/* Slide-out Navigation Drawer Overlay */}
      {drawerOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] animate-fade-in cursor-pointer"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Slide-out Navigation Drawer Menu */}
      <aside 
        className={`fixed top-0 bottom-0 left-0 w-[290px] bg-surface-container-high z-[1001] flex flex-col shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* User Card Profile Header in Drawer */}
        <div 
          onClick={() => { 
            if (state.currentUser?.requirePasswordChange) {
              alert('Security Policy: You must change your temporary password first.');
              return;
            }
            setDrawerOpen(false); 
            navigate('/profile'); 
          }}
          className="p-6 bg-primary text-on-primary flex flex-col gap-3 relative overflow-hidden shrink-0 cursor-pointer active:opacity-90 transition-opacity"
          title="View Profile"
        >
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          <div className="flex justify-between items-start">
            <img className="w-14 h-14 rounded-full object-cover border-2 border-white/20 shadow-md" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCpE_7nq3cQA2WhQwuKWRDeRExnrwDZ2H4cLF9MyG5b8jJwrnmbawBaT3K0ZvtOEBBws0978SY6nNpxxcGodOkJF4gaHFTMaOSc2FXlK-TIZp-2Vgr33JIbpf0eUnfbhhr3MIq1NPxu47bJgK2ot6dCu1P9p381UKWpXqz30L-69ajlaIe17bTDt5BIAT4GFF2fOSyYtsb4IFTfqUvFtSShYTbXFw1paQT1RfoSsoH2r-XNYODxmk9Xc-XziXFtdFLNwzH_TJu_V1_6" alt="User Profile" />
            <button 
              onClick={(e) => { e.stopPropagation(); setDrawerOpen(false); }}
              className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center text-white hover:bg-black/20 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <div>
            <h4 className="text-base font-bold leading-tight text-white animate-fade-in">{state.currentUser?.name || 'Alex Sterling'}</h4>
            <p className="text-[11px] opacity-80 mt-0.5 text-white/90">{state.currentUser?.role || 'Logistics Director'}</p>
          </div>
        </div>

        {/* Drawer Links */}
        <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-1.5 custom-scrollbar mobile-screen-scroll">
          <div className="text-[10px] font-black tracking-widest text-on-surface-variant/60 uppercase mb-2 px-3">Main Menu</div>
          {navLinks.map(link => (
            <NavLink 
              key={link.to} 
              to={state.currentUser?.requirePasswordChange ? '#' : link.to}
              onClick={(e) => {
                if (state.currentUser?.requirePasswordChange) {
                  e.preventDefault();
                  alert('Security Policy: You must change your temporary password first.');
                  return;
                }
                setDrawerOpen(false);
              }}
              className={({ isActive }) => 
                `flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${isActive ? 'bg-primary/10 text-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : undefined }}>{link.icon}</span>
                  <span>{link.label}</span>
                </>
              )}
            </NavLink>
          ))}
          
          <div className="border-t border-outline-variant/20 my-3"></div>
          
          <div className="text-[10px] font-black tracking-widest text-on-surface-variant/60 uppercase mb-2 px-3">System</div>
          <NavLink 
            to="/settings"
            onClick={() => setDrawerOpen(false)}
            className={({ isActive }) => 
              `flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${isActive ? 'bg-primary/10 text-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'}`
            }
          >
            {({ isActive }) => (
              <>
                <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : undefined }}>settings</span>
                <span>Settings</span>
              </>
            )}
          </NavLink>
        </nav>

        {/* Drawer Sign Out Footer */}
        <div className="p-4 border-t border-outline-variant/15 shrink-0">
          <button 
            onClick={() => { setDrawerOpen(false); logout(); navigate('/login'); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-error/10 text-error hover:bg-error/15 font-bold text-sm transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Notifications overlay if active */}
      {showNotifications && (
        <div className="fixed inset-x-4 top-16 max-h-80 bg-surface border border-outline-variant/30 shadow-2xl rounded-2xl overflow-hidden z-[900] flex flex-col animate-slide-up">
          <div className="p-3 border-b border-outline-variant/15 flex justify-between items-center bg-surface-container-low">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllNotificationsAsRead} className="text-[10px] text-primary hover:underline font-semibold cursor-pointer">Mark all read</button>
            )}
          </div>
          <div className="overflow-y-auto custom-scrollbar flex-1 max-h-60 bg-surface-container-lowest/50 mobile-screen-scroll">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-on-surface-variant text-xs">No notifications</div>
            ) : (
              notifications.map(notif => (
                <div key={notif.id} className={`p-3 border-b border-outline-variant/5 last:border-0 hover:bg-surface-container-low transition-colors ${!notif.read ? 'bg-primary/5' : ''}`}>
                  <div className="flex gap-2 items-start">
                    <span className={`material-symbols-outlined text-base mt-0.5 ${notif.type === 'success' ? 'text-emerald-500' : notif.type === 'error' ? 'text-error' : 'text-primary'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                      {notif.type === 'success' ? 'check_circle' : notif.type === 'error' ? 'error' : 'info'}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-on-surface">{notif.title}</div>
                      <div className="text-[10px] text-on-surface-variant mt-0.5 leading-tight">{notif.message}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main Workspace Frame */}
      <main className={`flex-1 overflow-y-auto custom-scrollbar mobile-screen-scroll bg-surface relative ${isChatRoute ? 'p-0' : 'p-4 pb-6'}`}>
        <div className={`max-w-full ${isChatRoute ? 'h-full' : ''}`}>
          {children}
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="h-[64px] bg-surface-container border-t border-outline-variant/30 flex items-center justify-around z-50 select-none px-2 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] shrink-0">
        {mobileBottomLinks.map(link => {
          const isActive = window.location.pathname === link.to;
          return (
            <button
              key={link.to}
              onClick={() => {
                if (state.currentUser?.requirePasswordChange) {
                  alert('Security Policy: You must change your temporary password first.');
                  return;
                }
                navigate(link.to);
              }}
              className="flex flex-col items-center justify-center gap-1 flex-1 py-1 relative cursor-pointer"
            >
              <div className={`w-14 h-8 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-primary/15 text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}>
                <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : undefined }}>
                  {link.icon}
                </span>
              </div>
              <span className={`text-[10px] font-bold tracking-wide transition-all ${isActive ? 'text-primary font-extrabold' : 'text-on-surface-variant'}`}>{link.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );

  useEffect(() => {
    if (subNavConfig?.items && subNavConfig?.title) {
       const savedOrder = localStorage.getItem(`navOrder_${subNavConfig.title}`);
       if (savedOrder) {
           const orderedIds = JSON.parse(savedOrder);
           const orderedItems = [];
           const remainingItems = [...subNavConfig.items];
           orderedIds.forEach(id => {
               const idx = remainingItems.findIndex(i => i.id === id);
               if (idx > -1) {
                   orderedItems.push(remainingItems[idx]);
                   remainingItems.splice(idx, 1);
               }
           });
           setNavItems([...orderedItems, ...remainingItems]);
       } else {
           setNavItems(subNavConfig.items);
       }
    }
  }, [subNavConfig?.title]); // Removed subNavConfig?.items to prevent reset on re-render when items are recreated in parent

  const handleDragStart = (e, index) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    
    const newItems = [...navItems];
    const draggedItem = newItems[draggedItemIndex];
    newItems.splice(draggedItemIndex, 1);
    newItems.splice(index, 0, draggedItem);
    
    setNavItems(newItems);
    setDraggedItemIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
    if (subNavConfig?.title) {
        localStorage.setItem(`navOrder_${subNavConfig.title}`, JSON.stringify(navItems.map(i => i.id)));
    }
  };

  // Filter out nav items that the user doesn't have permission to see
  const moduleNameForSubnav = subNavConfig?.moduleName;
  const filteredNavItems = navItems
      .filter(item => {
          if (!moduleNameForSubnav) return true;
          const screenId = item.screenId || item.id;
          return hasPermission(moduleNameForSubnav, screenId);
      })
      .filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSaveAsWidget = (item) => {
      addWidget({
          type: 'app_icon',
          title: item.label,
          icon: item.icon,
          path: window.location.pathname + '?tab=' + item.id
      });
      setOpenMenuId(null);
  };

  const navLinks = [
    { to: '/dashboard', icon: 'dashboard', label: 'Dashboard', module: 'dashboard' },
    { to: '/sale-orders', icon: 'shopping_cart', label: 'Sales Orders', module: 'salesOrders' },
    { to: '/production-flow', icon: 'account_tree', label: 'OMS', module: 'oms' },
    { to: '/production', icon: 'precision_manufacturing', label: 'Production', module: 'productionPlanning' },
    { to: '/inventory', icon: 'inventory_2', label: 'Inventory', module: 'inventory' },
    { to: '/delivery-dashboard', icon: 'local_shipping', label: 'Delivery', module: 'delivery' },
    { to: '/finance', icon: 'account_balance_wallet', label: 'Finance', module: 'finance' },
    { to: '/hr', icon: 'badge', label: 'HR Dashboard', module: 'hr' },
    { to: '/chat', icon: 'chat', label: 'Chats', module: 'chat' },
    { to: '/admin-setup', icon: 'manage_accounts', label: 'User Control', module: 'userManagement' },
    { to: '/settings', icon: 'settings', label: 'Settings', module: 'settings' }
  ].filter(link => link.module === null || hasPermission(link.module));

  if (isMobileView) {
    if (hideSidebar) {
      return (
        <div className="mobile-viewport flex flex-col h-full w-full bg-background relative text-on-surface overflow-hidden">
          <main className="flex-1 overflow-y-auto custom-scrollbar mobile-screen-scroll bg-surface p-0 relative">
            <div className="max-w-full h-full">
              {children}
            </div>
          </main>
        </div>
      );
    }
    return renderMobileShell();
  }

  if (isChatRoute && !isMobileSim) {
    return (
      <div className="w-full h-full overflow-hidden bg-background relative">
        <main className="w-full h-full p-0 m-0 overflow-hidden relative">
          {children}
        </main>
      </div>
    );
  }

  if (isMobileSim && !isRealMobile && !isInsideSimFrame) {
    return (
      <div className="min-h-screen w-full bg-[#0d0e12] text-slate-100 flex flex-col lg:flex-row items-center justify-center p-6 gap-8 relative overflow-hidden font-body select-none">
        
        {/* Floating tech grid background */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[150px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none"></div>

        {/* Technical Info Panel Left */}
        <div className="w-full lg:w-[350px] shrink-0 flex flex-col gap-6 bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-6 rounded-[32px] shadow-xl relative z-10 select-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">developer_mode</span>
            </div>
            <div>
              <h2 className="text-base font-black tracking-wide leading-none text-white uppercase">MOBILE SANDBOX</h2>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 block">Live Emulation Suite</span>
            </div>
          </div>
          
          <div className="border-t border-slate-800/60 my-1"></div>
          
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Device Configuration</h3>
            
            <div className="bg-slate-950/50 rounded-2xl p-4 space-y-3 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">PLATFORM:</span>
                <span className="text-emerald-400 font-bold">Android 16.0 (AOSP)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">DEVICE:</span>
                <span className="text-slate-300">Simulated Pixel 9 Pro</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">VIEWPORT:</span>
                <span className="text-slate-300">385 x 790px (3.5x xhdpi)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">COMPATIBLE WITH:</span>
                <span className="text-indigo-400 font-bold">Android, iOS, Windows</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">CONNECTIVITY:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> Live (WiFi)
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Test Suite Control</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              Yeh app dynamic responsive core standard per design ki gayi hai jo har device layout par automatic run karegi. Is simulator ke bottom system buttons directly functional hain!
            </p>
          </div>

          <div className="flex flex-col gap-2.5 mt-2">
            <button 
              onClick={handleToggleLandscapeSim}
              className="w-full py-3.5 px-6 bg-slate-800 hover:bg-slate-750 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all border border-slate-700 active:scale-[0.98] shadow-md cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">screen_rotation</span>
              {isLandscapeSim ? 'Portrait Mode' : 'Landscape Mode'}
            </button>

            <button 
              onClick={handleToggleMobileSim}
              className="w-full py-3.5 px-6 bg-slate-800 hover:bg-slate-750 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all border border-slate-700 active:scale-[0.98] shadow-md cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">desktop_windows</span>
              Desktop ERP Version
            </button>
            
            <button 
              onClick={() => {
                navigate('/dashboard');
                addNotification('Mobile Sandbox', 'Simulated device rebooted!', 'success');
              }}
              className="w-full py-3.5 px-6 bg-primary/10 hover:bg-primary/20 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              Reset Simulated App
            </button>
          </div>
        </div>

        {/* Dynamic Simulated Android Phone Chassis */}
        <div className="relative z-10 flex items-center justify-center animate-fade-in">
          
          <div className={`android-frame ${isLandscapeSim ? 'landscape' : ''}`}>
            {/* Volume and Power Buttons on Chassis side */}
            <div className="android-volume-rocker"></div>
            <div className="android-power-btn"></div>
            {/* Camera Punchhole and Speaker Grill */}
            <div className="android-camera-punch"></div>
            <div className="android-speaker-grill"></div>
            
            <div className="android-screen-container bg-[#111216]">
              {/* Simulated Status Bar */}
              <div className="android-status-bar text-white shrink-0 select-none">
                <span className="font-semibold text-xs tracking-wider">{simTime}</span>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">network_wifi</span>
                  <span className="material-symbols-outlined text-[14px]">signal_cellular_4_bar</span>
                  <span className="font-bold text-[10px] bg-white/20 px-1 rounded leading-none">5G</span>
                  <span className="material-symbols-outlined text-[15px] rotate-90 leading-none">battery_charging_full</span>
                </div>
              </div>

              {/* Real App rendering inside simulated screen */}
              <div className="flex-1 relative overflow-hidden bg-background">
                <iframe 
                  key={location.pathname + location.search}
                  src={location.pathname + location.search} 
                  title="Mobile Sandbox Simulator"
                  className="w-full h-full border-0" 
                />
              </div>

              {/* Simulated Android System Navigation Buttons */}
              <div className="android-nav-bar shrink-0">
                {/* BACK KEY: Triangle */}
                <button 
                  onClick={() => navigate(-1)}
                  className="android-nav-btn text-white/70 hover:text-white cursor-pointer"
                  title="System Back"
                >
                  <span className="material-symbols-outlined text-[20px] rotate-180" style={{ fontVariationSettings: "'wght' 300" }}>play_arrow</span>
                </button>
                
                {/* HOME KEY: Circle */}
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="android-nav-btn text-white/70 hover:text-white cursor-pointer"
                  title="System Home"
                >
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 700" }}>circle</span>
                </button>
                
                {/* RECENTS KEY: Square */}
                <button 
                  onClick={() => {
                    addNotification('System Sandbox', 'Background cached memory flushed.', 'success');
                  }}
                  className="android-nav-btn text-white/70 hover:text-white cursor-pointer"
                  title="System Recents"
                >
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}>square</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Sub-menu alignment hamesha main sidebar ke position ke mutabiq hogi
  const subMenuPosition = sidebarPosition === 'left' ? 'left' : (sidebarPosition === 'right' ? 'right' : 'center');
  
  // Sidebar bottom position par horizontal hogi
  const isSidebarHorizontal = sidebarPosition === 'bottom';
  const isSubMenuHorizontal = false;

  const getSubMenuProps = () => {
    const isSubSecondaryVisible = showSecondary && (!!subNavConfig || !!subNavigation);
    
    let positionStyle = {};
    let classNames = "fixed bg-surface/80 backdrop-blur-2xl rounded-[36px] shadow-sm border border-outline-variant/20 z-40 flex overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] print:hidden";

    if (subMenuPosition === 'left') {
      const leftOffset = (sidebarPosition === 'left') ? '112px' : '24px';
      positionStyle = {
        left: leftOffset,
        top: '24px',
        bottom: '24px',
        width: '280px',
        transform: isSubSecondaryVisible ? 'translateX(0)' : 'translateX(-150%)',
        opacity: isSubSecondaryVisible ? 1 : 0,
        pointerEvents: isSubSecondaryVisible ? 'auto' : 'none'
      };
      classNames += " flex-col";
    } else if (subMenuPosition === 'right') {
      const rightOffset = (sidebarPosition === 'right') ? '112px' : '24px';
      positionStyle = {
        right: rightOffset,
        top: '24px',
        bottom: '24px',
        width: '280px',
        transform: isSubSecondaryVisible ? 'translateX(0)' : 'translateX(150%)',
        opacity: isSubSecondaryVisible ? 1 : 0,
        pointerEvents: isSubSecondaryVisible ? 'auto' : 'none'
      };
      classNames += " flex-col";
    } else if (subMenuPosition === 'center') {
      // Position above the bottom rail when sidebar is at the bottom
      positionStyle = {
        left: '50%',
        bottom: '112px',
        width: '380px',
        height: 'auto',
        maxHeight: '660px',
        transform: isSubSecondaryVisible ? 'translate(-50%, 0) scale(1)' : 'translate(-50%, 20px) scale(0.95)',
        opacity: isSubSecondaryVisible ? 1 : 0,
        pointerEvents: isSubSecondaryVisible ? 'auto' : 'none'
      };
      classNames += " flex-col";
    }
    
    return { className: classNames, style: positionStyle };
  };

  const subMenuProps = getSubMenuProps();

  // Main canvas margins / paddings
  const getWorkspaceStyles = () => {
    let pl = 0;
    let pr = 0;
    let pt = 0;
    let pb = 0;
    
    if (hideSidebar) {
      return { paddingLeft: 0, paddingRight: 0, paddingTop: '1.5rem', paddingBottom: 0 };
    }
    
    // Sidebar offsets
    if (sidebarPosition === 'left') pl += 112;
    else if (sidebarPosition === 'right') pr += 112;
    else if (sidebarPosition === 'bottom') pb += 112;
    
    // Sub-menu offsets if visible
    const hasSub = !!subNavConfig || !!subNavigation;
    const isSubOpen = hasSub && showSecondary;
    if (isSubOpen) {
      if (subMenuPosition === 'left') pl += 280;
      else if (subMenuPosition === 'right') pr += 280;
      else if (subMenuPosition === 'center') {
        if (isPinned) {
          pb += 420; // offset the pinned bottom menu height
        }
      }
    }
    
    return {
      paddingLeft: pl ? `${pl}px` : '0',
      paddingRight: pr ? `${pr}px` : '0',
      paddingTop: pt ? `${pt + 24}px` : '1.5rem',
      paddingBottom: pb ? `${pb}px` : '0'
    };
  };

  const workspaceStyles = getWorkspaceStyles();

  const handleSidebarClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Restrictions: Left, Right, Bottom positions only
    const positions = ['left', 'right', 'bottom'];
    const currentIndex = positions.indexOf(sidebarPosition);
    const nextIndex = (currentIndex + 1) % positions.length;
    const nextPosition = positions[nextIndex];
    
    setState(prev => {
      const nextDisplay = {
        ...(prev.displaySettings || { webScale: 75, mobileScale: 100 }),
        sidebarPosition: nextPosition
      };
      return {
        ...prev,
        displaySettings: nextDisplay
      };
    });
    addNotification('Layout Updated', `Sidebar shifted clockwise to ${nextPosition.toUpperCase()}.`, 'success');
  };

  const handleLayoutDrop = (targetPosition) => {
    if (!draggingLayout) return;
    
    setState(prev => {
      const nextDisplay = {
        ...(prev.displaySettings || { webScale: 75, mobileScale: 100 }),
        [draggingLayout === 'sidebar' ? 'sidebarPosition' : 'subMenuPosition']: targetPosition
      };
      return {
        ...prev,
        displaySettings: nextDisplay
      };
    });
    
    addNotification('Layout Updated', `${draggingLayout === 'sidebar' ? 'Sidebar' : 'Sub-menu'} moved to ${targetPosition.toUpperCase()}.`, 'success');
    setDraggingLayout(null);
  };

  return (
    <div 
      className={`text-on-surface overflow-hidden flex h-full min-h-full bg-background relative ${isSidebarHorizontal ? 'flex-col' : 'flex-row'}`}
      style={{
        backgroundImage: hasDashboardBackground && state?.dashboardBackground ? `url(${state.dashboardBackground})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {hasDashboardBackground && state?.dashboardBackground && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-0 pointer-events-none"></div>
      )}
      
      {/* Primary Icon Rail (Floating Pills) & Hover Hitbox */}
      {!hideSidebar && (
        <div 
          className={`fixed z-50 print:hidden ${
            sidebarPosition === 'left' ? 'left-0 top-0 bottom-0 w-[112px]' :
            sidebarPosition === 'right' ? 'right-0 top-0 bottom-0 w-[112px]' :
            'bottom-0 left-1/2 -translate-x-1/2 h-[112px] w-[calc(100vh-48px)] max-w-[calc(100vw-48px)] pointer-events-none'
          }`}
          onMouseEnter={() => {
            if (sidebarPosition !== 'bottom') {
              setIsHovered(true);
            }
          }}
        >
          <aside className={`absolute pointer-events-auto ${
            sidebarPosition === 'left' ? 'left-6 top-6 bottom-6 w-[72px] flex-col' :
            sidebarPosition === 'right' ? 'right-6 top-6 bottom-6 w-[72px] flex-col' :
            'left-6 right-6 bottom-6 h-[72px] flex-row'
          } flex gap-4`}>
            <div className={`flex-1 module-control-panel-glow rounded-[36px] flex ${isSidebarHorizontal ? 'flex-row px-6 py-0' : 'flex-col py-6 px-0'} items-center gap-6 overflow-auto hide-scrollbar`}>
              <div 
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', 'sidebar');
                  setTimeout(() => {
                    setDraggingLayout('sidebar');
                  }, 0);
                }}
                onDragEnd={() => setDraggingLayout(null)}
                onClick={() => setIsAICopilotOpen(prev => !prev)}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${isSidebarHorizontal ? '' : 'mb-2'} shrink-0 bg-transparent overflow-hidden cursor-pointer hover:scale-110 active:scale-95 transition-transform ring-2 ring-cyan-400/40 hover:ring-cyan-400 shadow-cyan-500/20`}
                title="FlashVision AI Brain (Voice & Document Assistant) - Click to Open"
              >
                <img src="/favicon.svg" alt="Flashvision Logo" className="w-full h-full object-cover pointer-events-none" />
              </div>
              
              <nav className={`flex ${isSidebarHorizontal ? 'flex-row' : 'flex-col'} gap-3 items-center`}>
                {navLinks.map(link => (
                  <NavLink 
                    key={link.to} 
                    to={state.currentUser?.requirePasswordChange ? '#' : link.to} 
                    onClick={(e) => {
                      if (state.currentUser?.requirePasswordChange) {
                        e.preventDefault();
                        alert('Security Policy: You must change your temporary password first.');
                        return;
                      }
                      if (sidebarPosition === 'bottom') {
                        const isActive = location.pathname === link.to;
                        if (isActive) {
                          setIsHovered(prev => !prev);
                        } else {
                          setIsHovered(true);
                        }
                      }
                    }}
                    className={({ isActive }) => 
                      `w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group relative cursor-pointer ${
                        isActive 
                          ? 'bg-gradient-to-tr from-primary to-blue-500 text-white shadow-[0_0_20px_rgba(41,98,255,0.45)] ring-1 ring-white/30 scale-105' 
                          : 'text-on-surface-variant bg-surface-container-low/40 hover:bg-surface-container-highest hover:text-primary hover:scale-105 hover:shadow-[0_0_14px_rgba(41,98,255,0.18)]'
                      }`
                    } 
                    title={link.label}
                  >
                    {({ isActive }) => (
                      <>
                        <span className="material-symbols-outlined text-[24px] transition-transform duration-300 group-hover:scale-115" style={{ fontVariationSettings: isActive ? "'FILL' 1" : undefined }}>{link.icon}</span>
                        {isActive && !isSidebarHorizontal && (
                          <span className="absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] pointer-events-none" />
                        )}
                        {isActive && isSidebarHorizontal && (
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] pointer-events-none" />
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </nav>
            </div>
            
            <div className={`${isSidebarHorizontal ? 'h-[72px] px-2' : 'w-[72px] py-2 min-h-[110px]'} shrink-0 module-control-panel-glow rounded-[36px] flex ${isSidebarHorizontal ? 'flex-row' : 'flex-col'} items-center justify-center gap-1.5`}>
              <button 
                type="button"
                onClick={toggleThemeMode} 
                className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 text-on-surface-variant hover:bg-surface-container-highest hover:text-primary cursor-pointer group active:scale-90"
                title={isDarkMode ? 'Switch to Frosted Light Mode' : 'Switch to Obsidian Dark Mode'}
              >
                <span className={`material-symbols-outlined text-[20px] transition-transform duration-500 ${isThemeSwitching ? 'rotate-180 scale-125' : 'group-hover:rotate-45'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                  {isDarkMode ? 'light_mode' : 'dark_mode'}
                </span>
              </button>
              {hasPermission('settings') && (
                  <NavLink 
                    to={state.currentUser?.requirePasswordChange ? '#' : "/settings"} 
                    onClick={(e) => {
                      if (state.currentUser?.requirePasswordChange) {
                        e.preventDefault();
                        alert('Security Policy: You must change your temporary password first.');
                        return;
                      }
                      if (sidebarPosition === 'bottom') {
                        const isActive = location.pathname === '/settings';
                        if (isActive) {
                          setIsHovered(prev => !prev);
                        } else {
                          setIsHovered(true);
                        }
                      }
                    }}
                    className={({ isActive }) => `w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    isActive 
                      ? 'bg-gradient-to-tr from-primary to-blue-500 text-white shadow-[0_0_20px_rgba(41,98,255,0.45)] ring-1 ring-white/30 scale-105' 
                      : 'text-on-surface-variant bg-surface-container-low/40 hover:bg-surface-container-highest hover:text-primary group hover:shadow-[0_0_14px_rgba(41,98,255,0.18)]'
                  }`} 
                    title="Settings"
                  >
                    <span className="material-symbols-outlined text-[24px] transition-transform duration-300 group-hover:rotate-90" style={{ fontVariationSettings: "'FILL' 1" }}>settings</span>
                  </NavLink>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Secondary Context Panel (Glassmorphic) */}
      {!hideSidebar && (
        <div 
          className={subMenuProps.className}
          style={subMenuProps.style}
        >
          {isSubMenuHorizontal ? (
            <div className="flex flex-row items-center w-full h-full justify-between gap-6 px-6 py-2 select-none relative" onClick={() => setOpenMenuId(null)}>
               {/* User Profile & Search */}
               <div className="flex flex-row items-center gap-4 shrink-0 max-w-[340px]">
                  <div 
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', 'submenu');
                      setTimeout(() => {
                        setDraggingLayout('submenu');
                      }, 0);
                    }}
                    onDragEnd={() => setDraggingLayout(null)}
                    onClick={handleSubMenuClick}
                    className="flex items-center gap-3 cursor-pointer hover:bg-surface-container-low/50 transition-colors p-2 rounded-xl"
                    title="Click to change Position (Clockwise) or Drag"
                  >
                    <div 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (state.currentUser?.requirePasswordChange) {
                          alert('Security Policy: You must change your temporary password first.');
                          return;
                        }
                        navigate('/profile'); 
                      }}
                      className="w-8 h-8 rounded-full overflow-hidden border border-primary-fixed hover:ring-2 hover:ring-primary transition-all shrink-0 cursor-pointer"
                      title="View Profile"
                    >
                      <img className="w-full h-full object-cover pointer-events-none" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCpE_7nq3cQA2WhQwuKWRDeRExnrwDZ2H4cLF9MyG5b8jJwrnmbawBaT3K0ZvtOEBBws0978SY6nNpxxcGodOkJF4gaHFTMaOSc2FXlK-TIZp-2Vgr33JIbpf0eUnfbhhr3MIq1NPxu47bJgK2ot6dCu1P9p381UKWpXqz30L-69ajlaIe17bTDt5BIAT4GFF2fOSyYtsb4IFTfqUvFtSShYTbXFw1paQT1RfoSsoH2r-XNYODxmk9Xc-XziXFtdFLNwzH_TJu_V1_6" alt="User Profile" />
                    </div>
                    <div className="min-w-0 leading-tight">
                      <p className="text-xs font-bold text-on-surface truncate">{state.currentUser?.name || 'Alex Sterling'}</p>
                      <p className="text-[10px] text-on-surface-variant truncate">{state.currentUser?.role || 'Logistics Director'}</p>
                    </div>
                  </div>
                  
                  <button 
                     onClick={(e) => { e.stopPropagation(); setIsPinned(!isPinned); }}
                     className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isPinned ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                     title={isPinned ? "Unpin sidebar" : "Pin sidebar"}
                  >
                    <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: isPinned ? "'FILL' 1" : undefined }}>push_pin</span>
                  </button>
                  
                  <div className="relative w-40 group">
                    <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-[14px] group-focus-within:text-primary transition-colors">search</span>
                    <input 
                      className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg pl-7 pr-2 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none placeholder:text-on-surface-variant/50 transition-all text-on-surface" 
                      placeholder="Search..." 
                      type="text" 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
               </div>

               {/* Middle Section: Navigation Rails */}
               <div className="flex-1 overflow-x-auto custom-scrollbar flex items-center px-4 gap-2">
                  {subNavConfig ? (
                     <div className="flex flex-row gap-2 items-center min-w-max">
                        <div className="text-[10px] font-black tracking-widest text-on-surface-variant uppercase mr-2">{subNavConfig.title}</div>
                        {filteredNavItems.map((item, index) => (
                            <div 
                               key={item.id} 
                               className="relative flex items-center group shrink-0"
                               draggable
                               onDragStart={(e) => handleDragStart(e, index)}
                               onDragOver={(e) => handleDragOver(e, index)}
                               onDragEnd={handleDragEnd}
                            >
                                <button 
                                    onClick={() => subNavConfig.onSelect(item.id)} 
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${subNavConfig.activeId === item.id ? 'bg-primary/10 text-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'}`}
                                >
                                    <span className="material-symbols-outlined cursor-grab active:cursor-grabbing text-[14px] opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity" title="Drag to reorder">drag_indicator</span>
                                    <span className="material-symbols-outlined text-[16px] -ml-1" style={{ fontVariationSettings: subNavConfig.activeId === item.id ? "'FILL' 1" : undefined }}>
                                      {item.icon}
                                    </span>
                                    <span className="truncate max-w-[100px]">{item.label}</span>
                                </button>
                                <div className="relative">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === item.id ? null : item.id); }}
                                        className="w-6 h-6 flex items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">more_vert</span>
                                    </button>
                                    {openMenuId === item.id && (
                                        <div className="absolute right-0 top-full mt-1 bg-surface border border-outline-variant/20 shadow-xl rounded-xl overflow-hidden z-50 w-40 py-1" onClick={(e) => e.stopPropagation()}>
                                            <button 
                                                onClick={() => handleSaveAsWidget(item)}
                                                className="w-full text-left px-3 py-1.5 text-[10px] font-semibold text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-1.5"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">widgets</span>
                                                Save as Widget
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {filteredNavItems.length === 0 && (
                            <div className="text-on-surface-variant text-[11px] italic px-4">No matching screens</div>
                        )}
                     </div>
                  ) : subNavigation ? (
                      <div className="flex flex-row gap-2 items-center min-w-max">{subNavigation}</div>
                  ) : (
                     <div className="text-on-surface-variant text-[11px] italic px-4 flex items-center gap-1.5">
                         <span className="material-symbols-outlined text-[16px]">menu_open</span>
                         Select a module
                     </div>
                  )}
               </div>

               {/* Right Section: Actions */}
               <div className="flex flex-row items-center gap-2 shrink-0">
                 
                 <button 
                     type="button"
                     onClick={toggleThemeMode}
                     className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                     title={isDarkMode ? "Switch to Light Mode" : "Switch to Obsidian Dark"}
                 >
                     <span className={`material-symbols-outlined text-[18px] transition-transform duration-500 ${isThemeSwitching ? "rotate-180 scale-125" : ""}`}>
                       {isDarkMode ? "light_mode" : "dark_mode"}
                     </span>
                 </button>
                 <NavLink to="/theme" onClick={() => !isPinned && setIsHovered(false)} className={({ isActive }) => `w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isActive ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:text-primary hover:bg-primary/5'}`} title="Theme">
                     <span className="material-symbols-outlined text-[18px]">palette</span>
                 </NavLink>
                 <button 
                     onClick={() => { logout(); navigate('/login'); }}
                     className="w-8 h-8 rounded-lg flex items-center justify-center text-error hover:bg-error/5 transition-colors"
                     title="Sign Out"
                 >
                     <span className="material-symbols-outlined text-[18px]">logout</span>
                 </button>
               </div>
            </div>
          ) : (
            <>
              <div className="p-6 flex items-center justify-between border-b border-outline-variant/10">
                <div 
                  onClick={() => {
                    if (state.currentUser?.requirePasswordChange) {
                      alert('Security Policy: You must change your temporary password first.');
                      return;
                    }
                    navigate('/profile');
                  }}
                  className="flex items-center gap-3 p-2 rounded-xl cursor-pointer hover:bg-surface-container-high/50 transition-colors"
                  title="View Profile"
                >
                  <img className="w-10 h-10 rounded-full object-cover border-2 border-primary-fixed pointer-events-none" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCpE_7nq3cQA2WhQwuKWRDeRExnrwDZ2H4cLF9MyG5b8jJwrnmbawBaT3K0ZvtOEBBws0978SY6nNpxxcGodOkJF4gaHFTMaOSc2FXlK-TIZp-2Vgr33JIbpf0eUnfbhhr3MIq1NPxu47bJgK2ot6dCu1P9p381UKWpXqz30L-69ajlaIe17bTDt5BIAT4GFF2fOSyYtsb4IFTfqUvFtSShYTbXFw1paQT1RfoSsoH2r-XNYODxmk9Xc-XziXFtdFLNwzH_TJu_V1_6" alt="User Profile" />
                  <div className="flex-1 min-w-0 leading-tight">
                    <p className="text-sm font-bold text-on-surface truncate">{state.currentUser?.name || 'Alex Sterling'}</p>
                    <p className="text-[11px] text-on-surface-variant truncate">{state.currentUser?.role || 'Logistics Director'}</p>
                  </div>
                </div>
                  <div className="flex flex-col items-center gap-2">
                   {sidebarPosition !== 'bottom' && (
                     <button 
                        onClick={(e) => { e.stopPropagation(); setIsPinned(!isPinned); }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isPinned ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                        title={isPinned ? "Unpin sidebar" : "Pin sidebar"}
                     >
                       <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: isPinned ? "'FILL' 1" : undefined }}>push_pin</span>
                     </button>
                   )}
                   {/* WiFi Connection Indicator below pin button */}
                   <div className="flex items-center gap-1 mt-1 cursor-help" title={!isOnline ? 'Offline' : (networkQuality === 'slow' ? 'Slow Connection' : 'Connected to Cloud')}>
                       <span className={`material-symbols-outlined text-[18px] transition-colors duration-300 ${!isOnline ? 'text-error animate-pulse' : (networkQuality === 'slow' ? 'text-warning animate-pulse' : 'text-success')}`}>
                           {!isOnline ? 'wifi_off' : (networkQuality === 'slow' ? 'signal_wifi_bad' : 'wifi')}
                       </span>
                       {(!isOnline || networkQuality === 'slow') && (
                           <span className="text-[10px] font-black tracking-wider uppercase text-error">
                               Offline
                           </span>
                       )}
                   </div>
                 </div>
              </div>

              {/* Search Area */}
              <div className="p-4 border-b border-outline-variant/10">
                <div className="relative w-full group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] group-focus-within:text-primary transition-colors">search</span>
                  <input 
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none placeholder:text-on-surface-variant/50 transition-all text-on-surface" 
                    placeholder="Search..." 
                    type="text" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Dynamic Sub-Navigation Area */}
              <div 
                className="flex-1 overflow-y-auto custom-scrollbar p-4" 
                style={sidebarPosition === 'bottom' ? { maxHeight: '440px' } : undefined}
                onClick={() => setOpenMenuId(null)}
              >
                 {subNavConfig ? (
                    <div className="flex flex-col gap-1">
                        <div className="text-[10px] font-black tracking-widest text-on-surface-variant uppercase mb-2 px-3 mt-2">{subNavConfig.title}</div>
                        {filteredNavItems.map((item, index) => (
                            <div 
                               key={item.id} 
                               className="relative flex items-center group"
                               draggable
                               onDragStart={(e) => handleDragStart(e, index)}
                               onDragOver={(e) => handleDragOver(e, index)}
                               onDragEnd={handleDragEnd}
                            >
                                <button 
                                    onClick={() => subNavConfig.onSelect(item.id)} 
                                    className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${subNavConfig.activeId === item.id ? 'bg-primary/10 text-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'}`}
                                >
                                    <span className="material-symbols-outlined cursor-grab active:cursor-grabbing text-[16px] opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity" title="Drag to reorder">drag_indicator</span>
                                    <span className="material-symbols-outlined text-[18px] -ml-2" style={{ fontVariationSettings: subNavConfig.activeId === item.id ? "'FILL' 1" : undefined }}>
                                      {item.icon}
                                    </span>
                                    <span className="truncate text-left flex-1">{item.label}</span>
                                </button>
                                <div className="relative">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === item.id ? null : item.id); }}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">more_vert</span>
                                    </button>
                                    {openMenuId === item.id && (
                                        <div className="absolute right-0 top-full mt-1 bg-surface border border-outline-variant/20 shadow-xl rounded-xl overflow-hidden z-50 w-48 py-1" onClick={(e) => e.stopPropagation()}>
                                            <button 
                                                onClick={() => handleSaveAsWidget(item)}
                                                className="w-full text-left px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">widgets</span>
                                                Save as Widget
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {filteredNavItems.length === 0 && (
                            <div className="text-center py-6 text-on-surface-variant text-xs">No matching screens</div>
                        )}
                    </div>
                 ) : subNavigation ? (
                     subNavigation
                 ) : (
                    <div className="text-center py-10 opacity-50 flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-[32px]">space_dashboard</span>
                        <span className="text-xs font-medium">Select a module</span>
                    </div>
                 )}
              </div>
              
              {/* Quick Action Links */}
              <div className="p-4 border-t border-outline-variant/10 flex gap-2">
                 <button 
                     type="button"
                     onClick={toggleThemeMode}
                     className="flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-colors text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary hover:bg-primary/5 cursor-pointer"
                     title={isDarkMode ? "Switch to Light Mode" : "Switch to Obsidian Dark"}
                 >
                     <span className={`material-symbols-outlined text-[18px] transition-transform duration-500 ${isThemeSwitching ? "rotate-180 scale-125" : ""}`}>
                       {isDarkMode ? "light_mode" : "dark_mode"}
                     </span>
                     {isDarkMode ? "Light" : "Dark"}
                 </button>
                 <NavLink to="/theme" onClick={() => !isPinnedActive && setIsHovered(false)} className={({ isActive }) => `flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-colors text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:text-primary hover:bg-primary/5'}`}>
                     <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>palette</span>
                     Theme
                 </NavLink>
                 <button 
                     onClick={() => { logout(); navigate('/login'); }}
                     className="flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-error/80 hover:text-error hover:bg-error/5 transition-colors text-[10px] font-bold uppercase tracking-wider"
                 >
                     <span className="material-symbols-outlined text-[18px]">logout</span>
                     Sign Out
                 </button>
              </div>
            </>
          )}
        </div>
      )}

      <main 
        onClick={() => { if (!isPinnedActive) setIsHovered(false); setShowNotifications(false); }}
        style={workspaceStyles}
        className={`flex-grow flex flex-col relative overflow-y-auto w-full max-h-full h-full transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)] cursor-default print:!p-0 print:bg-white print:max-h-none print:overflow-visible print:block ${
          hasDashboardBackground ? 'bg-transparent' : 'bg-background'
        }`}
      >
        <div className={`w-full relative z-10 print:p-0 print:pr-0 transition-all duration-300 ${(location.pathname === '/document-warehouse' || (location.pathname === '/dashboard' && location.search.includes('tab=e-files')) || location.pathname.startsWith('/inventory') || location.pathname.startsWith('/production')) ? 'p-1.5 md:p-3 pr-3 space-y-2 max-w-full flex-1 flex flex-col min-h-0' : isSidebarHorizontal ? 'p-0 space-y-0 max-w-full' : (location.pathname === '/production-flow' || location.pathname.startsWith('/hr')) ? 'p-2 md:p-4 pr-4 space-y-4 max-w-full' : 'p-6 lg:p-8 pr-10 space-y-6 max-w-full'}`}>
          {children}
        </div>

        {/* Footer Attribution/Meta */}
        {!hideSidebar && location.pathname !== '/document-warehouse' && !location.search.includes('tab=e-files') && (
          <footer className={`mt-auto px-6 ${location.pathname.startsWith('/inventory') || location.pathname.startsWith('/production') ? 'pt-2 pb-3' : 'pt-6 pb-8'} flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest relative z-10 print:hidden`}>
            <p>© 2024 {state?.adminSetup?.companyName?.toUpperCase() || 'FLASHVISION LOGISTICS'}</p>
            <div className="flex gap-6">
              <a className="hover:text-primary transition-colors" href="#">Legal & Compliance</a>
              <span className="text-on-surface-variant/70">Powered by Flashvision</span>
            </div>
          </footer>
        )}

        {/* Visual Polish: Decorative Gradient Glows */}
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full pointer-events-none z-0 print:hidden"></div>
        <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-tertiary/5 blur-[100px] rounded-full pointer-events-none z-0 print:hidden"></div>
      </main>

      {/* Drag & Drop Overlays */}
      {draggingLayout && (
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/10 backdrop-blur-[2px] transition-all duration-300"
          onDragOver={(e) => e.preventDefault()}
        >
            {/* Bottom Drop Zone */}
            <div 
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-primary/20', 'scale-[1.02]'); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove('bg-primary/20', 'scale-[1.02]'); }}
              onDrop={() => handleLayoutDrop('bottom')}
              className="pointer-events-auto absolute bottom-4 left-4 right-4 h-24 bg-surface-container-high/80 backdrop-blur-md border-2 border-dashed border-primary rounded-2xl flex items-center justify-center text-on-surface font-bold transition-all shadow-lg text-sm"
            >
              Drop to position at BOTTOM
            </div>
            
            {/* Left Drop Zone */}
            <div 
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-primary/20', 'scale-[1.02]'); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove('bg-primary/20', 'scale-[1.02]'); }}
              onDrop={() => handleLayoutDrop('left')}
              className="pointer-events-auto absolute top-32 bottom-32 left-4 w-48 bg-surface-container-high/80 backdrop-blur-md border-2 border-dashed border-primary rounded-2xl flex items-center justify-center text-on-surface font-bold transition-all shadow-lg text-center px-4 text-sm"
            >
              <div className="flex flex-col items-center">
                <span>Drop to position at LEFT</span>
              </div>
            </div>
            
            {/* Right Drop Zone */}
            <div 
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-primary/20', 'scale-[1.02]'); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove('bg-primary/20', 'scale-[1.02]'); }}
              onDrop={() => handleLayoutDrop('right')}
              className="pointer-events-auto absolute top-32 bottom-32 right-4 w-48 bg-surface-container-high/80 backdrop-blur-md border-2 border-dashed border-primary rounded-2xl flex items-center justify-center text-on-surface font-bold transition-all shadow-lg text-center px-4 text-sm"
            >
              <div className="flex flex-col items-center">
                <span>Drop to position at RIGHT</span>
              </div>
            </div>
        </div>
      )}

      {/* Floating Mobile Mode toggle button restored for local testing */}
      {!isRealMobile && !isInsideSimFrame && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
        <button
          onClick={handleToggleMobileSim}
          className="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full bg-primary hover:bg-primary-container text-white shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all print:hidden"
          title="Toggle Mobile Sandbox Preview"
        >
          <span className="material-symbols-outlined text-[24px]">
            {isMobileSim ? 'desktop_windows' : 'phone_android'}
          </span>
        </button>
      )}
      <AICopilot isOpen={isAICopilotOpen} onClose={() => setIsAICopilotOpen(false)} />
    </div>
  );
}
