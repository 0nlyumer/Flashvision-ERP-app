import { initAutoContrastDetector } from './utils/contrastDetector';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AppProvider } from './context/AppContext'
import { DialogProvider } from './context/DialogContext'

// Global native print bridge interceptor for Android WebView
if (window.AndroidPrint && typeof window.AndroidPrint.print === 'function') {
  window.print = function() {
    window.AndroidPrint.print();
  };
}

// Start Real-Time Automatic UI Text Contrast & Visibility Detection Engine
initAutoContrastDetector();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProvider>
      <DialogProvider>
        <App />
      </DialogProvider>
    </AppProvider>
  </StrictMode>,
)
