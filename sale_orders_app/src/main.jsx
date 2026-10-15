import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AppProvider } from './context/AppContext';
import { DialogProvider } from './context/DialogContext';

// Global native print bridge interceptor for Android WebView
try {
  if (typeof window !== 'undefined' && window.AndroidPrint) {
    window.print = function() {
      if (typeof window.AndroidPrint.print === 'function') {
        window.AndroidPrint.print();
      }
    };
  }
} catch (e) {
  console.warn("Print bridge notice:", e);
}

// Safe Start of Automatic UI Text Contrast & Visibility Detection Engine
try {
  import('./utils/contrastDetector').then(({ initAutoContrastDetector }) => {
    if (typeof initAutoContrastDetector === 'function') {
      initAutoContrastDetector();
    }
  }).catch(() => {});
} catch (e) {
  console.warn("Contrast detector notice:", e);
}

// Top-Level Error Boundary to prevent black screen in mobile / browser
class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Critical Root React Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#090d16',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center'
        }}>
          <div style={{
            background: '#121927',
            border: '1px solid #1e293b',
            borderRadius: '24px',
            padding: '32px',
            maxWidth: '420px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#06b6d4', margin: '0 0 8px 0' }}>FLASH AM TERMINAL</h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px 0' }}>An unexpected error occurred while initializing the view.</p>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #4f46e5)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 24px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Restart Terminal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <RootErrorBoundary>
      <AppProvider>
        <DialogProvider>
          <App />
        </DialogProvider>
      </AppProvider>
    </RootErrorBoundary>
  );
}
