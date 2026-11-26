import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initPWA } from './services/pwaService';
import './index.css';

// Initialize PWA / Service Worker (with auto-rollback if disabled)
initPWA();

// Fix iOS Safari / mobile WebKit fixed-position repaint glitch on rotation
if (typeof window !== 'undefined') {
  const syncViewportAndRepaint = () => {
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }

    // Force compositor layer refresh on fixed UI elements
    const fixedEls = document.querySelectorAll<HTMLElement>(
      '.time-controller-card, header, .saved-locations-bar, .details-panel-drawer'
    );
    fixedEls.forEach((el) => {
      el.style.webkitTransform = 'translate3d(0, 0, 0)';
      el.style.transform = 'translate3d(0, 0, 0)';
    });
  };

  window.addEventListener('orientationchange', () => {
    syncViewportAndRepaint();
    setTimeout(syncViewportAndRepaint, 100);
    setTimeout(syncViewportAndRepaint, 300);
  });

  window.addEventListener('resize', () => {
    window.scrollTo(0, 0);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
