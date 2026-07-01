import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import i18n from './i18n';
import { initPlatformClasses } from './utils/platform';
import './index.css';

async function bootstrap() {
  initPlatformClasses();
  // In dev, remove stale service workers from earlier production builds
  if (import.meta.env.DEV && 'serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
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
