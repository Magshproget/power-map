import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initPWA } from './services/pwaService';
import './index.css';

// Initialize PWA / Service Worker (with auto-rollback if disabled)
initPWA();

// Lock orientation to portrait if supported natively (Android Chrome / PWA)
if (typeof screen !== 'undefined' && screen.orientation && (screen.orientation as any).lock) {
  (screen.orientation as any).lock('portrait-primary').catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
