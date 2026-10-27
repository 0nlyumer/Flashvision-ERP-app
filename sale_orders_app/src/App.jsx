import React, { useState, useEffect, lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, useLocation, useRouteError, Outlet } from 'react-router-dom';
import GlobalNavGuard from './components/GlobalNavGuard';
import { useApp } from './context/AppContext';
import CallingOverlay from './components/CallingOverlay';
import PageLoadingSkeleton from './components/ui/PageLoadingSkeleton';

// Fast synchronous load for initial entry
import Login from './pages/Login';

// High-Performance Dynamic Code Splitting for enterprise modules
//
// Chunk-load resilience (fix run D, 2026-10-28): a route chunk that
// fails to load — the classic case is a browser holding the previous
// deploy's index.html, whose hashed chunk URLs no longer exist after a
// new deploy, or a momentary network drop — used to throw the user
// straight onto the route error screen on FIRST landing after login
// (a manual reload fixed it, exactly as reported). Each lazy import now
// retries once after a short pause, and if it still fails, performs ONE
// guarded full reload (which fetches the fresh index.html) before
// giving up to the error boundary.
const lazyWithRetry = (importFn, name) => lazy(async () => {
  const flag = `fv_chunk_reloaded_${name}`;
  try {
    const mod = await importFn();
    try { sessionStorage.removeItem(flag); } catch (e) {}
    return mod;
  } catch (firstError) {
    await new Promise(r => setTimeout(r, 700));
    try {
      const mod = await importFn();
      try { sessionStorage.removeItem(flag); } catch (e) {}
      return mod;
    } catch (secondError) {
      let alreadyReloaded = false;
      try { alreadyReloaded = sessionStorage.getItem(flag) === '1'; } catch (e) {}
      if (!alreadyReloaded) {
        try { sessionStorage.setItem(flag, '1'); } catch (e) {}
        window.location.reload();
        // Never resolves — the reload replaces this page.
        return new Promise(() => {});
      }
      throw secondError;
    }
  }
});

const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'), 'Dashboard');
const SaleOrderModule = lazyWithRetry(() => import('./pages/SaleOrderModule'), 'SaleOrderModule');
const SaleOrderReturn = lazyWithRetry(() => import('./pages/SaleOrderReturn'), 'SaleOrderReturn');
const DeliveryDashboard = lazyWithRetry(() => import('./pages/DeliveryDashboard'), 'DeliveryDashboard');
const InventoryDashboard = lazyWithRetry(() => import('./pages/InventoryDashboard'), 'InventoryDashboard');
const ProductionOMS = lazyWithRetry(() => import('./pages/ProductionOMS'), 'ProductionOMS');
const ProductionModule = lazyWithRetry(() => import('./pages/ProductionModule'), 'ProductionModule');
const UserControlDashboard = lazyWithRetry(() => import('./pages/UserControlDashboard'), 'UserControlDashboard');
const SettingsDashboard = lazyWithRetry(() => import('./pages/SettingsDashboard'), 'SettingsDashboard');
const ThemeSettings = lazyWithRetry(() => import('./pages/ThemeSettings'), 'ThemeSettings');
const HRModule = lazyWithRetry(() => import('./pages/HRModule'), 'HRModule');
const DocumentWarehouse = lazyWithRetry(() => import('./pages/DocumentWarehouse'), 'DocumentWarehouse');
const ChatModule = lazyWithRetry(() => import('./pages/ChatModule'), 'ChatModule');
const FinanceModule = lazyWithRetry(() => import('./pages/FinanceModule'), 'FinanceModule');
const FlashAM = lazyWithRetry(() => import('./pages/FlashAM'), 'FlashAM');
const UserProfile = lazyWithRetry(() => import('./pages/UserProfile'), 'UserProfile');

const RootLayout = () => {
  const { isOnline, networkQuality, syncStatus } = useApp() || { isOnline: true, networkQuality: 'good', syncStatus: 'idle' };
  const [showNotification, setShowNotification] = useState(false);
  const [lastState, setLastState] = useState({ isOnline: true, networkQuality: 'good' });
  const [notificationMsg, setNotificationMsg] = useState('');
  const [notificationType, setNotificationType] = useState('info'); // 'info' | 'success' | 'warning'

  const location = useLocation();
  useEffect(() => {
    window.dispatchEvent(new Event('fv_chat_scale_changed'));
  }, [location.pathname]);

  useEffect(() => {
    const handleSessionExpired = (e) => {
      const reason = e?.detail?.reason || 'session_expired';
      setNotificationMsg(
        reason === 'inactivity_timeout' 
          ? "Session locked due to 60 minutes of inactivity. Please sign in again."
          : reason === 'concurrent_device_login'
          ? "Security Alert: You have been logged out because your account was logged in on another device."
          : "Session expired or invalidated. Please sign in to continue."
      );
      setNotificationType("warning");
      setShowNotification(true);
      setTimeout(() => {
        window.location.href = '/login?reason=' + encodeURIComponent(reason);
      }, 1400);
    };

    window.addEventListener('fv_session_expired', handleSessionExpired);
    return () => window.removeEventListener('fv_session_expired', handleSessionExpired);
  }, []);

  useEffect(() => {
      // 1. Detect transition from Online -> Offline
      if (!isOnline && lastState.isOnline) {
          setNotificationMsg("Connection Lost. Working in local offline mode.");
          setNotificationType("warning");
          setShowNotification(true);
          const t = setTimeout(() => setShowNotification(false), 5000);
          setLastState(prev => ({ ...prev, isOnline: false }));
          return () => clearTimeout(t);
      }
      
      // 2. Detect transition from Offline -> Online
      if (isOnline && !lastState.isOnline) {
          setNotificationMsg("Back Online! Synchronizing all changes with cloud database...");
          setNotificationType("success");
          setShowNotification(true);
          const t = setTimeout(() => setShowNotification(false), 5000);
          setLastState(prev => ({ ...prev, isOnline: true }));
          return () => clearTimeout(t);
      }

      // Update network quality state quietly without intrusive toast popups
      if (isOnline && networkQuality !== lastState.networkQuality) {
          setLastState(prev => ({ ...prev, networkQuality }));
      }
  }, [isOnline, networkQuality]);

  return (
    <>
      <GlobalNavGuard />
      <Suspense fallback={<PageLoadingSkeleton message="Opening workspace..." />}>
        <Outlet />
      </Suspense>
      <CallingOverlay />

      {/* Floating Center Notification Alert */}
      {showNotification && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3.5 bg-surface-container-lowest/90 backdrop-blur-xl border border-outline-variant/30 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-6 duration-300">
              <span className={`material-symbols-outlined text-[20px] ${notificationType === 'success' ? 'text-success' : 'text-warning animate-pulse'}`}>
                  {notificationType === 'success' ? 'check_circle' : 'warning'}
              </span>
              <p className="text-sm font-semibold text-on-surface font-manrope">
                  {notificationMsg}
              </p>
          </div>
      )}

      {/* Non-intrusive, auto-recovering Network Status Pill */}
      {(syncStatus === 'slow_retry' || syncStatus === 'offline_retry' || !isOnline) && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top duration-300">
              <div className="bg-slate-900/95 text-white border border-slate-700/60 rounded-full px-5 py-2.5 shadow-2xl backdrop-blur-md flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </span>
                  <div className="text-xs font-semibold font-manrope flex items-center gap-2">
                      <span>
                          {syncStatus === 'offline_retry' || !isOnline 
                              ? 'Connecting to cloud... (Working offline)' 
                              : 'Slow Network detected... Retrying save'}
                      </span>
                  </div>
                  <button
                      onClick={() => {
                          const { triggerSyncWrite } = useApp ? useApp() : {};
                          if (triggerSyncWrite) triggerSyncWrite();
                      }}
                      className="ml-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1 rounded-full transition-colors active:scale-95 shadow-sm"
                  >
                      Retry Now
                  </button>
              </div>
          </div>
      )}
    </>
  );
};

const ProtectedRoute = ({ children, moduleName }) => {
  const { hasPermission, state, isSessionValid } = useApp();
  const location = useLocation();
  
  // Strictly enforce authenticated user and valid cryptographic session token
  const storedUserRaw = typeof window !== 'undefined' ? (localStorage.getItem('aj_current_user') || sessionStorage.getItem('aj_current_user')) : null;
  const storedUser = storedUserRaw ? (() => { try { return JSON.parse(storedUserRaw); } catch(e) { return null; } })() : null;
  const effectiveUser = state?.currentUser || storedUser;

  const hasUser = Boolean(
    effectiveUser || 
    storedUserRaw ||
    sessionStorage.getItem('AjSyntheticSession') || 
    localStorage.getItem('AjSyntheticSession')
  );

  if (!hasUser || (isSessionValid && !isSessionValid() && !storedUser)) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (effectiveUser?.requirePasswordChange && location.pathname !== '/profile') {
    return <Navigate to="/profile?forceChange=true" replace />;
  }

  if (import.meta.env.VITE_APP_MODE === 'chat' && location.pathname !== '/chat' && location.pathname !== '/profile') {
    return <Navigate to="/chat" replace />;
  }

  if (moduleName) {
    const isGranted = (effectiveUser?.role === 'Super Admin') || 
                      (Array.isArray(effectiveUser?.permissions) && effectiveUser.permissions.includes(moduleName)) ||
                      (effectiveUser?.permissions && typeof effectiveUser.permissions === 'object' && !!effectiveUser.permissions[moduleName]) ||
                      hasPermission(moduleName);

    if (!isGranted) {
      const canDashboard = (effectiveUser?.role === 'Super Admin') || 
                           (Array.isArray(effectiveUser?.permissions) && effectiveUser.permissions.includes('dashboard')) ||
                           hasPermission('dashboard');
      if (canDashboard) {
        return <Navigate to="/dashboard" replace />;
      }
      return <Navigate to="/settings" replace />;
    }
  }

  return children;
};

const IndexRedirect = () => {
  // Dedicated Native Android APK auto-launch for Flash AM Attendance Terminal
  const isFlashAMNative = typeof window !== 'undefined' && (
    window.isCapacitorNative ||
    window.__FLASH_AM_MODE__ ||
    window.AndroidBiometrics !== undefined ||
    window.AndroidFileSaver !== undefined ||
    window.AndroidPrint !== undefined ||
    Boolean(window.Capacitor) ||
    window.location.search.includes('mode=flasham') ||
    localStorage.getItem('flasham_standalone') === 'true' ||
    import.meta.env.VITE_APP_MODE === 'flasham' ||
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && (!window.location.port || window.location.port === '80' || window.location.port === '443'))
  );
  if (isFlashAMNative) {
    return <Navigate to="/flash-am" replace />;
  }

  const { state, hasPermission, isSessionValid } = useApp();
  const isValidSession = state?.currentUser && (!isSessionValid || isSessionValid());
  if (isValidSession) {
    if (state.currentUser.requirePasswordChange) {
      return <Navigate to="/profile?forceChange=true" replace />;
    }
    if (import.meta.env.VITE_APP_MODE === 'chat' && hasPermission('chat')) {
      return <Navigate to="/chat" replace />;
    }
    if (hasPermission('dashboard')) {
      return <Navigate to="/dashboard" replace />;
    }
    if (hasPermission('chat')) {
      return <Navigate to="/chat" replace />;
    }
    return <Navigate to="/settings" replace />;
  }
  return <Navigate to="/login" replace />;
};


function RouteErrorBoundary() {
  const location = useLocation();
  const error = useRouteError();
  console.error('RouteErrorBoundary captured error:', error);

  // Redesigned in the app's own design language (fix run G, 2026-10-28):
  // the previous hard-coded navy/slate screen with a cyan→blue gradient
  // button matched nothing else in the ERP. This version uses the active
  // theme's Material tokens throughout, so it follows whatever theme
  // the user has selected.
  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[28px] p-8 max-w-lg w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-14 h-14 rounded-2xl bg-error-container text-on-error-container mx-auto flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl">error</span>
        </div>
        <div className="space-y-1.5">
          <h2 className="font-headline text-xl font-black tracking-tight">Something went wrong</h2>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            This screen couldn&rsquo;t be loaded. Your data is safe — reloading the page usually
            fixes it. If it keeps happening, please note what you were doing and inform your
            administrator.
          </p>
        </div>
        {error && (
          <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-3 text-left max-h-36 overflow-y-auto">
            <p className="text-[11px] font-mono text-error font-semibold break-all">
              {error?.message || error?.statusText || String(error)}
            </p>
          </div>
        )}
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={() => {
              if (window.caches) {
                caches.keys().then(names => {
                  names.forEach(name => caches.delete(name));
                });
              }
              window.location.reload();
            }}
            className="px-6 py-2.5 bg-primary text-on-primary hover:opacity-90 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            Reload Page
          </button>
          <a
            href="/dashboard"
            className="px-5 py-2.5 bg-secondary-container text-on-secondary-container hover:opacity-90 rounded-xl text-xs font-bold transition-all flex items-center"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mt-6">FlashVision ERP</p>
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: "/", element: <IndexRedirect /> },
      { path: "/login", element: <Login /> },
      { path: "/dashboard", element: <ProtectedRoute moduleName="dashboard"><Dashboard /></ProtectedRoute> },
      { path: "/sale-orders", element: <ProtectedRoute moduleName="salesOrders"><SaleOrderModule /></ProtectedRoute> },
      { path: "/sale-order-return", element: <ProtectedRoute moduleName="salesOrders"><SaleOrderReturn /></ProtectedRoute> },
      { path: "/delivery-dashboard", element: <ProtectedRoute moduleName="delivery"><DeliveryDashboard /></ProtectedRoute> },
      { path: "/inventory", element: <ProtectedRoute moduleName="inventory"><InventoryDashboard /></ProtectedRoute> },
      { path: "/production-flow", element: <ProtectedRoute moduleName="oms"><ProductionOMS /></ProtectedRoute> },
      { path: "/production", element: <ProtectedRoute moduleName="productionPlanning"><ProductionModule /></ProtectedRoute> },
      { path: "/finance", element: <ProtectedRoute moduleName="finance"><FinanceModule /></ProtectedRoute> },
      { path: "/admin-setup", element: <ProtectedRoute moduleName="userManagement"><UserControlDashboard /></ProtectedRoute> },
      { path: "/settings", element: <ProtectedRoute moduleName="settings"><SettingsDashboard /></ProtectedRoute> },
      { path: "/theme", element: <ProtectedRoute moduleName="settings"><ThemeSettings /></ProtectedRoute> },
      { path: "/hr", element: <ProtectedRoute moduleName="hr"><HRModule /></ProtectedRoute> },
      { path: "/flash-am", element: <Suspense fallback={<PageLoadingSkeleton />}><FlashAM /></Suspense> },
      { path: "/flasham", element: <Navigate to="/flash-am" replace /> },
      { path: "/document-warehouse", element: <ProtectedRoute moduleName="files"><DocumentWarehouse /></ProtectedRoute> },
      { path: "/chat", element: <ProtectedRoute moduleName="chat"><ChatModule /></ProtectedRoute> },
      { path: "/profile", element: <ProtectedRoute><UserProfile /></ProtectedRoute> }
    ]
  }
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
