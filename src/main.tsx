import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import i18n from './i18n';
import { initPlatformClasses } from './utils/platform';
import { initAppPreferences } from './services/appPreferences';
import { ensureCloudServerConfigured } from './services/cloudConfig';
import './index.css';
import './styles/animations.css';
import './styles/theme-advanced.css';
import './styles/auth-pro.css';
import './styles/settings-pro.css';
import './styles/interior-pro.css';
import './styles/dashboard-pro.css';
import './styles/dukaan-pro.css';
import './styles/godaam-pro.css';
import './styles/customers-pro.css';
import './styles/stock-pro.css';
import './styles/easy-ui.css';
import './styles/mobile-pro.css';
import './styles/export.css';
import './styles/landing.css';

async function bootstrap() {
  initPlatformClasses();
  initAppPreferences();
  // Pin live cloud API for mobile APK / Capacitor (https://patiwala.pk)
  ensureCloudServerConfigured();

  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (import.meta.env.DEV) {
        await Promise.all(regs.map((r) => r.unregister()));
      } else {
        // Force update so laptop picks up new API routes (old SW cached hanging /api/server)
        await Promise.all(regs.map(async (r) => {
          await r.update();
          if (r.waiting) r.waiting.postMessage({ type: 'SKIP_WAITING' });
        }));
      }
    } catch {
      /* ignore */
    }
  }

  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => /workbox|precache|patiwala-ledger-v[12]/i.test(k))
          .map((k) => caches.delete(k)),
      );
    } catch {
      /* ignore */
    }
  }

  const root = document.getElementById('root');
  if (!root) return;

  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <I18nextProvider i18n={i18n}>
          <App />
        </I18nextProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}

bootstrap();
